import type { PrismaClient } from '@prisma/client';

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
