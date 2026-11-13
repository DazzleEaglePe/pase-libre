'use client';

import type { AvisoCampanita, RespuestaResolverSolicitud } from '@paselibre/contracts';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { marcarAvisoLeido } from '@/shared/avisos-leidos';

/**
 * «Aceptar» / «Rechazar» de «{Tienda} quiere seguir tu tienda» (doc 20, punto 5). Aceptar crea el
 * seguimiento; rechazar la borra sin avisarle a la otra tienda. Después queda una línea con lo que
 * pasó (al volver a abrir la campana, el aviso ya no está).
 */
export function BotonesSolicitud({
  aviso,
  solicitudId,
}: {
  aviso: AvisoCampanita;
  solicitudId: string;
}) {
  const [trabajando, setTrabajando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function responder(accion: 'aceptar' | 'rechazar') {
    setTrabajando(true);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaResolverSolicitud>(
        `/solicitudes-seguir/${solicitudId}/${accion}`,
        { metodo: 'POST', cuerpo: {} },
      );
      marcarAvisoLeido(aviso);
      setHecho(respuesta.mensaje);
    } catch (falla) {
      setError(
        falla instanceof ErrorApi ? falla.message : 'No pudimos responder. Inténtalo otra vez.',
      );
    } finally {
      setTrabajando(false);
    }
  }

  if (hecho) {
    return (
      <span role="status" className="relative z-10 mt-1 text-apoyo font-semibold text-marca">
        {hecho}
      </span>
    );
  }
  return (
    <span className="relative z-10 mt-2 flex flex-col gap-1.5">
      <span className="flex gap-2">
        <button
          type="button"
          disabled={trabajando}
          onClick={() => void responder('aceptar')}
          className="flex h-9 items-center rounded-full bg-pase px-3.5 text-apoyo font-bold text-white disabled:opacity-60"
        >
          Aceptar
        </button>
        <button
          type="button"
          disabled={trabajando}
          onClick={() => void responder('rechazar')}
          className="flex h-9 items-center rounded-full border-[1.5px] border-borde bg-white px-3.5 text-apoyo font-bold text-tinta disabled:opacity-60"
        >
          Rechazar
        </button>
      </span>
      {error && (
        <span role="alert" className="text-nota text-error">
          {error}
        </span>
      )}
    </span>
  );
}
