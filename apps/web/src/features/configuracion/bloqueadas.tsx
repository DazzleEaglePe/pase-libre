'use client';

import type { TiendaBloqueada } from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/**
 * Tu cuenta · Tiendas bloqueadas (REP_WebBloqueadas): no te escriben, no responden tus pedidos
 * en vivo y no ves lo suyo. No se les avisa. Desde aquí se deshace.
 */
export function SeccionBloqueadas({ alAvisar }: { alAvisar: (mensaje: string) => void }) {
  const [bloqueadas, setBloqueadas] = useState<TiendaBloqueada[] | null>(null);

  const cargar = useCallback(() => {
    llamarApi<TiendaBloqueada[]>('/cuenta/bloqueados').then(setBloqueadas, () => setBloqueadas([]));
  }, []);
  useEffect(cargar, [cargar]);

  async function desbloquear(bloqueo: TiendaBloqueada) {
    await llamarApi(`/cuenta/bloqueados/${bloqueo.tienda.id}`, { metodo: 'DELETE' });
    alAvisar(`Desbloqueaste a ${bloqueo.tienda.nombre}.`);
    cargar();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoyo text-secundario">
        No pueden escribirte ni responder tus pedidos en vivo, y no ves sus publicaciones. No se les
        avisa.
      </p>
      {bloqueadas === null ? (
        <p className="text-secundario">Cargando…</p>
      ) : bloqueadas.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-superficie p-5">
          <b className="text-tarjeta">No bloqueaste a ninguna tienda</b>
          <span className="text-apoyo text-secundario">
            Si una tienda te molesta, bloquéala desde su chat, su publicación o su perfil.
          </span>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {bloqueadas.map((bloqueo) => (
            <li
              key={bloqueo.tienda.id}
              className="flex items-center justify-between gap-3 border-b border-linea py-3 last:border-0"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-superficie text-apoyo font-bold text-secundario"
                >
                  {(bloqueo.tienda.nombre.replace(/^tienda\s+/i, '')[0] ?? '·').toUpperCase()}
                </span>
                <span className="flex flex-col">
                  <b className="font-bold">{bloqueo.tienda.nombre}</b>
                  <span className="text-nota text-secundario">
                    {bloqueo.tienda.galeria ?? 'Independiente'}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => void desbloquear(bloqueo)}
                className="h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-bold"
              >
                Desbloquear
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
