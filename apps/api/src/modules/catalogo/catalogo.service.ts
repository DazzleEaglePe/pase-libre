import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  CategoriaResumen,
  Foto,
  GaleriaResumen,
  OfertaConVendedor,
  OfertaPublica,
  PortadaConsulta,
  ProductoDetalle,
  RespuestaFicha,
  RespuestaPortada,
  RespuestaRedireccion,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { conSesion, precioPara } from './visibilidad';

/** Una oferta se muestra si está activa, su tienda no está suspendida y su producto no se unió a otro. */
const OFERTA_VIGENTE = {
  estado: 'ACTIVA',
  tienda: { estado: 'ACTIVA' },
  producto: { fusionadoEnId: null },
} satisfies Prisma.OfertaWhereInput;

const FOTOS = {
  select: { ruta: true, ancho: true, alto: true },
  orderBy: { orden: 'asc' },
} as const;

/** Lo único que se pide de una oferta para un visitante: sin precio ni tienda. */
const SELECT_OFERTA_PUBLICA = {
  id: true,
  condicion: true,
  stock: true,
  descripcion: true,
  actualizadaEn: true,
  fotos: FOTOS,
  tienda: { select: { tipo: true, galeria: { select: { nombre: true } } } },
} satisfies Prisma.OfertaSelect;

const SELECT_OFERTA_CON_VENDEDOR = {
  ...SELECT_OFERTA_PUBLICA,
  tiendaId: true,
  precioCentimos: true,
  moneda: true,
  precioVisible: true,
  tienda: {
    select: {
      id: true,
      nombre: true,
      stand: true,
      tipo: true,
      galeria: { select: { nombre: true } },
    },
  },
} satisfies Prisma.OfertaSelect;

const PRODUCTO_TARJETA = {
  select: {
    slug: true,
    titulo: true,
    categoria: { select: { slug: true, nombre: true } },
    fotos: { ...FOTOS, take: 1 },
  },
} as const;

type OfertaPublicaFila = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA_PUBLICA }>;
type OfertaConVendedorFila = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA_CON_VENDEDOR }>;

/** Pseudo-galería para quienes venden sin galería. */
export const INDEPENDIENTES = { slug: 'independientes', nombre: 'Independientes' } as const;

function aFoto(foto: { ruta: string; ancho: number | null; alto: number | null }): Foto {
  return { ruta: foto.ruta, ancho: foto.ancho, alto: foto.alto };
}

function ofertaPublica(o: OfertaPublicaFila): OfertaPublica {
  return {
    id: o.id,
    condicion: o.condicion,
    stock: o.stock,
    galeria: o.tienda.galeria?.nombre ?? null,
    tipo_vendedor: o.tienda.tipo,
    descripcion: o.descripcion,
    fotos: o.fotos.map(aFoto),
    actualizada_en: o.actualizadaEn.toISOString(),
  };
}

function ofertaConVendedor(o: OfertaConVendedorFila, mirada: Mirada): OfertaConVendedor {
  return {
    ...ofertaPublica(o),
    tienda: { id: o.tienda.id, nombre: o.tienda.nombre, stand: o.tienda.stand },
    precio: precioPara(o, mirada),
    precio_visible: o.precioVisible,
    propia: o.tiendaId === mirada.tiendaId,
  };
}

/**
 * Orden de la ficha con sesión (RF-52): primero los precios visibles en dólares de menor
 * a mayor, luego los visibles en soles, y al final las ofertas al interno. Se ordena por
 * lo que ve cualquier vendedor, aunque la tienda dueña vea su propio precio oculto.
 */
function compararPorPrecio(a: OfertaConVendedorFila, b: OfertaConVendedorFila): number {
  const grupo = (o: OfertaConVendedorFila) =>
    !o.precioVisible || o.precioCentimos === null ? 2 : o.moneda === 'USD' ? 0 : 1;
  const diferencia = grupo(a) - grupo(b);
  if (diferencia !== 0) return diferencia;
  if (grupo(a) === 2) return b.actualizadaEn.getTime() - a.actualizadaEn.getTime();
  return Number((a.precioCentimos ?? 0n) - (b.precioCentimos ?? 0n));
}

@Injectable()
export class CatalogoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async categorias(): Promise<CategoriaResumen[]> {
    return this.prisma.$queryRaw<CategoriaResumen[]>`
      SELECT c.slug::text AS slug, c.nombre, count(DISTINCT p.id)::int AS productos
      FROM categoria c
      LEFT JOIN producto p ON p.categoria_id = c.id AND p.fusionado_en_id IS NULL
        AND EXISTS (
          SELECT 1 FROM oferta o JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
          WHERE o.producto_id = p.id AND o.estado = 'ACTIVA'
        )
      WHERE c.padre_id IS NULL
      GROUP BY c.id
      ORDER BY c.orden, c.nombre`;
  }

  async galerias(): Promise<GaleriaResumen[]> {
    const filas = await this.prisma.$queryRaw<
      Array<{ slug: string | null; nombre: string | null; ofertas: number }>
    >`
      SELECT g.slug::text AS slug, g.nombre, count(o.id)::int AS ofertas
      FROM tienda t
      LEFT JOIN galeria g ON g.id = t.galeria_id
      JOIN oferta o ON o.tienda_id = t.id AND o.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE t.estado = 'ACTIVA' AND (g.id IS NULL OR g.activa)
      GROUP BY g.slug, g.nombre, g.orden
      ORDER BY g.orden NULLS LAST, g.nombre`;
    const activas = await this.prisma.galeria.findMany({
      where: { activa: true },
      orderBy: { orden: 'asc' },
    });
    const cuenta = new Map(filas.map((f) => [f.slug ?? INDEPENDIENTES.slug, f.ofertas]));
    return [
      ...activas.map((g) => ({ slug: g.slug, nombre: g.nombre, ofertas: cuenta.get(g.slug) ?? 0 })),
      { ...INDEPENDIENTES, ofertas: cuenta.get(INDEPENDIENTES.slug) ?? 0 },
    ];
  }

  /** Portada (RF-44, RF-15, RF-17): recién publicado, categorías, galerías y totales. */
  async portada(consulta: PortadaConsulta, mirada: Mirada): Promise<RespuestaPortada> {
    const filtroGaleria: Prisma.OfertaWhereInput = !consulta.galeria
      ? {}
      : consulta.galeria === INDEPENDIENTES.slug
        ? { tienda: { estado: 'ACTIVA', galeriaId: null } }
        : { tienda: { estado: 'ACTIVA', galeria: { slug: consulta.galeria } } };
    const where: Prisma.OfertaWhereInput = { AND: [OFERTA_VIGENTE, filtroGaleria] };
    const orderBy = [
      { actualizadaEn: 'desc' },
      { creadaEn: 'desc' },
    ] satisfies Prisma.OfertaOrderByWithRelationInput[];

    const [categorias, galerias, totales] = await Promise.all([
      this.categorias(),
      this.galerias(),
      this.totales(),
    ]);
    const base = { categorias, galerias, totales };

    if (!conSesion(mirada)) {
      const ofertas = await this.prisma.oferta.findMany({
        where,
        orderBy,
        take: 8,
        select: { ...SELECT_OFERTA_PUBLICA, producto: PRODUCTO_TARJETA },
      });
      return {
        ...base,
        audiencia: 'visitante',
        recien_publicado: ofertas.map((o) => ({
          oferta_id: o.id,
          producto: {
            slug: o.producto.slug,
            titulo: o.producto.titulo,
            categoria: o.producto.categoria,
            foto: o.producto.fotos[0]?.ruta ?? null,
          },
          condicion: o.condicion,
          stock: o.stock,
          galeria: o.tienda.galeria?.nombre ?? null,
          actualizada_en: o.actualizadaEn.toISOString(),
        })),
      };
    }

    const ofertas = await this.prisma.oferta.findMany({
      where,
      orderBy,
      take: 8,
      select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
    });
    return {
      ...base,
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      recien_publicado: ofertas.map((o) => ({
        oferta_id: o.id,
        producto: {
          slug: o.producto.slug,
          titulo: o.producto.titulo,
          categoria: o.producto.categoria,
          foto: o.producto.fotos[0]?.ruta ?? null,
        },
        condicion: o.condicion,
        stock: o.stock,
        galeria: o.tienda.galeria?.nombre ?? null,
        actualizada_en: o.actualizadaEn.toISOString(),
        tienda: { nombre: o.tienda.nombre, stand: o.tienda.stand },
        precio: precioPara(o, mirada),
        precio_visible: o.precioVisible,
        propia: o.tiendaId === mirada.tiendaId,
      })),
    };
  }

  /**
   * Ficha (RF-19, RF-52). Si el producto se unió a otro (RF-54), devuelve a dónde ir
   * y el controlador responde 301. Un producto sin ofertas vigentes sigue existiendo:
   * la ficha muestra la lista vacía.
   */
  async ficha(slug: string, mirada: Mirada): Promise<RespuestaFicha | RespuestaRedireccion> {
    const producto = await this.prisma.producto.findUnique({
      where: { slug },
      include: {
        categoria: { select: { slug: true, nombre: true } },
        marca: { select: { nombre: true } },
        fotos: FOTOS,
        etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
        fusionadoEn: { select: { slug: true } },
      },
    });
    if (!producto) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Este producto no existe en PaseLibre.',
      );
    }
    if (producto.fusionadoEn) return { redirigir_a: producto.fusionadoEn.slug };

    const detalle: ProductoDetalle = {
      id: producto.id,
      slug: producto.slug,
      titulo: producto.titulo,
      modelo: producto.modelo,
      categoria: producto.categoria,
      marca: producto.marca?.nombre ?? null,
      etiquetas: producto.etiquetas.map((e) => e.etiqueta.nombre),
      caracteristicas: this.caracteristicas(producto.caracteristicas),
      fotos: producto.fotos.map(aFoto),
    };
    const where: Prisma.OfertaWhereInput = { ...OFERTA_VIGENTE, productoId: producto.id };

    if (!conSesion(mirada)) {
      // Para el visitante, de la más reciente a la más antigua: ordenar por precio lo delataría.
      const ofertas = await this.prisma.oferta.findMany({
        where,
        orderBy: [{ actualizadaEn: 'desc' }, { id: 'asc' }],
        select: SELECT_OFERTA_PUBLICA,
      });
      return { audiencia: 'visitante', producto: detalle, ofertas: ofertas.map(ofertaPublica) };
    }

    const ofertas = await this.prisma.oferta.findMany({
      where,
      select: SELECT_OFERTA_CON_VENDEDOR,
    });
    return {
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      producto: detalle,
      ofertas: ofertas.sort(compararPorPrecio).map((o) => ofertaConVendedor(o, mirada)),
    };
  }

  private async totales(): Promise<RespuestaPortada['totales']> {
    const [fila] = await this.prisma.$queryRaw<Array<RespuestaPortada['totales']>>`
      SELECT count(DISTINCT o.producto_id)::int AS productos,
             count(DISTINCT o.tienda_id)::int AS tiendas,
             (SELECT count(*)::int FROM galeria WHERE activa) AS galerias
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE o.estado = 'ACTIVA'`;
    return fila ?? { productos: 0, tiendas: 0, galerias: 0 };
  }

  private caracteristicas(valor: Prisma.JsonValue): Record<string, string> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
    return Object.fromEntries(
      Object.entries(valor).filter((par): par is [string, string] => typeof par[1] === 'string'),
    );
  }
}
