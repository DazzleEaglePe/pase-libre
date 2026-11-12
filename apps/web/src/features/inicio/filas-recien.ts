import { RECIEN_FILAS, RECIEN_INICIO, RECIEN_POR_FILA } from '@paselibre/contracts';

/** En la computadora, cada fila muestra 6 y la flecha corre de a 6 (docs/18 §5). */
export const VISIBLES_POR_FILA = 6;

/** Una pieza de la fila: una publicación o, al final de una fila llena, «Ver todas». */
export type PiezaFila<T> = { tipo: 'tarjeta'; tarjeta: T } | { tipo: 'ver-todas' };

/**
 * Reparte «Recién publicado» en filas, por turnos: la 1, 5, 9… van a la fila 1; la 2, 6, 10… a
 * la 2, y así. Lo primero que se ve sigue siendo lo más nuevo. Cada fila guarda hasta 18 y las
 * filas sin nada no salen.
 */
export function repartirEnFilas<T>(
  lista: readonly T[],
  filas = RECIEN_FILAS,
  porFila = RECIEN_POR_FILA,
): T[][] {
  const resultado: T[][] = Array.from({ length: filas }, () => []);
  lista.slice(0, filas * porFila).forEach((item, n) => {
    resultado[n % filas]?.push(item);
  });
  return resultado.filter((fila) => fila.length > 0);
}

/** Hay más publicaciones que las 72 del inicio: salen «Ver todas» al final y debajo. */
export const hayMasQueElInicio = (total: number) => total > RECIEN_INICIO;

/**
 * Las piezas de una fila: sus publicaciones y, si llegó a 18 y hay más que las 72 del inicio,
 * la tarjeta «Ver todas las publicaciones» al final.
 */
export function piezasDeLaFila<T>(fila: readonly T[], total: number): PiezaFila<T>[] {
  const piezas: PiezaFila<T>[] = fila.map((tarjeta) => ({ tipo: 'tarjeta', tarjeta }));
  if (fila.length >= RECIEN_POR_FILA && hayMasQueElInicio(total))
    piezas.push({ tipo: 'ver-todas' });
  return piezas;
}

/** Hasta dónde se puede correr la fila: con la última pieza pegada al borde derecho. */
export const posicionMaxima = (piezas: number) => Math.max(0, piezas - VISIBLES_POR_FILA);

/** La flecha de la derecha: las 6 siguientes, o lo justo para que la última quede al borde. */
export const posicionSiguiente = (posicion: number, piezas: number) =>
  Math.min(posicion + VISIBLES_POR_FILA, posicionMaxima(piezas));

/** La flecha de volver: las 6 anteriores, sin pasar del principio. */
export const posicionAnterior = (posicion: number) => Math.max(0, posicion - VISIBLES_POR_FILA);

/** Qué flechas salen: la de volver si la fila ya se movió; la de seguir si queda algo. */
export function flechasDeLaFila(posicion: number, piezas: number) {
  return { anterior: posicion > 0, siguiente: posicion < posicionMaxima(piezas) };
}

/**
 * Con el teclado: si la pieza que recibe el foco quedó fuera de las 6 que se ven, la fila se
 * corre lo justo para mostrarla.
 */
export function posicionParaVer(posicion: number, indice: number, piezas: number) {
  if (indice < posicion) return indice;
  if (indice >= posicion + VISIBLES_POR_FILA) {
    return Math.min(indice - VISIBLES_POR_FILA + 1, posicionMaxima(piezas));
  }
  return posicion;
}
