import { EVENTOS } from '@paselibre/contracts';

import type { PrismaService } from '../infrastructure/database/prisma.service';
import { avisoCampanita } from '../modules/mensajes/avisos.service';
import type { TiempoRealService } from '../modules/tiempo-real/tiempo-real.service';

export interface AvisoDeSeguridad {
  titulo: string;
  extracto?: string;
  enlace?: string;
}

/**
 * Un aviso de la campanita que no se puede apagar ni espera a «No molestar»: una sesión que se
 * cerró, una contraseña que cambió el equipo o un cambio que hizo el equipo en la tienda (N10,
 * N14). «Si no fuiste tú…» tiene que llegar siempre.
 */
export async function avisarSeguridad(
  prisma: PrismaService,
  tiempoReal: TiempoRealService,
  usuarioIds: string[],
  aviso: AvisoDeSeguridad,
): Promise<void> {
  const ids = [...new Set(usuarioIds)];
  if (ids.length === 0) return;
  const creados = await prisma.aviso.createManyAndReturn({
    data: ids.map((usuarioId) => ({
      usuarioId,
      tipo: 'SEGURIDAD' as const,
      titulo: aviso.titulo.slice(0, 160),
      extracto: aviso.extracto?.slice(0, 240) ?? null,
      enlace: aviso.enlace ?? null,
    })),
  });
  for (const creado of creados) {
    tiempoReal.emitirAUsuario(creado.usuarioId, EVENTOS.avisoNuevo, avisoCampanita(creado));
    tiempoReal.emitirAUsuario(creado.usuarioId, EVENTOS.contadores);
  }
}

/** Los dueños activos de una tienda: a ellos les llega lo que el equipo cambia en la tienda. */
export async function duenosDe(prisma: PrismaService, tiendaId: string): Promise<string[]> {
  const duenos = await prisma.usuario.findMany({
    where: { tiendaId, rol: 'DUENO', estado: 'ACTIVO', quitadoEn: null },
    select: { id: true },
  });
  return duenos.map((dueno) => dueno.id);
}
