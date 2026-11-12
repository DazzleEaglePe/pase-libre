import type { NivelGaleria } from '@paselibre/contracts';

/**
 * El orden de las galerías en Wilson en vivo y en el directorio de tiendas (N08): el de la base
 * (`galeria.orden` y luego el nombre), que el equipo cambia arrastrando en Equipo › Galerías
 * (docs/18 §3). Esta lista fija queda vacía a propósito; si algún día se llena, sus slugs van
 * primero. La galería de quien mira va primero igual («Estás aquí»).
 */
export const ORDEN_DE_GALERIAS: readonly string[] = [];

export function galeriasEnOrden<T extends { slug: string; nombre: string; orden: number }>(
  galerias: readonly T[],
): T[] {
  const puesto = (slug: string) => {
    const indice = ORDEN_DE_GALERIAS.indexOf(slug);
    return indice === -1 ? ORDEN_DE_GALERIAS.length : indice;
  };
  return [...galerias].sort(
    (a, b) =>
      puesto(a.slug) - puesto(b.slug) ||
      a.orden - b.orden ||
      a.nombre.localeCompare(b.nombre, 'es'),
  );
}

/** Con menos productos que esto en todo Wilson, todas las galerías salen en verde suave (N08). */
export const MINIMO_PARA_COMPARAR = 20;

/**
 * «Se ajusta solo» (N08): «Pocos / Varios / Muchos» compara las galerías entre sí. Entre las
 * que tienen productos, el tercio con menos, el del medio y el de más; las empatadas quedan
 * juntas (cuenta su puesto promedio). Las que no tienen nada, «Sin productos».
 */
export function nivelesPorTercios(cuentas: readonly number[]): NivelGaleria[] {
  const total = cuentas.reduce((suma, n) => suma + Math.max(0, n), 0);
  const conProductos = cuentas.filter((n) => n > 0).sort((a, b) => a - b);
  return cuentas.map((n) => {
    if (n <= 0) return 'SIN';
    if (total < MINIMO_PARA_COMPARAR) return 'POCOS';
    const puesto = (conProductos.indexOf(n) + conProductos.lastIndexOf(n)) / 2;
    // En tercios: del 0 al 1, dónde cae el medio de su puesto.
    const parte = (puesto + 0.5) / conProductos.length;
    if (parte * 3 < 1) return 'POCOS';
    if (parte * 3 < 2) return 'VARIOS';
    return 'MUCHOS';
  });
}
