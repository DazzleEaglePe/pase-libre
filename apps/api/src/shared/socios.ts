import type { PrismaClient } from '@prisma/client';

/**
 * Las tiendas que tienen a esta como socia (PS_SociosWeb): de ellas ve el precio socio y lo
 * publicado como «Solo mis socios». Sin tienda (visitante o equipo), ninguna.
 */
export async function tiendasQueMeTienenDeSocia(
  prisma: Pick<PrismaClient, 'socio'>,
  tiendaId: string | null,
): Promise<Set<string>> {
  if (!tiendaId) return new Set();
  const filas = await prisma.socio.findMany({
    where: { socioId: tiendaId },
    select: { tiendaId: true },
  });
  return new Set(filas.map((fila) => fila.tiendaId));
}
