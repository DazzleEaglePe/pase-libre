'use client';

import type { MensajeChatEquipo } from '@paselibre/contracts';
import { useCallback, useRef } from 'react';

import type { EstadoCheck } from './estado-chat';

/**
 * Cómo entra un mensaje nuevo (doc 19, punto 19): el que llega sube 14 px y aparece en 180 ms;
 * el tuyo sube desde la caja. Los que ya estaban al abrir el chat no se mueven.
 */
export type EntradaMensaje = 'llega' | 'sale';

/** La clase de `globals.css` (bloque «doc 19 · punto 19»), o nada. */
export function claseDe(entrada: EntradaMensaje | null | undefined): string {
  if (entrada === 'llega') return 'chat-llega';
  if (entrada === 'sale') return 'chat-sale';
  return '';
}

/** Los checks del chat con el Equipo (doc 19, punto 18), en el nombre que usan los otros chats. */
export function checkDeEquipo(m: Pick<MensajeChatEquipo, 'mio' | 'estado'>): EstadoCheck | null {
  if (!m.mio || !m.estado) return null;
  return m.estado === 'visto' ? 'leido' : m.estado;
}

/**
 * Para los chats que se vuelven a pedir enteros (el del Equipo): recuerda qué mensajes ya
 * estaban y marca los que aparecen después, los tuyos para «sale» y los otros para «llega».
 * La primera carga (o la de otro chat, con `reiniciar`) no anima nada.
 */
export function useEntradas() {
  const conocidos = useRef<Set<string> | null>(null);
  const entradas = useRef(new Map<string, EntradaMensaje>());

  const marcarNuevos = useCallback(
    (lista: ReadonlyArray<Pick<MensajeChatEquipo, 'id' | 'mio'>>) => {
      const vistos = conocidos.current;
      if (!vistos) {
        conocidos.current = new Set(lista.map((m) => m.id));
        return;
      }
      for (const m of lista) {
        if (vistos.has(m.id)) continue;
        vistos.add(m.id);
        entradas.current.set(m.id, m.mio ? 'sale' : 'llega');
      }
    },
    [],
  );

  const marcar = useCallback((m: Pick<MensajeChatEquipo, 'id'>, entrada: EntradaMensaje) => {
    entradas.current.set(m.id, entrada);
    conocidos.current?.add(m.id);
  }, []);

  const reiniciar = useCallback(() => {
    conocidos.current = null;
    entradas.current.clear();
  }, []);

  const entradaDe = useCallback((id: string) => entradas.current.get(id) ?? null, []);

  return { entradaDe, marcarNuevos, marcar, reiniciar };
}
