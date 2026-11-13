/**
 * «Más barato de la galería» (doc 20, puntos 20 y 22), para «Sus mejores precios» del perfil.
 *
 * Una oferta lo es si su precio de pase es el más bajo entre las ofertas vigentes de **ese
 * producto** en **su galería**, y ahí hay al menos 2 ofertas que se puedan comparar. Solo se
 * comparan precios a la vista (los «al interno» no se saben), pasados a una misma moneda; si dos
 * empatan en el más bajo, las dos lo son. Las tiendas independientes no tienen galería: nunca.
 *
 * El punto 22 (la chapita del Inicio) lo hace otro equipo en paralelo; esta es la misma regla,
 * escrita aparte para unirlas al juntar.
 */

/** Lo que hace falta de cada oferta vigente (con stock) para comparar. */
export interface OfertaParaComparar {
  id: string;
  productoId: string;
  /** Nula para las independientes. */
  galeriaId: string | null;
  /** El precio de pase a la vista, en céntimos; nulo si está al interno o no tiene. */
  precioCentimos: bigint | number | null;
  moneda: 'USD' | 'PEN';
}

/** Mínimo de ofertas comparables del mismo producto en la galería. */
export const MINIMO_PARA_COMPARAR = 2;

/** Los ids de las ofertas que son las más baratas de su galería. `tipoCambio`: soles por dólar. */
export function masBaratasDeLaGaleria(
  ofertas: readonly OfertaParaComparar[],
  tipoCambio: number,
): Set<string> {
  const grupos = new Map<string, Array<{ id: string; enDolares: number }>>();
  for (const oferta of ofertas) {
    if (oferta.galeriaId === null || oferta.precioCentimos === null) continue;
    const centimos = Number(oferta.precioCentimos);
    const enDolares = oferta.moneda === 'PEN' ? centimos / tipoCambio : centimos;
    const clave = `${oferta.productoId}|${oferta.galeriaId}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), { id: oferta.id, enDolares }]);
  }
  const baratas = new Set<string>();
  for (const grupo of grupos.values()) {
    if (grupo.length < MINIMO_PARA_COMPARAR) continue;
    const minimo = Math.min(...grupo.map((oferta) => oferta.enDolares));
    // Una diferencia de menos de un céntimo (por el cambio de moneda) cuenta como empate.
    for (const oferta of grupo) if (oferta.enDolares - minimo < 0.5) baratas.add(oferta.id);
  }
  return baratas;
}
