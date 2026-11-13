import type { Foto } from '@paselibre/contracts';

/** Una foto de la ficha y de dónde salió (la etiqueta chica debajo de su miniatura). */
export interface FotoFicha extends Foto {
  origen: 'catalogo' | 'tienda';
}

/**
 * Las fotos de la ficha, en el orden de las miniaturas (doc 20 · punto 23):
 * 1. la portada que eligió la tienda al publicar. Si no eligió, la de siempre: la del catálogo y,
 *    sin catálogo, la primera suya (lo mismo que `portadaDeOferta` y la API);
 * 2. las del catálogo que no son la portada;
 * 3. las demás fotos de la tienda.
 * Sin repetir ninguna. Sin oferta (nadie lo tiene), solo las del catálogo.
 */
export function fotosDeFicha(
  delCatalogo: readonly Foto[],
  oferta: { fotos: readonly Foto[]; portada: string | null } | null,
): FotoFicha[] {
  const propias = oferta?.fotos ?? [];
  const portada = oferta?.portada ?? delCatalogo[0]?.ruta ?? propias[0]?.ruta ?? null;
  const todas: FotoFicha[] = [
    ...delCatalogo.map((foto) => ({ ...foto, origen: 'catalogo' as const })),
    ...propias.map((foto) => ({ ...foto, origen: 'tienda' as const })),
  ];
  const primera = todas.find((foto) => foto.ruta === portada);
  const vistas = new Set<string>();
  return [...(primera ? [primera] : []), ...todas].filter((foto) => {
    if (vistas.has(foto.ruta)) return false;
    vistas.add(foto.ruta);
    return true;
  });
}
