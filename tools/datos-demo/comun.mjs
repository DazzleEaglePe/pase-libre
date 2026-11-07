/** Lo que comparten la carga de datos y la verificación: la clave demo y la base de prueba. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const RAIZ = new URL('../../', import.meta.url);

/** La clave de las cuentas demo: CLAVE_DEMO o la de semilla.ts. Nunca se imprime. */
export async function leerClave() {
  if (process.env.CLAVE_DEMO) return process.env.CLAVE_DEMO;
  const semilla = await readFile(new URL('apps/api/prisma/semilla.ts', RAIZ), 'utf8');
  const clave = /CLAVE_DEMO\s*=\s*process\.env\.CLAVE_DEMO\s*\|\|\s*'([^']+)'/.exec(semilla)?.[1];
  if (!clave) throw new Error('No encontré la clave demo: pon CLAVE_DEMO en el entorno.');
  return clave;
}

/** Usuario y base de DATABASE_URL (la de desarrollo) y el contenedor de Docker que la guarda. */
export async function conexionBase() {
  const env = existsSync(new URL('.env', RAIZ))
    ? await readFile(new URL('.env', RAIZ), 'utf8')
    : '';
  const url = process.env.DATABASE_URL ?? /^DATABASE_URL=(.+)$/m.exec(env)?.[1]?.trim();
  const m = /^postgres(?:ql)?:\/\/([^:@/]+)(?::[^@]*)?@[^/]+\/([^?]+)/.exec(url ?? '');
  if (!m) throw new Error('No pude leer DATABASE_URL.');
  return {
    usuario: m[1],
    base: m[2],
    contenedor: process.env.PG_CONTENEDOR ?? 'paselibre-local-postgres-1',
  };
}

/** Corre SQL en la base de prueba con `docker exec ... psql`. */
export function psql(conexion, sql) {
  const r = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      conexion.contenedor,
      'psql',
      '-U',
      conexion.usuario,
      '-d',
      conexion.base,
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
    ],
    { input: sql, encoding: 'utf8' },
  );
  if (r.status !== 0)
    throw new Error(`psql falló: ${(r.stderr || r.error?.message || '').trim().slice(0, 300)}`);
  return r.stdout;
}

export const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
