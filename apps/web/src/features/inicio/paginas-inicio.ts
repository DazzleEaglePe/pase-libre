import { RECIEN_POR_PAGINA, RECIEN_POR_PAGINA_CELULAR } from '@paselibre/contracts';

/** Un botón de la paginación: un número de página o los «…» entre dos que no se tocan. */
export type BotonPagina = { tipo: 'pagina'; numero: number } | { tipo: 'puntos'; clave: string };

/**
 * Los botones de `‹ 1 2 3 … 7 Siguiente ›` (doc 20, punto 4): siempre la primera y la última, la
 * actual con sus vecinas y, al principio o al final, las 3 primeras o las 3 últimas. Si entre dos
 * falta una sola página, va ese número y no los «…».
 */
export function botonesDePaginas(actual: number, total: number): BotonPagina[] {
  if (total <= 1) return total === 1 ? [{ tipo: 'pagina', numero: 1 }] : [];
  const elegidas = new Set([1, total, actual - 1, actual, actual + 1]);
  if (actual <= 2) [2, 3].forEach((n) => elegidas.add(n));
  if (actual >= total - 1) [total - 1, total - 2].forEach((n) => elegidas.add(n));
  const numeros = [...elegidas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const botones: BotonPagina[] = [];
  numeros.forEach((numero, i) => {
    const anterior = numeros[i - 1];
    if (anterior !== undefined && numero - anterior === 2) {
      botones.push({ tipo: 'pagina', numero: anterior + 1 });
    } else if (anterior !== undefined && numero - anterior > 2) {
      botones.push({ tipo: 'puntos', clave: `${anterior}-${numero}` });
    }
    botones.push({ tipo: 'pagina', numero });
  });
  return botones;
}

/**
 * En qué página está la tarjeta `desde` (la primera que se ve), de a 20 en la computadora o de a
 * 10 en el celular. Las del celular caen siempre dentro de una de la computadora: la página 3
 * del celular es la segunda mitad de la 2 de la computadora.
 */
export const paginaDe = (desde: number, celular: boolean) =>
  Math.floor(desde / (celular ? RECIEN_POR_PAGINA_CELULAR : RECIEN_POR_PAGINA)) + 1;

/** La primera tarjeta de una página. */
export const desdeDe = (pagina: number, celular: boolean) =>
  (pagina - 1) * (celular ? RECIEN_POR_PAGINA_CELULAR : RECIEN_POR_PAGINA);

/** Cuántas páginas hay en el celular, de a 10. */
export const paginasEnCelular = (enPaginas: number) =>
  Math.ceil(enPaginas / RECIEN_POR_PAGINA_CELULAR);
