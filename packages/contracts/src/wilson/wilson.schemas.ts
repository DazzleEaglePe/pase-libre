import { z } from 'zod';

const slug = z.string().trim().min(1).max(80);

/** `GET /v1/wilson`: la galería elegida y la categoría con que se cuenta (CAT_Web3). */
export const wilsonSchema = z.object({
  galeria: slug.optional(),
  categoria: slug.optional(),
});
export type WilsonConsulta = z.output<typeof wilsonSchema>;

export const ORDENES_PRECIOS = ['vendidos', 'baratos', 'bajaron'] as const;
export const ESTADOS_FILTRO = ['SELLADO', 'OPEN_BOX', 'USADO'] as const;

/** Varias opciones en la misma clave: `?estado=SELLADO&estado=USADO` o `?estado=SELLADO,USADO`. */
const lista = z
  .union([z.string().max(400), z.array(z.string().max(80)).max(20)])
  .optional()
  .transform((valor) =>
    (Array.isArray(valor) ? valor : valor ? valor.split(',') : [])
      .map((texto) => texto.trim())
      .filter(Boolean)
      .slice(0, 20),
  );

/** `GET /v1/categorias/:slug/precios` (CAT_Web4): orden y filtros de la tabla. */
export const preciosCategoriaSchema = z.object({
  orden: z.enum(ORDENES_PRECIOS).default('vendidos'),
  marca: lista,
  estado: lista.pipe(z.array(z.enum(ESTADOS_FILTRO))),
  galeria: lista,
});
export type PreciosCategoriaConsulta = z.output<typeof preciosCategoriaSchema>;

export const TIPOS_NOVEDAD = ['todo', 'nuevos', 'remates', 'en_vivo'] as const;

/** `GET /v1/seguidas/novedades` (SEG_Web): de una tienda o de todas, y de qué tipo. */
export const novedadesSchema = z.object({
  tienda: z.uuid().optional(),
  tipo: z.enum(TIPOS_NOVEDAD).default('todo'),
});
export type NovedadesConsulta = z.output<typeof novedadesSchema>;

/** Cómo se ordena el directorio de tiendas (N13): «Ordenar: Mejor reputación ▾». */
export const ORDENES_DIRECTORIO = ['reputacion', 'productos', 'recientes', 'nombre'] as const;

/**
 * `GET /v1/wilson/tiendas` (N13, pestaña «Tiendas» de Wilson en vivo): el directorio, con sus
 * filtros. `galeria` acepta `independientes` para las que no están en una galería; `vende` es
 * el slug de una categoría y `q` un pedazo del nombre (lo que se escribió en el buscador).
 */
export const directorioTiendasSchema = z.object({
  q: z.string().trim().max(60).optional(),
  galeria: slug.optional(),
  piso: z.string().trim().min(1).max(20).optional(),
  vende: slug.optional(),
  orden: z.enum(ORDENES_DIRECTORIO).default('reputacion'),
  pagina: z.coerce.number().int().min(1).max(100).default(1),
});
export type DirectorioTiendasConsulta = z.output<typeof directorioTiendasSchema>;
export type OrdenDirectorio = (typeof ORDENES_DIRECTORIO)[number];
