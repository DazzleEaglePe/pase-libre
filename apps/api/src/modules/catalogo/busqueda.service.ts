import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buscarSchema,
  normalizarTexto,
  precioDe,
  type BuscarConsulta,
  type Condicion,
  type Faceta,
  type MasBuscadoConsulta,
  type OfertaDestacada,
  type Precio,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
  type RespuestaBuscar,
  type RespuestaMasBuscado,
  type RespuestaSugerenciasBusqueda,
  type SugerenciasBusquedaConsulta,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { INDEPENDIENTES } from './catalogo.service';
import { conSesion, tiendaPara } from './visibilidad';

export const POR_PAGINA = 24;
/** Productos del desplegable del buscador. */
export const SUGERENCIAS = 5;
/** Términos de «Lo más buscado». */
export const MAS_BUSCADOS = 4;
/** Cuántos de lo más buscado se prueban contra una categoría antes de rendirse. */
const CANDIDATOS_POR_CATEGORIA = 20;

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
  /** La oferta destacada (solo se pide con sesión). */
  oferta_id?: string;
  tienda_id?: string;
  tienda_nombre?: string;
  tienda_stand?: string | null;
  d_tienda_visible?: boolean;
  d_condicion?: Condicion;
  d_stock?: number;
  d_galeria?: string;
  d_moneda?: 'USD' | 'PEN';
  d_precio?: bigint | null;
  d_visible?: boolean;
  d_mas_barato?: boolean;
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
 *    menor precio visible y la oferta más barata para escribirle. Al visitante no se le
 *    piden ni se le calculan precios ni tiendas.
 */
@Injectable()
export class BusquedaService {
  private readonly logger = new Logger(BusquedaService.name);

  /** Soles por dólar, solo para comparar (TIPO_CAMBIO). */
  private readonly tipoCambio: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.tipoCambio = config.get('TIPO_CAMBIO', { infer: true });
  }

  async buscar(consulta: BuscarConsulta, mirada: Mirada): Promise<RespuestaBuscar> {
    const conPrecio = conSesion(mirada);
    // Al visitante se le ignoran el filtro y el orden por precio: si no, podría deducir
    // los precios probando rangos (docs/05 §5).
    const efectiva: BuscarConsulta = conPrecio
      ? consulta
      : { ...consulta, precio_min: undefined, precio_max: undefined, orden: 'recientes' };

    const palabras = this.palabras(consulta.q);
    let resultado = await this.ejecutar(palabras, efectiva, conPrecio, POR_PAGINA, mirada.tiendaId);
    let correccion: RespuestaBuscar['correccion'] = null;

    if (resultado.totalProductos === 0 && palabras.length > 0) {
      const corregidas = await this.corregir(palabras);
      if (corregidas.join(' ') !== palabras.join(' ')) {
        const intento = await this.ejecutar(
          corregidas,
          efectiva,
          conPrecio,
          POR_PAGINA,
          mirada.tiendaId,
        );
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
      productos: resultado.filas.map((f) => this.productoConPrecio(f, mirada)),
    };
  }

  /**
   * El desplegable del buscador de la barra: los primeros productos de la misma búsqueda,
   * con su corrección. No se registra (lo que se va escribiendo no es una búsqueda) y va
   * siempre como para un visitante: el desplegable no muestra precios ni tiendas.
   */
  async sugerencias(consulta: SugerenciasBusquedaConsulta): Promise<RespuestaSugerenciasBusqueda> {
    const palabras = this.palabras(consulta.q);
    if (palabras.length === 0) return { correccion: null, total_productos: 0, productos: [] };
    const base = buscarSchema.parse({ q: consulta.q, categoria: consulta.categoria });

    let resultado = await this.ejecutar(palabras, base, false, SUGERENCIAS);
    let correccion: RespuestaSugerenciasBusqueda['correccion'] = null;
    if (resultado.totalProductos === 0) {
      const corregidas = await this.corregir(palabras);
      if (corregidas.join(' ') !== palabras.join(' ')) {
        const intento = await this.ejecutar(corregidas, base, false, SUGERENCIAS);
        if (intento.totalProductos > 0) {
          resultado = intento;
          correccion = { buscaste: consulta.q, mostramos: corregidas.join(' ') };
        }
      }
    }
    return {
      correccion,
      total_productos: resultado.totalProductos,
      productos: resultado.filas.map((f) => this.productoEnLista(f)),
    };
  }

  /**
   * «Lo más buscado» del buscador: lo que se buscó al menos dos veces en los últimos 30 días
   * y encontró algo. «RTX3070» y «rtx 3070» cuentan juntos (misma forma normalizada), y se
   * muestra como más se escribió. Con categoría, se quedan los que hoy encuentran algo en
   * ella («Lo más buscado en Gráficas»), probando a lo más los 20 primeros.
   */
  async masBuscado(consulta: MasBuscadoConsulta = {}): Promise<RespuestaMasBuscado> {
    const todos = await this.terminosRepetidos();
    if (!consulta.categoria) return { terminos: todos.slice(0, MAS_BUSCADOS) };

    const base = buscarSchema.parse({ categoria: consulta.categoria });
    const terminos: string[] = [];
    for (const termino of todos.slice(0, CANDIDATOS_POR_CATEGORIA)) {
      if (terminos.length === MAS_BUSCADOS) break;
      if (await this.hayResultados(this.palabras(termino), base)) terminos.push(termino);
    }
    return { terminos };
  }

  /** Lo buscado al menos dos veces, de más a menos, con la forma que más se escribió. */
  private async terminosRepetidos(): Promise<string[]> {
    const filas = await this.prisma.$queryRaw<Array<{ texto: string; veces: number }>>`
      SELECT regexp_replace(lower(trim(coalesce(texto_corregido, texto))), '[[:space:]]+', ' ', 'g') AS texto,
             count(*)::int AS veces
      FROM busqueda
      WHERE resultados > 0 AND creada_en > now() - interval '30 days'
      GROUP BY 1
      ORDER BY 2 DESC, 1
      LIMIT 200`;
    const grupos = new Map<string, { veces: number; forma: string; vecesForma: number }>();
    for (const fila of filas) {
      const clave = normalizarTexto(fila.texto);
      if (!clave) continue;
      const grupo = grupos.get(clave);
      if (!grupo) {
        grupos.set(clave, { veces: fila.veces, forma: fila.texto, vecesForma: fila.veces });
      } else {
        grupo.veces += fila.veces;
        if (fila.veces > grupo.vecesForma) {
          grupo.forma = fila.texto;
          grupo.vecesForma = fila.veces;
        }
      }
    }
    return [...grupos.values()]
      .filter((grupo) => grupo.veces >= 2)
      .sort((a, b) => b.veces - a.veces || a.forma.localeCompare(b.forma, 'es'))
      .map((grupo) => grupo.forma);
  }

  /** Si lo escrito encuentra hoy al menos una oferta vigente (con la categoría de `consulta`). */
  private async hayResultados(palabras: string[], consulta: BuscarConsulta): Promise<boolean> {
    if (palabras.length === 0) return false;
    const condiciones = this.condicionesBase(palabras, consulta);
    const [fila] = await this.prisma.$queryRaw<Array<{ hay: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM oferta o
        JOIN tienda t ON t.id = o.tienda_id
        JOIN producto p ON p.id = o.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        WHERE ${Prisma.join(condiciones, ' AND ')}
      ) AS hay`;
    return fila?.hay === true;
  }

  /** Palabras normalizadas y sin repetir de lo que se escribió (también para «Ya está en PaseLibre»). */
  palabras(q: string): string[] {
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
    // `precio_eq`: el precio visible en céntimos de dólar, solo para comparar (nunca se muestra).
    const columnasPrecio = conPrecio
      ? Prisma.sql`, o.moneda, o.precio_centimos, o.precio_visible,
             o.id AS oferta_id, o.tienda_id, t.nombre AS tienda_nombre, t.stand AS tienda_stand,
             o.tienda_visible,
             CASE WHEN o.precio_visible AND o.precio_centimos IS NOT NULL
                  THEN o.precio_centimos::numeric
                       / CASE WHEN o.moneda::text = 'PEN' THEN CAST(${this.tipoCambio} AS numeric) ELSE 1 END
             END AS precio_eq`
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
    limite = POR_PAGINA,
    /** La tienda de quien mira: su propia oferta solo se destaca si no hay otra. */
    miTiendaId: string | null = null,
  ): Promise<Resultado> {
    const filtradas = this.filtradas(palabras, consulta, conPrecio);
    const agregadosPrecio = conPrecio
      ? Prisma.sql`,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'USD') AS desde_usd,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'PEN') AS desde_pen,
        min(f.precio_eq) AS desde_eq,
        count(*) FILTER (WHERE NOT f.precio_visible OR f.precio_centimos IS NULL)::int AS al_interno`
      : Prisma.empty;
    // Con sesión se compara en dólares (`precio_eq`): un precio en soles y uno en dólares
    // quedan en la misma vara, y los productos sin precio visible van al final.
    const orden =
      consulta.orden === 'precio_asc'
        ? Prisma.sql`g.desde_eq ASC NULLS LAST, g.actualizada_en DESC, g.titulo`
        : consulta.orden === 'precio_desc'
          ? Prisma.sql`g.desde_eq DESC NULLS LAST, g.actualizada_en DESC, g.titulo`
          : Prisma.sql`g.actualizada_en DESC, g.titulo`;
    // La oferta destacada: la de otra tienda antes que la propia (la tarjeta es para escribirle
    // a alguien), con stock, con precio visible y la más barata; entre iguales, la más reciente.
    // «Más barata» es la de menor precio entre todos los resultados.
    const destacada = conPrecio
      ? Prisma.sql`,
        d AS (
          SELECT DISTINCT ON (f.producto_id)
                 f.producto_id, f.oferta_id, f.tienda_id, f.tienda_nombre, f.tienda_stand,
                 f.tienda_visible AS d_tienda_visible,
                 f.condicion::text AS d_condicion, f.stock AS d_stock, f.galeria_nombre AS d_galeria,
                 f.moneda::text AS d_moneda, f.precio_centimos AS d_precio,
                 f.precio_visible AS d_visible, f.precio_eq AS d_eq
          FROM f
          ORDER BY f.producto_id, COALESCE(f.tienda_id = CAST(${miTiendaId} AS uuid), false) ASC,
                   (f.stock > 0) DESC, (f.precio_eq IS NOT NULL) DESC,
                   f.precio_eq ASC, f.actualizada_en DESC, f.oferta_id
        )`
      : Prisma.empty;
    const columnasDestacada = conPrecio
      ? Prisma.sql`, d.oferta_id, d.tienda_id, d.tienda_nombre, d.tienda_stand, d.d_tienda_visible,
               d.d_condicion,
               d.d_stock, d.d_galeria, d.d_moneda, d.d_precio, d.d_visible,
               (d.d_stock > 0 AND d.d_eq IS NOT NULL
                 AND d.d_eq = min(d.d_eq) FILTER (WHERE d.d_stock > 0) OVER ()) AS d_mas_barato`
      : Prisma.empty;
    const unirDestacada = conPrecio
      ? Prisma.sql`JOIN d ON d.producto_id = g.producto_id`
      : Prisma.empty;

    const [filas, totales] = await Promise.all([
      this.prisma.$queryRaw<FilaProducto[]>`
        WITH f AS (${filtradas}),
        g AS (
          SELECT p.id AS producto_id, p.slug::text AS slug, p.titulo,
                 c.slug::text AS categoria_slug, c.nombre AS categoria_nombre,
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
        )${destacada}
        SELECT g.*${columnasDestacada}
        FROM g
        ${unirDestacada}
        ORDER BY ${orden}
        LIMIT ${limite} OFFSET ${(consulta.pagina - 1) * limite}`,
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
  async corregir(palabras: string[]): Promise<string[]> {
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

  /**
   * Conteos para el lateral, sobre lo que coincide con el texto y la categoría. Las
   * categorías se cuentan sin su propio filtro: así las tarjetas de arriba de los resultados
   * siguen mostrando las otras categorías después de elegir una.
   */
  private async facetas(
    palabras: string[],
    consulta: BuscarConsulta,
  ): Promise<RespuestaBuscar['facetas']> {
    const condiciones = this.condicionesBase(palabras, consulta);
    const sinCategoria = this.condicionesBase(palabras, { ...consulta, categoria: undefined });
    const categorias = this.prisma.$queryRaw<Faceta[]>`
      SELECT c.slug::text AS slug, c.nombre, count(DISTINCT p.id)::int AS cantidad
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id
      JOIN producto p ON p.id = o.producto_id
      JOIN categoria c ON c.id = p.categoria_id
      WHERE ${Prisma.join(sinCategoria, ' AND ')}
      GROUP BY c.slug, c.nombre, c.orden
      ORDER BY 3 DESC, c.orden, c.nombre`;
    const lateral = this.prisma.$queryRaw<Array<Faceta & { dimension: string }>>`
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
    const [filas, porCategoria] = await Promise.all([lateral, categorias]);

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
      categorias: porCategoria,
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

  private productoConPrecio(f: FilaProducto, mirada: Mirada): ProductoEnListaConPrecio {
    const lista = this.productoEnLista(f);
    const precios: Precio[] = [];
    if (f.desde_usd != null) precios.push(precioDe(Number(f.desde_usd), 'USD'));
    if (f.desde_pen != null) precios.push(precioDe(Number(f.desde_pen), 'PEN'));
    return {
      ...lista,
      ofertas: { ...lista.ofertas, precios_desde: precios, al_interno: f.al_interno ?? 0 },
      oferta_destacada: this.ofertaDestacada(f, mirada),
    };
  }

  private ofertaDestacada(f: FilaProducto, mirada: Mirada): OfertaDestacada {
    const visible = f.d_visible === true && f.d_precio != null && f.d_moneda != null;
    const tiendaVisible = f.d_tienda_visible !== false;
    const tienda = tiendaPara(
      { tiendaVisible, tiendaId: f.tienda_id as string },
      {
        id: f.tienda_id as string,
        nombre: f.tienda_nombre as string,
        stand: f.tienda_stand ?? null,
      },
      mirada,
    );
    return {
      id: f.oferta_id as string,
      condicion: f.d_condicion as Condicion,
      stock: f.d_stock ?? 0,
      galeria: f.d_galeria as string,
      precio: visible ? precioDe(Number(f.d_precio), f.d_moneda as 'USD' | 'PEN') : null,
      tienda: { nombre: tienda.nombre, stand: tienda.stand },
      tienda_visible: tiendaVisible,
      propia: f.tienda_id === mirada.tiendaId,
      mas_barata: f.d_mas_barato === true,
    };
  }
}
