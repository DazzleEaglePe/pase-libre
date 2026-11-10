import type { PrismaClient } from '@prisma/client';

/**
 * Las tiendas que bloqueó quien mira (REP_WebBloqueadas): «Dejarás de ver sus publicaciones
 * y sus pedidos en vivo». Sin usuario (visitante), ninguna.
 */
export async function tiendasBloqueadasPor(
  prisma: Pick<PrismaClient, 'bloqueo'>,
  usuarioId: string | null,
): Promise<string[]> {
  if (!usuarioId) return [];
  const filas = await prisma.bloqueo.findMany({
    where: { usuarioId },
    select: { tiendaBloqueadaId: true },
  });
  return filas.map((fila) => fila.tiendaBloqueadaId);
}
