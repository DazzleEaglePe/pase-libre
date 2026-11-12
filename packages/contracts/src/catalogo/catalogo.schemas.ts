import { z } from 'zod';

/** `galeria=a&galeria=b` o `galeria=a,b` llegan como lista. */
function lista<T extends z.ZodType>(item: T) {
  return z.preprocess(
    (valor) =>
      valor === undefined || valor === ''
        ? []
        : (Array.isArray(valor) ? valor : String(valor).split(','))
            .map((parte) => String(parte).trim().toLowerCase())
            .filter(Boolean),
    z.array(item).max(20),
  );
}

/** Como los arma `slugDe`: un carácter raro (un NUL, por ejemplo) ni llega a la base. */
const slug = z
  .string()
  .max(80)
  .regex(/^[a-z0-9-]*$/, 'Esa categoría o galería no existe.');

/**
 * Consulta de `GET /v1/buscar` (RF-12 a RF-18). El filtro y el orden por precio
 * solo se aplican con sesión: a un visitante se le ignoran para no filtrar precios
 * por descarte (docs/05 §5).
 */
export const buscarSchema = z.object({
  q: z.string().trim().max(100).default(''),
  categoria: slug.optional(),
  galeria: lista(slug),
  marca: lista(slug),
  condicion: lista(z.enum(['nuevo', 'usado'])),
  stock: z.stringbool().default(false),
  precio_min: z.coerce.number().nonnegative().max(1_000_000).optional(),
  precio_max: z.coerce.number().nonnegative().max(1_000_000).optional(),
  moneda: z.enum(['USD', 'PEN']).default('USD'),
  orden: z.enum(['recientes', 'precio_asc', 'precio_desc']).default('recientes'),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
  /** «Buscar … tal cual»: sin entender números ni categorías ni corregir letras (BUS_Web). */
  tal_cual: z.stringbool().default(false),
});

export const portadaSchema = z.object({
  galeria: slug.optional(),
});

/** `GET /v1/inicio/recien`: desde qué publicación (de a 24, N15). */
export const inicioRecienSchema = z.object({
  desde: z.coerce.number().int().min(0).max(5000).default(0),
});

/**
 * Consulta de `GET /v1/buscar/sugerencias`: lo que se va escribiendo en el buscador de la
 * barra, para sugerir productos antes de buscar. No se registra como búsqueda.
 */
export const sugerenciasBusquedaSchema = z.object({
  q: z.string().trim().max(100).default(''),
  categoria: slug.optional(),
});

/**
 * Consulta de `GET /v1/buscar/populares`. Con `categoria`, solo lo más buscado que encuentra
 * algo en esa categoría: «Lo más buscado en Gráficas» del menú y de los resultados.
 */
export const masBuscadoSchema = z.object({
  categoria: slug.optional(),
});

export type BuscarConsulta = z.output<typeof buscarSchema>;
export type MasBuscadoConsulta = z.output<typeof masBuscadoSchema>;
export type PortadaConsulta = z.output<typeof portadaSchema>;
export type InicioRecienConsulta = z.output<typeof inicioRecienSchema>;
export type SugerenciasBusquedaConsulta = z.output<typeof sugerenciasBusquedaSchema>;
