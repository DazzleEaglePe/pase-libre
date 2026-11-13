'use client';

import type { AvisoCampanita, RespuestaAvisos } from '@paselibre/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/** Evento de la pestaña: un aviso se acaba de leer (N07, error 36). */
const EVENTO = 'paselibre:aviso-leido';

/** Evento de la pestaña: la API no guardó lo marcado; hay que volver a pedir la verdad. */
const EVENTO_RECARGAR = 'paselibre:contadores-recargar';

/** Cuánto se ve «No pudimos marcar el aviso» (doc 20, A1). */
export const FALLO_VISIBLE_MS = 4_000;

/**
 * Nunca fallar en silencio (doc 20, A1). La pantalla vuelve a lo que dice la base: nunca un 0
 * falso que reaparece con F5. `mostrar` dice si hay que avisar «No pudimos marcar el aviso»;
 * en modo soporte no (la web ya no marca ahí, y si se colara uno, el 403 es lo esperado).
 */
export function siFalla(error: unknown): void {
  const mostrar = !(error instanceof ErrorApi && error.codigo === 'MODO_SOPORTE');
  window.dispatchEvent(
    new CustomEvent<{ mostrar: boolean }>(EVENTO_RECARGAR, { detail: { mostrar } }),
  );
}

/**
 * Tocar un aviso lo marca leído: el contador baja al toque en la campanita, el menú de la
 * cuenta y la página Avisos (sin esperar a la API), y después la API lo guarda y avisa a las
 * demás pestañas por el tiempo real. Con `keepalive`, el pedido sigue aunque el mismo clic
 * abra otra página. Si la API dice que no, `siFalla` vuelve a pedir los contadores.
 */
export function marcarAvisoLeido(aviso: AvisoCampanita): void {
  if (aviso.leido) return;
  window.dispatchEvent(new CustomEvent<AvisoCampanita>(EVENTO, { detail: aviso }));
  llamarApi('/avisos/leidos', {
    metodo: 'POST',
    cuerpo: { ids: [aviso.id] },
    keepalive: true,
  }).catch(siFalla);
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
  llamarApi('/avisos/vistos', { metodo: 'POST', cuerpo: {}, keepalive: true }).catch(siFalla);
}

/**
 * Cuando la API no guardó lo marcado: `recargar` vuelve a pedir lo suyo (los contadores, la
 * lista con sus puntitos). Recibe si hay que mostrar «No pudimos marcar el aviso».
 */
export function useRecargarContadores(recargar: (mostrar: boolean) => void): void {
  useEffect(() => {
    const escuchar = (evento: Event) =>
      recargar((evento as CustomEvent<{ mostrar?: boolean }>).detail?.mostrar ?? true);
    window.addEventListener(EVENTO_RECARGAR, escuchar);
    return () => window.removeEventListener(EVENTO_RECARGAR, escuchar);
  }, [recargar]);
}

/**
 * Para la campanita y la página Avisos: si la API no guardó lo marcado, vuelve a cargar la lista
 * y devuelve `true` por 4 segundos, para mostrar abajo «No pudimos marcar el aviso. Vuelve a
 * intentarlo.» (doc 20, A1).
 */
export function useFalloAlMarcar(cargar: () => void): boolean {
  const [fallo, setFallo] = useState(false);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reloj.current), []);
  useRecargarContadores(
    useCallback(
      (mostrar: boolean) => {
        cargar();
        if (!mostrar) return;
        setFallo(true);
        clearTimeout(reloj.current);
        reloj.current = setTimeout(() => setFallo(false), FALLO_VISIBLE_MS);
      },
      [cargar],
    ),
  );
  return fallo;
}

/** El texto de cuando la API no guardó lo marcado. */
export const TEXTO_FALLO_AL_MARCAR = 'No pudimos marcar el aviso. Vuelve a intentarlo.';

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
