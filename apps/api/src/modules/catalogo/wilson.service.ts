import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  precioDe,
  type GaleriaEnVivo,
  type PisoDeGaleria,
  type PrecioDeModelo,
  type PreciosCategoriaConsulta,
  type RespuestaPreciosCategoria,
  type RespuestaWilson,
  type RitmoModelo,
  type WilsonConsulta,
} from '@paselibre/contracts';
import { Prisma, type Moneda } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { tiendasBloqueadasPor } from '../../shared/bloqueadas';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { inicioDelDiaEnLima } from '../en-vivo/horario';
import {
  detalleDe,
  OFERTA_VIGENTE,
  PRODUCTO_TARJETA,
  SELECT_OFERTA_CON_VENDEDOR,
  SELECT_OFERTA_PUBLICA,
  tarjetaConVendedor,
} from './catalogo.service';
import { conSesion } from './visibilidad';

/** Una persona camina unos 75 m por minuto por la avenida. */
const METROS_POR_MINUTO = 75;
const OFERTAS_DE_GALERIA = 24;
const MODELOS = 60;
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

const noEncontrada = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta categoría no existe.');

/**
 * «Wilson en vivo» (CAT_Web3) y la página de una categoría con los precios de pase por modelo
 * (CAT_Web4), sección 8 del lienzo final.
 */
@Injectable()
export class WilsonService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async wilson(consulta: WilsonConsulta, mirada: Mirada): Promise<RespuestaWilson> {
    const bloqueadas = mirada.usuarioId
      ? await tiendasBloqueadasPor(this.prisma, mirada.usuarioId)
      : [];
    const categoria = consulta.categoria
      ? await this.prisma.categoria.findUnique({
          where: { slug: consulta.categoria },
          select: { id: true, slug: true, nombre: true },
        })
      : null;
    const conStock: Prisma.OfertaWhereInput = {
      AND: [
        OFERTA_VIGENTE,
        { stock: { gt: 0 } },
        categoria ? { producto: { categoriaId: categoria.id } } : {},
        bloqueadas.length > 0 ? { tiendaId: { notIn: bloqueadas } } : {},
      ],
    };

    const [top, galerias, porGaleria, tiendasPorGaleria, mia] = await Promise.all([
      this.prisma.$queryRaw<Array<{ slug: string; nombre: string }>>`
        SELECT c.slug, c.nombre FROM oferta o
        JOIN producto p ON p.id = o.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        JOIN tienda t ON t.id = o.tienda_id
        WHERE o.estado = 'ACTIVA' AND o.stock > 0 AND t.estado = 'ACTIVA' AND p.fusionado_en_id IS NULL
        GROUP BY c.slug, c.nombre ORDER BY count(*) DESC, c.nombre LIMIT 3`,
      this.prisma.galeria.findMany({
        where: { activa: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { id: true, slug: true, nombre: true, metros: true },
      }),
      this.prisma.oferta.groupBy({
        by: ['tiendaId'],
        where: conStock,
        _count: { _all: true },
      }),
      this.prisma.tienda.groupBy({
        by: ['galeriaId'],
        where: { estado: 'ACTIVA', galeriaId: { not: null } },
        _count: { _all: true },
      }),
      mirada.tiendaId
        ? this.prisma.tienda.findUnique({
            where: { id: mirada.tiendaId },
            select: { galeriaId: true },
          })
        : null,
    ]);

    // De tienda a galería, para sumar lo publicado por galería.
    const tiendas = await this.prisma.tienda.findMany({
      where: { id: { in: porGaleria.map((fila) => fila.tiendaId) } },
      select: { id: true, galeriaId: true },
    });
    const galeriaDe = new Map(tiendas.map((tienda) => [tienda.id, tienda.galeriaId]));
    const productos = new Map<string, number>();
    for (const fila of porGaleria) {
      const galeriaId = galeriaDe.get(fila.tiendaId);
      if (galeriaId) productos.set(galeriaId, (productos.get(galeriaId) ?? 0) + fila._count._all);
    }
    const tiendasEn = new Map(tiendasPorGaleria.map((fila) => [fila.galeriaId, fila._count._all]));
    const mias = galerias.find((galeria) => galeria.id === mia?.galeriaId);
    const lista: Array<GaleriaEnVivo & { id: string }> = galerias.map((galeria) => ({
      id: galeria.id,
      slug: galeria.slug,
      nombre: galeria.nombre,
      productos: productos.get(galeria.id) ?? 0,
      tiendas: tiendasEn.get(galeria.id) ?? 0,
      mia: galeria.id === mias?.id,
      minutos:
        galeria.id === mias?.id
          ? 0
          : mias?.metros != null && galeria.metros != null
            ? Math.max(1, Math.round(Math.abs(galeria.metros - mias.metros) / METROS_POR_MINUTO))
            : null,
    }));
    const elegida =
      lista.find((galeria) => galeria.slug === consulta.galeria) ??
      lista.find((galeria) => galeria.mia) ??
      [...lista].sort((a, b) => b.productos - a.productos)[0] ??
      null;
    const sinId = ({ id: _id, ...galeria }: GaleriaEnVivo & { id: string }): GaleriaEnVivo =>
      galeria;
    const base = {
      categorias: top,
      categoria: categoria ? { slug: categoria.slug, nombre: categoria.nombre } : null,
      galerias: lista.map(sinId),
      galeria: elegida ? sinId(elegida) : null,
    };

    const deLaGaleria: Prisma.OfertaWhereInput = {
      AND: [
        conStock,
        { tienda: { galeriaId: elegida?.id ?? '00000000-0000-0000-0000-000000000000' } },
      ],
    };
    const orderBy = [{ actualizadaEn: 'desc' }, { id: 'asc' }] as const;
    if (!conSesion(mirada)) {
      const filas = elegida
        ? await this.prisma.oferta.findMany({
            where: deLaGaleria,
            orderBy: [...orderBy],
            take: OFERTAS_DE_GALERIA,
            select: { ...SELECT_OFERTA_PUBLICA, producto: PRODUCTO_TARJETA },
          })
        : [];
      return {
        ...base,
        // Sin sesión no se nombran las tiendas (docs/05 §5).
        pisos: [],
        audiencia: 'visitante',
        ofertas: filas.map((o) => ({
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
          detalle: detalleDe(o),
        })),
      };
    }

    const [filas, pisos] = await Promise.all([
      elegida
        ? this.prisma.oferta.findMany({
            where: deLaGaleria,
            orderBy: [...orderBy],
            take: OFERTAS_DE_GALERIA,
            select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
          })
        : [],
      elegida ? this.pisos(elegida.id, mirada, bloqueadas) : [],
    ]);
    return {
      ...base,
      pisos,
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      ofertas: filas.map((o) => ({ ...tarjetaConVendedor(o, mirada), detalle: detalleDe(o) })),
    };
  }

  /** «Tiendas por piso»: las activas de la galería, con lo que tienen publicado a su nombre. */
  private async pisos(
    galeriaId: string,
    mirada: Mirada,
    bloqueadas: string[],
  ): Promise<PisoDeGaleria[]> {
    const tiendas = await this.prisma.tienda.findMany({
      where: { galeriaId, estado: 'ACTIVA', id: { notIn: bloqueadas } },
      orderBy: [{ piso: 'asc' }, { stand: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        stand: true,
        piso: true,
        _count: {
          select: {
            ofertas: { where: { estado: 'ACTIVA', stock: { gt: 0 }, tiendaVisible: true } },
          },
        },
      },
    });
    const porPiso = new Map<string, PisoDeGaleria['tiendas']>();
    for (const tienda of tiendas) {
      const piso = tienda.piso
        ? /^\d+$/.test(tienda.piso)
          ? `Piso ${tienda.piso}`
          : tienda.piso
        : 'Sin piso';
      porPiso.set(piso, [
        ...(porPiso.get(piso) ?? []),
        {
          id: tienda.id,
          nombre: tienda.nombre,
          stand: tienda.stand,
          mia: tienda.id === mirada.tiendaId,
          productos: tienda._count.ofertas,
        },
      ]);
    }
    return [...porPiso.entries()].map(([piso, lista]) => ({ piso, tiendas: lista }));
  }

  // ── La página de una categoría (CAT_Web4) ────────────────────────────────

  async precios(
    slug: string,
    consulta: PreciosCategoriaConsulta,
    mirada: Mirada,
  ): Promise<RespuestaPreciosCategoria> {
    if (!conSesion(mirada)) {
      throw new ApiHttpException(
        HttpStatus.UNAUTHORIZED,
        'SIN_SESION',
        'Los precios de pase se ven al iniciar sesión.',
      );
    }
    const categoria = await this.prisma.categoria.findUnique({
      where: { slug },
      select: { id: true, slug: true, nombre: true },
    });
    if (!categoria) throw noEncontrada();
    const bloqueadas = mirada.usuarioId
      ? await tiendasBloqueadasPor(this.prisma, mirada.usuarioId)
      : [];

    const [ofertas, galerias, enVivoHoy] = await Promise.all([
      this.prisma.oferta.findMany({
        where: {
          AND: [
            OFERTA_VIGENTE,
            { stock: { gt: 0 } },
            { producto: { categoriaId: categoria.id } },
            bloqueadas.length > 0 ? { tiendaId: { notIn: bloqueadas } } : {},
          ],
        },
        select: {
          tiendaId: true,
          productoId: true,
          condicion: true,
          estadoDetalle: true,
          precioCentimos: true,
          moneda: true,
          precioVisible: true,
          producto: { select: { slug: true, titulo: true, marca: { select: { nombre: true } } } },
          tienda: { select: { galeria: { select: { slug: true } } } },
        },
      }),
      this.prisma.galeria.findMany({
        where: { activa: true },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { slug: true, nombre: true },
      }),
      this.prisma.enVivo.count({
        where: { categoriaId: categoria.id, creadoEn: { gte: inicioDelDiaEnLima(new Date()) } },
      }),
    ]);

    // La historia se guarda con todo lo de la categoría, sin los filtros de quien mira.
    await this.guardarHoy(ofertas);

    const estadoDe = (o: (typeof ofertas)[number]) =>
      o.estadoDetalle ?? (o.condicion === 'NUEVO' ? 'SELLADO' : 'USADO');
    const filtradas = ofertas.filter(
      (o) =>
        (consulta.marca.length === 0 ||
          (o.producto.marca && consulta.marca.includes(o.producto.marca.nombre))) &&
        (consulta.estado.length === 0 ||
          consulta.estado.includes(estadoDe(o) as (typeof consulta.estado)[number])) &&
        (consulta.galeria.length === 0 ||
          (o.tienda.galeria && consulta.galeria.includes(o.tienda.galeria.slug))),
    );

    const porProducto = new Map<string, typeof filtradas>();
    for (const oferta of filtradas) {
      porProducto.set(oferta.productoId, [...(porProducto.get(oferta.productoId) ?? []), oferta]);
    }
    const ids = [...porProducto.keys()];
    const desde30 = new Date(Date.now() - 30 * 86_400_000);
    const [historia, ventas] = await Promise.all([
      this.prisma.precioDiario.findMany({
        where: { productoId: { in: ids }, dia: { gte: desde30 } },
        orderBy: { dia: 'asc' },
        select: { productoId: true, moneda: true, minimoCentimos: true },
      }),
      this.prisma.venta.findMany({
        where: { oferta: { productoId: { in: ids } }, creadaEn: { gte: desde30 } },
        select: { oferta: { select: { productoId: true } } },
      }),
    ]);
    const vendidas = new Map<string, number>();
    for (const venta of ventas) {
      const id = venta.oferta.productoId;
      vendidas.set(id, (vendidas.get(id) ?? 0) + 1);
    }

    const modelos: Array<PrecioDeModelo & { vendidas: number }> = ids.map((id) => {
      const lista = porProducto.get(id) ?? [];
      const primera = lista[0];
      const { moneda, montos } = preciosVisibles(lista);
      const desde = montos.length > 0 ? Math.min(...montos) : null;
      // El promedio, redondeado a la unidad: «US$ 252», no «US$ 251.67».
      const promedio =
        montos.length > 0
          ? Math.round(montos.reduce((a, b) => a + b, 0) / montos.length / 100) * 100
          : null;
      const serie = historia
        .filter((fila) => fila.productoId === id && fila.moneda === moneda)
        .map((fila) => Number(fila.minimoCentimos));
      const viejo = serie[0];
      const ultimo = serie[serie.length - 1];
      const cuantas = vendidas.get(id) ?? 0;
      const ritmo: RitmoModelo = cuantas >= 3 ? 'RAPIDO' : cuantas >= 1 ? 'NORMAL' : 'LENTO';
      return {
        slug: primera?.producto.slug ?? '',
        titulo: primera?.producto.titulo ?? '',
        desde: desde === null || !moneda ? null : precioDe(desde, moneda),
        promedio: promedio === null || !moneda ? null : precioDe(promedio, moneda),
        serie,
        cambio:
          serie.length >= 2 && viejo && ultimo !== undefined
            ? Math.round(((ultimo - viejo) / viejo) * 100)
            : null,
        tiendas: new Set(lista.map((o) => o.tiendaId)).size,
        ofertas: lista.length,
        ritmo,
        vendidas: cuantas,
      };
    });

    const comparar: Record<
      PreciosCategoriaConsulta['orden'],
      (a: (typeof modelos)[number], b: (typeof modelos)[number]) => number
    > = {
      vendidos: (a, b) => b.vendidas - a.vendidas || b.ofertas - a.ofertas,
      // En dólares primero; sin precio a la vista, al final.
      baratos: (a, b) =>
        (a.desde ? (a.desde.moneda === 'USD' ? 0 : 1) : 2) -
          (b.desde ? (b.desde.moneda === 'USD' ? 0 : 1) : 2) ||
        (a.desde?.centimos ?? 0) - (b.desde?.centimos ?? 0),
      bajaron: (a, b) => (a.cambio ?? 999) - (b.cambio ?? 999) || b.ofertas - a.ofertas,
    };
    modelos.sort(
      (a, b) => comparar[consulta.orden](a, b) || a.titulo.localeCompare(b.titulo, 'es'),
    );

    const marcas = new Map<string, number>();
    for (const oferta of ofertas) {
      const marca = oferta.producto.marca?.nombre;
      if (marca) marcas.set(marca, (marcas.get(marca) ?? 0) + 1);
    }
    const masBajo = modelos
      .filter((modelo) => modelo.desde?.moneda === 'USD')
      .sort((a, b) => (a.desde?.centimos ?? 0) - (b.desde?.centimos ?? 0))[0];

    return {
      categoria: { slug: categoria.slug, nombre: categoria.nombre },
      resumen: {
        publicadas: filtradas.length,
        tiendas: new Set(filtradas.map((o) => o.tiendaId)).size,
        en_vivo_hoy: enVivoHoy,
        mas_bajo: masBajo?.desde ? { precio: masBajo.desde, titulo: masBajo.titulo } : null,
      },
      filtros: {
        marcas: [...marcas.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
          .slice(0, 8)
          .map(([marca]) => marca),
        galerias,
      },
      modelos: modelos.slice(0, MODELOS).map(({ vendidas: _vendidas, ...modelo }) => modelo),
    };
  }

  /** El precio de hoy de cada producto de la categoría: se pisa en cada visita del día. */
  private async guardarHoy(
    ofertas: Array<{
      productoId: string;
      precioCentimos: bigint | null;
      moneda: Moneda;
      precioVisible: boolean;
    }>,
  ): Promise<void> {
    const porProducto = new Map<string, typeof ofertas>();
    for (const oferta of ofertas) {
      porProducto.set(oferta.productoId, [...(porProducto.get(oferta.productoId) ?? []), oferta]);
    }
    const dia = new Date(`${DIA_LIMA.format(new Date())}T00:00:00Z`);
    const filas: Prisma.Sql[] = [];
    for (const [productoId, lista] of porProducto) {
      const { moneda, montos } = preciosVisibles(lista);
      if (!moneda || montos.length === 0) continue;
      const minimo = Math.min(...montos);
      const promedio = Math.round(montos.reduce((a, b) => a + b, 0) / montos.length);
      filas.push(
        Prisma.sql`(${productoId}::uuid, ${dia}::date, ${moneda}::moneda, ${minimo}, ${promedio}, ${montos.length}, now())`,
      );
    }
    if (filas.length === 0) return;
    await this.prisma.$executeRaw`
      INSERT INTO precio_diario (producto_id, dia, moneda, minimo_centimos, promedio_centimos, ofertas, actualizado_en)
      VALUES ${Prisma.join(filas)}
      ON CONFLICT (producto_id, dia) DO UPDATE SET
        moneda = EXCLUDED.moneda,
        minimo_centimos = EXCLUDED.minimo_centimos,
        promedio_centimos = EXCLUDED.promedio_centimos,
        ofertas = EXCLUDED.ofertas,
        actualizado_en = now()`;
  }
}

/**
 * Los precios que cualquier tienda ve (los que se muestran), en la moneda con más de ellos: los
 * ocultos y los de «Solo mis socios» no entran en el «desde» ni en el promedio.
 */
function preciosVisibles(
  ofertas: Array<{ precioCentimos: bigint | null; moneda: Moneda; precioVisible: boolean }>,
): { moneda: Moneda | null; montos: number[] } {
  const visibles = ofertas.filter((o) => o.precioVisible && o.precioCentimos !== null);
  const usd = visibles.filter((o) => o.moneda === 'USD').length;
  const moneda: Moneda | null =
    visibles.length === 0 ? null : usd >= visibles.length - usd ? 'USD' : 'PEN';
  return {
    moneda,
    montos: visibles.filter((o) => o.moneda === moneda).map((o) => Number(o.precioCentimos)),
  };
}
