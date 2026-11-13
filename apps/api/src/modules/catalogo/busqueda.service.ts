import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buscarSchema,
  normalizarTexto,
  precioDe,
  type BuscarConsulta,
  type Condicion,
  type Correccion,
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
import { destacadasAhora } from '../../shared/destacados';
import { fundadorasDelDia } from '../../shared/fundadoras';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { MemoriaPorClave } from '../../shared/memoria';
import { tiendasCerradas, tiendasQueNoVeo, veComoVisitante } from '../../shared/bloqueadas';
import { INDEPENDIENTES } from './catalogo.service';
import {
  buscarConMotor,
  coincidencias,
  condicionesTexto,
  filtroDePalabras,
  type FiltroTexto,
  type Intento,
} from './motor-busqueda';
import { conSesion, tiendaPara } from './visibilidad';

export const POR_PAGINA = 24;
/** Productos del desplegable del buscador. */
export const SUGERENCIAS = 5;
/** Términos de «Lo más buscado». */
export const MAS_BUSCADOS = 4;
/** «Parecidas que sí hay» cuando no se encontró nada (EV_WebRes). */
const PARECIDAS = 3;

/**
 * La consulta con lo que agrega la API: las tiendas que quien mira no ve (bloqueadas, ocultas y
 * privadas que no sigue; `tiendasQueNoVeo`) y si eso es justo lo que no ve un visitante, para
 * saber si sirve `producto_resumen` (que solo cuenta las tiendas públicas).
 */
type ConsultaInterna = BuscarConsulta & { excluirTiendas?: string[]; comoVisitante?: boolean };

/** Si la búsqueda puede salir de `producto_resumen` en cuanto a las tiendas que se ven. */
function resumenSirve(consulta: BuscarConsulta): boolean {
  const { excluirTiendas = [], comoVisitante } = consulta as ConsultaInterna;
  return comoVisitante ?? excluirTiendas.length === 0;
}
/** Cuántos de lo más buscado se prueban contra una categoría antes de rendirse. */
const CANDIDATOS_POR_CATEGORIA = 20;
/**
 * Lo que ve un visitante es igual para todos: resultados y sugerencias se guardan 30 s por
 * consulta normalizada (docs/16 §4.4). Con sesión nunca: depende de la tienda, de sus bloqueos
 * y de la audiencia.
 */
const MEMORIA_VISITANTE_MS = 30_000;

/** La clave de una búsqueda de visitante: lo que cambia sus resultados, ya normalizado. */
function claveDeVisitante(consulta: BuscarConsulta): string {
  const lista = (valores: string[]) => [...new Set(valores)].sort();
  // Al visitante se le ignoran el precio, el orden y la moneda: no van en la clave.
  return JSON.stringify([
    normalizarTexto(consulta.q),
    consulta.categoria ?? '',
    lista(consulta.galeria),
    lista(consulta.marca),
    lista(consulta.condicion),
    consulta.stock,
    consulta.pagina,
    consulta.tal_cual,
    consulta.perfil ?? '',
  ]);
}

/** Lo guardado con lo que escribió esta persona en «Buscaste …» (lo demás sale de lo normalizado). */
function conLoEscrito<T extends { correccion: Correccion | null }>(respuesta: T, q: string): T {
  return respuesta.correccion
    ? { ...respuesta, correccion: { ...respuesta.correccion, buscaste: q } }
    : respuesta;
}

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

/** La categoría y el perfil de memoria que se entendieron, sobre lo que eligió quien busca. */
function conIntento<C extends BuscarConsulta>(consulta: C, intento: Intento): C {
  const perfil = intento.filtro.perfil === 'XMP' ? 'intel' : 'ryzen';
  return {
    ...consulta,
    categoria: intento.categoria ?? consulta.categoria,
    ...(intento.filtro.perfil && !consulta.perfil ? { perfil } : {}),
  };
}

/**
 * Búsqueda tolerante a errores (docs/05 §7, RF-12 a RF-18), con el motor de todos los
 * buscadores (doc 20 §11, `motor-busqueda.ts`).
 *
 * 1. Normaliza lo escrito igual que el catálogo («RTX3070» → «rtx 3070»).
 * 2. Busca productos donde cada término es el comienzo de alguna palabra del producto: primero
 *    lo entendido, después lo escrito, lo corregido y, al final, «Lo más parecido».
 * 3. Agrupa por producto: cuántas ofertas, en qué galerías, stock y, con sesión, el
 *    menor precio visible y la oferta más barata para escribirle. Al visitante no se le
 *    piden ni se le calculan precios ni tiendas.
 */
@Injectable()
export class BusquedaService {
  private readonly logger = new Logger(BusquedaService.name);

  /** Soles por dólar, solo para comparar (TIPO_CAMBIO). */
  private readonly tipoCambio: number;

  private readonly buscadoPorVisitantes = new MemoriaPorClave<RespuestaBuscar>(
    MEMORIA_VISITANTE_MS,
    500,
  );
  private readonly sugeridoAVisitantes = new MemoriaPorClave<RespuestaSugerenciasBusqueda>(
    MEMORIA_VISITANTE_MS,
    1_000,
  );
  /** Las facetas del visitante no cambian de una página a otra: se guardan sin la página. */
  private readonly facetasDeVisitantes = new MemoriaPorClave<RespuestaBuscar['facetas']>(
    MEMORIA_VISITANTE_MS,
    500,
  );

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.tipoCambio = config.get('TIPO_CAMBIO', { infer: true });
  }

  async buscar(consulta: BuscarConsulta, mirada: Mirada): Promise<RespuestaBuscar> {
    const respuesta = conSesion(mirada)
      ? await this.resolver(consulta, mirada)
      : conLoEscrito(
          await this.buscadoPorVisitantes.recordar(claveDeVisitante(consulta), () =>
            this.resolver(consulta, mirada),
          ),
          consulta.q,
        );
    // Cada búsqueda se registra, también la que sale de la memoria (RF-31, RF-32).
    await this.registrar(
      consulta.q,
      respuesta.correccion?.mostramos ?? null,
      respuesta.total_productos,
      mirada,
    );
    return respuesta;
  }

  private async resolver(consulta: BuscarConsulta, mirada: Mirada): Promise<RespuestaBuscar> {
    const conPrecio = conSesion(mirada);
    // Al visitante se le ignoran el filtro y el orden por precio: si no, podría deducir
    // los precios probando rangos (docs/05 §5).
    const efectiva: ConsultaInterna = conPrecio
      ? { ...consulta, ...(await this.loQueNoVe(mirada)) }
      : {
          ...consulta,
          precio_min: undefined,
          precio_max: undefined,
          orden: 'recientes',
          ...(await this.loQueNoVe(mirada)),
        };

    const palabras = this.palabras(consulta.q);
    const { resultado, intento } = await buscarConMotor(
      this.prisma,
      consulta.q,
      { categoria: efectiva.categoria ?? null, tal_cual: consulta.tal_cual },
      (i) =>
        this.ejecutar(i.filtro, conIntento(efectiva, i), conPrecio, POR_PAGINA, mirada.tiendaId),
      (r) => r.totalProductos > 0,
    );
    const usada = conIntento(efectiva, intento);
    const usado = intento.filtro;

    // «Parecidas que sí hay»: con una palabra menos cada vez («rtx 5090» → «rtx»).
    let parecidas: Resultado['filas'] = [];
    if (resultado.totalProductos === 0 && palabras.length > 1) {
      for (let cuantas = palabras.length - 1; cuantas >= 1 && parecidas.length === 0; cuantas--) {
        parecidas = (
          await this.ejecutar(
            filtroDePalabras(palabras.slice(0, cuantas)),
            { ...efectiva, pagina: 1 },
            conPrecio,
            PARECIDAS,
            mirada.tiendaId,
          )
        ).filas;
      }
    }

    const facetas = conPrecio
      ? await this.facetas(usado, usada)
      : await this.facetasDeVisitantes.recordar(
          JSON.stringify([usado, usada.categoria ?? '']),
          () => this.facetas(usado, usada),
        );

    const base = {
      correccion: intento.correccion,
      lo_mas_parecido: intento.lo_mas_parecido,
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
        parecidas: parecidas.map((f) => this.productoEnLista(f)),
      };
    }
    return {
      ...base,
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      productos: resultado.filas.map((f) => this.productoConPrecio(f, mirada)),
      parecidas: parecidas.map((f) => this.productoConPrecio(f, mirada)),
    };
  }

  /**
   * El desplegable del buscador de la barra: los primeros productos de la misma búsqueda,
   * con su corrección. No se registra (lo que se va escribiendo no es una búsqueda) y va
   * siempre como para un visitante: el desplegable no muestra precios ni tiendas.
   */
  async sugerencias(
    consulta: SugerenciasBusquedaConsulta,
    mirada: Mirada,
  ): Promise<RespuestaSugerenciasBusqueda> {
    if (conSesion(mirada)) return this.sugerir(consulta, mirada);
    const clave = JSON.stringify([normalizarTexto(consulta.q), consulta.categoria ?? '']);
    return conLoEscrito(
      await this.sugeridoAVisitantes.recordar(clave, () => this.sugerir(consulta, mirada)),
      consulta.q,
    );
  }

  private async sugerir(
    consulta: SugerenciasBusquedaConsulta,
    mirada: Mirada,
  ): Promise<RespuestaSugerenciasBusqueda> {
    const palabras = this.palabras(consulta.q);
    if (palabras.length === 0) {
      return { correccion: null, lo_mas_parecido: false, total_productos: 0, productos: [] };
    }
    const conPrecio = conSesion(mirada);
    const base: ConsultaInterna = {
      ...buscarSchema.parse({ q: consulta.q, categoria: consulta.categoria }),
      ...(await this.loQueNoVe(mirada)),
    };

    const { resultado, intento } = await buscarConMotor(
      this.prisma,
      consulta.q,
      { categoria: base.categoria ?? null },
      (i) => this.ejecutar(i.filtro, conIntento(base, i), conPrecio, SUGERENCIAS, mirada.tiendaId),
      (r) => r.totalProductos > 0,
    );
    return {
      correccion: intento.correccion,
      lo_mas_parecido: intento.lo_mas_parecido,
      total_productos: resultado.totalProductos,
      productos: resultado.filas.map((f) =>
        conPrecio ? this.productoConPrecio(f, mirada) : this.productoEnLista(f),
      ),
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

  /**
   * «Lo más buscado hoy» del menú de categorías: lo buscado hoy (hora de Lima) con resultados,
   * de más a menos. Si hoy no hay al menos dos, lo de los últimos 30 días.
   */
  async masBuscadoDeHoy(): Promise<{ terminos: string[]; hoy: boolean }> {
    const filas = await this.prisma.$queryRaw<Array<{ texto: string }>>`
      SELECT regexp_replace(lower(trim(coalesce(texto_corregido, texto))), '[[:space:]]+', ' ', 'g') AS texto
      FROM busqueda
      WHERE resultados > 0
        AND creada_en >= (date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima')
      GROUP BY 1
      ORDER BY count(*) DESC, 1
      LIMIT 40`;
    const vistos = new Set<string>();
    const terminos: string[] = [];
    for (const fila of filas) {
      const clave = normalizarTexto(fila.texto);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      terminos.push(fila.texto);
      if (terminos.length === MAS_BUSCADOS) break;
    }
    if (terminos.length >= 2) return { terminos, hoy: true };
    return { terminos: (await this.masBuscado()).terminos, hoy: false };
  }

  /** Lo buscado al menos dos veces, de más a menos, con la forma que más se escribió. */
  async terminosRepetidos(): Promise<string[]> {
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
    const condiciones = this.condicionesBase(filtroDePalabras(palabras), consulta);
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

  /**
   * Las tiendas que quien mira no ve (doc 20, punto 5), también un visitante (las privadas y las
   * ocultas), y si es lo mismo que no ve un visitante.
   */
  private async loQueNoVe(
    mirada: Mirada,
  ): Promise<Required<Pick<ConsultaInterna, 'excluirTiendas' | 'comoVisitante'>>> {
    const [noVeo, cerradas] = await Promise.all([
      tiendasQueNoVeo(this.prisma, mirada),
      tiendasCerradas(this.prisma),
    ]);
    return { excluirTiendas: noVeo, comoVisitante: veComoVisitante(noVeo, cerradas) };
  }

  /** Palabras normalizadas y sin repetir de lo que se escribió (también para «Ya está en PaseLibre»). */
  palabras(q: string): string[] {
    const normalizado = normalizarTexto(q);
    return normalizado ? [...new Set(normalizado.split(' '))].slice(0, 12) : [];
  }

  /** Condiciones de producto y de vigencia, sin los filtros de faceta. */
  private condicionesBase(filtro: FiltroTexto, consulta: BuscarConsulta): Prisma.Sql[] {
    const condiciones: Prisma.Sql[] = [
      Prisma.sql`o.estado = 'ACTIVA'`,
      Prisma.sql`t.estado = 'ACTIVA'`,
      Prisma.sql`p.fusionado_en_id IS NULL`,
    ];
    // Lo de las tiendas que quien mira no ve no aparece (REP_WebBloqueadas; doc 20, punto 5).
    const excluir = (consulta as ConsultaInterna).excluirTiendas ?? [];
    if (excluir.length > 0) {
      condiciones.push(
        Prisma.sql`t.id NOT IN (${Prisma.join(excluir.map((id) => Prisma.sql`${id}::uuid`))})`,
      );
    }
    // Cada término es el comienzo de alguna palabra del producto (`motor-busqueda.ts`).
    condiciones.push(...condicionesTexto(filtro));
    if (consulta.categoria) condiciones.push(Prisma.sql`c.slug = ${consulta.categoria}`);
    return condiciones;
  }

  /**
   * Lo mismo sobre `producto_resumen r` (con `producto p` si hay términos): el resumen ya solo
   * tiene productos sin unir con ofertas vigentes. La marca es del producto, así que también va.
   */
  private condicionesResumen(
    filtro: FiltroTexto,
    consulta: Pick<BuscarConsulta, 'categoria' | 'marca'>,
  ): Prisma.Sql[] {
    const condiciones = condicionesTexto(filtro);
    if (consulta.categoria) {
      condiciones.push(
        Prisma.sql`r.categoria_id = (SELECT id FROM categoria WHERE slug = ${consulta.categoria})`,
      );
    }
    if (consulta.marca.length > 0) {
      condiciones.push(
        Prisma.sql`r.marca_id IN (SELECT id FROM marca WHERE slug IN (${Prisma.join(consulta.marca)}))`,
      );
    }
    return condiciones;
  }

  /**
   * Si la búsqueda sale de `producto_resumen`: cuando no filtra por algo de la oferta (galería,
   * condición, stock o precio) y quien mira no ve justo lo que un visitante (sin bloqueadas, sin
   * privadas que siga y sin ser el Equipo). Si no, se agrupan las ofertas.
   */
  private usaResumen(consulta: BuscarConsulta, conPrecio: boolean): boolean {
    const porPrecio =
      conPrecio && (consulta.precio_min !== undefined || consulta.precio_max !== undefined);
    return (
      resumenSirve(consulta) &&
      consulta.galeria.length === 0 &&
      consulta.condicion.length === 0 &&
      !consulta.stock &&
      !consulta.perfil &&
      !porPrecio
    );
  }

  /** Filtros que elige el usuario en el lateral (RF-16, RF-17). */
  private condicionesFaceta(consulta: BuscarConsulta, conPrecio: boolean): Prisma.Sql[] {
    const condiciones: Prisma.Sql[] = [];
    if (consulta.galeria.length > 0) {
      const conGaleria = consulta.galeria.filter((g) => g !== INDEPENDIENTES.slug);
      const independientes = consulta.galeria.includes(INDEPENDIENTES.slug);
      const partes: Prisma.Sql[] = [];
      if (conGaleria.length > 0) partes.push(Prisma.sql`ga.slug IN (${Prisma.join(conGaleria)})`);
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
    // «Para Intel» / «Para Ryzen» (docs/19 §13): lo marcado así o «Sirve para los dos». También
    // «expo» o «xmp» escrito (doc 20 §11). Sin perfil en la oferta, el del producto (A8).
    if (consulta.perfil) {
      const perfil = consulta.perfil === 'intel' ? 'XMP' : 'EXPO';
      condiciones.push(
        Prisma.sql`coalesce(o.perfil_memoria, p.perfil_memoria)::text IN (${perfil}, 'AMBOS')`,
      );
    }
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

  /** Las ofertas que coinciden, una fila por oferta. `extra` agrega una condición (una ficha). */
  private filtradas(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
    conPrecio: boolean,
    extra: Prisma.Sql | null = null,
  ): Prisma.Sql {
    const condiciones = [
      ...this.condicionesBase(filtro, consulta),
      ...this.condicionesFaceta(consulta, conPrecio),
      ...(extra ? [extra] : []),
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
    // «Lo más parecido»: cuántos términos tiene, para ordenar de más a menos.
    const columnaParecido =
      filtro.minimo !== null
        ? Prisma.sql`, ${coincidencias(filtro)} AS coincidencias`
        : Prisma.empty;
    return Prisma.sql`
      SELECT o.producto_id, o.condicion, o.stock, o.actualizada_en,
             coalesce(ga.nombre, ${INDEPENDIENTES.nombre}) AS galeria_nombre
             ${columnasPrecio} ${columnaParecido}
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id
      LEFT JOIN galeria ga ON ga.id = t.galeria_id
      JOIN producto p ON p.id = o.producto_id
      JOIN categoria c ON c.id = p.categoria_id
      LEFT JOIN marca m ON m.id = p.marca_id
      WHERE ${Prisma.join(condiciones, ' AND ')}`;
  }

  /**
   * Los productos con una publicación destacada ahora, o de una tienda fundadora en su día
   * destacado (doc 20, punto 7: sin ninguna marca, las demás no lo notan).
   */
  private async productosImpulsados(): Promise<string[]> {
    const [destacadas, fundadoras] = await Promise.all([
      destacadasAhora(this.prisma),
      fundadorasDelDia(this.prisma),
    ]);
    const tiendas = [...destacadas.tiendas, ...fundadoras];
    if (tiendas.length === 0 && destacadas.ofertas.size === 0) return [];
    const filas = await this.prisma.oferta.findMany({
      where: {
        estado: 'ACTIVA',
        OR: [{ tiendaId: { in: tiendas } }, { id: { in: [...destacadas.ofertas] } }],
      },
      select: { productoId: true },
      distinct: ['productoId'],
    });
    return filas.map((fila) => fila.productoId);
  }

  /**
   * Una página de resultados y sus totales, en una sola consulta. Sale de `producto_resumen`
   * cuando se puede (`usaResumen`) y, si no, de agrupar las ofertas que coinciden.
   */
  private async ejecutar(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
    conPrecio: boolean,
    limite = POR_PAGINA,
    /** La tienda de quien mira: su propia oferta solo se destaca si no hay otra. */
    miTiendaId: string | null = null,
  ): Promise<Resultado> {
    // «Destacar en silencio» (COR16): más arriba en las búsquedas de su categoría.
    const impulsados =
      consulta.categoria && consulta.orden !== 'precio_asc' && consulta.orden !== 'precio_desc'
        ? await this.productosImpulsados()
        : [];
    const primero = impulsados.length
      ? Prisma.sql`(g.producto_id = ANY(${impulsados}::uuid[])) DESC, `
      : Prisma.empty;
    // «Lo más parecido» va de los que tienen más términos a los que tienen menos.
    const parecido = filtro.minimo !== null ? Prisma.sql`g.coincidencias DESC, ` : Prisma.empty;
    // Con sesión se compara en dólares (`desde_eq`): un precio en soles y uno en dólares
    // quedan en la misma vara, y los productos sin precio visible van al final.
    const orden =
      consulta.orden === 'precio_asc'
        ? Prisma.sql`${parecido}g.desde_eq ASC NULLS LAST, g.actualizada_en DESC, g.titulo`
        : consulta.orden === 'precio_desc'
          ? Prisma.sql`${parecido}g.desde_eq DESC NULLS LAST, g.actualizada_en DESC, g.titulo`
          : Prisma.sql`${parecido}${primero}g.actualizada_en DESC, g.titulo`;
    const pagina = { limite, desde: (consulta.pagina - 1) * limite };
    return this.usaResumen(consulta, conPrecio)
      ? this.ejecutarConResumen(filtro, consulta, conPrecio, miTiendaId, orden, pagina)
      : this.ejecutarConOfertas(filtro, consulta, conPrecio, miTiendaId, orden, pagina);
  }

  /** `precio_eq` de un precio visible en céntimos: en dólares, para comparar (nunca se muestra). */
  private enDolares(usd: Prisma.Sql, pen: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`LEAST(${usd}::numeric, ${pen}::numeric / CAST(${this.tipoCambio} AS numeric))`;
  }

  /**
   * La oferta destacada de cada producto de la página (`g`): la de otra tienda antes que la
   * propia (la tarjeta es para escribirle a alguien), con stock, con precio visible y la más
   * barata; entre iguales, la más reciente. Lleva «Más barata» si su precio es `barata`, el menor
   * entre las destacadas con stock de todos los resultados.
   */
  private destacada(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
    miTiendaId: string | null,
    barata: Prisma.Sql,
  ): Prisma.Sql {
    const delProducto = this.filtradas(
      filtro,
      consulta,
      true,
      Prisma.sql`o.producto_id = g.producto_id`,
    );
    return Prisma.sql`
      JOIN LATERAL (
        SELECT f.oferta_id, f.tienda_id, f.tienda_nombre, f.tienda_stand,
               f.tienda_visible AS d_tienda_visible,
               f.condicion::text AS d_condicion, f.stock AS d_stock, f.galeria_nombre AS d_galeria,
               f.moneda::text AS d_moneda, f.precio_centimos AS d_precio,
               f.precio_visible AS d_visible,
               (f.stock > 0 AND f.precio_eq IS NOT NULL AND f.precio_eq = ${barata}) AS d_mas_barato
        FROM (${delProducto}) f
        ORDER BY COALESCE(f.tienda_id = CAST(${miTiendaId} AS uuid), false) ASC,
                 (f.stock > 0) DESC, (f.precio_eq IS NOT NULL) DESC,
                 f.precio_eq ASC, f.actualizada_en DESC, f.oferta_id
        LIMIT 1
      ) d ON true`;
  }

  /**
   * La foto de la tarjeta (`p` es el producto). Sin sesión, la del producto: la tarjeta es del
   * producto y no pone ninguna oferta al frente. Con sesión, la portada de la oferta destacada
   * (`d`), con la misma regla que `portadaDe` (docs/17 §5): la que eligió su tienda, la del
   * producto o, si el producto no tiene, la primera de la tienda.
   */
  private fotoDeTarjeta(conPrecio: boolean): Prisma.Sql {
    const delProducto = Prisma.sql`(SELECT pf.ruta FROM producto_foto pf WHERE pf.producto_id = p.id ORDER BY pf.orden LIMIT 1)`;
    if (!conPrecio) return delProducto;
    return Prisma.sql`COALESCE(
               (SELECT od.portada_ruta FROM oferta od WHERE od.id = d.oferta_id),
               ${delProducto},
               (SELECT fo.ruta FROM oferta_foto fo WHERE fo.oferta_id = d.oferta_id ORDER BY fo.orden LIMIT 1))`;
  }

  /**
   * El precio que tendría la destacada de cada producto si tiene stock (`d_eq`): la de otra
   * tienda si la hay, y entre esas la más barata con stock. Con su mínimo sale «Más barato» de
   * todos los resultados sin armar la destacada de cada producto.
   */
  private precioDestacada(miTiendaId: string | null): Prisma.Sql {
    const ajena = Prisma.sql`f.tienda_id IS DISTINCT FROM CAST(${miTiendaId} AS uuid)`;
    return Prisma.sql`CASE WHEN bool_or(${ajena})
             THEN min(f.precio_eq) FILTER (WHERE ${ajena} AND f.stock > 0)
             ELSE min(f.precio_eq) FILTER (WHERE f.stock > 0)
        END`;
  }

  /**
   * Desde `producto_resumen`: la página sale del índice por fecha (o por categoría y fecha) sin
   * recorrer las ofertas, y los totales de una pasada por el resumen. Con sesión, los precios
   * «desde» y el orden por precio también salen del resumen (solo tiene precios visibles); la
   * destacada se busca en las ofertas, y solo para la página. Para «Más barato», los productos
   * donde quien mira tiene una oferta se calculan aparte desde las ofertas: ahí la destacada
   * puede no ser la más barata (la propia va al final).
   */
  private async ejecutarConResumen(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
    conPrecio: boolean,
    miTiendaId: string | null,
    orden: Prisma.Sql,
    pagina: { limite: number; desde: number },
  ): Promise<Resultado> {
    const condiciones = this.condicionesResumen(filtro, consulta);
    const unirProducto = filtro.terminos.length
      ? Prisma.sql`JOIN producto p ON p.id = r.producto_id`
      : Prisma.empty;
    // Al visitante ni siquiera se le piden las columnas de precio.
    const columnasPrecio = conPrecio
      ? Prisma.sql`, r.desde_usd, r.desde_pen, r.al_interno,
          ${this.enDolares(Prisma.sql`r.desde_usd`, Prisma.sql`r.desde_pen`)} AS desde_eq,
          ${this.enDolares(Prisma.sql`r.barata_usd`, Prisma.sql`r.barata_pen`)} AS barata_eq`
      : Prisma.empty;
    // «Lo más parecido»: cuántos términos tiene cada producto, para ordenar.
    const columnaParecido =
      filtro.minimo !== null
        ? Prisma.sql`, ${coincidencias(filtro)} AS coincidencias`
        : Prisma.empty;
    const conPropias = conPrecio && miTiendaId !== null;
    const propias = conPropias
      ? Prisma.sql`
      propias AS (
        SELECT DISTINCT o.producto_id
        FROM oferta o
        JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
        WHERE o.tienda_id = CAST(${miTiendaId} AS uuid) AND o.estado = 'ACTIVA'
          AND o.producto_id IN (SELECT producto_id FROM coinciden)
      ),
      barata_propia AS (
        SELECT min(x.d_eq) AS barata
        FROM (
          SELECT ${this.precioDestacada(miTiendaId)} AS d_eq
          FROM (
            -- Los productos ya coinciden: basta con las ofertas vigentes, sin volver a filtrar.
            SELECT o.producto_id, o.tienda_id, o.stock,
                   CASE WHEN o.precio_visible AND o.precio_centimos IS NOT NULL
                        THEN o.precio_centimos::numeric
                             / CASE WHEN o.moneda::text = 'PEN' THEN CAST(${this.tipoCambio} AS numeric) ELSE 1 END
                   END AS precio_eq
            FROM oferta o
            JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
            WHERE o.estado = 'ACTIVA' AND o.producto_id IN (SELECT producto_id FROM propias)
          ) f
          GROUP BY f.producto_id
        ) x
      ),`
      : Prisma.empty;
    const barataTotales = !conPrecio
      ? Prisma.empty
      : conPropias
        ? Prisma.sql`, min(g.barata_eq) FILTER (WHERE g.producto_id NOT IN (SELECT producto_id FROM propias)) AS barata`
        : Prisma.sql`, min(g.barata_eq) AS barata`;
    const barata = conPropias
      ? Prisma.sql`LEAST(t.barata, (SELECT barata FROM barata_propia))`
      : Prisma.sql`t.barata`;

    const filas = await this.prisma.$queryRaw<
      Array<
        FilaProducto & {
          producto_id: string | null;
          total_productos: number;
          total_ofertas: number;
        }
      >
    >`
      WITH coinciden AS NOT MATERIALIZED (
        SELECT r.producto_id, r.titulo, r.ofertas, r.stock, r.nuevas, r.usadas, r.galerias,
               r.actualizada_en ${columnasPrecio} ${columnaParecido}
        FROM producto_resumen r
        ${unirProducto}
        WHERE ${condiciones.length ? Prisma.join(condiciones, ' AND ') : Prisma.sql`true`}
      ),
      ${propias}
      totales AS (
        SELECT count(*)::int AS total_productos, coalesce(sum(g.ofertas), 0)::int AS total_ofertas
               ${barataTotales}
        FROM coinciden g
      ),
      pagina AS (
        SELECT g.* FROM coinciden g
        ORDER BY ${orden}
        LIMIT ${pagina.limite} OFFSET ${pagina.desde}
      )
      SELECT g.producto_id, g.titulo, p.slug::text AS slug,
             c.slug::text AS categoria_slug, c.nombre AS categoria_nombre,
             m.nombre::text AS marca,
             ${this.fotoDeTarjeta(conPrecio)} AS foto,
             g.ofertas AS cantidad,
             ARRAY(
               SELECT DISTINCT coalesce(ga.nombre, ${INDEPENDIENTES.nombre})
               FROM jsonb_object_keys(g.galerias) k LEFT JOIN galeria ga ON ga.id::text = k
             ) AS galerias,
             array_remove(ARRAY[CASE WHEN g.nuevas > 0 THEN 'NUEVO' END,
                                CASE WHEN g.usadas > 0 THEN 'USADO' END], NULL) AS condiciones,
             g.stock AS stock_total, g.actualizada_en,
             t.total_productos, t.total_ofertas
             ${conPrecio ? Prisma.sql`, g.desde_usd, g.desde_pen, g.al_interno, d.*` : Prisma.empty}
      FROM totales t
      LEFT JOIN pagina g ON true
      LEFT JOIN producto p ON p.id = g.producto_id
      LEFT JOIN categoria c ON c.id = p.categoria_id
      LEFT JOIN marca m ON m.id = p.marca_id
      ${conPrecio ? Prisma.sql`LEFT ${this.destacada(filtro, consulta, miTiendaId, barata)}` : Prisma.empty}
      ORDER BY ${orden}`;
    return {
      filas: filas.filter((fila) => fila.producto_id !== null),
      totalProductos: filas[0]?.total_productos ?? 0,
      totalOfertas: filas[0]?.total_ofertas ?? 0,
    };
  }

  /**
   * Agrupando las ofertas que coinciden (con filtros de la oferta o tiendas bloqueadas): se
   * agrupa una vez, los totales salen de esa misma agrupación (`OVER ()`) y lo caro (la foto,
   * la oferta destacada) se busca solo para los productos de la página.
   */
  private async ejecutarConOfertas(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
    conPrecio: boolean,
    miTiendaId: string | null,
    orden: Prisma.Sql,
    pagina: { limite: number; desde: number },
  ): Promise<Resultado> {
    const filtradas = this.filtradas(filtro, consulta, conPrecio);
    const agregadoParecido =
      filtro.minimo !== null ? Prisma.sql`, max(f.coincidencias) AS coincidencias` : Prisma.empty;
    const agregadosPrecio = conPrecio
      ? Prisma.sql`,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'USD') AS desde_usd,
        min(f.precio_centimos) FILTER (WHERE f.precio_visible AND f.moneda = 'PEN') AS desde_pen,
        min(f.precio_eq) AS desde_eq,
        count(*) FILTER (WHERE NOT f.precio_visible OR f.precio_centimos IS NULL)::int AS al_interno,
        ${this.precioDestacada(miTiendaId)} AS d_eq`
      : Prisma.empty;
    const barata = conPrecio ? Prisma.sql`, min(g.d_eq) OVER () AS barata` : Prisma.empty;

    const filas = await this.prisma.$queryRaw<
      Array<FilaProducto & { total_productos: number; total_ofertas: number }>
    >`
      WITH f AS (${filtradas}),
      g AS (
        SELECT f.producto_id,
               count(*)::int AS cantidad,
               array_agg(DISTINCT f.galeria_nombre) AS galerias,
               array_agg(DISTINCT f.condicion::text) AS condiciones,
               sum(f.stock)::int AS stock_total,
               max(f.actualizada_en) AS actualizada_en
               ${agregadosPrecio} ${agregadoParecido}
        FROM f
        GROUP BY f.producto_id
      ),
      pagina AS (
        SELECT g.*,
               count(*) OVER ()::int AS total_productos,
               sum(g.cantidad) OVER ()::int AS total_ofertas
               ${barata}
        FROM (SELECT g.*, p.titulo FROM g JOIN producto p ON p.id = g.producto_id) g
        ORDER BY ${orden}
        LIMIT ${pagina.limite} OFFSET ${pagina.desde}
      )
      SELECT g.*, p.slug::text AS slug,
             c.slug::text AS categoria_slug, c.nombre AS categoria_nombre,
             m.nombre::text AS marca,
             ${this.fotoDeTarjeta(conPrecio)} AS foto
             ${conPrecio ? Prisma.sql`, d.*` : Prisma.empty}
      FROM pagina g
      JOIN producto p ON p.id = g.producto_id
      JOIN categoria c ON c.id = p.categoria_id
      LEFT JOIN marca m ON m.id = p.marca_id
      ${conPrecio ? this.destacada(filtro, consulta, miTiendaId, Prisma.sql`g.barata`) : Prisma.empty}
      ORDER BY ${orden}`;
    const [primera] = filas;
    if (primera) {
      return {
        filas,
        totalProductos: primera.total_productos,
        totalOfertas: primera.total_ofertas,
      };
    }
    // Una página después de la última: no trae filas, pero los totales siguen valiendo.
    if (pagina.desde === 0) return { filas, totalProductos: 0, totalOfertas: 0 };
    const [totales] = await this.prisma.$queryRaw<Array<{ productos: number; ofertas: number }>>`
      WITH f AS (${filtradas})
      SELECT count(DISTINCT producto_id)::int AS productos, count(*)::int AS ofertas FROM f`;
    return {
      filas,
      totalProductos: totales?.productos ?? 0,
      totalOfertas: totales?.ofertas ?? 0,
    };
  }

  /**
   * Conteos para el lateral, sobre lo que coincide con el texto y la categoría. Las
   * categorías se cuentan sin su propio filtro: así las tarjetas de arriba de los resultados
   * siguen mostrando las otras categorías después de elegir una.
   */
  private async facetas(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
  ): Promise<RespuestaBuscar['facetas']> {
    const [filas, porCategoria] = await (resumenSirve(consulta)
      ? this.facetasConResumen(filtro, consulta)
      : this.facetasConOfertas(filtro, consulta));

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

  /**
   * Las facetas desde `producto_resumen` (sin tiendas bloqueadas): productos por categoría y
   * ofertas por galería, marca, condición y con stock, sin recorrer las ofertas.
   */
  private facetasConResumen(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
  ): Promise<[Array<Faceta & { dimension: string }>, Faceta[]]> {
    const unirProducto = filtro.terminos.length
      ? Prisma.sql`JOIN producto p ON p.id = r.producto_id`
      : Prisma.empty;
    const donde = (condiciones: Prisma.Sql[]) =>
      condiciones.length ? Prisma.join(condiciones, ' AND ') : Prisma.sql`true`;
    const conCategoria = this.condicionesResumen(filtro, {
      categoria: consulta.categoria,
      marca: [],
    });
    const sinCategoria = this.condicionesResumen(filtro, { categoria: undefined, marca: [] });
    // Se agrupa por id y después se buscan los nombres: agrupar por el slug (citext) es más lento.
    const categorias = this.prisma.$queryRaw<Faceta[]>`
      SELECT c.slug::text AS slug, c.nombre, x.cantidad
      FROM (
        SELECT r.categoria_id, count(*)::int AS cantidad
        FROM producto_resumen r
        ${unirProducto}
        WHERE ${donde(sinCategoria)}
        GROUP BY r.categoria_id
      ) x
      JOIN categoria c ON c.id = x.categoria_id
      ORDER BY 3 DESC, c.orden, c.nombre`;
    const lateral = this.prisma.$queryRaw<Array<Faceta & { dimension: string }>>`
      WITH base AS NOT MATERIALIZED (
        SELECT r.marca_id, r.ofertas, r.nuevas, r.usadas, r.con_stock, r.galerias
        FROM producto_resumen r
        ${unirProducto}
        WHERE ${donde(conCategoria)}
      )
      SELECT 'galeria' AS dimension, coalesce(ga.slug::text, ${INDEPENDIENTES.slug}) AS slug,
             coalesce(ga.nombre, ${INDEPENDIENTES.nombre}) AS nombre, sum(x.ofertas)::int AS cantidad
      FROM (
        SELECT e.key AS galeria, sum(e.value::int) AS ofertas
        FROM base b CROSS JOIN LATERAL jsonb_each_text(b.galerias) e
        GROUP BY e.key
      ) x
      LEFT JOIN galeria ga ON ga.id::text = x.galeria
      GROUP BY 2, 3
      UNION ALL
      SELECT 'marca', m.slug::text, m.nombre::text, x.ofertas
      FROM (
        SELECT b.marca_id, sum(b.ofertas)::int AS ofertas FROM base b
        WHERE b.marca_id IS NOT NULL
        GROUP BY b.marca_id
      ) x
      JOIN marca m ON m.id = x.marca_id
      UNION ALL
      SELECT v.dimension, v.slug, v.nombre, v.cantidad
      FROM (
        SELECT coalesce(sum(b.nuevas), 0)::int AS nuevas, coalesce(sum(b.usadas), 0)::int AS usadas,
               coalesce(sum(b.con_stock), 0)::int AS con_stock
        FROM base b
      ) s
      CROSS JOIN LATERAL (VALUES ('condicion', 'nuevo', 'Nuevo', s.nuevas),
                                 ('condicion', 'usado', 'Usado', s.usadas),
                                 ('stock', 'con-stock', 'Con stock', s.con_stock))
        AS v(dimension, slug, nombre, cantidad)
      WHERE v.dimension = 'stock' OR v.cantidad > 0`;
    return Promise.all([lateral, categorias]);
  }

  /** Las facetas agrupando las ofertas (quien mira bloqueó tiendas). */
  private facetasConOfertas(
    filtro: FiltroTexto,
    consulta: BuscarConsulta,
  ): Promise<[Array<Faceta & { dimension: string }>, Faceta[]]> {
    const condiciones = this.condicionesBase(filtro, consulta);
    const sinCategoria = this.condicionesBase(filtro, { ...consulta, categoria: undefined });
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
    return Promise.all([lateral, categorias]);
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
