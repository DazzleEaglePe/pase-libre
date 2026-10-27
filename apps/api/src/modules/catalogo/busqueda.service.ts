import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  normalizarTexto,
  precioDe,
  type BuscarConsulta,
  type Condicion,
  type Faceta,
  type Precio,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
  type RespuestaBuscar,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { INDEPENDIENTES } from './catalogo.service';
import { conSesion } from './visibilidad';

export const POR_PAGINA = 24;

interface FilaProducto {
  slug: string;
  titulo: string;
  categoria_slug: string;
  categoria_nombre: string;
  marca: string | null;
  foto: string | null;
  cantidad: number;
  galerias: string[];
  condiciones: Condicion[];
  stock_total: number;
  actualizada_en: Date;
  desde_usd?: bigint | null;
  desde_pen?: bigint | null;
  al_interno?: number;
}

interface Resultado {
  filas: FilaProducto[];
  totalProductos: number;
  totalOfertas: number;
}

/**
 * Búsqueda tolerante a errores (docs/05 §7, RF-12 a RF-18).
 *
 * 1. Normaliza lo escrito igual que el catálogo («RTX3070» → «rtx 3070»).
 * 2. Busca productos donde cada palabra es el comienzo de alguna palabra del producto.
 * 3. Si no hay nada, corrige palabra por palabra contra `termino` y vuelve a buscar.
 * 4. Agrupa por producto: cuántas ofertas, en qué galerías, stock y, con sesión, el
 *    menor precio visible. Al visitante no se le piden ni se le calculan precios.
 */
@Injectable()
export class BusquedaService {
  private readonly logger = new Logger(BusquedaService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async buscar(consulta: BuscarConsulta, mirada: Mirada): Promise<RespuestaBuscar> {
    const conPrecio = conSesion(mirada);
    // Al visitante se le ignoran el filtro y el orden por precio: si no, podría deducir
    // los precios probando rangos (docs/05 §5).
    const efectiva: BuscarConsulta = conPrecio
      ? consulta
      : { ...consulta, precio_min: undefined, precio_max: undefined, orden: 'recientes' };

    const palabras = this.palabras(consulta.q);
    let resultado = await this.ejecutar(palabras, efectiva, conPrecio);
    let correccion: RespuestaBuscar['correccion'] = null;

    if (resultado.totalProductos === 0 && palabras.length > 0) {
      const corregidas = await this.corregir(palabras);
      if (corregidas.join(' ') !== palabras.join(' ')) {
        const intento = await this.ejecutar(corregidas, efectiva, conPrecio);
        if (intento.totalProductos > 0) {
          resultado = intento;
          correccion = { buscaste: consulta.q, mostramos: corregidas.join(' ') };
        }
      }
    }

    const facetas = await this.facetas(
      correccion ? correccion.mostramos.split(' ') : palabras,
      efectiva,
    );
    await this.registrar(
      consulta.q,
      correccion?.mostramos ?? null,
      resultado.totalProductos,
      mirada,
    );

    const base = {
      correccion,
      total_productos: resultado.totalProductos,
      total_ofertas: resultado.totalOfertas,
      pagina: efectiva.pagina,
      paginas: Math.max(1, Math.ceil(resultado.totalProductos / POR_PAGINA)),
      facetas,
    };
    if (!conPrecio) {
      return {
        ...base,
        audiencia: 'visitante',
        productos: resultado.filas.map((f) => this.productoEnLista(f)),
      };
    }
    return {
      ...base,
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      productos: resultado.filas.map((f) => this.productoConPrecio(f)),
    };
  }

  private palabras(q: string): string[] {
    const normalizado = normalizarTexto(q);
    return normalizado ? [...new Set(normalizado.split(' '))].slice(0, 12) : [];
  }

  /** Condiciones de producto y de vigencia, sin los filtros de faceta. */
  private condicionesBase(palabras: string[], consulta: BuscarConsulta): Prisma.Sql[] {
    const condiciones: Prisma.Sql[] = [
      Prisma.sql`o.estado = 'ACTIVA'`,
      Prisma.sql`t.estado = 'ACTIVA'`,
      Prisma.sql`p.fusionado_en_id IS NULL`,
    ];
    // Las palabras normalizadas solo tienen letras y números: no hay comodines que escapar.
    for (const palabra of palabras) {
      condiciones.push(Prisma.sql`(' ' || p.texto_busqueda) LIKE ${`% ${palabra}%`}`);
    }
    if (consulta.categoria) condiciones.push(Prisma.sql`c.slug = ${consulta.categoria}`);
    return condiciones;
  }

  /** Filtros que elige el usuario en el lateral (RF-16, RF-17). */
  private condicionesFaceta(consulta: BuscarConsulta, conPrecio: boolean): Prisma.Sql[] {
    const condiciones: Prisma.Sql[] = [];
    if (consulta.galeria.length > 0) {
      const conGaleria = consulta.galeria.filter((g) => g !== INDEPENDIENTES.slug);
      const independientes = consulta.galeria.includes(INDEPENDIENTES.slug);
      const partes: Prisma.Sql[] = [];
      if (conGaleria.length > 0) partes.push(Prisma.sql`g.slug IN (${Prisma.join(conGaleria)})`);
      if (independientes) partes.push(Prisma.sql`t.galeria_id IS NULL`);
      condiciones.push(Prisma.sql`(${Prisma.join(partes, ' OR ')})`);
    }
    if (consulta.marca.length > 0)
      condiciones.push(Prisma.sql`m.slug IN (${Prisma.join(consulta.marca)})`);
    if (consulta.condicion.length > 0) {
      const valores = consulta.condicion.map((c) => c.toUpperCase());
      condiciones.push(Prisma.sql`o.condicion::text IN (${Prisma.join(valores)})`);
    }
    if (consulta.stock) condiciones.push(Prisma.sql`o.stock > 0`);
    if (conPrecio && (consulta.precio_min !== undefined || consulta.precio_max !== undefined)) {
      // Las ofertas al interno siempre se muestran; las visibles en otra moneda no se comparan.
      const minimo = Math.round((consulta.precio_min ?? 0) * 100);
      const maximo = Math.round((consulta.precio_max ?? 1_000_000) * 100);
      condiciones.push(Prisma.sql`(
        NOT o.precio_visible OR o.precio_centimos IS NULL
        OR (o.moneda::text = ${consulta.moneda} AND o.precio_centimos BETWEEN ${minimo} AND ${maximo})
      )`);
    }
    return condiciones;
  }

  private filtradas(palabras: string[], consulta: BuscarConsulta, conPrecio: boolean): Prisma.Sql {
    const condiciones = [
      ...this.condicionesBase(palabras, consulta),
      ...this.condicionesFaceta(consulta, conPrecio),
    ];
    const columnasPrecio = conPrecio
      ? Prisma.sql`, o.moneda, o.precio_centimos, o.precio_visible`
      : Prisma.empty;
    return Prisma.sql`
      SELECT o.producto_id, o.condicion, o.stock, o.actualizada_en,
             coalesce(g.nombre, ${INDEPENDIENTES.nombre}) AS galeria_nombre
             ${columnasPrecio}
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id
      LEFT JOIN galeria g ON g.id = t.galeria_id
      JOIN producto p ON p.id = o.producto_id
      JOIN categoria c ON c.id = p.categoria_id
      LEFT JOIN marca m ON m.id = p.marca_id
      WHERE ${Prisma.join(condiciones, ' AND ')}`;
  }

  private async ejecutar(
    palabras: string[],
    consulta: BuscarConsulta,
    conPrecio: boolean,
  ): Promise<Resultado> {
    const filtradas = this.filtradas(palabras, consulta, conPrecio);
    const agregadosPrecio = conPrecio
      ? Prisma.sql`,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'USD') AS desde_usd,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'PEN') AS desde_pen,
        count(*) FILTER (WHERE NOT f.precio_visible OR f.precio_centimos IS NULL)::int AS al_interno`
      : Prisma.empty;
    const orden =
      consulta.orden === 'precio_asc'
        ? Prisma.sql`desde_usd ASC NULLS LAST, desde_pen ASC NULLS LAST, actualizada_en DESC`
        : consulta.orden === 'precio_desc'
          ? Prisma.sql`desde_usd DESC NULLS LAST, desde_pen DESC NULLS LAST, actualizada_en DESC`
          : Prisma.sql`actualizada_en DESC, p.titulo`;

    const [filas, totales] = await Promise.all([
      this.prisma.$queryRaw<FilaProducto[]>`
        WITH f AS (${filtradas})
        SELECT p.slug::text AS slug, p.titulo, c.slug::text AS categoria_slug, c.nombre AS categoria_nombre,
               m.nombre::text AS marca,
               (SELECT pf.ruta FROM producto_foto pf WHERE pf.producto_id = p.id ORDER BY pf.orden LIMIT 1) AS foto,
               count(*)::int AS cantidad,
               array_agg(DISTINCT f.galeria_nombre) AS galerias,
               array_agg(DISTINCT f.condicion::text) AS condiciones,
               sum(f.stock)::int AS stock_total,
               max(f.actualizada_en) AS actualizada_en
               ${agregadosPrecio}
        FROM f
        JOIN producto p ON p.id = f.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        LEFT JOIN marca m ON m.id = p.marca_id
        GROUP BY p.id, c.slug, c.nombre, m.nombre
        ORDER BY ${orden}
        LIMIT ${POR_PAGINA} OFFSET ${(consulta.pagina - 1) * POR_PAGINA}`,
      this.prisma.$queryRaw<Array<{ productos: number; ofertas: number }>>`
        WITH f AS (${filtradas})
        SELECT count(DISTINCT producto_id)::int AS productos, count(*)::int AS ofertas FROM f`,
    ]);
    return {
      filas,
      totalProductos: totales[0]?.productos ?? 0,
      totalOfertas: totales[0]?.ofertas ?? 0,
    };
  }

  /**
   * Corrige cada palabra que no está en el catálogo (docs/05 §7). Con números se exige
   * distancia de Levenshtein 1 («3370» → «3070»): la similitud por trigramas falla con
   * números cortos. Con letras se acepta distancia 1 o 2 según el largo, o similitud ≥ 0,4.
   */
  private async corregir(palabras: string[]): Promise<string[]> {
    const conocidas = await this.prisma.termino.findMany({
      where: { palabra: { in: palabras } },
      select: { palabra: true },
    });
    const conocidasSet = new Set(conocidas.map((t) => t.palabra));

    return Promise.all(
      palabras.map(async (palabra) => {
        if (conocidasSet.has(palabra)) return palabra;
        if (/^\d+$/.test(palabra)) {
          const [candidata] = await this.prisma.$queryRaw<Array<{ palabra: string }>>`
            SELECT palabra FROM termino
            WHERE palabra ~ '^[0-9]+$' AND abs(length(palabra) - ${palabra.length}) <= 1
              AND levenshtein(palabra, ${palabra}) <= 1
            ORDER BY levenshtein(palabra, ${palabra}), veces DESC, palabra
            LIMIT 1`;
          return candidata?.palabra ?? palabra;
        }
        if (palabra.length < 3) return palabra;
        const distancia = palabra.length >= 5 ? 2 : 1;
        const [candidata] = await this.prisma.$queryRaw<Array<{ palabra: string }>>`
          SELECT palabra FROM termino
          WHERE palabra ~ '[a-z]'
            AND (levenshtein(palabra, ${palabra}) <= ${distancia} OR similarity(palabra, ${palabra}) >= 0.4)
          ORDER BY levenshtein(palabra, ${palabra}), similarity(palabra, ${palabra}) DESC, veces DESC, palabra
          LIMIT 1`;
        return candidata?.palabra ?? palabra;
      }),
    );
  }

  /** Conteos para el lateral, sobre lo que coincide con el texto y la categoría. */
  private async facetas(
    palabras: string[],
    consulta: BuscarConsulta,
  ): Promise<RespuestaBuscar['facetas']> {
    const condiciones = this.condicionesBase(palabras, consulta);
    const filas = await this.prisma.$queryRaw<Array<Faceta & { dimension: string }>>`
      WITH base AS (
        SELECT o.condicion, o.stock, g.slug::text AS galeria_slug, g.nombre AS galeria_nombre,
               m.slug::text AS marca_slug, m.nombre::text AS marca_nombre
        FROM oferta o
        JOIN tienda t ON t.id = o.tienda_id
        LEFT JOIN galeria g ON g.id = t.galeria_id
        JOIN producto p ON p.id = o.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        LEFT JOIN marca m ON m.id = p.marca_id
        WHERE ${Prisma.join(condiciones, ' AND ')}
      )
      SELECT 'galeria' AS dimension, coalesce(galeria_slug, ${INDEPENDIENTES.slug}) AS slug,
             coalesce(galeria_nombre, ${INDEPENDIENTES.nombre}) AS nombre, count(*)::int AS cantidad
      FROM base GROUP BY 2, 3
      UNION ALL
      SELECT 'marca', marca_slug, marca_nombre, count(*)::int FROM base WHERE marca_slug IS NOT NULL GROUP BY 2, 3
      UNION ALL
      SELECT 'condicion', lower(condicion::text), initcap(lower(condicion::text)), count(*)::int FROM base GROUP BY 2, 3
      UNION ALL
      SELECT 'stock', 'con-stock', 'Con stock', count(*)::int FROM base WHERE stock > 0`;

    const de = (dimension: string): Faceta[] =>
      filas
        .filter((f) => f.dimension === dimension)
        .map(({ slug, nombre, cantidad }) => ({ slug, nombre, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre, 'es'));
    return {
      galerias: de('galeria'),
      marcas: de('marca'),
      condiciones: de('condicion'),
      con_stock: filas.find((f) => f.dimension === 'stock')?.cantidad ?? 0,
    };
  }

  /** RF-31 y RF-32: guarda la búsqueda, también las que no encontraron nada. */
  private async registrar(
    texto: string,
    corregido: string | null,
    resultados: number,
    mirada: Mirada,
  ): Promise<void> {
    if (!texto) return;
    try {
      await this.prisma.busqueda.create({
        data: {
          texto: texto.slice(0, 200),
          textoCorregido: corregido,
          resultados,
          usuarioId: mirada.usuarioId,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudo registrar la búsqueda: ${String(error)}`);
    }
  }

  private productoEnLista(f: FilaProducto): ProductoEnLista {
    return {
      slug: f.slug,
      titulo: f.titulo,
      categoria: { slug: f.categoria_slug, nombre: f.categoria_nombre },
      marca: f.marca,
      foto: f.foto,
      ofertas: {
        cantidad: f.cantidad,
        galerias: [...f.galerias].sort((a, b) => a.localeCompare(b, 'es')),
        condiciones: [...f.condiciones].sort() as Condicion[],
        stock_total: f.stock_total,
        actualizada_en: f.actualizada_en.toISOString(),
      },
    };
  }

  private productoConPrecio(f: FilaProducto): ProductoEnListaConPrecio {
    const lista = this.productoEnLista(f);
    const precios: Precio[] = [];
    if (f.desde_usd != null) precios.push(precioDe(Number(f.desde_usd), 'USD'));
    if (f.desde_pen != null) precios.push(precioDe(Number(f.desde_pen), 'PEN'));
    return {
      ...lista,
      ofertas: { ...lista.ofertas, precios_desde: precios, al_interno: f.al_interno ?? 0 },
    };
  }
}
