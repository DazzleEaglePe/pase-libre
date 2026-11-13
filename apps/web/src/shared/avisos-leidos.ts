'use client';

import type { AvisoCampanita, RespuestaAvisos } from '@paselibre/contracts';
import { useEffect } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** Evento de la pestaña: un aviso se acaba de leer (N07, error 36). */
const EVENTO = 'paselibre:aviso-leido';

/**
 * Tocar un aviso lo marca leído: el contador baja al toque en la campanita, el menú de la
 * cuenta y la página Avisos (sin esperar a la API), y después la API lo guarda y avisa a las
 * demás pestañas por el tiempo real.
 */
export function marcarAvisoLeido(aviso: AvisoCampanita): void {
  if (aviso.leido) return;
  window.dispatchEvent(new CustomEvent<AvisoCampanita>(EVENTO, { detail: aviso }));
  void llamarApi('/avisos/leidos', { metodo: 'POST', cuerpo: { ids: [aviso.id] } }).catch(
    () => undefined,
  );
}

/** Escucha los avisos que se leen en esta pestaña. */
export function useAvisoLeido(alLeer: (aviso: AvisoCampanita) => void): void {
  useEffect(() => {
    const escuchar = (evento: Event) => alLeer((evento as CustomEvent<AvisoCampanita>).detail);
    window.addEventListener(EVENTO, escuchar);
    return () => window.removeEventListener(EVENTO, escuchar);
  }, [alLeer]);
}

/** Evento de la pestaña: se abrió la campanita o la página Avisos (doc 19, punto 15). */
const EVENTO_VISTOS = 'paselibre:avisos-vistos';

/**
 * Abrir la campanita (o, en el celular, la página Avisos) borra su número naranja al toque y
 * la API guarda desde cuándo contar (`POST /v1/avisos/vistos`), que avisa a las demás
 * pestañas. El puntito de cada aviso no cambia: sigue hasta tocarlo.
 */
export function marcarAvisosVistos(): void {
  window.dispatchEvent(new Event(EVENTO_VISTOS));
  void llamarApi('/avisos/vistos', { metodo: 'POST', cuerpo: {} }).catch(() => undefined);
}

/** Escucha cuando se abre la campanita en esta pestaña. */
export function useAvisosVistos(alVer: () => void): void {
  useEffect(() => {
    window.addEventListener(EVENTO_VISTOS, alVer);
    return () => window.removeEventListener(EVENTO_VISTOS, alVer);
  }, [alVer]);
}

/** La lista de avisos con uno ya leído: sin su punto y un sin leer menos en su filtro. */
export function conAvisoLeido(
  datos: RespuestaAvisos | null,
  leido: AvisoCampanita,
): RespuestaAvisos | null {
  if (!datos) return datos;
  const estaba = datos.avisos.find((aviso) => aviso.id === leido.id);
  if (estaba?.leido) return datos;
  const categoria = datos.sin_leer_por_categoria[leido.categoria] ?? 0;
  return {
    avisos: datos.avisos.map((aviso) =>
      aviso.id === leido.id ? { ...aviso, leido: true } : aviso,
    ),
    sin_leer: Math.max(0, datos.sin_leer - 1),
    sin_leer_por_categoria: {
      ...datos.sin_leer_por_categoria,
      [leido.categoria]: Math.max(0, categoria - 1),
    },
  };
}
