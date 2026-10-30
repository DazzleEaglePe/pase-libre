import { Injectable } from '@nestjs/common';
import type { Server } from 'socket.io';

export const salaDeUsuario = (id: string) => `usuario:${id}`;
export const salaDeTienda = (id: string) => `tienda:${id}`;
export const salaDeSesion = (id: string) => `sesion:${id}`;

/**
 * Lo que el resto de la API usa del tiempo real (docs/05 §6.3): emitir a una persona o a
 * una tienda, saber quién está conectado y cortar los sockets de una sesión que se cerró.
 *
 * El servidor lo deja el gateway al arrancar. Si todavía no hay servidor (pruebas sin
 * socket), emitir no hace nada: nada depende de que el evento llegue, porque al
 * reconectar la interfaz vuelve a pedir los datos.
 *
 * La presencia se lleva en memoria: alcanza con un solo proceso de API. Con varios, hará
 * falta el adaptador de Redis y contar las conexiones ahí.
 */
@Injectable()
export class TiempoRealService {
  private servidor: Server | null = null;
  private readonly conexiones = new Map<string, number>();

  usarServidor(servidor: Server): void {
    this.servidor = servidor;
  }

  emitirAUsuario(usuarioId: string, evento: string, datos?: unknown): void {
    this.servidor?.to(salaDeUsuario(usuarioId)).emit(evento, datos ?? {});
  }

  emitirATienda(tiendaId: string, evento: string, datos?: unknown): void {
    this.servidor?.to(salaDeTienda(tiendaId)).emit(evento, datos ?? {});
  }

  /** A todos los sockets: todos tienen sesión, porque el visitante no abre uno. */
  emitirATodos(evento: string, datos?: unknown): void {
    this.servidor?.emit(evento, datos ?? {});
  }

  enLinea(usuarioId: string): boolean {
    return (this.conexiones.get(usuarioId) ?? 0) > 0;
  }

  conecto(usuarioId: string): void {
    this.conexiones.set(usuarioId, (this.conexiones.get(usuarioId) ?? 0) + 1);
  }

  desconecto(usuarioId: string): void {
    const quedan = (this.conexiones.get(usuarioId) ?? 1) - 1;
    if (quedan > 0) this.conexiones.set(usuarioId, quedan);
    else this.conexiones.delete(usuarioId);
  }

  /** Al salir: los sockets de esa sesión dejan de recibir mensajes al instante. */
  desconectarSesion(sesionId: string): void {
    this.servidor?.in(salaDeSesion(sesionId)).disconnectSockets(true);
  }

  /**
   * Al suspender o dar una clave nueva se revocan todas las sesiones; al cambiar la
   * contraseña, todas menos la actual.
   */
  async desconectarUsuario(usuarioId: string, salvoSesion?: string): Promise<void> {
    if (!this.servidor) return;
    const sockets = await this.servidor.in(salaDeUsuario(usuarioId)).fetchSockets();
    for (const socket of sockets) {
      if (socket.data.sesionId !== salvoSesion) socket.disconnect(true);
    }
  }
}
