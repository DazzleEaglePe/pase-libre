import { Inject, Injectable } from '@nestjs/common';
import {
  EVENTOS,
  type AvisoCampanita,
  type Contadores,
  type RespuestaAvisos,
} from '@paselibre/contracts';
import { Prisma, type Aviso } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { visibleDesde } from './no-molestar';

const AVISOS_EN_LA_CAMPANITA = 20;

function avisoCampanita(aviso: Aviso): AvisoCampanita {
  return {
    id: aviso.id,
    tipo: aviso.tipo,
    titulo: aviso.titulo,
    extracto: aviso.extracto,
    enlace: aviso.enlace,
    leido: aviso.leidoEn !== null,
    actualizado_en: aviso.actualizadoEn.toISOString(),
  };
}

/** Conversaciones con algo sin leer para una persona: las cuentan Mensajes y la lista. */
export async function noLeidosPorConversacion(
  prisma: Prisma.TransactionClient,
  usuarioId: string,
  conversacionId?: string,
): Promise<Map<string, number>> {
  const deUna = conversacionId
    ? Prisma.sql`AND m.conversacion_id = ${conversacionId}::uuid`
    : Prisma.empty;
  const filas = await prisma.$queryRaw<Array<{ id: string; cantidad: number }>>`
    SELECT m.conversacion_id::text AS id, count(*)::int AS cantidad
    FROM mensaje m
    JOIN participacion p ON p.conversacion_id = m.conversacion_id AND p.usuario_id = ${usuarioId}::uuid
    WHERE m.autor_id IS DISTINCT FROM ${usuarioId}::uuid
      AND m.creado_en > coalesce(p.leido_hasta, '-infinity'::timestamptz)
      ${deUna}
    GROUP BY m.conversacion_id`;
  return new Map(filas.map((f) => [f.id, f.cantidad]));
}

/**
 * La campanita (RF-40, RF-59). Un aviso por conversación con mensajes sin leer: un mensaje
 * nuevo lo actualiza, no apila otro. No hay aviso si la conversación está silenciada o la
 * persona apagó los avisos de mensajes; con «No molestar», el aviso aparece al terminar el
 * horario. El chat sí se actualiza siempre.
 */
@Injectable()
export class AvisosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  /** Dentro de la transacción del mensaje. Devuelve el aviso si ya se puede ver. */
  async porMensaje(
    tx: Prisma.TransactionClient,
    datos: { destinatarioId: string; conversacionId: string; remitente: string; extracto: string },
  ): Promise<AvisoCampanita | null> {
    const [destinatario, participacion, preferencia] = await Promise.all([
      tx.usuario.findUniqueOrThrow({
        where: { id: datos.destinatarioId },
        select: { noMolestarDesde: true, noMolestarHasta: true },
      }),
      tx.participacion.findUnique({
        where: {
          conversacionId_usuarioId: {
            conversacionId: datos.conversacionId,
            usuarioId: datos.destinatarioId,
          },
        },
        select: { silenciada: true },
      }),
      tx.preferenciaAviso.findUnique({
        where: { usuarioId_tipo: { usuarioId: datos.destinatarioId, tipo: 'MENSAJE' } },
        select: { campanita: true },
      }),
    ]);
    if (participacion?.silenciada || preferencia?.campanita === false) return null;

    const sinLeer =
      (await noLeidosPorConversacion(tx, datos.destinatarioId, datos.conversacionId)).get(
        datos.conversacionId,
      ) ?? 1;
    const ahora = new Date();
    const desde = visibleDesde(destinatario.noMolestarDesde, destinatario.noMolestarHasta, ahora);
    const contenido = {
      titulo:
        sinLeer === 1
          ? `Tienes un mensaje sin leer de ${datos.remitente}`
          : `Tienes ${sinLeer} mensajes sin leer de ${datos.remitente}`,
      extracto: datos.extracto.slice(0, 240),
      enlace: `/mensajes/${datos.conversacionId}`,
      leidoEn: null,
      visibleDesde: desde,
    };
    const aviso = await tx.aviso.upsert({
      where: {
        usuarioId_conversacionId: {
          usuarioId: datos.destinatarioId,
          conversacionId: datos.conversacionId,
        },
      },
      update: contenido,
      create: {
        ...contenido,
        usuarioId: datos.destinatarioId,
        conversacionId: datos.conversacionId,
        tipo: 'MENSAJE',
      },
    });
    return desde <= ahora ? avisoCampanita(aviso) : null;
  }

  async lista(usuarioId: string): Promise<RespuestaAvisos> {
    const visibles = { usuarioId, visibleDesde: { lte: new Date() } };
    const [avisos, sinLeer] = await Promise.all([
      this.prisma.aviso.findMany({
        where: visibles,
        orderBy: { actualizadoEn: 'desc' },
        take: AVISOS_EN_LA_CAMPANITA,
      }),
      this.prisma.aviso.count({ where: { ...visibles, leidoEn: null } }),
    ]);
    return { avisos: avisos.map(avisoCampanita), sin_leer: sinLeer };
  }

  /** «Marcar como leídos»: todos, o los que lleguen en `ids`. */
  async leer(usuarioId: string, ids?: string[]): Promise<RespuestaAvisos> {
    await this.prisma.aviso.updateMany({
      where: { usuarioId, leidoEn: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { leidoEn: new Date() },
    });
    this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.contadores);
    return this.lista(usuarioId);
  }

  /** Al abrir una conversación su aviso queda leído. */
  async leerDeConversacion(usuarioId: string, conversacionId: string): Promise<void> {
    await this.prisma.aviso.updateMany({
      where: { usuarioId, conversacionId, leidoEn: null },
      data: { leidoEn: new Date() },
    });
  }

  async contadores(usuarioId: string): Promise<Contadores> {
    const [noLeidos, manuales, avisos] = await Promise.all([
      noLeidosPorConversacion(this.prisma, usuarioId),
      this.prisma.participacion.findMany({
        where: { usuarioId, noLeidaManual: true, archivada: false },
        select: { conversacionId: true },
      }),
      this.prisma.aviso.count({
        where: { usuarioId, leidoEn: null, visibleDesde: { lte: new Date() } },
      }),
    ]);
    const archivadas = new Set(
      (
        await this.prisma.participacion.findMany({
          where: { usuarioId, archivada: true },
          select: { conversacionId: true },
        })
      ).map((p) => p.conversacionId),
    );
    const conAlgoSinLeer = new Set([
      ...[...noLeidos.keys()].filter((id) => !archivadas.has(id)),
      ...manuales.map((p) => p.conversacionId),
    ]);
    return { mensajes: conAlgoSinLeer.size, avisos };
  }
}
