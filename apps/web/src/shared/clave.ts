import { claveNuevaSchema } from '@paselibre/contracts';

const LETRAS = 'abcdefghjkmnpqrstuvwxyz';
const NUMEROS = '23456789';

/**
 * «Generar una» al crear una cuenta con contraseña definitiva (doc 19, punto 6): fácil de
 * dictar por teléfono, sin letras que se confundan (0/O, 1/l) y con números, como la temporal
 * que arma la API. `azar` es para las pruebas.
 */
export function generarClave(
  azar: (cuantos: number) => number = (cuantos) =>
    (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % cuantos,
): string {
  const bloque = (largo: number, alfabeto: string) =>
    Array.from({ length: largo }, () => alfabeto[azar(alfabeto.length)]).join('');
  return `${bloque(4, LETRAS)}${bloque(2, NUMEROS)}-${bloque(3, LETRAS)}${bloque(1, NUMEROS)}`;
}

/** El mismo aviso que dará la API: «La contraseña debe tener al menos un número.», o nulo. */
export function problemaDeClave(clave: string): string | null {
  const resultado = claveNuevaSchema.safeParse(clave);
  return resultado.success ? null : (resultado.error.issues[0]?.message ?? null);
}
