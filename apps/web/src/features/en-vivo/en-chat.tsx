'use client';

import {
  EVENTOS,
  formatearPrecio,
  type EnVivoEnChat,
  type EventoEnVivoCambio,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { useEvento } from '@/shared/tiempo-real';

import { useAhora } from './datos';
import { EtiquetaTipo } from './piezas';
import { cuantoQueda, textoCierre } from './textos';

/**
 * La tarjeta del pase del día fija arriba del chat (EV_Responder): el busco o el remate del
 * que nació el hilo. Quien lo publicó lo cierra desde aquí («Ya lo conseguí» o «Cerrar
 * remate»); «Vendido» sigue en la barra del producto y le resta unidades al remate.
 */
export function EnVivoEnElChat({
  enVivo,
  alCambiar,
}: {
  enVivo: EnVivoEnChat;
  alCambiar: () => void;
}) {
  const ahora = useAhora();
  const [error, setError] = useState<string | null>(null);
  useEvento<EventoEnVivoCambio>(EVENTOS.enVivoCambio, (evento) => {
    if (evento.id === enVivo.id) alCambiar();
  });

  async function cerrar() {
    setError(null);
    try {
      await llamarApi(`/en-vivo/${enVivo.id}`, { metodo: 'PATCH', cuerpo: { accion: 'cerrar' } });
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cerrarlo.');
    }
  }

  const vivo = enVivo.estado === 'VIVO';
  const dato = enVivo.precio
    ? enVivo.tipo === 'BUSCO'
      ? `Paga hasta ${formatearPrecio(enVivo.precio)}`
      : `${formatearPrecio(enVivo.precio)} · quedan ${enVivo.cantidad}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-linea bg-white px-3 py-2.5 sm:px-4">
      <EtiquetaTipo tipo={enVivo.tipo} />
      <span className="flex min-w-0 flex-[1_1_220px] flex-col">
        <Link
          href={`/pases-del-dia?id=${enVivo.id}`}
          className="truncate text-apoyo font-semibold no-underline hover:underline"
        >
          {enVivo.titulo}
        </Link>
        <span className="text-nota text-secundario">
          {[dato, vivo ? cuantoQueda(enVivo.vence_en, ahora) : textoCierre(enVivo)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      {enVivo.puede_cerrar && (
        <button
          type="button"
          onClick={() => void cerrar()}
          className="h-9 rounded-full border border-borde bg-white px-3.5 text-nota font-medium"
        >
          {enVivo.tipo === 'BUSCO' ? 'Ya lo conseguí' : 'Cerrar remate'}
        </button>
      )}
      {error && (
        <p role="alert" className="basis-full text-nota text-error">
          {error}
        </p>
      )}
    </div>
  );
}
