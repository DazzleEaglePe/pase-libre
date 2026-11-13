'use client';

import {
  AL_SERVIDOR,
  ESCRIBIENDO_CADA_MS,
  ESCRIBIENDO_SE_APAGA_MS,
  EVENTOS,
  type EscribiendoDatos,
  type EventoEscribiendo,
  type EventoMensajeEquipo,
  type EventoMensajeNuevo,
} from '@paselibre/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useEvento, useSocket } from './tiempo-real';

/** Dónde se escribe: un chat entre tiendas o el hilo de una tienda con el Equipo. */
export type DondeEscribe = { conversacion_id: string } | { equipo: true; tienda_id?: string };

/** `c:<conversación>` o `e:<tienda>`: la clave de cada «escribiendo…». */
export function claveEscribiendo(evento: EventoEscribiendo): string {
  return 'conversacion_id' in evento ? `c:${evento.conversacion_id}` : `e:${evento.tienda_id}`;
}

/**
 * Cuándo avisar «escribiendo» (doc 19, punto 19): con texto, como mucho cada 3 s; al dejar la
 * caja vacía, «borró todo», solo si se había avisado hace menos de 5 s. Lógica pura para probarla.
 */
export function queAvisar(
  texto: string,
  ultimoAviso: number,
  ahora: number,
): 'escribiendo' | 'borro' | null {
  if (texto.trim()) return ahora - ultimoAviso >= ESCRIBIENDO_CADA_MS ? 'escribiendo' : null;
  return ultimoAviso > 0 && ahora - ultimoAviso < ESCRIBIENDO_SE_APAGA_MS ? 'borro' : null;
}

/**
 * Le avisa a la otra persona que se está escribiendo, mientras la caja tenga texto, como mucho
 * cada 3 s. Si se borra todo, se lo dice para que se apague al instante. Con `donde` nulo
 * (editando un mensaje, chat bloqueado…) no avisa nada.
 */
export function useAvisarEscribiendo(donde: DondeEscribe | null, texto: string): void {
  const socket = useSocket();
  const ultimo = useRef(0);
  const clave = donde ? JSON.stringify(donde) : null;

  useEffect(() => {
    ultimo.current = 0;
  }, [clave]);

  useEffect(() => {
    if (!socket?.connected || !clave) return;
    const ahora = Date.now();
    const accion = queAvisar(texto, ultimo.current, ahora);
    if (!accion) return;
    const datos = JSON.parse(clave) as EscribiendoDatos;
    if (accion === 'escribiendo') {
      ultimo.current = ahora;
      socket.emit(AL_SERVIDOR.escribiendo, datos);
    } else {
      ultimo.current = 0;
      socket.emit(AL_SERVIDOR.escribiendo, { ...datos, borro: true });
    }
  }, [socket, clave, texto]);
}

export interface Escribiendo {
  /** La otra tienda está escribiendo en esa conversación. */
  enConversacion: (conversacionId: string) => boolean;
  /**
   * En el hilo con el Equipo: del lado del Equipo, la tienda de `tiendaId` escribe; del lado de
   * la tienda (sin `tiendaId`), el Equipo le escribe.
   */
  enEquipo: (tiendaId?: string | null) => boolean;
}

/**
 * Quién te está escribiendo ahora (doc 19, punto 19). Se apaga a los 5 s sin otro aviso, al
 * llegar su mensaje o si borra todo.
 */
export function useEscribiendo(): Escribiendo {
  const [activas, setActivas] = useState<ReadonlySet<string>>(() => new Set());
  const relojes = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const apagar = useCallback((clave: string) => {
    clearTimeout(relojes.current.get(clave));
    relojes.current.delete(clave);
    setActivas((antes) => {
      if (!antes.has(clave)) return antes;
      const despues = new Set(antes);
      despues.delete(clave);
      return despues;
    });
  }, []);

  useEffect(() => {
    const lista = relojes.current;
    return () => {
      for (const reloj of lista.values()) clearTimeout(reloj);
      lista.clear();
    };
  }, []);

  useEvento<EventoEscribiendo>(EVENTOS.escribiendo, (evento) => {
    const clave = claveEscribiendo(evento);
    if (evento.borro) {
      apagar(clave);
      return;
    }
    clearTimeout(relojes.current.get(clave));
    relojes.current.set(
      clave,
      setTimeout(() => apagar(clave), ESCRIBIENDO_SE_APAGA_MS),
    );
    setActivas((antes) => (antes.has(clave) ? antes : new Set(antes).add(clave)));
  });
  // Llegó su mensaje: los puntitos se vuelven el mensaje.
  useEvento<EventoMensajeNuevo>(EVENTOS.mensajeNuevo, (evento) => {
    if (!evento.mensaje.mio) apagar(`c:${evento.conversacion_id}`);
  });
  useEvento<EventoMensajeEquipo>(EVENTOS.mensajeEquipo, (evento) => {
    apagar(`e:${evento.tienda_id}`);
  });

  return {
    enConversacion: (conversacionId) => activas.has(`c:${conversacionId}`),
    enEquipo: (tiendaId) =>
      tiendaId ? activas.has(`e:${tiendaId}`) : [...activas].some((c) => c.startsWith('e:')),
  };
}
