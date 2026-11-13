import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  AL_SERVIDOR,
  ESCRIBIENDO_SE_APAGA_MS,
  escribiendoSchema,
  EVENTOS,
  RUTA_TIEMPO_REAL,
  type EscribiendoDatos,
  type EventoEscribiendo,
} from '@paselibre/contracts';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SesionService } from '../sesion/sesion.service';
import { COOKIE_SESION } from '../sesion/sesion.types';
import {
  SALA_EQUIPO,
  salaDeSesion,
  salaDeTienda,
  salaDeUsuario,
  TiempoRealService,
} from './tiempo-real.service';

/** Lee `pl_sesion` de la cabecera Cookie del handshake. */
export function tokenDeCookie(cabecera: string | undefined): string | null {
  for (const parte of (cabecera ?? '').split(';')) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === COOKIE_SESION && valor.length > 0) {
      try {
        return decodeURIComponent(valor.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Entre dos «escribiendo» del mismo socket, como mínimo esto: el navegador manda uno cada 3 s,
 * así que más seguido es alguien probando.
 */
export const ESCRIBIENDO_MINIMO_MS = 1_000;

/** Lo que el gateway guarda en cada socket al conectarse. */
interface DatosDelSocket {
  usuarioId: string;
  sesionId: string;
  rol: string;
  tiendaId: string | null;
  ultimoEscribiendo?: number;
}

/**
 * Socket del tiempo real (docs/05 §6.3), en `/tiempo-real`. Entra solo quien tiene una
 * sesión vigente y su propia contraseña; queda en la sala de su usuario, la de su tienda y
 * la de su sesión; la gente del Equipo, también en la del Equipo. Del navegador solo recibe
 * «escribiendo» (doc 19, punto 19); todo lo demás va por HTTP.
 */
@WebSocketGateway({ path: RUTA_TIEMPO_REAL, serveClient: false })
export class TiempoRealGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TiempoRealGateway.name);

  constructor(
    @Inject(SesionService) private readonly sesiones: SesionService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  afterInit(servidor: Server): void {
    this.tiempoReal.usarServidor(servidor);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = tokenDeCookie(socket.handshake.headers.cookie);
    const sesion = token ? await this.sesiones.validar(token).catch(() => null) : null;
    // En «Ayudar como la tienda» no llega nada en vivo: el equipo no lee los chats así (N14).
    if (!sesion || sesion.usuario.debeCambiarClave || sesion.soporte) {
      socket.emit(EVENTOS.sinSesion);
      socket.disconnect(true);
      return;
    }

    const { usuario } = sesion;
    const datos: DatosDelSocket = {
      usuarioId: usuario.id,
      sesionId: sesion.sesionId,
      rol: usuario.rol,
      tiendaId: usuario.tiendaId,
    };
    socket.data = datos;
    await socket.join([
      salaDeUsuario(usuario.id),
      salaDeSesion(sesion.sesionId),
      ...(usuario.tiendaId ? [salaDeTienda(usuario.tiendaId)] : []),
      ...(usuario.rol === 'EQUIPO' ? [SALA_EQUIPO] : []),
    ]);
    this.tiempoReal.conecto(usuario.id, usuario.tiendaId);
    socket.emit(EVENTOS.listo);
    await this.marcarConexion(usuario.id);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const usuarioId: unknown = socket.data?.usuarioId;
    if (typeof usuarioId !== 'string') return;
    this.tiempoReal.desconecto(usuarioId);
    await this.marcarConexion(usuarioId);
  }

  /**
   * «Escribiendo…» (doc 19, punto 19): `{ conversacion_id }` en un chat entre tiendas, o
   * `{ equipo: true }` en el hilo con el Equipo (el Equipo dice de qué tienda). Solo llega a la
   * otra persona de esa conversación, y nunca si quien escribe apagó el «Visto».
   */
  @SubscribeMessage(AL_SERVIDOR.escribiendo)
  async escribiendo(
    @ConnectedSocket() socket: Socket,
    @MessageBody() cuerpo: unknown,
  ): Promise<void> {
    const quien = socket.data as Partial<DatosDelSocket> | undefined;
    if (typeof quien?.usuarioId !== 'string') return;
    const leido = escribiendoSchema.safeParse(cuerpo);
    if (!leido.success) return;
    const ahora = Date.now();
    const desdeElUltimo = ahora - (quien.ultimoEscribiendo ?? 0);
    if (leido.data.borro) {
      // «Borró todo» solo tiene sentido justo después de un «escribiendo» que sí salió.
      if (desdeElUltimo > ESCRIBIENDO_SE_APAGA_MS) return;
      quien.ultimoEscribiendo = 0;
    } else {
      if (desdeElUltimo < ESCRIBIENDO_MINIMO_MS) return;
      quien.ultimoEscribiendo = ahora;
    }
    try {
      await this.avisarEscribiendo(quien as DatosDelSocket, leido.data);
    } catch (error) {
      this.logger.warn(`No se pudo avisar «escribiendo»: ${String(error)}`);
    }
  }

  private async avisarEscribiendo(quien: DatosDelSocket, datos: EscribiendoDatos): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: quien.usuarioId },
      select: { mostrarVisto: true, estado: true },
    });
    // Con el «Visto» apagado tampoco se dice que está escribiendo (es la misma idea).
    if (!usuario?.mostrarVisto || usuario.estado !== 'ACTIVO') return;
    const borro = datos.borro ? { borro: true as const } : {};

    if ('conversacion_id' in datos) {
      const participacion = await this.prisma.participacion.findUnique({
        where: {
          conversacionId_usuarioId: {
            conversacionId: datos.conversacion_id,
            usuarioId: quien.usuarioId,
          },
        },
        select: {
          conversacion: {
            select: {
              compradorId: true,
              vendedorId: true,
              tiendaCompradoraId: true,
              tiendaVendedoraId: true,
            },
          },
        },
      });
      // Una conversación ajena no dice nada (ni que existe).
      if (!participacion) return;
      const { conversacion: c } = participacion;
      const soyComprador = c.compradorId === quien.usuarioId;
      const otroId = soyComprador ? c.vendedorId : c.compradorId;
      const miTienda = soyComprador ? c.tiendaCompradoraId : c.tiendaVendedoraId;
      const suTienda = soyComprador ? c.tiendaVendedoraId : c.tiendaCompradoraId;
      const bloqueos = await this.prisma.bloqueo.count({
        where: {
          OR: [
            { usuarioId: otroId, tiendaBloqueadaId: miTienda },
            { usuarioId: quien.usuarioId, tiendaBloqueadaId: suTienda },
          ],
        },
      });
      if (bloqueos > 0) return;
      const evento: EventoEscribiendo = { conversacion_id: datos.conversacion_id, ...borro };
      this.tiempoReal.emitirAUsuario(otroId, EVENTOS.escribiendo, evento);
      return;
    }

    // El hilo de una tienda con el Equipo.
    if (quien.rol === 'EQUIPO') {
      if (!datos.tienda_id) return;
      const evento: EventoEscribiendo = { equipo: true, tienda_id: datos.tienda_id, ...borro };
      this.tiempoReal.emitirATienda(datos.tienda_id, EVENTOS.escribiendo, evento);
      return;
    }
    // La tienda solo escribe en su propio hilo.
    if (!quien.tiendaId || (datos.tienda_id && datos.tienda_id !== quien.tiendaId)) return;
    const evento: EventoEscribiendo = { equipo: true, tienda_id: quien.tiendaId, ...borro };
    this.tiempoReal.emitirAlEquipo(EVENTOS.escribiendo, evento);
  }

  private async marcarConexion(usuarioId: string): Promise<void> {
    try {
      await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { ultimaConexionEn: new Date() },
      });
    } catch (error) {
      this.logger.warn(`No se pudo guardar la última conexión: ${String(error)}`);
    }
  }
}
