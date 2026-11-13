import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CategoriaDelPerfil,
  OrdenPerfil,
  ProductoDeTienda,
  PublicacionesTiendaConsulta,
  RespuestaPublicacionesTienda,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { FOTO_DEL_PRODUCTO, PORTADA_DE_OFERTA, portadaDe } from '../../shared/portada';
import { variantesDe } from '../catalogo/catalogo.service';
import { ofertasMasBaratasDeLaGaleria } from '../catalogo/mas-barato';
import { preciosPara } from '../catalogo/visibilidad';

/** Productos por página en «Todo» (SG_Web); «Ver más» trae los siguientes. */
export const PRODUCTOS_EN_PERFIL = 48;
/** «Lo nuevo de esta semana» y «Sus mejores precios» van en una fila: hasta 10. */
export const EN_UNA_FILA = 10;
/** «Lo nuevo de esta semana»: lo publicado en los últimos 7 días. */
const SEMANA_MS = 7 * 86_400_000;
/** «Más vistos»: las vistas de los últimos 30 días. */
const VISTAS_MS = 30 * 86_400_000;
/** Tope de publicaciones que se ordenan en memoria (una tienda tiene unas decenas). */
const TOPE_PARA_ORDENAR = 2_000;

/** Las publicaciones que se pueden mostrar en el perfil: vigentes y con el nombre a la vista. */
export const OFERTA_DEL_PERFIL = {
  estado: 'ACTIVA',
  tiendaVisible: true,
  stock: { gt: 0 },
  producto: { fusionadoEnId: null },
} satisfies Prisma.OfertaWhereInput;

/** Lo que se pide de cada publicación del perfil. */
const SELECT_DEL_PERFIL = {
  id: true,
  condicion: true,
  stock: true,
  precioCentimos: true,
  precioFacturadoCentimos: true,
  descuentoSocioCentimos: true,
  soloSocios: true,
  moneda: true,
  precioVisible: true,
  negociable: true,
  perfilMemoria: true,
  empaque: true,
  oc: true,
  tiendaId: true,
  productoId: true,
  creadaEn: true,
  ...PORTADA_DE_OFERTA,
  producto: {
    select: {
      slug: true,
      titulo: true,
      categoria: { select: { slug: true, nombre: true } },
      ...FOTO_DEL_PRODUCTO,
      // El respaldo de Intel / EXPO para lo publicado antes de la 1.10.0 (doc 20 · A8).
      perfilMemoria: true,
    },
  },
} satisfies Prisma.OfertaSelect;

type FilaDelPerfil = Prisma.OfertaGetPayload<{ select: typeof SELECT_DEL_PERFIL }>;

/** Una publicación como la ve quien mira (precios de socia incluidos). */
function productoDeTienda(
  oferta: FilaDelPerfil,
  mirada: Mirada,
  socios: ReadonlySet<string>,
  masBarato = false,
): ProductoDeTienda {
  const precios = preciosPara(oferta, mirada, socios);
  return {
    oferta_id: oferta.id,
    producto: {
      slug: oferta.producto.slug,
      titulo: oferta.producto.titulo,
      foto: portadaDe(oferta),
      categoria: oferta.producto.categoria,
    },
    condicion: oferta.condicion,
    stock: oferta.stock,
    precio: precios.precio,
    precio_socio: precios.socio,
    // «Negociable» solo con un precio a la vista (igual que en el feed).
    negociable: precios.precio !== null && oferta.negociable,
    variantes: variantesDe(oferta, oferta.producto),
    ...(masBarato ? { mas_barato: true } : {}),
  };
}

/**
 * La pestaña Productos del perfil en tres secciones (doc 20, punto 20): «Lo nuevo de esta
 * semana», «Sus mejores precios» y «Todo» con las burbujas de sus categorías y «Ordenar ▾».
 * Solo lo vigente, con stock y con el nombre a la vista: lo reservado no sale en el perfil.
 */
@Injectable()
export class PerfilPublicacionesService {
  /** Soles por dólar, solo para comparar precios (TIPO_CAMBIO). */
  private readonly tipoCambio: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.tipoCambio = config.get('TIPO_CAMBIO', { infer: true });
  }

  /** «Todo»: con las categorías marcadas (se suman) y en el orden elegido, por páginas. */
  async todo(
    tiendaId: string,
    consulta: PublicacionesTiendaConsulta,
    mirada: Mirada,
    socios: ReadonlySet<string>,
  ): Promise<RespuestaPublicacionesTienda> {
    const where: Prisma.OfertaWhereInput = {
      tiendaId,
      ...OFERTA_DEL_PERFIL,
      ...(consulta.categoria.length > 0
        ? { producto: { fusionadoEnId: null, categoria: { slug: { in: consulta.categoria } } } }
        : {}),
    };
    const filas = await this.prisma.oferta.findMany({
      where,
      orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
      take: TOPE_PARA_ORDENAR,
      select: SELECT_DEL_PERFIL,
    });
    const ordenadas = await this.ordenar(filas, consulta.orden, mirada, socios);
    const desde = (consulta.pagina - 1) * PRODUCTOS_EN_PERFIL;
    return {
      productos: ordenadas
        .slice(desde, desde + PRODUCTOS_EN_PERFIL)
        .map((oferta) => productoDeTienda(oferta, mirada, socios)),
      total: filas.length,
      pagina: consulta.pagina,
      hay_mas: desde + PRODUCTOS_EN_PERFIL < filas.length,
    };
  }

  /** Cuántas publicaciones se ven en el perfil, en total. */
  total(tiendaId: string): Promise<number> {
    return this.prisma.oferta.count({ where: { tiendaId, ...OFERTA_DEL_PERFIL } });
  }

  /** «Lo nuevo de esta semana»: lo publicado en los últimos 7 días, lo más nuevo primero. */
  async nuevas(
    tiendaId: string,
    mirada: Mirada,
    socios: ReadonlySet<string>,
  ): Promise<ProductoDeTienda[]> {
    const filas = await this.prisma.oferta.findMany({
      where: {
        tiendaId,
        ...OFERTA_DEL_PERFIL,
        creadaEn: { gte: new Date(Date.now() - SEMANA_MS) },
      },
      orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
      take: EN_UNA_FILA,
      select: SELECT_DEL_PERFIL,
    });
    return filas.map((oferta) => productoDeTienda(oferta, mirada, socios));
  }

  /**
   * «Sus mejores precios»: sus publicaciones que son las más baratas de su galería
   * (`ofertasMasBaratasDeLaGaleria`), comparadas con las vigentes y con stock de las demás tiendas de la
   * misma galería. Primero la más nueva.
   */
  async mejoresPrecios(
    tienda: { id: string; galeriaId: string | null },
    mirada: Mirada,
    socios: ReadonlySet<string>,
  ): Promise<ProductoDeTienda[]> {
    if (!tienda.galeriaId) return [];
    const propias = await this.prisma.oferta.findMany({
      where: {
        tiendaId: tienda.id,
        ...OFERTA_DEL_PERFIL,
        precioVisible: true,
        precioCentimos: { not: null },
      },
      orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
      take: TOPE_PARA_ORDENAR,
      select: SELECT_DEL_PERFIL,
    });
    if (propias.length === 0) return [];
    // La misma regla que la chapita del Inicio (doc 20, punto 22): una sola para todo el sitio.
    const baratas = await ofertasMasBaratasDeLaGaleria(this.prisma, this.tipoCambio, {
      tiendaId: tienda.id,
    });
    return propias
      .filter((oferta) => baratas.has(oferta.id))
      .slice(0, EN_UNA_FILA)
      .map((oferta) => productoDeTienda(oferta, mirada, socios, true));
  }

  /** Las burbujas de «Todo»: solo las categorías que vende, con cuántas tiene, de más a menos. */
  async categorias(tiendaId: string): Promise<CategoriaDelPerfil[]> {
    const grupos = await this.prisma.oferta.groupBy({
      by: ['productoId'],
      where: { tiendaId, ...OFERTA_DEL_PERFIL },
      _count: { _all: true },
    });
    if (grupos.length === 0) return [];
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: grupos.map((grupo) => grupo.productoId) } },
      select: { id: true, categoria: { select: { slug: true, nombre: true, orden: true } } },
    });
    const categoriaDe = new Map(productos.map((p) => [p.id, p.categoria]));
    const cuenta = new Map<string, CategoriaDelPerfil & { orden: number }>();
    for (const grupo of grupos) {
      const categoria = categoriaDe.get(grupo.productoId);
      if (!categoria) continue;
      const actual = cuenta.get(categoria.slug) ?? {
        slug: categoria.slug,
        nombre: categoria.nombre,
        orden: categoria.orden,
        cantidad: 0,
      };
      actual.cantidad += grupo._count._all;
      cuenta.set(categoria.slug, actual);
    }
    return [...cuenta.values()]
      .sort((a, b) => b.cantidad - a.cantidad || a.orden - b.orden)
      .map(({ slug, nombre, cantidad }) => ({ slug, nombre, cantidad }));
  }

  /**
   * El orden de «Ordenar ▾». Ya vienen de la más nueva a la más vieja («Recién publicados»).
   * Por precio, el que ve quien mira, en dólares para comparar; las que no muestran precio, al
   * final (ordenar por un precio oculto lo delataría).
   */
  private async ordenar(
    filas: FilaDelPerfil[],
    orden: OrdenPerfil,
    mirada: Mirada,
    socios: ReadonlySet<string>,
  ): Promise<FilaDelPerfil[]> {
    const conDesempate = (comparar: (a: FilaDelPerfil, b: FilaDelPerfil) => number) => {
      const puesto = new Map(filas.map((fila, i) => [fila.id, i]));
      return [...filas].sort(
        (a, b) => comparar(a, b) || (puesto.get(a.id) ?? 0) - (puesto.get(b.id) ?? 0),
      );
    };
    switch (orden) {
      case 'recientes':
        return filas;
      case 'precio_asc':
      case 'precio_desc': {
        const signo = orden === 'precio_asc' ? 1 : -1;
        const enDolares = new Map(
          filas.map((fila) => {
            const precio = preciosPara(fila, mirada, socios).precio;
            if (!precio) return [fila.id, null] as const;
            const centimos = precio.centimos;
            return [fila.id, precio.moneda === 'PEN' ? centimos / this.tipoCambio : centimos];
          }),
        );
        return conDesempate((a, b) => {
          const pa = enDolares.get(a.id) ?? null;
          const pb = enDolares.get(b.id) ?? null;
          if (pa === null || pb === null) return (pa === null ? 1 : 0) - (pb === null ? 1 : 0);
          return signo * (pa - pb);
        });
      }
      case 'vistos': {
        const vistas = await this.prisma.vistaOferta.groupBy({
          by: ['ofertaId'],
          where: {
            ofertaId: { in: filas.map((fila) => fila.id) },
            dia: { gte: new Date(Date.now() - VISTAS_MS) },
          },
          _count: { _all: true },
        });
        const cuantas = new Map(vistas.map((fila) => [fila.ofertaId, fila._count._all]));
        return conDesempate((a, b) => (cuantas.get(b.id) ?? 0) - (cuantas.get(a.id) ?? 0));
      }
      case 'remates': {
        // En remate ahora: una oferta flash en vivo de esa publicación.
        const remates = await this.prisma.enVivo.findMany({
          where: {
            tipo: 'FLASH',
            estado: 'VIVO',
            venceEn: { gt: new Date() },
            ofertaId: { in: filas.map((fila) => fila.id) },
          },
          select: { ofertaId: true },
        });
        const enRemate = new Set(remates.map((fila) => fila.ofertaId));
        return conDesempate((a, b) => Number(enRemate.has(b.id)) - Number(enRemate.has(a.id)));
      }
    }
  }
}
