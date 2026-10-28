import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts', 'src/**/*.spec.ts'],
    globalSetup: ['test/preparar-base.ts'],
    // Los e2e comparten una sola base de pruebas: un archivo a la vez.
    fileParallelism: false,
    // Antes de importar la app: la configuración se lee al cargar AppModule, y las fotos
    // de las pruebas nunca deben caer en `apps/api/media`.
    env: { MEDIA_DIR: join(tmpdir(), 'paselibre-media-pruebas') },
  },
});
