import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

// Dos grupos: «unidad» (los .spec.ts de src: funciones puras, sin base de datos) y «e2e» (los
// .e2e-spec.ts de test: la API entera contra la base de pruebas). `pnpm test` corre los dos;
// `pnpm exec vitest run --project unidad` solo los rápidos.
export default defineConfig({
  test: {
    environment: 'node',
    // Los e2e comparten una sola base de pruebas: un archivo a la vez.
    fileParallelism: false,
    // Antes de importar la app: la configuración se lee al cargar AppModule, y las fotos
    // de las pruebas nunca deben caer en `apps/api/media`.
    env: { MEDIA_DIR: join(tmpdir(), 'paselibre-media-pruebas') },
    projects: [
      { extends: true, test: { name: 'unidad', include: ['src/**/*.spec.ts'] } },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e-spec.ts'],
          globalSetup: ['test/preparar-base.ts'],
        },
      },
    ],
  },
});
