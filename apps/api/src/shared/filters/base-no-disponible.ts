import { Prisma } from '@prisma/client';

/**
 * Cuando la base está saturada o no atiende, la API responde 503 con `Retry-After` en lugar de
 * un 500 (docs/16 §4.4, «fallar rápido»): quien llama sabe que es pasajero y cuándo volver, y
 * Cloudflare o nginx no lo cuentan como una falla del código.
 *
 * - **Saturada** (5 s): no hubo conexión libre a tiempo (`P2024`, ver `pool_timeout` en
 *   `tools/deploy/compose.yml`), una consulta pasó el tiempo máximo (Postgres `57014`, ver
 *   `TIEMPO_MAXIMO_CONSULTA_MS`) o la base no acepta más conexiones (`53300`).
 * - **Sin conexión** (15 s): la base no responde, se está reiniciando o cortó la conexión.
 */
export interface BaseNoDisponible {
  motivo: 'saturada' | 'sin_conexion';
  segundos: number;
}

const SATURADA: BaseNoDisponible = { motivo: 'saturada', segundos: 5 };
const SIN_CONEXION: BaseNoDisponible = { motivo: 'sin_conexion', segundos: 15 };

/** Códigos de Postgres: tiempo máximo vencido, demasiadas conexiones, límite de configuración. */
const POSTGRES_SATURADA = new Set(['57014', '53300', '53400']);
/** La base se apaga, se reinicia o todavía no acepta conexiones. */
const POSTGRES_SIN_CONEXION = new Set(['57P01', '57P02', '57P03']);

/** Errores de Prisma: pool agotado / operación vencida, y sin llegar a la base o conexión cortada. */
const PRISMA_SATURADA = new Set(['P2024', 'P1008']);
const PRISMA_SIN_CONEXION = new Set(['P1001', 'P1002', 'P1017']);

function porCodigoDePostgres(codigo: unknown): BaseNoDisponible | null {
  if (typeof codigo !== 'string') return null;
  if (POSTGRES_SATURADA.has(codigo)) return SATURADA;
  if (POSTGRES_SIN_CONEXION.has(codigo) || codigo.startsWith('08')) return SIN_CONEXION;
  return null;
}

/** Si el error dice que la base está saturada o no atiende, cuál de los dos; si no, `null`. */
export function baseNoDisponible(error: unknown): BaseNoDisponible | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (PRISMA_SATURADA.has(error.code)) return SATURADA;
    if (PRISMA_SIN_CONEXION.has(error.code)) return SIN_CONEXION;
    // Las consultas crudas (`$queryRaw`) traen el código de Postgres en `meta.code` (P2010).
    if (error.code === 'P2010') return porCodigoDePostgres(error.meta?.code);
    return null;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return SIN_CONEXION;
  // Las consultas normales que Postgres corta llegan como error «desconocido» con el código en
  // el texto: `PostgresError { code: "57014", … }`.
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const codigo = /PostgresError \{ code: "([0-9A-Z]{5})"/.exec(error.message)?.[1];
    return porCodigoDePostgres(codigo);
  }
  return null;
}
