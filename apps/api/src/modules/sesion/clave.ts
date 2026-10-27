import { randomInt } from 'node:crypto';

import * as argon2 from 'argon2';

/** Mismos parámetros de argon2id que Yallegó. */
const OPCIONES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const CLAVES_COMPROMETIDAS = new Set([
  '12345678',
  '123456789',
  'password1',
  'contraseña1',
  'paselibre1',
  'wilson2026',
  'qwerty123',
  'admin1234',
]);

export function esClaveComprometida(clave: string): boolean {
  return CLAVES_COMPROMETIDAS.has(clave.trim().toLocaleLowerCase('es'));
}

export function cifrarClave(clave: string): Promise<string> {
  return argon2.hash(clave, OPCIONES_ARGON2);
}

export async function verificarClave(hash: string, clave: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, clave);
  } catch {
    return false;
  }
}

/**
 * Hash fijo para comparar cuando el usuario no existe: así ingresar con un
 * usuario inventado tarda lo mismo que con uno real y no revela cuáles existen.
 */
let hashSenuelo: Promise<string> | undefined;
export function hashParaUsuarioInexistente(): Promise<string> {
  hashSenuelo ??= cifrarClave('usuario-que-no-existe-0');
  return hashSenuelo;
}

/**
 * Clave temporal que entrega el equipo por WhatsApp: fácil de dictar, sin
 * letras que se confundan (0/O, 1/l) y con números para cumplir la regla.
 */
export function generarClaveTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const bloque = (largo: number, alfabeto: string): string =>
    Array.from({ length: largo }, () => alfabeto[randomInt(alfabeto.length)]).join('');
  return `pase-${bloque(3, letras)}${bloque(1, numeros)}-${bloque(2, letras)}${bloque(1, numeros)}`;
}
