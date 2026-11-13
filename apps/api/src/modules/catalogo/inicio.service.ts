import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MAX_FUNDADORAS,
  normalizarTexto,
  PUBLICACIONES_INICIO_NORMAL,
  RECIEN_INICIO,
  RECIEN_POR_FILA,
  RECIEN_POR_PAGINA,
  type ChapitaInicio,
  type FaseInicio,
  type RespuestaInicio,
  type RespuestaRecienInicio,
  type RespuestaRecienLlegados,
  type TarjetaInicio,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { tiendasBloqueadasPor } from '../../shared/bloqueadas';
import { destacadasAhora } from '../../shared/destacados';
import { fundadorasDelDia } from '../../shared/fundadoras';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { recordarPor } from '../../shared/memoria';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { BusquedaService } from './busqueda.service';
import {
  CatalogoService,
  OFERTA_VIGENTE,
  PRODUCTO_TARJETA,
  SELECT_OFERTA_CON_VENDEDOR,
  tarjetaConVendedor,
} from './catalogo.service';
import { ofertasMasBaratasDeLaGaleria } from './mas-barato';
import {
  BAJO_DE_PRECIO,
  chapitaDe,
  compararPorPuntos,
  MAXIMO_INICIO,
  MUY_BUSCADO_CUANTOS,
  MUY_BUSCADO_MINIMO,
  MUY_BUSCADO_POR_PEDIDO,
  ORDEN_INICIO_MS,
  ordenarConTope,
  puntosDe,
  puntosDeResenas,
  RESPONDE_RAPIDO_MINUTOS,
  VENTANA_INICIO,
} from './puntos-inicio';
import { reputacionCorta } from './reputacion-corta';

// `mezclarSinRepetir` vive con el resto del orden del Inicio (doc 20, punto 4b).
export { mezclarSinRepetir } from './puntos-inicio';

/** «Con 20 tiendas, aquí vas a encontrar casi todo» (N16). */
export const META_TIENDAS = 20;
/** Desde cuántas publicaciones de otras tiendas el inicio es el de todos los días (N16). */
export const PUBLICACIONES_NORMAL = PUBLICACIONES_INICIO_NORMAL;
const MAS_PEDIDO = 4;
/** «Recién llegados» cuenta como máximo lo de las últimas 24 h (N07, mejora 20). */
const RECIEN_LLEGADOS_MS = 24 * 60 * 60 * 1000;
/** La banda «¿Conoces una tienda…?» del inicio vuelve a salir a los 2 días de su X (doc 19, 14). */
export const INVITAR_VUELVE_MS = 2 * 24 * 60 * 60 * 1000;

/** Una publicación en el orden del Inicio, ya con sus puntos y su chapita. */
interface EnElOrden {
  id: string;
  tiendaId: string;
  creadaEn: Date;
  puntos: number;
  chapita: ChapitaInicio | null;
  /** Cuánto bajó, en céntimos de su moneda, si bajó en las últimas 48 h. */
  bajoCentimos: number | null;
}

/** «DA» para «Dark Alien Planeta», «A» para «Tienda A». */
function iniciales(nombre: string): string {
  return (
    nombre
      .replace(/^tienda\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0] ?? '')
      .join('')
      .toUpperCase() || '·'
  );
}

/**
 * El inicio de una tienda (N16, N15): crece solo. Sin nada publicado por las demás, bienvenida,
 * precios protegidos, lo que más se pide y primeros pasos; de 1 a 11, lo nuevo en lista con
 * «Van N de 12»; desde 12, el inicio normal: una sola grilla de 5 por fila y 4 filas, con
 * paginación, ordenada por puntos y con tope por tienda en cada fila (doc 20, puntos 4, 22 y 4b).
 * Al llegar a 12 se guarda el hito en la tienda y ya no vuelve atrás.
 */
@Injectable()
export class InicioService {
  /** Soles por dólar, solo para comparar «Más barato de la galería» (TIPO_CAMBIO). */
  private readonly tipoCambio: number;
  /**
   * El orden por puntos de todo lo vigente (doc 20, punto 4b): 60 s en memoria, igual para
   * todos. Cada tienda que mira saca después las suyas y las que bloqueó.
   */
  private readonly ordenEnMemoria = recordarPor(ORDEN_INICIO_MS, () => this.calcularOrden());

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
    @Inject(BusquedaService) private readonly busqueda: BusquedaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.tipoCambio = config.get('TIPO_CAMBIO', { infer: true });
  }

  /** El inicio es de las cuentas con tienda (dueño o asesor): el equipo no tiene. */
  private deTienda(mirada: Mirada): { tiendaId: string; usuarioId: string } {
    if (!mirada.tiendaId || !mirada.usuarioId) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'El inicio de tienda es para cuentas con tienda.',
      );
    }
    return { tiendaId: mirada.tiendaId, usuarioId: mirada.usuarioId };
  }

  /** Lo vigente y con stock de las demás tiendas, sin las que bloqueaste. */
  private deOtras(tiendaId: string, bloqueadas: string[]): Prisma.OfertaWhereInput {
    return {
      AND: [
        OFERTA_VIGENTE,
        { stock: { gt: 0 } },
        { tiendaId: { notIn: [tiendaId, ...bloqueadas] } },
      ],
    };
  }

  async inicio(mirada: Mirada): Promise<RespuestaInicio> {
    const { tiendaId, usuarioId } = this.deTienda(mirada);
    const bloqueadas = await tiendasBloqueadasPor(this.prisma, usuarioId);
    const [tienda, usuario, publicaciones, deSeguidas, masPedido, tiendas, pasos, fundadoras] =
      await Promise.all([
        this.prisma.tienda.findUniqueOrThrow({
          where: { id: tiendaId },
          select: { inicioNormalEn: true },
        }),
        this.prisma.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { invitarCerradoEn: true },
        }),
        this.prisma.oferta.count({ where: this.deOtras(tiendaId, bloqueadas) }),
        this.catalogo.deSeguidas(mirada),
        this.masPedido(tiendaId),
        this.tiendas(tiendaId, bloqueadas),
        this.pasos(tiendaId),
        this.fundadoras(),
      ]);

    // «Cambia solo y no vuelve atrás»: el hito queda en la tienda la primera vez que llega a 12.
    let normal = tienda.inicioNormalEn !== null;
    if (!normal && publicaciones >= PUBLICACIONES_NORMAL) {
      await this.prisma.tienda.updateMany({
        where: { id: tiendaId, inicioNormalEn: null },
        data: { inicioNormalEn: new Date() },
      });
      normal = true;
    }
    const fase: FaseInicio = normal ? 'NORMAL' : publicaciones === 0 ? 'DIA_1' : 'POCAS';
    const pagina =
      fase === 'DIA_1'
        ? null
        : await this.pagina(
            mirada,
            bloqueadas,
            1,
            fase === 'POCAS' ? PUBLICACIONES_NORMAL - 1 : RECIEN_INICIO,
          );
    return {
      fase,
      de_seguidas: deSeguidas,
      mas_pedido: masPedido,
      tiendas,
      fundadoras,
      pasos,
      publicaciones,
      recien: pagina?.tarjetas ?? [],
      // Es el mismo conteo que `publicaciones`: lo vigente de las demás, sin las bloqueadas.
      total: publicaciones,
      total_paginas: pagina?.total_paginas ?? 0,
      en_paginas: pagina?.en_paginas ?? 0,
      invitar_cerrado:
        usuario.invitarCerradoEn !== null &&
        Date.now() - usuario.invitarCerradoEn.getTime() < INVITAR_VUELVE_MS,
    };
  }

  /** `‹ 1 2 3 … 7 Siguiente ›`: una página del Inicio, de a 20 (doc 20, punto 4). */
  async recien(mirada: Mirada, pagina: number): Promise<RespuestaRecienInicio> {
    const { usuarioId } = this.deTienda(mirada);
    const bloqueadas = await tiendasBloqueadasPor(this.prisma, usuarioId);
    return this.pagina(mirada, bloqueadas, pagina, RECIEN_POR_PAGINA);
  }

  /**
   * Una página del Inicio (doc 20, puntos 4 y 4b). El orden por puntos es el mismo para todos
   * (60 s en memoria); de ahí se sacan las tuyas y las que bloqueaste, se reparte en filas de 5
   * con el tope por tienda y se corta la página. Como el orden no depende de la página, la 3
   * sigue donde terminó la 2.
   */
  private async pagina(
    mirada: Mirada,
    bloqueadas: string[],
    pagina: number,
    cuantas: number,
  ): Promise<RespuestaRecienInicio> {
    const tiendaId = mirada.tiendaId ?? '';
    const fuera = new Set([tiendaId, ...bloqueadas]);
    const [orden, total, socios] = await Promise.all([
      this.ordenEnMemoria(),
      this.prisma.oferta.count({ where: this.deOtras(tiendaId, bloqueadas) }),
      tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId),
    ]);
    const enFilas = ordenarConTope(
      orden.filter((item) => !fuera.has(item.tiendaId)),
      RECIEN_POR_FILA,
    );
    const elegidas = enFilas.slice((pagina - 1) * cuantas, pagina * cuantas);
    const completas = await this.prisma.oferta.findMany({
      where: { id: { in: elegidas.map((item) => item.id) } },
      select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
    });
    const porId = new Map(completas.map((o) => [o.id, o]));
    const tarjetas: TarjetaInicio[] = [];
    for (const item of elegidas) {
      const oferta = porId.get(item.id);
      if (!oferta) continue;
      const tarjeta = tarjetaConVendedor(oferta, mirada, socios);
      // «Bajó S/ 40» necesita el precio a la vista.
      const bajo = item.chapita === 'BAJO' && tarjeta.precio !== null;
      tarjetas.push({
        ...tarjeta,
        chapita: item.chapita === 'BAJO' && !bajo ? null : item.chapita,
        bajo_centimos: bajo ? item.bajoCentimos : null,
      });
    }
    return {
      tarjetas,
      pagina,
      total_paginas: Math.ceil(enFilas.length / cuantas),
      en_paginas: enFilas.length,
      total,
    };
  }

  /**
   * El orden por puntos de todo lo vigente y con stock (doc 20, punto 4b): lo de los últimos 30
   * días (como mucho las 600 más nuevas), con sus puntos y su chapita, de más a menos puntos.
   */
  private async calcularOrden(ahora = new Date()): Promise<EnElOrden[]> {
    const ofertas = await this.prisma.oferta.findMany({
      where: {
        AND: [
          OFERTA_VIGENTE,
          { stock: { gt: 0 } },
          { actualizadaEn: { gte: new Date(ahora.getTime() - VENTANA_INICIO) } },
        ],
      },
      orderBy: [{ actualizadaEn: 'desc' }, { creadaEn: 'desc' }, { id: 'asc' }],
      take: MAXIMO_INICIO,
      select: {
        id: true,
        tiendaId: true,
        productoId: true,
        creadaEn: true,
        actualizadaEn: true,
        precioCentimos: true,
        precioVisible: true,
        precioAnteriorCentimos: true,
        precioBajoEn: true,
      },
    });
    if (ofertas.length === 0) return [];
    const ids = ofertas.map((o) => o.id);
    const tiendaIds = [...new Set(ofertas.map((o) => o.tiendaId))];
    const [baratas, buscados, reputaciones, responde, fundadoras, destacadas, reportes] =
      await Promise.all([
        ofertasMasBaratasDeLaGaleria(this.prisma, this.tipoCambio, { ofertaIds: ids }),
        this.muyBuscadosHoy(),
        reputacionCorta(this.prisma, tiendaIds),
        this.catalogo.respondeEn(tiendaIds),
        fundadorasDelDia(this.prisma, ahora),
        destacadasAhora(this.prisma, ahora),
        this.prisma.denuncia.groupBy({
          by: ['objetoId'],
          where: {
            objeto: 'OFERTA',
            estado: { in: ['ABIERTA', 'EN_REVISION'] },
            objetoId: { in: ids },
          },
          _count: { _all: true },
        }),
      ]);
    const reportesDe = new Map(reportes.map((fila) => [fila.objetoId, fila._count._all]));
    const delDia = new Set(fundadoras);
    return ofertas
      .map((o) => {
        const bajoCentimos =
          o.precioVisible &&
          o.precioBajoEn !== null &&
          ahora.getTime() - o.precioBajoEn.getTime() <= BAJO_DE_PRECIO &&
          o.precioAnteriorCentimos !== null &&
          o.precioCentimos !== null &&
          o.precioAnteriorCentimos > o.precioCentimos
            ? Number(o.precioAnteriorCentimos - o.precioCentimos)
            : null;
        const reputacion = reputaciones.get(o.tiendaId);
        const minutos = responde.get(o.tiendaId);
        const datos = {
          creadaEn: o.creadaEn,
          actualizadaEn: o.actualizadaEn,
          masBarato: baratas.has(o.id),
          muyBuscado: buscados.has(o.productoId),
          bajo: bajoCentimos !== null,
          resenas: reputacion ? puntosDeResenas(reputacion.opiniones, reputacion.puntaje) : 0,
          respondeRapido: minutos !== undefined && minutos < RESPONDE_RAPIDO_MINUTOS,
          diaFundadora: delDia.has(o.tiendaId),
          destacada: destacadas.fuerzaDe(o),
          reportesAbiertos: reportesDe.get(o.id) ?? 0,
        };
        return {
          id: o.id,
          tiendaId: o.tiendaId,
          creadaEn: o.creadaEn,
          puntos: puntosDe(datos, ahora),
          chapita: chapitaDe(datos, ahora),
          bajoCentimos,
        };
      })
      .sort(compararPorPuntos);
  }

  /**
   * «Muy buscado hoy» (doc 20, punto 4b): los 10 productos con más puntos hoy (hora de Lima),
   * sumando las vistas de hoy de todas sus ofertas y 3 por cada pedido en vivo de hoy de ese
   * producto. Con menos de 3 no entra.
   */
  private async muyBuscadosHoy(): Promise<Set<string>> {
    const filas = await this.prisma.$queryRaw<Array<{ producto_id: string }>>`
      WITH hoy AS (
        SELECT (now() AT TIME ZONE 'America/Lima')::date AS dia,
               (date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima') AS desde
      ),
      puntos AS (
        SELECT o.producto_id, count(*)::int AS puntos
        FROM vista_oferta v
        JOIN oferta o ON o.id = v.oferta_id
        CROSS JOIN hoy
        WHERE v.dia = hoy.dia
        GROUP BY o.producto_id
        UNION ALL
        SELECT e.producto_id, (count(*) * ${MUY_BUSCADO_POR_PEDIDO})::int AS puntos
        FROM en_vivo e
        CROSS JOIN hoy
        WHERE e.tipo = 'BUSCO' AND e.producto_id IS NOT NULL AND e.creado_en >= hoy.desde
        GROUP BY e.producto_id
      )
      SELECT producto_id::text AS producto_id
      FROM puntos
      GROUP BY producto_id
      HAVING sum(puntos) >= ${MUY_BUSCADO_MINIMO}
      ORDER BY sum(puntos) DESC, producto_id
      LIMIT ${MUY_BUSCADO_CUANTOS}`;
    return new Set(filas.map((fila) => fila.producto_id));
  }

  /** «★ Tiendas fundadoras · 7 de 10 ya entraron» (doc 20, punto 7). */
  private async fundadoras(): Promise<RespuestaInicio['fundadoras']> {
    const filas = await this.prisma.tienda.findMany({
      where: { fundadoraDesde: { not: null }, estado: 'ACTIVA' },
      orderBy: [{ fundadoraDesde: 'asc' }, { nombre: 'asc' }],
      select: { nombre: true },
    });
    return {
      entraron: filas.length,
      total: MAX_FUNDADORAS,
      iniciales: filas.map((fila) => iniciales(fila.nombre)),
    };
  }

  /**
   * La X de la banda «¿Conoces una tienda…?» del inicio (N07): se guarda en la cuenta, siempre
   * con la fecha de la última vez, porque la banda vuelve a salir a los 2 días (doc 19, 14).
   */
  async cerrarInvitar(mirada: Mirada): Promise<void> {
    const { usuarioId } = this.deTienda(mirada);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { invitarCerradoEn: new Date() },
    });
  }

  /**
   * La X de la misma banda en las secciones de la barra negra (doc 19, 14): no vuelve más, así
   * que se queda la primera fecha.
   */
  async cerrarInvitarSecciones(mirada: Mirada): Promise<void> {
    const { usuarioId } = this.deTienda(mirada);
    await this.prisma.usuario.updateMany({
      where: { id: usuarioId, invitarSeccionesCerradoEn: null },
      data: { invitarSeccionesCerradoEn: new Date() },
    });
  }

  /**
   * «Recién llegados +N nuevo» (N07, mejora 20): lo publicado desde tu última visita a la
   * página, sin lo de tu tienda ni lo de las que bloqueaste, y como máximo de las últimas 24 h.
   */
  async recienLlegados(mirada: Mirada): Promise<RespuestaRecienLlegados> {
    const { tiendaId, usuarioId } = this.deTienda(mirada);
    const [usuario, bloqueadas] = await Promise.all([
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { recienVistoEn: true },
      }),
      tiendasBloqueadasPor(this.prisma, usuarioId),
    ]);
    const hace24 = new Date(Date.now() - RECIEN_LLEGADOS_MS);
    const desde =
      usuario.recienVistoEn && usuario.recienVistoEn > hace24 ? usuario.recienVistoEn : hace24;
    const nuevos = await this.prisma.oferta.count({
      where: { AND: [this.deOtras(tiendaId, bloqueadas), { creadaEn: { gt: desde } }] },
    });
    return { nuevos };
  }

  /** Entró a «Recién llegados»: el contador vuelve a cero. */
  async recienVisto(mirada: Mirada): Promise<RespuestaRecienLlegados> {
    const { usuarioId } = this.deTienda(mirada);
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { recienVistoEn: new Date() },
    });
    return { nuevos: 0 };
  }

  /**
   * «Lo que más se pide en la galería»: lo buscado al menos dos veces en 30 días, con el
   * producto del catálogo que mejor le calza. Lo que tu tienda ya publica no sale.
   */
  private async masPedido(tiendaId: string): Promise<RespuestaInicio['mas_pedido']> {
    const terminos = (await this.busqueda.terminosRepetidos()).slice(0, 20);
    const lista: RespuestaInicio['mas_pedido'] = [];
    const vistos = new Set<string>();
    for (const termino of terminos) {
      if (lista.length === MAS_PEDIDO) break;
      const palabras = normalizarTexto(termino).split(' ').filter(Boolean);
      if (palabras.length === 0) continue;
      const producto = await this.prisma.producto.findFirst({
        where: {
          fusionadoEnId: null,
          AND: palabras.map((palabra) => ({ textoBusqueda: { contains: palabra } })),
        },
        orderBy: { ofertas: { _count: 'desc' } },
        select: {
          id: true,
          slug: true,
          titulo: true,
          categoria: { select: { nombre: true } },
          ofertas: {
            where: { tiendaId, estado: { not: 'ELIMINADA' } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (producto && producto.ofertas.length > 0) continue;
      const clave = producto?.slug ?? normalizarTexto(termino);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      lista.push(
        producto
          ? {
              texto: producto.titulo,
              categoria: producto.categoria.nombre,
              producto: producto.slug,
            }
          : { texto: termino, categoria: null, producto: null },
      );
    }
    return lista;
  }

  /** «Tiendas que ya están»: las activas, con su categoría fuerte y su galería. */
  private async tiendas(
    tiendaId: string,
    bloqueadas: string[],
  ): Promise<RespuestaInicio['tiendas']> {
    const filas = await this.prisma.$queryRaw<
      Array<{
        id: string;
        nombre: string;
        logo: string | null;
        galeria: string | null;
        ofertas: number;
        visibles: number;
        categoria: string | null;
      }>
    >`
      SELECT t.id, t.nombre, t.logo, g.nombre AS galeria,
             count(o.id)::int AS ofertas,
             count(o.id) FILTER (WHERE o.tienda_visible)::int AS visibles,
             (SELECT c.nombre FROM oferta o2
                JOIN producto p ON p.id = o2.producto_id
                JOIN categoria c ON c.id = p.categoria_id
               WHERE o2.tienda_id = t.id AND o2.estado = 'ACTIVA'
               GROUP BY c.nombre ORDER BY count(*) DESC, c.nombre LIMIT 1) AS categoria
      FROM tienda t
      LEFT JOIN galeria g ON g.id = t.galeria_id
      LEFT JOIN oferta o ON o.tienda_id = t.id AND o.estado = 'ACTIVA'
      WHERE t.estado = 'ACTIVA'
      GROUP BY t.id, g.nombre
      ORDER BY t.creada_en, t.nombre`;
    // Con todo en reservado, la tienda cuenta pero no se nombra.
    const reservada = (fila: (typeof filas)[number]) => fila.ofertas > 0 && fila.visibles === 0;
    const otras = filas.filter((fila) => fila.id !== tiendaId && !bloqueadas.includes(fila.id));
    return {
      visibles: otras
        .filter((fila) => !reservada(fila))
        .map((fila) => ({
          id: fila.id,
          nombre: fila.nombre,
          logo: fila.logo,
          detalle: [fila.categoria, fila.galeria ?? 'Independiente'].filter(Boolean).join(' · '),
        })),
      reservadas: otras.filter(reservada).length,
      activas: filas.length,
      meta: META_TIENDAS,
    };
  }

  /** «Primeros pasos»: «Completa tu perfil» pide portada, horario y qué vendes (N16). */
  private async pasos(tiendaId: string): Promise<RespuestaInicio['pasos']> {
    const [tienda, publicadas, enVivo] = await Promise.all([
      this.prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: { horario: true, descripcion: true, portadaRuta: true },
      }),
      this.prisma.oferta.count({ where: { tiendaId, estado: { not: 'ELIMINADA' } } }),
      this.prisma.enVivo.count({ where: { tiendaId } }),
    ]);
    return {
      perfil: Boolean(tienda?.horario && tienda.descripcion && tienda.portadaRuta),
      publicadas,
      en_vivo: enVivo > 0,
    };
  }
}
