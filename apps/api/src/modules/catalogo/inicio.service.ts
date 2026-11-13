import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  normalizarTexto,
  PUBLICACIONES_INICIO_NORMAL,
  RECIEN_INICIO,
  RECIEN_POR_PAGINA,
  type FaseInicio,
  type RespuestaInicio,
  type RespuestaRecienInicio,
  type RespuestaRecienLlegados,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { tiendasQueNoVeo } from '../../shared/bloqueadas';
import { destacadasAhora, mezclarDestacadas } from '../../shared/destacados';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { BusquedaService } from './busqueda.service';
import {
  CatalogoService,
  OFERTA_VIGENTE,
  PRODUCTO_TARJETA,
  SELECT_OFERTA_CON_VENDEDOR,
  tarjetaConVendedor,
} from './catalogo.service';

/** «Con 20 tiendas, aquí vas a encontrar casi todo» (N16): la meta del piloto. */
export const META_TIENDAS = 20;
/** Desde cuántas publicaciones de otras tiendas el inicio es el de todos los días (N16). */
export const PUBLICACIONES_NORMAL = PUBLICACIONES_INICIO_NORMAL;
const MAS_PEDIDO = 4;
/** «Recién llegados» cuenta como máximo lo de las últimas 24 h (N07, mejora 20). */
const RECIEN_LLEGADOS_MS = 24 * 60 * 60 * 1000;
/** La banda «¿Conoces una tienda…?» del inicio vuelve a salir a los 2 días de su X (doc 19, 14). */
export const INVITAR_VUELVE_MS = 2 * 24 * 60 * 60 * 1000;
/** Cuántas de más se miran para mezclar sin dejar dos seguidas de la misma tienda. */
const HOLGURA_MEZCLA = 2 * RECIEN_POR_PAGINA;

type Ordenable = { id: string; tiendaId: string };

/**
 * «Mezclado por tienda: nunca salen dos seguidos de la misma» (N15). Va en el orden de lo más
 * reciente y, si la siguiente es de la misma tienda que la anterior, adelanta la primera de otra
 * tienda. Solo se repite si ya no quedan de otras.
 */
export function mezclarSinRepetir<T extends { tiendaId: string }>(lista: T[]): T[] {
  const pendientes = [...lista];
  const resultado: T[] = [];
  while (pendientes.length > 0) {
    const anterior = resultado[resultado.length - 1]?.tiendaId;
    const indice = Math.max(
      0,
      pendientes.findIndex((item) => item.tiendaId !== anterior),
    );
    resultado.push(...pendientes.splice(indice, 1));
  }
  return resultado;
}

/**
 * El inicio de una tienda (N16, N15): crece solo. Sin nada publicado por las demás, bienvenida,
 * precios protegidos, lo que más se pide y primeros pasos; de 1 a 11, lo nuevo en lista con
 * «Van N de 12»; desde 12, el inicio normal con «Recién publicado» en 4 filas de hasta 18 (las 72
 * van de una vez, docs/18 §5). Al llegar a 12 se guarda el hito en la tienda y ya no vuelve atrás.
 */
@Injectable()
export class InicioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
    @Inject(BusquedaService) private readonly busqueda: BusquedaService,
  ) {}

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
    // Bloqueadas, ocultas y privadas que no sigue (doc 20, punto 5).
    const bloqueadas = await tiendasQueNoVeo(this.prisma, mirada);
    const [tienda, usuario, publicaciones, deSeguidas, masPedido, tiendas, pasos] =
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
    const recien =
      fase === 'DIA_1'
        ? []
        : (
            await this.pagina(
              mirada,
              bloqueadas,
              0,
              fase === 'POCAS' ? PUBLICACIONES_NORMAL - 1 : RECIEN_INICIO,
            )
          ).tarjetas;
    return {
      fase,
      de_seguidas: deSeguidas,
      mas_pedido: masPedido,
      tiendas,
      pasos,
      publicaciones,
      recien,
      // Es el mismo conteo que `publicaciones`: lo vigente de las demás, sin las bloqueadas.
      total: publicaciones,
      invitar_cerrado:
        usuario.invitarCerradoEn !== null &&
        Date.now() - usuario.invitarCerradoEn.getTime() < INVITAR_VUELVE_MS,
    };
  }

  /** «La flechita trae las siguientes 24, sin fin» (N15). */
  async recien(mirada: Mirada, desde: number): Promise<RespuestaRecienInicio> {
    this.deTienda(mirada);
    const bloqueadas = await tiendasQueNoVeo(this.prisma, mirada);
    return this.pagina(mirada, bloqueadas, desde, RECIEN_POR_PAGINA);
  }

  /**
   * Una página de «Recién publicado»: lo más reciente de las demás tiendas, con lo destacado por
   * el equipo entre los 4 primeros (COR16) y mezclado por tienda. El orden se arma siempre desde
   * el principio, así cada página sigue donde terminó la anterior.
   */
  private async pagina(
    mirada: Mirada,
    bloqueadas: string[],
    desde: number,
    cuantas: number,
  ): Promise<RespuestaRecienInicio> {
    const tiendaId = mirada.tiendaId ?? '';
    const where = this.deOtras(tiendaId, bloqueadas);
    const orderBy = [
      { actualizadaEn: 'desc' },
      { creadaEn: 'desc' },
      { id: 'asc' },
    ] satisfies Prisma.OfertaOrderByWithRelationInput[];
    const destacadas = await destacadasAhora(this.prisma);
    const hayDestacadas = destacadas.tiendas.size > 0 || destacadas.ofertas.size > 0;
    const [filas, total, impulsadas, socios] = await Promise.all([
      this.prisma.oferta.findMany({
        where,
        orderBy,
        take: desde + cuantas + HOLGURA_MEZCLA,
        select: { id: true, tiendaId: true },
      }),
      this.prisma.oferta.count({ where }),
      hayDestacadas
        ? this.prisma.oferta.findMany({
            where: {
              AND: [
                where,
                {
                  OR: [
                    { tiendaId: { in: [...destacadas.tiendas] } },
                    { id: { in: [...destacadas.ofertas] } },
                  ],
                },
              ],
            },
            orderBy,
            take: 4,
            select: { id: true, tiendaId: true },
          })
        : Promise.resolve([] as Ordenable[]),
      tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId),
    ]);
    const arriba = new Set(impulsadas.map((o) => o.id));
    const orden = mezclarSinRepetir(
      mezclarDestacadas([...impulsadas, ...filas.filter((o) => !arriba.has(o.id))], (o) =>
        arriba.has(o.id),
      ),
    );
    const ids = orden.slice(desde, desde + cuantas).map((o) => o.id);
    const completas = await this.prisma.oferta.findMany({
      where: { id: { in: ids } },
      select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
    });
    const porId = new Map(completas.map((o) => [o.id, o]));
    return {
      tarjetas: ids
        .map((id) => porId.get(id))
        .filter((o) => o !== undefined)
        .map((o) => tarjetaConVendedor(o, mirada, socios)),
      desde,
      total,
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
      tiendasQueNoVeo(this.prisma, mirada),
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

  /**
   * «Primeros pasos»: «Completa tu perfil» pide portada y horario (N16). «Sobre la tienda» es
   * opcional y ya no cuenta (doc 20, A4).
   */
  private async pasos(tiendaId: string): Promise<RespuestaInicio['pasos']> {
    const [tienda, publicadas, enVivo] = await Promise.all([
      this.prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: { horario: true, portadaRuta: true },
      }),
      this.prisma.oferta.count({ where: { tiendaId, estado: { not: 'ELIMINADA' } } }),
      this.prisma.enVivo.count({ where: { tiendaId } }),
    ]);
    return {
      perfil: Boolean(tienda?.horario && tienda.portadaRuta),
      publicadas,
      en_vivo: enVivo > 0,
    };
  }
}
