import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { crearApp, usarBaseDePruebas } from './ayudas';

usarBaseDePruebas();

/** Lo que la API le pide a la base en cada conexión (docs/16 §4.4). */
describe('Conexión de la API a la base', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('ninguna consulta pasa de 8 s y no se compila con JIT', async () => {
    const prisma = app.get(PrismaService);
    const [tiempo] = await prisma.$queryRaw<Array<{ statement_timeout: string }>>`
      SHOW statement_timeout`;
    const [jit] = await prisma.$queryRaw<Array<{ jit: string }>>`SHOW jit`;
    expect(tiempo?.statement_timeout).toBe('8s');
    expect(jit?.jit).toBe('off');
  });
});
