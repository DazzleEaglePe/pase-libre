import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Dos grupos: «unidad» (los .test.ts, funciones puras, en node) y «componentes» (los .test.tsx,
// en jsdom con Testing Library). `pnpm test` corre los dos.
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unidad', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'componentes',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['src/test/preparar-dom.ts'],
        },
      },
    ],
  },
});
