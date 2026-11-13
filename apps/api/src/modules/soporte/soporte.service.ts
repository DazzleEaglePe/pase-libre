import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  EVENTOS,
  MAX_ADVERTENCIAS,
  type EstadoMensajeEquipo,
  type EventoMensajeEquipo,
  type EventoVistoEquipo,
  type EscribirEquipoDatos,
  type HiloEquipoEnLista,
  type MensajeChatEquipo,
  type RespuestaAutomatica,
  type RespuestaChatEquipo,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { SALA_EQUIPO, salaDeTienda, TiempoRealService } from '../tiempo-real/tiempo-real.service';

const MOTIVO = { ESTAFA: 'Estafa', DESCRITO: 'No cumplió con lo descrito', TRATO: 'Mal trato' };
const ESTADO = {
  ABIERTA: 'Abierto',
  EN_REVISION: 'En revisión',
  REVISADA: 'Resuelto',
  DESCARTADA: 'Cerrado',
};
const ULTIMOS = 200;

/** La respuesta automática sale la primera vez o después de 12 h sin conversación (N14). */
const PAUSA_RESPUESTA_AUTOMATICA_MS = 12 * 3_600_000;
const CLAVE_RESPUESTA_AUTOMATICA = 'respuesta_automatica';
/** La del lienzo (N14). «{tienda}» se cambia por el nombre de la tienda. */
export const RESPUESTA_AUTOMATICA_INICIAL =
  'Hola, {tienda} 👋 Gracias por escribirnos. Cuéntanos tu consulta o reclamo con el mayor detalle posible (y si puedes, una captura). En breve te atenderá un asesor del Equipo PaseLibre.';

const SELECT_MENSAJE = {
  id: true,
  texto: true,
  deEquipo: true,
  automatica: true,
  autorId: true,
  creadoEn: true,
  autor: { select: { nombre: true } },
  denuncia: { select: { codigo: true, tipo: true, estado: true } },
} satisfies Prisma.MensajeEquipoSelect;

/** Las marcas del hilo: hasta dónde leyó y le llegó a cada lado. */
const SELECT_MARCAS = {
  id: true,
  leidoTiendaHasta: true,
  entregadoTiendaHasta: true,
  leidoEquipoHasta: true,
  entregadoEquipoHasta: true,
} satisfies Prisma.HiloEquipoSelect;

type FilaMensaje = Prisma.MensajeEquipoGetPayload<{ select: typeof SELECT_MENSAJE }>;
type MarcasDelHilo = Prisma.HiloEquipoGetPayload<{ select: typeof SELECT_MARCAS }>;

/**
 * Hasta dónde le llegaron y leyó el otro lado los mensajes de quien mira (doc 19, punto 18).
 * `visto` ya viene nulo si el «Visto» está apagado.
 */
export interface MarcasDelOtroLado {
  entregado: Date | null;
  visto: Date | null;
}

/** ✓ enviado, ✓✓ gris le llegó, ✓✓ verde lo leyó. Leer es haber recibido. */
export function estadoDeMensajeEquipo(
  creadoEn: Date,
  marcas: MarcasDelOtroLado,
): EstadoMensajeEquipo {
  if (marcas.visto && marcas.visto >= creadoEn) return 'visto';
  if (marcas.entregado && marcas.entregado >= creadoEn) return 'recibido';
  return 'enviado';
}

/** La fecha más nueva de las que hay, o nula. */
function masNueva(...fechas: Array<Date | null>): Date | null {
  return fechas.reduce<Date | null>(
    (mayor, fecha) => (fecha && (!mayor || fecha > mayor) ? fecha : mayor),
    null,
  );
}

/** Lo que ve la tienda de sus mensajes: «lo leyó» es que alguien del Equipo lo abrió. */
function marcasDelEquipo(hilo: MarcasDelHilo, muestraVisto: boolean): MarcasDelOtroLado {
  return {
    entregado: masNueva(hilo.entregadoEquipoHasta, hilo.leidoEquipoHasta),
    visto: muestraVisto ? hilo.leidoEquipoHasta : null,
  };
}

/** Lo que ve el Equipo de sus mensajes: hasta dónde le llegó y leyó la tienda. */
function marcasDeLaTienda(hilo: MarcasDelHilo, muestraVisto: boolean): MarcasDelOtroLado {
  return {
    entregado: masNueva(hilo.entregadoTiendaHasta, hilo.leidoTiendaHasta),
    visto: muestraVisto ? hilo.leidoTiendaHasta : null,
  };
}

function aMensaje(
  fila: FilaMensaje,
  usuarioId: string,
  marcas?: MarcasDelOtroLado,
): MensajeChatEquipo {
  const nombre = fila.autor?.nombre ?? 'Equipo PaseLibre';
  const mio = fila.autorId !== null && fila.autorId === usuarioId;
  return {
    id: fila.id,
    texto: fila.texto,
    de_equipo: fila.deEquipo,
    // Del equipo se dice el nombre de pila: «Fabrizio · Equipo PaseLibre».
    autor: fila.deEquipo && fila.autor ? (nombre.split(' ')[0] ?? nombre) : nombre,
    mio,
    automatica: fila.automatica,
    creado_en: fila.creadoEn.toISOString(),
    caso: fila.denuncia
      ? {
          codigo: `R-${fila.denuncia.codigo}`,
          motivo: fila.denuncia.tipo ? MOTIVO[fila.denuncia.tipo] : 'Reporte',
          estado: ESTADO[fila.denuncia.estado],
        }
      : null,
    ...(mio && marcas ? { estado: estadoDeMensajeEquipo(fila.creadoEn, marcas) } : {}),
  };
}

/**
 * El chat oficial con el equipo (REP_WebChatEquipo, secciones 13 y 18 del lienzo final): uno
 * por tienda, fijado arriba en Mensajes. El equipo puede escribir primero, por ejemplo por un
 * reporte («Caso R-1031»); la tienda contesta. Cada lado recibe su aviso, uno por hilo que se
 * actualiza (doc 19, punto 16), y ve ✓ / ✓✓ en sus mensajes (punto 18).
 */
@Injectable()
export class SoporteService implements OnModuleInit {
  private readonly logger = new Logger(SoporteService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  /** Al abrir PaseLibre, lo que le habían escrito ya le llegó: ✓✓ gris del otro lado. */
  onModuleInit(): void {
    this.tiempoReal.alConectar((usuarioId) => {
      this.marcarEntregados(usuarioId).catch((error: unknown) =>
        this.logger.warn(`No se pudo marcar el chat con el Equipo: ${String(error)}`),
      );
    });
  }

  private async marcarEntregados(usuarioId: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { rol: true, tiendaId: true },
    });
    if (!usuario) return;
    if (usuario.rol === 'EQUIPO') {
      const filas = await this.prisma.$queryRaw<Array<{ tienda_id: string }>>`
        UPDATE hilo_equipo h SET entregado_equipo_hasta = now()
        WHERE EXISTS (
          SELECT 1 FROM mensaje_equipo m
          WHERE m.hilo_id = h.id AND NOT m.de_equipo
            AND m.creado_en > coalesce(h.entregado_equipo_hasta, '-infinity'::timestamptz)
        )
        RETURNING h.tienda_id::text AS tienda_id`;
      for (const fila of filas) this.avisarVisto(fila.tienda_id, 'a la tienda');
      return;
    }
    if (!usuario.tiendaId) return;
    const filas = await this.prisma.$queryRaw<Array<{ tienda_id: string }>>`
      UPDATE hilo_equipo h SET entregado_tienda_hasta = now()
      WHERE h.tienda_id = ${usuario.tiendaId}::uuid
        AND EXISTS (
          SELECT 1 FROM mensaje_equipo m
          WHERE m.hilo_id = h.id AND m.de_equipo
            AND m.creado_en > coalesce(h.entregado_tienda_hasta, '-infinity'::timestamptz)
        )
      RETURNING h.tienda_id::text AS tienda_id`;
    for (const fila of filas) this.avisarVisto(fila.tienda_id, 'al equipo');
  }

  /**
   * El chat se mueve en vivo en los dos lados, aparte de los avisos: «No molestar» y el
   * apagado de «Novedades del equipo» callan la campanita, nunca el chat abierto (doc 19, A3).
   */
  private avisarChat(tiendaId: string): void {
    const datos: EventoMensajeEquipo = { tienda_id: tiendaId };
    this.tiempoReal.emitirATienda(tiendaId, EVENTOS.mensajeEquipo, datos);
    this.tiempoReal.emitirAlEquipo(EVENTOS.mensajeEquipo, datos);
  }

  /** Cambiaron los checks de un lado: quien tiene el chat abierto lo vuelve a pedir. */
  private avisarVisto(tiendaId: string, a: 'a la tienda' | 'al equipo'): void {
    const datos: EventoVistoEquipo = { tienda_id: tiendaId };
    if (a === 'a la tienda') this.tiempoReal.emitirATienda(tiendaId, EVENTOS.vistoEquipo, datos);
    else this.tiempoReal.emitirAlEquipo(EVENTOS.vistoEquipo, datos);
  }

  /**
   * Si la tienda apagó el «Visto» en Privacidad (cualquiera de su gente), el Equipo no ve sus
   * lecturas en verde, como en los otros chats.
   */
  private async tiendaMuestraVisto(tiendaId: string): Promise<boolean> {
    const apagados = await this.prisma.usuario.count({
      where: { tiendaId, estado: 'ACTIVO', mostrarVisto: false },
    });
    return apagados === 0;
  }

  /** Los mensajes de un lado que el otro todavía no leyó. */
  private sinLeerDe(hiloId: string, deEquipo: boolean, leidoHasta: Date | null): Promise<number> {
    return this.prisma.mensajeEquipo.count({
      where: { hiloId, deEquipo, ...(leidoHasta ? { creadoEn: { gt: leidoHasta } } : {}) },
    });
  }

  private tiendaDe(sesion: SesionActiva): string {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    return tiendaId;
  }

  /** Lo de la tienda: los mensajes y cuántos no leyó. Con `leer`, los marca leídos. */
  async miChat(sesion: SesionActiva, leer: boolean): Promise<RespuestaChatEquipo> {
    const tiendaId = this.tiendaDe(sesion);
    const [hilo, advertencias] = await Promise.all([
      this.prisma.hiloEquipo.findUnique({ where: { tiendaId }, select: SELECT_MARCAS }),
      this.advertenciasDe(tiendaId),
    ]);
    if (!hilo) return { mensajes: [], sin_leer: 0, ...(advertencias ? { advertencias } : {}) };
    const [filas, sinLeer] = await Promise.all([
      this.prisma.mensajeEquipo.findMany({
        where: { hiloId: hilo.id },
        orderBy: { creadoEn: 'desc' },
        take: ULTIMOS,
        select: SELECT_MENSAJE,
      }),
      this.sinLeerDe(hilo.id, true, hilo.leidoTiendaHasta),
    ]);
    // Cargar el hilo es recibirlo (✓✓ gris); abrirlo con algo nuevo, leerlo (✓✓ verde). Solo se
    // guarda y se avisa si cambió algo.
    const ultimoDelEquipo = filas.find((fila) => fila.deEquipo)?.creadoEn ?? null;
    const llega =
      ultimoDelEquipo !== null &&
      !(hilo.entregadoTiendaHasta && hilo.entregadoTiendaHasta >= ultimoDelEquipo);
    const lee = leer && sinLeer > 0;
    if (llega || lee) {
      const ahora = new Date();
      await this.prisma.hiloEquipo.update({
        where: { id: hilo.id },
        data: {
          ...(llega ? { entregadoTiendaHasta: ahora } : {}),
          ...(lee ? { leidoTiendaHasta: ahora } : {}),
        },
      });
      this.avisarVisto(tiendaId, 'al equipo');
    }
    if (leer) await this.avisos.leerDeHiloEquipo(sesion.usuario.id, hilo.id);
    // Con su propio «Visto» apagado, tampoco ve el del Equipo (RF-57).
    const marcas = marcasDelEquipo(hilo, sesion.usuario.mostrarVisto);
    return {
      mensajes: filas.reverse().map((fila) => aMensaje(fila, sesion.usuario.id, marcas)),
      sin_leer: leer ? 0 : sinLeer,
      ...(advertencias ? { advertencias } : {}),
    };
  }

  /** «Recibiste 1 advertencia de 3» (N14): las que dio el equipo, no los reportes recibidos. */
  private async advertenciasDe(tiendaId: string): Promise<RespuestaChatEquipo['advertencias']> {
    const [total, ultima] = await Promise.all([
      this.prisma.advertencia.count({ where: { tiendaId } }),
      this.prisma.advertencia.findFirst({
        where: { tiendaId },
        orderBy: { creadaEn: 'desc' },
        select: { motivo: true, creadaEn: true, denuncia: { select: { codigo: true } } },
      }),
    ]);
    if (!ultima) return null;
    return {
      total,
      maximo: MAX_ADVERTENCIAS,
      ultima: {
        motivo: ultima.motivo,
        caso: ultima.denuncia ? `R-${ultima.denuncia.codigo}` : null,
        fecha: ultima.creadaEn.toISOString(),
      },
    };
  }

  /** La tienda le escribe al equipo: el hilo se crea si no existía y el equipo recibe aviso. */
  async escribirAlEquipo(
    datos: EscribirEquipoDatos,
    sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    const tiendaId = this.tiendaDe(sesion);
    const anterior = await this.prisma.mensajeEquipo.findFirst({
      where: { hilo: { tiendaId } },
      orderBy: { creadoEn: 'desc' },
      select: { creadoEn: true },
    });
    const { mensaje, hilo } = await this.escribir(tiendaId, sesion.usuario.id, false, {
      texto: datos.texto,
      denunciaId: null,
      leLlega: this.tiempoReal.hayAlguienEn(SALA_EQUIPO),
    });
    if (!anterior || Date.now() - anterior.creadoEn.getTime() >= PAUSA_RESPUESTA_AUTOMATICA_MS) {
      await this.responderSolo(tiendaId, sesion.usuario.tienda?.nombre ?? 'tienda');
    }
    this.avisarChat(tiendaId);
    const [equipo, sinLeer] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { rol: 'EQUIPO', estado: 'ACTIVO' },
        select: { id: true },
      }),
      this.sinLeerDe(hilo.id, false, hilo.leidoEquipoHasta),
    ]);
    // Doc 19, punto 16: «{tienda} escribió al equipo · N mensajes», una fila por hilo.
    const tienda = sesion.usuario.tienda?.nombre ?? 'Una tienda';
    await this.avisos.porHiloEquipo(
      equipo.map((persona) => persona.id),
      hilo.id,
      {
        tipo: 'SISTEMA',
        titulo:
          sinLeer > 1
            ? `${tienda} escribió al equipo · ${sinLeer} mensajes`
            : `${tienda} escribió al equipo`,
        extracto: sinLeer > 1 ? `Último: "${datos.texto}"` : datos.texto,
        enlace: `/equipo/chats?tienda=${tiendaId}`,
      },
    );
    return aMensaje(mensaje, sesion.usuario.id, marcasDelEquipo(hilo, sesion.usuario.mostrarVisto));
  }

  /**
   * La respuesta automática (N14): un mensaje del equipo sin autor, un instante después del de la
   * tienda. La tienda lo ve como leído (lo acaba de recibir mientras escribía).
   */
  private async responderSolo(tiendaId: string, tienda: string): Promise<void> {
    const { texto } = await this.respuestaAutomatica();
    const ahora = new Date(Date.now() + 1);
    const hilo = await this.prisma.hiloEquipo.update({
      where: { tiendaId },
      data: {
        ultimoMensajeEn: ahora,
        leidoTiendaHasta: ahora,
        entregadoTiendaHasta: ahora,
      },
      select: { id: true },
    });
    await this.prisma.mensajeEquipo.create({
      data: {
        hiloId: hilo.id,
        autorId: null,
        deEquipo: true,
        automatica: true,
        texto: texto.replaceAll('{tienda}', tienda).slice(0, 2000),
        creadoEn: ahora,
      },
    });
  }

  async respuestaAutomatica(): Promise<RespuestaAutomatica> {
    const ajuste = await this.prisma.ajusteEquipo.findUnique({
      where: { clave: CLAVE_RESPUESTA_AUTOMATICA },
      select: { valor: true },
    });
    return { texto: ajuste?.valor ?? RESPUESTA_AUTOMATICA_INICIAL };
  }

  /** «Respuesta automática» editable desde el panel (N14). */
  async guardarRespuestaAutomatica(
    datos: RespuestaAutomatica,
    sesion: SesionActiva,
  ): Promise<RespuestaAutomatica> {
    await this.prisma.ajusteEquipo.upsert({
      where: { clave: CLAVE_RESPUESTA_AUTOMATICA },
      create: {
        clave: CLAVE_RESPUESTA_AUTOMATICA,
        valor: datos.texto,
        actualizadoPorId: sesion.usuario.id,
      },
      update: { valor: datos.texto, actualizadoPorId: sesion.usuario.id },
    });
    await this.prisma.registroEquipo.create({
      data: { autorId: sesion.usuario.id, accion: 'cambió la respuesta automática del chat' },
    });
    return datos;
  }

  // ── Del lado del equipo ──────────────────────────────────────────────────

  async hilos(): Promise<HiloEquipoEnLista[]> {
    const hilos = await this.prisma.hiloEquipo.findMany({
      orderBy: { ultimoMensajeEn: 'desc' },
      take: 200,
      select: {
        id: true,
        ultimoMensajeEn: true,
        leidoEquipoHasta: true,
        tienda: {
          select: {
            id: true,
            nombre: true,
            logo: true,
            stand: true,
            galeria: { select: { nombre: true } },
          },
        },
        mensajes: { orderBy: { creadoEn: 'desc' }, take: 1, select: SELECT_MENSAJE },
      },
    });
    const sinLeer = await Promise.all(
      hilos.map((hilo) => this.sinLeerDe(hilo.id, false, hilo.leidoEquipoHasta)),
    );
    return hilos.map((hilo, i) => ({
      tienda: {
        id: hilo.tienda.id,
        nombre: hilo.tienda.nombre,
        logo: hilo.tienda.logo,
        galeria: hilo.tienda.galeria?.nombre ?? null,
        stand: hilo.tienda.stand,
      },
      ultimo: hilo.mensajes[0] ? aMensaje(hilo.mensajes[0], '') : null,
      sin_leer: sinLeer[i] ?? 0,
      actualizado_en: hilo.ultimoMensajeEn.toISOString(),
    }));
  }

  async chatDeTienda(tiendaId: string, sesion: SesionActiva): Promise<RespuestaChatEquipo> {
    const hilo = await this.prisma.hiloEquipo.findUnique({
      where: { tiendaId },
      select: SELECT_MARCAS,
    });
    if (!hilo) return { mensajes: [], sin_leer: 0 };
    const [filas, muestraVisto] = await Promise.all([
      this.prisma.mensajeEquipo.findMany({
        where: { hiloId: hilo.id },
        orderBy: { creadoEn: 'desc' },
        take: ULTIMOS,
        select: SELECT_MENSAJE,
      }),
      this.tiendaMuestraVisto(tiendaId),
    ]);
    // Abrirlo es recibir y leer lo que escribió la tienda. Solo se guarda (y se avisa) si hay
    // algo nuevo: dos personas del Equipo con el chat abierto no se avisan sin parar.
    const ultimoDeLaTienda = filas.find((fila) => !fila.deEquipo)?.creadoEn ?? null;
    if (ultimoDeLaTienda && !(hilo.leidoEquipoHasta && hilo.leidoEquipoHasta >= ultimoDeLaTienda)) {
      const ahora = new Date();
      await this.prisma.hiloEquipo.update({
        where: { id: hilo.id },
        data: { leidoEquipoHasta: ahora, entregadoEquipoHasta: ahora },
      });
      this.avisarVisto(tiendaId, 'a la tienda');
    }
    await this.avisos.leerDeHiloEquipo(sesion.usuario.id, hilo.id);
    const marcas = marcasDeLaTienda(hilo, muestraVisto);
    return {
      mensajes: filas.reverse().map((fila) => aMensaje(fila, sesion.usuario.id, marcas)),
      sin_leer: 0,
      // «Visto por {tienda} a las 00:51».
      visto_hasta: marcas.visto?.toISOString() ?? null,
    };
  }

  /** El equipo le escribe a una tienda (puede ser el primero): a su gente le llega un aviso. */
  async escribirATienda(
    tiendaId: string,
    datos: EscribirEquipoDatos,
    sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { id: true, usuarios: { where: { estado: 'ACTIVO' }, select: { id: true } } },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    if (datos.denuncia) {
      const denuncia = await this.prisma.denuncia.findUnique({
        where: { id: datos.denuncia },
        select: { tiendaDenunciadaId: true, denunciante: { select: { tiendaId: true } } },
      });
      // El caso tiene que ser de esa tienda: reportada o quien reportó.
      if (
        !denuncia ||
        (denuncia.tiendaDenunciadaId !== tiendaId && denuncia.denunciante.tiendaId !== tiendaId)
      ) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Ese reporte no es de esta tienda.',
        );
      }
    }
    const { mensaje, hilo } = await this.escribir(tiendaId, sesion.usuario.id, true, {
      texto: datos.texto,
      denunciaId: datos.denuncia ?? null,
      leLlega: this.tiempoReal.hayAlguienEn(salaDeTienda(tiendaId)),
    });
    this.avisarChat(tiendaId);
    const [sinLeer, muestraVisto] = await Promise.all([
      this.sinLeerDe(hilo.id, true, hilo.leidoTiendaHasta),
      this.tiendaMuestraVisto(tiendaId),
    ]);
    // Doc 19, punto 16: «El equipo PaseLibre te escribió N mensajes · Último: "…"», una fila
    // por hilo que se actualiza y sube arriba.
    await this.avisos.porHiloEquipo(
      tienda.usuarios.map((persona) => persona.id),
      hilo.id,
      {
        tipo: 'EQUIPO',
        titulo:
          sinLeer > 1
            ? `El equipo PaseLibre te escribió ${sinLeer} mensajes`
            : 'El equipo PaseLibre te escribió',
        extracto: sinLeer > 1 ? `Último: "${datos.texto}"` : datos.texto,
        enlace: '/mensajes/equipo',
        accion: { tipo: 'ABRIR', texto: 'Responder', enlace: '/mensajes/equipo' },
      },
    );
    return aMensaje(mensaje, sesion.usuario.id, marcasDeLaTienda(hilo, muestraVisto));
  }

  /**
   * Guarda el mensaje y sube el hilo. Quien escribe ya leyó todo; si el otro lado tiene
   * PaseLibre abierto (`leLlega`), ya le llegó (✓✓ gris, doc 19 punto 18).
   */
  private async escribir(
    tiendaId: string,
    autorId: string,
    deEquipo: boolean,
    datos: { texto: string; denunciaId: string | null; leLlega: boolean },
  ): Promise<{ mensaje: FilaMensaje; hilo: MarcasDelHilo }> {
    const ahora = new Date();
    const cambios = {
      ultimoMensajeEn: ahora,
      ...(deEquipo ? { leidoEquipoHasta: ahora } : { leidoTiendaHasta: ahora }),
      ...(datos.leLlega
        ? deEquipo
          ? { entregadoTiendaHasta: ahora }
          : { entregadoEquipoHasta: ahora }
        : {}),
    };
    const hilo = await this.prisma.hiloEquipo.upsert({
      where: { tiendaId },
      create: { tiendaId, ...cambios },
      update: cambios,
      select: SELECT_MARCAS,
    });
    const mensaje = await this.prisma.mensajeEquipo.create({
      data: {
        hiloId: hilo.id,
        autorId,
        deEquipo,
        texto: datos.texto,
        denunciaId: datos.denunciaId,
        creadoEn: ahora,
      },
      select: SELECT_MENSAJE,
    });
    return { mensaje, hilo };
  }
}
