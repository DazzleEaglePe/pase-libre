import { conVendedor, type ItemEnVivo } from './textos';

/**
 * El pedido en vivo que entra y brilla (doc 19, punto 22): cuáles cuentan como nuevos y en qué
 * orden se muestran. Funciones puras; el estado vive en `ProveedorEnVivo`.
 */

/** «NUEVO» se va solo a los 10 s. */
export const DURA_NUEVO_MS = 10_000;
/** Si llegan varios juntos, entran uno tras otro con esta distancia. */
export const ENTRE_ENTRADAS_MS = 400;
/**
 * Solo brilla lo recién publicado: uno más viejo que vuelve a la lista (se desbloqueó una tienda,
 * se recargó sin conexión un rato) entra callado.
 */
const RECIEN_PUBLICADO_MS = 5 * 60_000;

/**
 * Los que entran ahora: no estaban en la lista anterior, se publicaron hace poco y no son de tu
 * tienda (el que publica no ve su propio pedido así). Los más nuevos primero.
 */
export function pedidosQueEntran(
  conocidos: ReadonlySet<string>,
  lista: readonly ItemEnVivo[],
  ahora: number,
): string[] {
  return lista
    .filter(
      (item) =>
        !conocidos.has(item.id) &&
        !(conVendedor(item) && item.propio) &&
        ahora - Date.parse(item.creado_en) < RECIEN_PUBLICADO_MS,
    )
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    .map((item) => item.id);
}

/**
 * La lista con los que entraron mientras la página estaba abierta adelante (el último primero):
 * así la tarjeta nueva entra por la izquierda en la banda y es «1 de N» en la tarjeta mini. El
 * resto, en su orden (lo que vence primero).
 */
export function conLosNuevosPrimero<T extends { id: string }>(
  lista: readonly T[],
  entrados: readonly string[],
): T[] {
  if (entrados.length === 0) return [...lista];
  const lugar = new Map(entrados.map((id, i) => [id, i]));
  const primeros = lista
    .filter((item) => lugar.has(item.id))
    .sort((a, b) => (lugar.get(a.id) ?? 0) - (lugar.get(b.id) ?? 0));
  return [...primeros, ...lista.filter((item) => !lugar.has(item.id))];
}
