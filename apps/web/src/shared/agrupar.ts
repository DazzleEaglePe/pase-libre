'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Junta en una sola llamada lo que llega seguido: un mensaje nuevo dispara `mensajeNuevo` y
 * `contadores` a la vez, y sin esto cada uno pediría la bandeja entera. `espera` también sirve
 * para que cientos de pestañas no pidan lo mismo en el mismo instante (ver useEnVivo).
 */
export function useAgrupado(funcion: () => void, espera = 300): () => void {
  const ultima = useRef(funcion);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  ultima.current = funcion;

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current);
    },
    [],
  );

  return useCallback(() => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = setTimeout(() => {
      reloj.current = null;
      ultima.current();
    }, espera);
  }, [espera]);
}
