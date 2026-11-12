import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { Server } from 'socket.io';

export const salaDeUsuario = (id: string) => `usuario:${id}`;
export const salaDeTienda = (id: string) => `tienda:${id}`;
export const salaDeSesion = (id: string) => `sesion:${id}`;

/**
 * Si alguien recarga la página, su socket se corta y vuelve en un par de segundos: se espera
 * esto antes de marcarlo desconectado (N01, «Activo ahora»).
 */
export const GRACIA_DESCONEXION_MS = 30_000;

type AlCambiarPresencia = (tiendaId: string, enLinea: boolean) => void;
type AlConectar = (usuarioId: string) => void;

/**
 * Lo que el resto de la API usa del tiempo real (docs/05 §6.3): emitir a una persona o a
 * una tienda, saber quién está conectado y cortar los sockets de una sesión que se cerró.
 *
 * El servidor lo deja el gateway al arrancar. Si todavía no hay servidor (pruebas sin
 * socket), emitir no hace nada: nada depende de que el evento llegue, porque al
 * reconectar la interfaz vuelve a pedir los datos.
 *
 * La presencia se lleva en memoria: alcanza con un solo proceso de API. Con varios, hará
 * falta el adaptador de Redis y contar las conexiones ahí. Una tienda está en línea si
 * alguna de sus personas lo está (N01); al irse la última se esperan 30 s de gracia.
 */
@Injectable()
export class TiempoRealService implements OnModuleDestroy {
  private servidor: Server | null = null;
  /** Las pruebas la acortan para no esperar 30 s. */
  graciaMs = GRACIA_DESCONEXION_MS;
  /** Sockets abiertos de cada persona, sin contar la gracia. */
  private readonly conexiones = new Map<string, number>();
  /** Personas que se fueron hace menos de 30 s: siguen «en línea» hasta que vence. */
  private readonly gracias = new Map<string, NodeJS.Timeout>();
  /** De qué tienda es cada persona conectada (o en gracia). */
  private readonly tiendaDe = new Map<string, string>();
  /** Las personas en línea de cada tienda (con la gracia incluida). */
  private readonly presentes = new Map<string, Set<string>>();
  private readonly oyentesPresencia: AlCambiarPresencia[] = [];
  private readonly oyentesConexion: AlConectar[] = [];

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

  /** En línea, contando los 30 s de gracia después de cerrar o recargar. */
  enLinea(usuarioId: string): boolean {
    return this.tieneSocket(usuarioId) || this.gracias.has(usuarioId);
  }

  /** Tiene PaseLibre abierto ahora mismo en algún equipo: lo que se le envía le llega. */
  tieneSocket(usuarioId: string): boolean {
    return (this.conexiones.get(usuarioId) ?? 0) > 0;
  }

  /** Alguien de la tienda está en línea (el puntito verde y «Activo ahora», N01). */
  tiendaEnLinea(tiendaId: string): boolean {
    return (this.presentes.get(tiendaId)?.size ?? 0) > 0;
  }

  /** Los mensajes avisan a quienes hablan con esa tienda (ver MensajesService). */
  alCambiarPresencia(oyente: AlCambiarPresencia): void {
    this.oyentesPresencia.push(oyente);
  }

  /** Al abrir un socket: lo que se le había enviado ya le llegó (dos checks grises). */
  alConectar(oyente: AlConectar): void {
    this.oyentesConexion.push(oyente);
  }

  conecto(usuarioId: string, tiendaId: string | null = null): void {
    this.conexiones.set(usuarioId, (this.conexiones.get(usuarioId) ?? 0) + 1);
    const gracia = this.gracias.get(usuarioId);
    if (gracia) {
      clearTimeout(gracia);
      this.gracias.delete(usuarioId);
    }
    if (tiendaId) {
      this.tiendaDe.set(usuarioId, tiendaId);
      const personas = this.presentes.get(tiendaId) ?? new Set<string>();
      const estaba = personas.size > 0;
      personas.add(usuarioId);
      this.presentes.set(tiendaId, personas);
      if (!estaba) this.avisarPresencia(tiendaId, true);
    }
    for (const oyente of this.oyentesConexion) oyente(usuarioId);
  }

  desconecto(usuarioId: string): void {
    const quedan = (this.conexiones.get(usuarioId) ?? 1) - 1;
    if (quedan > 0) {
      this.conexiones.set(usuarioId, quedan);
      return;
    }
    this.conexiones.delete(usuarioId);
    if (this.gracias.has(usuarioId)) return;
    const reloj = setTimeout(() => this.seFue(usuarioId), this.graciaMs);
    reloj.unref();
    this.gracias.set(usuarioId, reloj);
  }

  /** Vencieron los 30 s sin volver: deja de estar en línea, y su tienda si era la última. */
  private seFue(usuarioId: string): void {
    this.gracias.delete(usuarioId);
    if (this.tieneSocket(usuarioId)) return;
    const tiendaId = this.tiendaDe.get(usuarioId);
    this.tiendaDe.delete(usuarioId);
    if (!tiendaId) return;
    const personas = this.presentes.get(tiendaId);
    if (!personas) return;
    personas.delete(usuarioId);
    if (personas.size === 0) {
      this.presentes.delete(tiendaId);
      this.avisarPresencia(tiendaId, false);
    }
  }

  private avisarPresencia(tiendaId: string, enLinea: boolean): void {
    for (const oyente of this.oyentesPresencia) oyente(tiendaId, enLinea);
  }

  onModuleDestroy(): void {
    for (const reloj of this.gracias.values()) clearTimeout(reloj);
    this.gracias.clear();
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
