import { Inject, Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { EVENTOS, RUTA_TIEMPO_REAL } from '@paselibre/contracts';
import type { Server, Socket } from 'socket.io';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SesionService } from '../sesion/sesion.service';
import { COOKIE_SESION } from '../sesion/sesion.types';
import {
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
 * Socket del tiempo real (docs/05 §6.3), en `/tiempo-real`. Entra solo quien tiene una
 * sesión vigente y su propia contraseña; queda en la sala de su usuario, la de su tienda y
 * la de su sesión. El navegador no le manda nada: solo escucha.
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
    if (!sesion || sesion.usuario.debeCambiarClave) {
      socket.emit(EVENTOS.sinSesion);
      socket.disconnect(true);
      return;
    }

    const { usuario } = sesion;
    socket.data = { usuarioId: usuario.id, sesionId: sesion.sesionId };
    await socket.join([
      salaDeUsuario(usuario.id),
      salaDeSesion(sesion.sesionId),
      ...(usuario.tiendaId ? [salaDeTienda(usuario.tiendaId)] : []),
    ]);
    this.tiempoReal.conecto(usuario.id);
    socket.emit(EVENTOS.listo);
    await this.marcarConexion(usuario.id);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const usuarioId: unknown = socket.data?.usuarioId;
    if (typeof usuarioId !== 'string') return;
    this.tiempoReal.desconecto(usuarioId);
    await this.marcarConexion(usuarioId);
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
