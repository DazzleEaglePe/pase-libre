import type { Prisma } from '@prisma/client';

/** La primera foto, por orden: la del producto (del catálogo) o la de la oferta (de la tienda). */
export const PRIMERA_FOTO = {
  select: { ruta: true },
  orderBy: { orden: 'asc' },
  take: 1,
} as const;

/**
 * Lo que se pide de una oferta para saber su portada (docs/17 §5). Va con `FOTO_DEL_PRODUCTO`
 * dentro del `select` de su producto, que casi siempre se pide con otros campos:
 *
 * `select: { ...PORTADA_DE_OFERTA, producto: { select: { titulo: true, ...FOTO_DEL_PRODUCTO } } }`
 *
 * Si la consulta ya pide todas las fotos de la oferta (la ficha), basta con `portadaRuta`.
 */
export const PORTADA_DE_OFERTA = {
  portadaRuta: true,
  fotos: PRIMERA_FOTO,
} satisfies Prisma.OfertaSelect;

export const FOTO_DEL_PRODUCTO = { fotos: PRIMERA_FOTO } satisfies Prisma.ProductoSelect;

/** Una oferta con lo que hace falta para su portada; las fotos, en su orden. */
export interface OfertaConPortada {
  portadaRuta: string | null;
  fotos: ReadonlyArray<{ ruta: string }>;
  producto: { fotos: ReadonlyArray<{ ruta: string }> };
}

/**
 * La foto con la que sale una oferta en el feed, los resultados, el perfil, Wilson, el chat…
 * (docs/17 §5): la que eligió la tienda; si no eligió, la primera del producto, y si el producto
 * no tiene fotos, la primera de la tienda. Nula sin ninguna: la web dibuja la categoría.
 */
export function portadaDe(oferta: OfertaConPortada): string | null {
  return oferta.portadaRuta ?? oferta.producto.fotos[0]?.ruta ?? oferta.fotos[0]?.ruta ?? null;
}
