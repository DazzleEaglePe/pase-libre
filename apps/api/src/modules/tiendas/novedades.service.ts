import { Inject, Injectable } from '@nestjs/common';
import {
  precioDe,
  type NovedadesConsulta,
  type NovedadSeguida,
  type OfertaDeNovedad,
  type RespuestaNovedades,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { tiendasBloqueadasPor } from '../../shared/bloqueadas';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { detalleDe } from '../catalogo/catalogo.service';
import { preciosPara } from '../catalogo/visibilidad';
import { inicioDelDiaEnLima } from '../en-vivo/horario';
import { EnVivoService } from '../en-vivo/en-vivo.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { miradaDe, OFERTA_DEL_PERFIL } from './tiendas.service';

const DIAS = 7;
const MAXIMO = 60;
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

const SELECT_OFERTA = {
  id: true,
  tiendaId: true,
  stock: true,
  condicion: true,
  estadoDetalle: true,
  conCaja: true,
  conFactura: true,
  probado: true,
  garantia: true,
  enAlmacen: true,
  precioCentimos: true,
  precioFacturadoCentimos: true,
  descuentoSocioCentimos: true,
  precioAnteriorCentimos: true,
  precioBajoEn: true,
  moneda: true,
  precioVisible: true,
  soloSocios: true,
  creadaEn: true,
  producto: {
    select: {
      slug: true,
      titulo: true,
      categoria: { select: { slug: true } },
      fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
} satisfies Prisma.OfertaSelect;

type FilaOferta = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA }>;

/**
 * «De tiendas que sigues» (SEG_Web, sección 8 del lienzo final): lo que publicaron, lo que
 * bajaron de precio y lo que piden o rematan en vivo las tiendas que sigues, por día. Lo de
 * una publicación con la tienda reservada no sale: delataría de quién es.
 */
@Injectable()
export class NovedadesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EnVivoService) private readonly enVivo: EnVivoService,
  ) {}

  async novedades(consulta: NovedadesConsulta, sesion: SesionActiva): Promise<RespuestaNovedades> {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) return { seguidas: [], novedades: [], sugeridas: [] };
    const mirada = miradaDe(sesion);
    const [seguimientos, bloqueadas] = await Promise.all([
      this.prisma.seguimiento.findMany({
        where: { tiendaId, seguida: { estado: 'ACTIVA' } },
        orderBy: { creadoEn: 'asc' },
        select: {
          seguida: {
            select: {
              id: true,
              nombre: true,
              stand: true,
              galeria: { select: { nombre: true } },
            },
          },
        },
      }),
      tiendasBloqueadasPor(this.prisma, sesion.usuario.id),
    ]);
    const seguidas = seguimientos
      .map((fila) => fila.seguida)
      .filter((tienda) => !bloqueadas.includes(tienda.id));
    const sugeridas = await this.sugeridas(tiendaId, [
      tiendaId,
      ...bloqueadas,
      ...seguidas.map((tienda) => tienda.id),
    ]);
    if (seguidas.length === 0) return { seguidas: [], novedades: [], sugeridas };

    const ids =
      consulta.tienda && seguidas.some((tienda) => tienda.id === consulta.tienda)
        ? [consulta.tienda]
        : seguidas.map((tienda) => tienda.id);
    const desde = new Date(Date.now() - DIAS * 86_400_000);
    const hoy = inicioDelDiaEnLima(new Date());
    const quiere = (tipo: NovedadSeguida['tipo']) =>
      consulta.tipo === 'todo' ||
      (consulta.tipo === 'nuevos' && (tipo === 'PUBLICO' || tipo === 'BAJO')) ||
      (consulta.tipo === 'remates' && tipo === 'REMATE') ||
      (consulta.tipo === 'en_vivo' && tipo === 'BUSCO');

    const [publicadas, bajadas, enVivo, socios, deHoy] = await Promise.all([
      this.prisma.oferta.findMany({
        where: { ...OFERTA_DEL_PERFIL, tiendaId: { in: ids }, creadaEn: { gte: desde } },
        orderBy: { creadaEn: 'desc' },
        take: 200,
        select: SELECT_OFERTA,
      }),
      this.prisma.oferta.findMany({
        where: {
          ...OFERTA_DEL_PERFIL,
          tiendaId: { in: ids },
          precioBajoEn: { gte: desde },
          precioAnteriorCentimos: { not: null },
        },
        orderBy: { precioBajoEn: 'desc' },
        take: 50,
        select: SELECT_OFERTA,
      }),
      this.enVivo.vigentesDe(ids, mirada),
      tiendasQueMeTienenDeSocia(this.prisma, tiendaId),
      this.prisma.oferta.groupBy({
        by: ['tiendaId'],
        where: {
          ...OFERTA_DEL_PERFIL,
          tiendaId: { in: seguidas.map((t) => t.id) },
          creadaEn: { gte: hoy },
        },
        _count: { _all: true },
      }),
    ]);

    const tiendaDe = new Map(
      seguidas.map((tienda) => [
        tienda.id,
        {
          id: tienda.id,
          nombre: tienda.nombre,
          lugar: [
            tienda.galeria?.nombre ?? 'Independiente',
            tienda.stand && `Stand ${tienda.stand}`,
          ]
            .filter(Boolean)
            .join(' · '),
        },
      ]),
    );
    const aOferta = (o: FilaOferta): OfertaDeNovedad => {
      const general = preciosPara(o, mirada, new Set());
      const conSocio = preciosPara(o, mirada, socios);
      return {
        id: o.id,
        producto: {
          slug: o.producto.slug,
          titulo: o.producto.titulo,
          foto: o.producto.fotos[0]?.ruta ?? null,
          categoria: o.producto.categoria,
        },
        detalle: detalleDe(o),
        stock: o.stock,
        precio: general.precio ?? conSocio.precio,
        precio_socio: conSocio.socio ? conSocio.precio : null,
      };
    };

    const novedades: NovedadSeguida[] = [];
    // Lo publicado, por tienda y día: «publicó 3 productos · hace 1 h».
    const grupos = new Map<string, FilaOferta[]>();
    for (const oferta of publicadas) {
      const clave = `${oferta.tiendaId}|${DIA_LIMA.format(oferta.creadaEn)}`;
      grupos.set(clave, [...(grupos.get(clave) ?? []), oferta]);
    }
    for (const lista of grupos.values()) {
      const [primera, ...resto] = lista;
      const tienda = primera && tiendaDe.get(primera.tiendaId);
      if (!primera || !tienda) continue;
      novedades.push({
        tipo: 'PUBLICO',
        tienda,
        fecha: primera.creadaEn.toISOString(),
        oferta: aOferta(primera),
        mas: resto.map((oferta) => oferta.producto.titulo),
      });
    }
    for (const oferta of bajadas) {
      const tienda = tiendaDe.get(oferta.tiendaId);
      const visto = aOferta(oferta);
      // Si quien mira no ve el precio, tampoco ve que bajó.
      if (
        !tienda ||
        !visto.precio ||
        oferta.precioAnteriorCentimos === null ||
        !oferta.precioBajoEn
      )
        continue;
      novedades.push({
        tipo: 'BAJO',
        tienda,
        fecha: oferta.precioBajoEn.toISOString(),
        oferta: visto,
        antes: precioDe(Number(oferta.precioAnteriorCentimos), oferta.moneda),
      });
    }
    for (const { tiendaId: suya, item } of enVivo) {
      const tienda = tiendaDe.get(suya);
      if (!tienda) continue;
      novedades.push({
        tipo: item.tipo === 'BUSCO' ? 'BUSCO' : 'REMATE',
        tienda,
        fecha: item.creado_en,
        en_vivo: item,
      });
    }

    const conHoy = new Set([
      ...deHoy.map((fila) => fila.tiendaId),
      ...enVivo.filter(({ item }) => new Date(item.creado_en) >= hoy).map((x) => x.tiendaId),
    ]);
    return {
      seguidas: seguidas.map((tienda) => ({
        id: tienda.id,
        nombre: tienda.nombre,
        nuevo_hoy: conHoy.has(tienda.id),
      })),
      novedades: novedades
        .filter((novedad) => quiere(novedad.tipo))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .slice(0, MAXIMO),
      sugeridas,
    };
  }

  /**
   * «Te pueden interesar»: tiendas activas que no sigues, con un porqué (le compraste, muy bien
   * calificada, nueva, la que más publica).
   */
  private async sugeridas(
    tiendaId: string,
    fuera: string[],
  ): Promise<RespuestaNovedades['sugeridas']> {
    const tiendas = await this.prisma.tienda.findMany({
      where: { estado: 'ACTIVA', id: { notIn: fuera } },
      select: {
        id: true,
        nombre: true,
        stand: true,
        creadaEn: true,
        galeria: { select: { nombre: true } },
        _count: { select: { ofertas: { where: OFERTA_DEL_PERFIL } } },
      },
    });
    if (tiendas.length === 0) return [];
    const ids = tiendas.map((tienda) => tienda.id);
    const [compras, opiniones, categorias] = await Promise.all([
      this.prisma.venta.findMany({
        where: {
          tiendaCompradoraId: tiendaId,
          oferta: { tiendaId: { in: ids }, tiendaVisible: true },
        },
        select: { oferta: { select: { tiendaId: true } } },
      }),
      this.prisma.opinion.groupBy({
        by: ['tiendaId'],
        where: { tiendaId: { in: ids } },
        _avg: { estrellas: true },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<Array<{ tienda_id: string; nombre: string }>>`
        SELECT DISTINCT ON (o.tienda_id) o.tienda_id, c.nombre
        FROM oferta o
        JOIN producto p ON p.id = o.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        WHERE o.estado = 'ACTIVA' AND o.tienda_visible
        GROUP BY o.tienda_id, c.nombre
        ORDER BY o.tienda_id, count(*) DESC`,
    ]);
    const compradas = new Map<string, number>();
    for (const venta of compras) {
      const id = venta.oferta.tiendaId;
      compradas.set(id, (compradas.get(id) ?? 0) + 1);
    }
    const nota = new Map(opiniones.map((fila) => [fila.tiendaId, fila]));
    const vende = new Map(categorias.map((fila) => [fila.tienda_id, fila.nombre]));
    const hace30 = Date.now() - 30 * 86_400_000;

    return tiendas
      .map((tienda) => {
        const veces = compradas.get(tienda.id) ?? 0;
        const opinion = nota.get(tienda.id);
        const promedio = opinion?._avg.estrellas ?? 0;
        const [por, puntos] =
          veces > 0
            ? [veces === 1 ? 'Le compraste 1 vez' : `Le compraste ${veces} veces`, 100 + veces]
            : promedio >= 4.5 && (opinion?._count._all ?? 0) >= 3
              ? ['Muy bien calificada', 50 + promedio]
              : tienda.creadaEn.getTime() > hace30
                ? ['Nueva en PaseLibre', 30]
                : [`${tienda._count.ofertas} publicaciones`, tienda._count.ofertas / 100];
        return {
          id: tienda.id,
          nombre: tienda.nombre,
          lugar: [
            tienda.galeria?.nombre ?? 'Independiente',
            tienda.stand && `Stand ${tienda.stand}`,
          ]
            .filter(Boolean)
            .join(' · '),
          vende: vende.get(tienda.id) ?? null,
          estrellas: opinion?._avg.estrellas ? Math.round(opinion._avg.estrellas * 10) / 10 : null,
          por,
          puntos,
        };
      })
      .sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'))
      .slice(0, 6)
      .map(({ puntos: _puntos, ...sugerida }) => sugerida);
  }
}
