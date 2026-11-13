import { DIAS_FUNDADORA, MAX_FUNDADORAS } from '@paselibre/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

import { diaDeLaSemanaEnLima } from '../modules/catalogo/puntos-inicio';

/**
 * Las tiendas fundadoras cuyo día destacado es hoy (doc 20, punto 7), en hora de Lima. Ese día
 * sus publicaciones suman en el Inicio y van más arriba en las búsquedas, sin ninguna marca: las
 * demás tiendas no lo notan. El domingo no hay ninguna.
 */
export async function fundadorasDelDia(
  prisma: Pick<PrismaClient, 'tienda'>,
  ahora = new Date(),
): Promise<string[]> {
  const dia = diaDeLaSemanaEnLima(ahora);
  if (dia > 6) return [];
  const filas = await prisma.tienda.findMany({
    where: { fundadoraDesde: { not: null }, fundadoraDia: dia, estado: 'ACTIVA' },
    select: { id: true },
  });
  return filas.map((fila) => fila.id);
}

/**
 * Un candado de la transacción para las fundadoras: dos altas a la vez (el registro, «Crear
 * cuenta» o «+ Agregar fundadora») no pasan de `MAX_FUNDADORAS` (doc 20b). Se suelta solo al
 * terminar la transacción.
 */
export async function candadoDeFundadoras(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fundadoras'))`;
}

/** Cuántas fundadoras hay y el día con menos, para darle a la que entra. */
export async function lugaresDeFundadoras(
  tx: Prisma.TransactionClient,
): Promise<{ yaSon: number; diaConMenos: number }> {
  const dias = await tx.tienda.groupBy({
    by: ['fundadoraDia'],
    where: { fundadoraDesde: { not: null } },
    _count: { _all: true },
  });
  const yaSon = dias.reduce((total, fila) => total + fila._count._all, 0);
  const usados = new Map(dias.map((fila) => [fila.fundadoraDia, fila._count._all]));
  const diaConMenos =
    [...DIAS_FUNDADORA].sort((a, b) => (usados.get(a.dia) ?? 0) - (usados.get(b.dia) ?? 0))[0]
      ?.dia ?? 1;
  return { yaSon, diaConMenos };
}

/**
 * Una tienda nueva entra como fundadora si quedan lugares (doc 20b): así la vecina que llega por
 * «Invita a una tienda vecina» también lo es. Lo usan el registro y «Crear cuenta», dentro de la
 * misma transacción en que se crea la tienda. Si el Equipo quita una fundadora, su lugar lo toma
 * la próxima que entre, no una tienda vieja.
 */
export async function entrarSiHayLugar(
  tx: Prisma.TransactionClient,
  tiendaId: string,
): Promise<void> {
  await candadoDeFundadoras(tx);
  const { yaSon, diaConMenos } = await lugaresDeFundadoras(tx);
  if (yaSon >= MAX_FUNDADORAS) return;
  await tx.tienda.update({
    where: { id: tiendaId },
    data: { fundadoraDesde: new Date(), fundadoraDia: diaConMenos },
  });
}
