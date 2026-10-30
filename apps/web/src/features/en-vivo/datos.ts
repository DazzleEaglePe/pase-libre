'use client';

import { EVENTOS, type RespuestaEnVivo } from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { useEvento } from '@/shared/tiempo-real';

/** Sin socket (el visitante no abre uno), la lista se vuelve a pedir cada minuto. */
const CADA = 60_000;

/**
 * Lo que está en vivo, al día: con sesión, cada `en-vivo:cambio` del socket la vuelve a
 * pedir; sin ella, cada minuto. Si la API responde 404, En vivo está apagado (`EN_VIVO`) y
 * `activo` queda en falso para siempre: no se vuelve a preguntar.
 */
export function useEnVivo(consulta = '') {
  const [datos, setDatos] = useState<RespuestaEnVivo | null>(null);
  const [activo, setActivo] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaEnVivo>(`/en-vivo${consulta}`));
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 404) setActivo(false);
    }
  }, [consulta]);

  useEffect(() => {
    if (!activo) return;
    void cargar();
    const reloj = setInterval(() => {
      if (document.visibilityState === 'visible') void cargar();
    }, CADA);
    return () => clearInterval(reloj);
  }, [activo, cargar]);

  useEvento(EVENTOS.enVivoCambio, () => {
    if (activo) void cargar();
  });

  return { datos, activo, recargar: cargar };
}

/** La hora para «Quedan 35 min»: cambia cada 30 s. */
export function useAhora(cada = 30_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), cada);
    return () => clearInterval(reloj);
  }, [cada]);
  return ahora;
}
