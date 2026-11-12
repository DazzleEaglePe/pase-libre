import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { baseNoDisponible } from './base-no-disponible';

const conocido = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('falla', { code, clientVersion: '6', meta });
// Así llega una consulta normal que Postgres corta por `statement_timeout` (copiado de Prisma 6).
const desconocido = (codigo: string) =>
  new Prisma.PrismaClientUnknownRequestError(
    `Error occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { code: "${codigo}", message: "canceling statement due to statement timeout", severity: "ERROR" }) })`,
    { clientVersion: '6' },
  );

describe('baseNoDisponible', () => {
  it('pool agotado y consultas que pasan el tiempo máximo: saturada, volver en 5 s', () => {
    const saturada = { motivo: 'saturada', segundos: 5 };
    expect(baseNoDisponible(conocido('P2024', { connection_limit: 15, timeout: 5 }))).toEqual(
      saturada,
    );
    expect(baseNoDisponible(desconocido('57014'))).toEqual(saturada);
    expect(baseNoDisponible(conocido('P2010', { code: '57014' }))).toEqual(saturada);
    expect(baseNoDisponible(conocido('P2010', { code: '53300' }))).toEqual(saturada);
  });

  it('base caída, reiniciándose o con la conexión cortada: sin conexión, volver en 15 s', () => {
    const sinConexion = { motivo: 'sin_conexion', segundos: 15 };
    expect(baseNoDisponible(conocido('P1001'))).toEqual(sinConexion);
    expect(baseNoDisponible(conocido('P1017'))).toEqual(sinConexion);
    expect(baseNoDisponible(desconocido('57P03'))).toEqual(sinConexion);
    expect(baseNoDisponible(conocido('P2010', { code: '08006' }))).toEqual(sinConexion);
    expect(
      baseNoDisponible(new Prisma.PrismaClientInitializationError("Can't reach database", '6')),
    ).toEqual(sinConexion);
  });

  it('lo demás sigue su camino: duplicados, datos inválidos y errores del código', () => {
    expect(baseNoDisponible(conocido('P2002'))).toBeNull();
    expect(baseNoDisponible(conocido('P2010', { code: '23505' }))).toBeNull();
    expect(baseNoDisponible(desconocido('22P02'))).toBeNull();
    expect(baseNoDisponible(new Error('canceling statement due to statement timeout'))).toBeNull();
    expect(baseNoDisponible(undefined)).toBeNull();
  });
});
