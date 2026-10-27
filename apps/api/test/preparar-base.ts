import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Antes de las pruebas: apunta todo a TEST_DATABASE_URL y aplica las migraciones.
 * Nunca usa DATABASE_URL, para no tocar los datos de desarrollo.
 */
export default function prepararBase(): void {
  const rootEnvFile = resolve(__dirname, '../../../.env');
  if (!process.env.TEST_DATABASE_URL && existsSync(rootEnvFile)) {
    process.loadEnvFile(rootEnvFile);
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).');

  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
