import {
  interpretarBusqueda,
  normalizarTexto,
  type Correccion,
  type PerfilBuscado,
} from '@paselibre/contracts';
import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Un solo buscador para todo (doc 20 §11). La barra de arriba, Publicar y «Publicar uno igual»,
 * Pedir en vivo, Mis publicaciones y el Catálogo del panel buscan igual: lo que dice este archivo.
 * Cada uno pone su parte (qué filas mira, cómo ordena y cuántas trae) en `ejecutar`.
 *
 * El orden de los intentos (`buscarConMotor`):
 * 1. Lo entendido por `interpretarBusqueda`: categoría, marca, tipo, relleno y perfil de memoria.
 * 2. Lo escrito tal cual.
 * 3. Lo entendido con las letras cambiadas corregidas contra el catálogo (`corregirPalabras`).
 * 4. «Lo más parecido»: los productos con al menos el 60 % de los términos, de más a menos.
 */

/** Términos que se miran como mucho: un nombre largo pegado del Excel cabe entero. */
export const MAX_TERMINOS = 20;
/** «Lo más parecido»: el porcentaje de los términos que tiene que tener un producto. */
export const PARECIDO_MINIMO = 60;

/** Lo que tiene que tener el producto (`p`). */
export interface FiltroTexto {
  /** Cada término es una palabra o varias que van juntas («g skill», «m 2»). */
  terminos: string[];
  /** Los términos que son un tipo: también valen en las características del producto. */
  tipos: string[];
  /** «expo», «xmp» o «intel» en RAM. */
  perfil: PerfilBuscado | null;
  /** «Lo más parecido»: cuántos términos tienen que estar como mínimo. Nulo: todos. */
  minimo: number | null;
}

/** Un intento de búsqueda: lo que se busca y qué decirle a quien buscó. */
export interface Intento {
  filtro: FiltroTexto;
  /** La categoría que se entendió (slug). Nula si no se nombró o si quien busca ya eligió una. */
  categoria: string | null;
  correccion: Correccion | null;
  /** «No hay uno igual. Lo más parecido:». */
  lo_mas_parecido: boolean;
}

/** Palabras normalizadas y sin repetir de lo escrito. */
export function palabrasDe(q: string): string[] {
  const normalizado = normalizarTexto(q);
  return normalizado ? [...new Set(normalizado.split(' '))].slice(0, MAX_TERMINOS) : [];
}

/** Lo escrito tal cual: cada palabra tiene que estar. */
export function filtroDePalabras(palabras: string[]): FiltroTexto {
  return { terminos: palabras, tipos: [], perfil: null, minimo: null };
}

/**
 * Las características del producto pasadas por `normalizarTexto` en la base: así un tipo
 * («M.2 NVMe» en «Tipo») se encuentra aunque no esté en el nombre ni en los sinónimos.
 */
const CARACTERISTICAS = Prisma.raw(
  "regexp_replace(regexp_replace(regexp_replace(lower(p.caracteristicas::text), '[^a-z0-9]+', ' ', 'g'), '([a-z])([0-9])', '\\1 \\2', 'g'), '([0-9])([a-z])', '\\1 \\2', 'g')",
);

/**
 * Un término es el comienzo de alguna palabra del producto. Las palabras normalizadas solo
 * tienen letras, números y espacios: no hay comodines que escapar.
 */
export function empiezaCon(termino: string): Prisma.Sql {
  return Prisma.sql`(' ' || p.texto_busqueda) LIKE ${`% ${termino}%`}`;
}

/** Un término del filtro; el tipo vale también en las características. */
function condicionTermino(termino: string, esTipo: boolean): Prisma.Sql {
  return esTipo
    ? Prisma.sql`(${empiezaCon(termino)} OR (' ' || ${CARACTERISTICAS}) LIKE ${`% ${termino}%`})`
    : empiezaCon(termino);
}

/** Cuántos términos del filtro tiene el producto (`p`): para «Lo más parecido». */
export function coincidencias(filtro: FiltroTexto): Prisma.Sql {
  if (filtro.terminos.length === 0) return Prisma.sql`0`;
  return Prisma.join(
    filtro.terminos.map(
      (termino) =>
        Prisma.sql`(CASE WHEN ${condicionTermino(termino, filtro.tipos.includes(termino))} THEN 1 ELSE 0 END)`,
    ),
    ' + ',
  );
}

/**
 * Las condiciones de texto sobre el producto (`p`). Con todos los términos, cada uno es el
 * comienzo de alguna palabra; con tres letras o más se repite como «la contiene»: no cambia el
 * resultado, pero esa forma sí puede usar el índice de trigramas de `texto_busqueda`. Con
 * `minimo` («Lo más parecido»), basta con esa cantidad de términos.
 */
export function condicionesTexto(filtro: FiltroTexto): Prisma.Sql[] {
  if (filtro.terminos.length === 0) return [];
  if (filtro.minimo !== null) return [Prisma.sql`(${coincidencias(filtro)}) >= ${filtro.minimo}`];
  return filtro.terminos.flatMap((termino) =>
    filtro.tipos.includes(termino)
      ? [condicionTermino(termino, true)]
      : [
          empiezaCon(termino),
          ...(termino.length >= 3 ? [Prisma.sql`p.texto_busqueda LIKE ${`%${termino}%`}`] : []),
        ],
  );
}

/**
 * «expo» / «xmp» (A8): el perfil de la oferta y, si la oferta no tiene (las de antes de la
 * 1.10.0), el del producto. «Sirve para los dos» vale para ambos. Sobre una oferta (`o`) o, si
 * se buscan productos, sobre el producto o cualquiera de sus publicaciones vigentes.
 */
export function condicionPerfil(
  perfil: PerfilBuscado | null,
  sobre: 'oferta' | 'producto',
): Prisma.Sql | null {
  if (!perfil) return null;
  if (sobre === 'oferta') {
    return Prisma.sql`coalesce(o.perfil_memoria, p.perfil_memoria)::text IN (${perfil}, 'AMBOS')`;
  }
  return Prisma.sql`(
    coalesce(p.perfil_memoria::text, '') IN (${perfil}, 'AMBOS')
    OR EXISTS (
      SELECT 1 FROM oferta op
      WHERE op.producto_id = p.id AND op.estado = 'ACTIVA'
        AND op.perfil_memoria::text IN (${perfil}, 'AMBOS')
    )
  )`;
}

/**
 * Todo lo de un intento sobre el producto `p`: los términos, la categoría (la que eligió quien
 * busca o la entendida) y el perfil de memoria. Para los buscadores que no usan `producto_resumen`
 * (Publicar, Pedir en vivo, Mis publicaciones y el Catálogo del panel).
 */
export function condicionesDeIntento(
  intento: Intento,
  opciones: { categoria?: string | null; sobre: 'oferta' | 'producto' },
): Prisma.Sql[] {
  const condiciones = condicionesTexto(intento.filtro);
  const categoria = opciones.categoria || intento.categoria;
  if (categoria) {
    condiciones.push(
      Prisma.sql`p.categoria_id = (SELECT id FROM categoria WHERE slug = ${categoria})`,
    );
  }
  const perfil = condicionPerfil(intento.filtro.perfil, opciones.sobre);
  if (perfil) condiciones.push(perfil);
  return condiciones;
}

/** «Lo más parecido» primero los que tienen más términos; si no, nada (va antes del orden propio). */
export function ordenDeParecido(intento: Intento): Prisma.Sql {
  return intento.filtro.minimo !== null
    ? Prisma.sql`(${coincidencias(intento.filtro)}) DESC, `
    : Prisma.empty;
}

/**
 * Corrige cada palabra que no está en el catálogo (docs/05 §7). Con números se exige
 * distancia de Levenshtein 1 («3370» → «3070»): la similitud por trigramas falla con
 * números cortos. Con letras se acepta distancia 1 o 2 según el largo, o similitud ≥ 0,4.
 * Los términos de varias palabras (una marca, un tipo) y los tipos no se tocan. Una palabra
 * que no está en `termino` pero sí en algún producto (los del Catálogo del panel y del
 * importador no pasan por `termino`) tampoco: «5070» no se cambia por «3070».
 */
export async function corregirPalabras(
  prisma: Pick<PrismaClient, 'termino' | '$queryRaw'>,
  palabras: string[],
  tipos: string[] = [],
): Promise<string[]> {
  const conocidas = await prisma.termino.findMany({
    where: { palabra: { in: palabras } },
    select: { palabra: true },
  });
  const conocidasSet = new Set(conocidas.map((t) => t.palabra));
  const sueltas = palabras.filter(
    (palabra) => !conocidasSet.has(palabra) && !palabra.includes(' ') && !tipos.includes(palabra),
  );
  if (sueltas.length > 0) {
    // Las palabras normalizadas solo tienen letras y números: no hay comodines que escapar.
    const enProductos = await prisma.$queryRaw<Array<{ palabra: string }>>`
      SELECT w AS palabra FROM unnest(${sueltas}::text[]) AS w
      WHERE EXISTS (
        SELECT 1 FROM producto p
        WHERE p.fusionado_en_id IS NULL AND (' ' || p.texto_busqueda || ' ') LIKE '% ' || w || ' %'
      )`;
    for (const { palabra } of enProductos) conocidasSet.add(palabra);
  }

  return Promise.all(
    palabras.map(async (palabra) => {
      if (conocidasSet.has(palabra) || palabra.includes(' ') || tipos.includes(palabra)) {
        return palabra;
      }
      if (/^\d+$/.test(palabra)) {
        const [candidata] = await prisma.$queryRaw<Array<{ palabra: string }>>`
          SELECT palabra FROM termino
          WHERE palabra ~ '^[0-9]+$' AND abs(length(palabra) - ${palabra.length}) <= 1
            AND levenshtein(palabra, ${palabra}) <= 1
          ORDER BY levenshtein(palabra, ${palabra}), veces DESC, palabra
          LIMIT 1`;
        return candidata?.palabra ?? palabra;
      }
      if (palabra.length < 3) return palabra;
      const distancia = palabra.length >= 5 ? 2 : 1;
      const [candidata] = await prisma.$queryRaw<Array<{ palabra: string }>>`
        SELECT palabra FROM termino
        WHERE palabra ~ '[a-z]'
          AND (levenshtein(palabra, ${palabra}) <= ${distancia} OR similarity(palabra, ${palabra}) >= 0.4)
        ORDER BY levenshtein(palabra, ${palabra}), similarity(palabra, ${palabra}) DESC, veces DESC, palabra
        LIMIT 1`;
      return candidata?.palabra ?? palabra;
    }),
  );
}

export interface OpcionesMotor {
  /**
   * La categoría que ya eligió quien busca (slug): la que se entienda de lo escrito no la
   * cambia. Si es la misma («ram» buscando en Memoria RAM), la palabra se da por cumplida.
   */
  categoria?: string | null;
  /** «Buscar tal cual»: solo lo escrito, sin entender, corregir ni «Lo más parecido». */
  tal_cual?: boolean;
}

/**
 * Busca con el mismo orden de intentos en todos los buscadores y devuelve el primero que
 * encuentra algo (`hay`) con el intento que lo encontró. Si ninguno encuentra, lo escrito tal cual.
 */
export async function buscarConMotor<R>(
  prisma: Pick<PrismaClient, 'categoria' | 'termino' | '$queryRaw'>,
  q: string,
  opciones: OpcionesMotor,
  ejecutar: (intento: Intento) => Promise<R>,
  hay: (resultado: R) => boolean,
): Promise<{ resultado: R; intento: Intento }> {
  const crudas = palabrasDe(q);
  const base: Intento = {
    filtro: filtroDePalabras(crudas),
    categoria: null,
    correccion: null,
    lo_mas_parecido: false,
  };
  const entendida = opciones.tal_cual ? null : interpretarBusqueda(q);

  // 1 · Lo entendido.
  let guia = base;
  if (entendida?.cambio) {
    const elegida = opciones.categoria ?? null;
    const categoria =
      entendida.categoria && !elegida
        ? await prisma.categoria.findUnique({
            where: { slug: entendida.categoria },
            select: { slug: true, nombre: true },
          })
        : null;
    const filtro: FiltroTexto = {
      terminos: entendida.terminos.slice(0, MAX_TERMINOS),
      tipos: entendida.tipos,
      perfil: entendida.perfil,
      minimo: null,
    };
    // Solo una categoría nombrada sin nada más: si no se pudo elegir, no hay qué buscar.
    const yaElegida = entendida.categoria !== null && entendida.categoria === elegida;
    if (filtro.terminos.length > 0 || categoria || filtro.perfil || yaElegida) {
      const lo = entendida.texto || (categoria?.nombre ?? '');
      // «ram expo» → «Memoria RAM con EXPO».
      const mostramos = filtro.perfil ? `${lo} con ${filtro.perfil}`.trim() : lo;
      const intento: Intento = {
        filtro,
        categoria: categoria?.slug ?? null,
        correccion: mostramos
          ? { buscaste: q, mostramos, ...(categoria ? { categoria } : {}) }
          : null,
        lo_mas_parecido: false,
      };
      const resultado = await ejecutar(intento);
      if (hay(resultado)) return { resultado, intento };
      guia = intento;
    }
  }

  // 2 · Lo escrito tal cual.
  const cruda = { resultado: await ejecutar(base), intento: base };
  if (hay(cruda.resultado) || opciones.tal_cual || crudas.length === 0) return cruda;

  // 3 · Con las letras cambiadas corregidas.
  const corregidas = await corregirPalabras(prisma, guia.filtro.terminos, guia.filtro.tipos);
  if (corregidas.join(' ') !== guia.filtro.terminos.join(' ')) {
    const intento: Intento = {
      ...guia,
      filtro: { ...guia.filtro, terminos: corregidas },
      correccion: {
        buscaste: q,
        mostramos: corregidas.join(' '),
        ...(guia.correccion?.categoria ? { categoria: guia.correccion.categoria } : {}),
      },
    };
    const resultado = await ejecutar(intento);
    if (hay(resultado)) return { resultado, intento };
  }

  // 4 · «Lo más parecido»: con al menos el 60 % de los términos.
  const cuantos = guia.filtro.terminos.length;
  const minimo = Math.ceil((cuantos * PARECIDO_MINIMO) / 100);
  if (minimo < cuantos) {
    const intento: Intento = {
      ...guia,
      filtro: { ...guia.filtro, minimo },
      lo_mas_parecido: true,
    };
    const resultado = await ejecutar(intento);
    if (hay(resultado)) return { resultado, intento };
  }
  return cruda;
}
