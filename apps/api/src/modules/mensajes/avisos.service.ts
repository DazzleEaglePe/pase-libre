import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORIA_DE_AVISO,
  EVENTOS,
  type AccionAviso,
  type AvisoCampanita,
  type AvisosConsulta,
  type CategoriaAviso,
  type Contadores,
  type RespuestaAvisos,
} from '@paselibre/contracts';
import { Prisma, type Aviso, type TipoAviso } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { visibleDesde } from './no-molestar';

const AVISOS_EN_LA_CAMPANITA = 20;

const CATEGORIAS: CategoriaAviso[] = ['EN_VIVO', 'VENTAS', 'MENSAJES', 'PUBLICACIONES', 'CUENTA'];

const TIPOS_DE: Record<CategoriaAviso, TipoAviso[]> = Object.fromEntries(
  CATEGORIAS.map((categoria) => [
    categoria,
    (Object.keys(CATEGORIA_DE_AVISO) as TipoAviso[]).filter(
      (tipo) => CATEGORIA_DE_AVISO[tipo] === categoria,
    ),
  ]),
) as Record<CategoriaAviso, TipoAviso[]>;

export function avisoCampanita(aviso: Aviso): AvisoCampanita {
  return {
    id: aviso.id,
    tipo: aviso.tipo,
    categoria: CATEGORIA_DE_AVISO[aviso.tipo],
    titulo: aviso.titulo,
    extracto: aviso.extracto,
    enlace: aviso.enlace,
    accion: (aviso.accion as AccionAviso | null) ?? null,
    foto: aviso.foto,
    leido: aviso.leidoEn !== null,
    actualizado_en: aviso.actualizadoEn.toISOString(),
  };
}

/** Lo que lleva un aviso nuevo, sin el destinatario. */
export interface AvisoNuevo {
  tipo: TipoAviso;
  titulo: string;
  extracto?: string | null;
  enlace?: string | null;
  accion?: AccionAviso | null;
  /** La foto del pedido en vivo (doc 19, punto 21). */
  foto?: string | null;
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

  /**
   * Un aviso para cada persona (salvo a quien apagó ese tipo), con «No molestar», y por el
   * socket a quien ya lo puede ver. Lo usan En vivo, opiniones, tiendas seguidas y el equipo.
   */
  async crear(usuarioIds: string[], nuevo: AvisoNuevo): Promise<void> {
    const ids = [...new Set(usuarioIds)];
    if (ids.length === 0) return;
    const [apagados, personas] = await Promise.all([
      this.prisma.preferenciaAviso.findMany({
        where: { usuarioId: { in: ids }, tipo: nuevo.tipo, campanita: false },
        select: { usuarioId: true },
      }),
      this.prisma.usuario.findMany({
        where: { id: { in: ids }, estado: 'ACTIVO' },
        select: { id: true, noMolestarDesde: true, noMolestarHasta: true },
      }),
    ]);
    const sinAviso = new Set(apagados.map((fila) => fila.usuarioId));
    const ahora = new Date();
    const avisos = await this.prisma.aviso.createManyAndReturn({
      data: personas
        .filter((persona) => !sinAviso.has(persona.id))
        .map((persona) => ({
          usuarioId: persona.id,
          tipo: nuevo.tipo,
          titulo: nuevo.titulo.slice(0, 160),
          extracto: nuevo.extracto?.slice(0, 240) ?? null,
          enlace: nuevo.enlace ?? null,
          accion: nuevo.accion ?? Prisma.DbNull,
          foto: nuevo.foto ?? null,
          visibleDesde: visibleDesde(persona.noMolestarDesde, persona.noMolestarHasta, ahora),
        })),
    });
    for (const aviso of avisos) {
      if (aviso.visibleDesde > ahora) continue;
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.avisoNuevo, avisoCampanita(aviso));
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.contadores);
    }
  }

  /**
   * El chat con el Equipo (doc 19, punto 16): un aviso por persona y por hilo, como los de los
   * chats entre tiendas. Un mensaje nuevo lo actualiza y lo sube arriba, sin leer; no apila otro.
   * Respeta el apagado de ese tipo y «No molestar», igual que `crear`.
   */
  async porHiloEquipo(
    usuarioIds: string[],
    hiloEquipoId: string,
    nuevo: AvisoNuevo,
  ): Promise<void> {
    const ids = [...new Set(usuarioIds)];
    if (ids.length === 0) return;
    const [apagados, personas] = await Promise.all([
      this.prisma.preferenciaAviso.findMany({
        where: { usuarioId: { in: ids }, tipo: nuevo.tipo, campanita: false },
        select: { usuarioId: true },
      }),
      this.prisma.usuario.findMany({
        where: { id: { in: ids }, estado: 'ACTIVO' },
        select: { id: true, noMolestarDesde: true, noMolestarHasta: true },
      }),
    ]);
    const sinAviso = new Set(apagados.map((fila) => fila.usuarioId));
    const ahora = new Date();
    for (const persona of personas) {
      if (sinAviso.has(persona.id)) continue;
      const contenido = {
        tipo: nuevo.tipo,
        titulo: nuevo.titulo.slice(0, 160),
        extracto: nuevo.extracto?.slice(0, 240) ?? null,
        enlace: nuevo.enlace ?? null,
        accion: nuevo.accion ?? Prisma.DbNull,
        leidoEn: null,
        visibleDesde: visibleDesde(persona.noMolestarDesde, persona.noMolestarHasta, ahora),
        // Sube arriba aunque el contenido no cambie.
        actualizadoEn: ahora,
      };
      const aviso = await this.prisma.aviso.upsert({
        where: { usuarioId_hiloEquipoId: { usuarioId: persona.id, hiloEquipoId } },
        update: contenido,
        create: { ...contenido, usuarioId: persona.id, hiloEquipoId },
      });
      if (aviso.visibleDesde > ahora) continue;
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.avisoNuevo, avisoCampanita(aviso));
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.contadores);
    }
  }

  /** Al abrir el chat con el Equipo, su aviso queda leído (como al abrir una conversación). */
  async leerDeHiloEquipo(usuarioId: string, hiloEquipoId: string): Promise<void> {
    const { count } = await this.prisma.aviso.updateMany({
      where: { usuarioId, hiloEquipoId, leidoEn: null },
      data: { leidoEn: new Date() },
    });
    if (count > 0) this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.contadores);
  }

  async lista(usuarioId: string, consulta: Partial<AvisosConsulta> = {}): Promise<RespuestaAvisos> {
    const visibles = { usuarioId, visibleDesde: { lte: new Date() } };
    const filtro = consulta.categoria ? { tipo: { in: TIPOS_DE[consulta.categoria] } } : {};
    const [avisos, porTipo] = await Promise.all([
      this.prisma.aviso.findMany({
        where: { ...visibles, ...filtro },
        orderBy: { actualizadoEn: 'desc' },
        take: consulta.limite ?? AVISOS_EN_LA_CAMPANITA,
      }),
      this.prisma.aviso.groupBy({
        by: ['tipo'],
        where: { ...visibles, leidoEn: null },
        _count: { _all: true },
      }),
    ]);
    const sinLeerPorCategoria = Object.fromEntries(
      CATEGORIAS.map((categoria) => [categoria, 0]),
    ) as Record<CategoriaAviso, number>;
    let sinLeer = 0;
    for (const fila of porTipo) {
      sinLeerPorCategoria[CATEGORIA_DE_AVISO[fila.tipo]] += fila._count._all;
      sinLeer += fila._count._all;
    }
    return {
      avisos: avisos.map(avisoCampanita),
      sin_leer: sinLeer,
      sin_leer_por_categoria: sinLeerPorCategoria,
    };
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

  /**
   * Al abrir una conversación su aviso queda leído (N07, error 36): el de sus mensajes y
   * cualquier otro que lleve a ese chat (una venta, un «¡Lo tengo!»…).
   */
  async leerDeConversacion(usuarioId: string, conversacionId: string): Promise<void> {
    await this.prisma.aviso.updateMany({
      where: {
        usuarioId,
        leidoEn: null,
        OR: [{ conversacionId }, { enlace: `/mensajes/${conversacionId}` }],
      },
      data: { leidoEn: new Date() },
    });
  }

  /**
   * Abrió la campanita (doc 19, punto 15): el número naranja vuelve a 0 y desde ahora cuenta
   * solo lo que llegue después. El puntito de cada aviso sigue hasta tocarlo (`leidoEn`). Avisa
   * a sus otras pestañas para que también lo bajen.
   */
  async vistos(usuarioId: string): Promise<Contadores> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { avisosVistosEn: new Date() },
    });
    this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.contadores);
    return this.contadores(usuarioId);
  }

  /**
   * El número naranja de la campanita (doc 19, punto 15): los avisos sin leer que llegaron
   * desde la última vez que la abrió. «Llegó» es cuando se pudo ver: al crearse o
   * actualizarse (otro mensaje del mismo chat), o al terminar «No molestar».
   */
  private async avisosNuevos(usuarioId: string): Promise<number> {
    const ahora = new Date();
    const { avisosVistosEn: vistos } = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { avisosVistosEn: true },
    });
    return this.prisma.aviso.count({
      where: {
        usuarioId,
        leidoEn: null,
        visibleDesde: { lte: ahora },
        ...(vistos
          ? { OR: [{ actualizadoEn: { gt: vistos } }, { visibleDesde: { gt: vistos } }] }
          : {}),
      },
    });
  }

  async contadores(usuarioId: string): Promise<Contadores> {
    const [noLeidos, manuales, avisos] = await Promise.all([
      noLeidosPorConversacion(this.prisma, usuarioId),
      this.prisma.participacion.findMany({
        where: { usuarioId, noLeidaManual: true, archivada: false },
        select: { conversacionId: true },
      }),
      this.avisosNuevos(usuarioId),
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
    // El chat oficial con el equipo cuenta como una conversación más (REP_WebChatEquipo).
    const [equipo] = await this.prisma.$queryRaw<Array<{ hay: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM hilo_equipo h
        JOIN usuario u ON u.tienda_id = h.tienda_id
        JOIN mensaje_equipo m ON m.hilo_id = h.id
        WHERE u.id = ${usuarioId}::uuid AND m.de_equipo
          AND (h.leido_tienda_hasta IS NULL OR m.creado_en > h.leido_tienda_hasta)
      ) AS hay`;
    return { mensajes: conAlgoSinLeer.size + (equipo?.hay ? 1 : 0), avisos };
  }
}
