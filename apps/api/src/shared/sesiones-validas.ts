/**
 * Las sesiones que la API ya comprobó hace poco, por el sha256 de su token. El límite «por
 * persona» (limites.ts) cuenta por cookie solo si está aquí: con una cookie inventada en cada
 * pedido, cada uno estrenaría un contador nuevo y el límite no serviría. Si no está (la
 * cookie es falsa, o es el primer pedido después de reiniciar la API), cuenta por IP.
 *
 * Vive en memoria, como los contadores del límite: una sola API (docs/05).
 */
const VIGENCIA_MS = 30 * 60_000;
const MAXIMO = 20_000;
const validas = new Map<string, number>();

export function recordarSesionValida(hash: string): void {
  if (validas.size >= MAXIMO) {
    // Las más viejas primero: un Map recorre en orden de inserción.
    for (const clave of validas.keys()) {
      validas.delete(clave);
      if (validas.size < MAXIMO * 0.9) break;
    }
  }
  validas.delete(hash);
  validas.set(hash, Date.now() + VIGENCIA_MS);
}

export function esSesionValidaReciente(hash: string): boolean {
  const vence = validas.get(hash);
  if (vence === undefined) return false;
  if (vence < Date.now()) {
    validas.delete(hash);
    return false;
  }
  return true;
}

export function olvidarSesion(hash: string): void {
  validas.delete(hash);
}
