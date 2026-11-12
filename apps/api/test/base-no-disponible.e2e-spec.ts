import type { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { sembrarBase } from '../prisma/semilla';
import { CatalogoService } from '../src/modules/catalogo/catalogo.service';
import { MENSAJE_BASE_NO_DISPONIBLE } from '../src/shared/filters/api-exception.filter';
import { crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Con la base saturada o caída, la API responde 503 con `Retry-After` en lugar de un 500
 * (docs/16 §4.4). Los errores son los que lanza Prisma de verdad (ver base-no-disponible.spec).
 */
describe('Base saturada o caída', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    app = await crearApp();
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sin conexión libre en el pool: 503, vuelve en 5 s y un mensaje que se entiende', async () => {
    vi.spyOn(app.get(CatalogoService), 'portada').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Timed out fetching a new connection', {
        code: 'P2024',
        clientVersion: Prisma.prismaVersion.client,
        meta: { connection_limit: 15, timeout: 5 },
      }),
    );
    const respuesta = await http().get('/v1/portada').expect(503);
    expect(respuesta.headers['retry-after']).toBe('5');
    expect(respuesta.body.error).toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE',
      mensaje: MENSAJE_BASE_NO_DISPONIBLE,
    });
    // Lo que dice Prisma no le llega a quien llama.
    expect(JSON.stringify(respuesta.body)).not.toMatch(/pool|Prisma|connection/i);
  });

  it('una consulta que pasó el tiempo máximo también es 503 con Retry-After', async () => {
    vi.spyOn(app.get(CatalogoService), 'portada').mockRejectedValueOnce(
      new Prisma.PrismaClientUnknownRequestError(
        'Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "57014", message: "canceling statement due to statement timeout", severity: "ERROR" }) })',
        { clientVersion: Prisma.prismaVersion.client },
      ),
    );
    const respuesta = await http().get('/v1/portada').expect(503);
    expect(respuesta.headers['retry-after']).toBe('5');
  });

  it('la base caída: 503 y vuelve en 15 s; cualquier otro error sigue siendo 500', async () => {
    vi.spyOn(app.get(CatalogoService), 'portada').mockRejectedValueOnce(
      new Prisma.PrismaClientInitializationError(
        "Can't reach database server",
        Prisma.prismaVersion.client,
      ),
    );
    const caida = await http().get('/v1/portada').expect(503);
    expect(caida.headers['retry-after']).toBe('15');

    vi.spyOn(app.get(CatalogoService), 'portada').mockRejectedValueOnce(new Error('otra cosa'));
    const otra = await http().get('/v1/portada').expect(500);
    expect(otra.headers['retry-after']).toBeUndefined();
    expect(otra.body.error.codigo).toBe('ERROR_INTERNO');
  });
});
