'use client';

import { EVENTOS, type Contadores, type RespuestaAvisos } from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { useConexionTiempoReal, useEvento } from '@/shared/tiempo-real';

/**
 * Los contadores de Mensajes y la campanita. Se piden al entrar, al reconectar el socket y
 * cada vez que llega algo que los mueve.
 */
export function useContadores(): Contadores {
  const conexion = useConexionTiempoReal();
  const [contadores, setContadores] = useState<Contadores>({ mensajes: 0, avisos: 0 });
  const pedir = useCallback(() => {
    llamarApi<Contadores>('/contadores').then(setContadores, () => undefined);
  }, []);

  useEffect(pedir, [pedir, conexion]);
  useEvento(EVENTOS.mensajeNuevo, pedir);
  useEvento(EVENTOS.avisoNuevo, pedir);
  useEvento(EVENTOS.contadores, pedir);
  return contadores;
}

/** Insignia lima del lienzo; «9+» para no romper el círculo. */
export function Insignia({ cantidad }: { cantidad: number }) {
  if (cantidad <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute right-[3px] top-[3px] min-w-[17px] rounded-full bg-lima px-1 text-center text-[10px] font-semibold leading-[17px] text-tinta"
    >
      {cantidad > 9 ? '9+' : cantidad}
    </span>
  );
}

/**
 * La campanita (RF-40, C_Header con `salida="primera"`): el contador y, al abrirla, los
 * avisos con su extracto. Abrir un aviso lleva a la conversación, que lo marca leído.
 */
export function Campanita({ sinLeer }: { sinLeer: number }) {
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState<RespuestaAvisos | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    llamarApi<RespuestaAvisos>('/avisos').then(setDatos, () => undefined);
  }, []);

  useEffect(() => {
    if (abierta) cargar();
  }, [abierta, cargar, sinLeer]);

  useEffect(() => {
    if (!abierta) return;
    const cerrarAfuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierta(false);
    };
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierta(false);
    };
    document.addEventListener('mousedown', cerrarAfuera);
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarAfuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierta]);

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
        aria-expanded={abierta}
        onClick={() => setAbierta(!abierta)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${abierta ? 'bg-superficie' : ''}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <Insignia cantidad={sinLeer} />
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 top-12 z-40 flex w-[380px] max-w-[calc(100vw-32px)] flex-col rounded-[20px] border border-linea bg-white py-2 text-apoyo shadow-[0_18px_40px_rgba(20,22,26,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1">
            <b className="text-tarjeta">Avisos</b>
            {(datos?.sin_leer ?? 0) > 0 && (
              <button
                type="button"
                onClick={() =>
                  llamarApi<RespuestaAvisos>('/avisos/leidos', { metodo: 'POST', cuerpo: {} }).then(
                    setDatos,
                  )
                }
                className="h-9 text-nota font-medium underline"
              >
                Marcar como leídos
              </button>
            )}
          </div>
          {datos === null ? (
            <p className="border-t border-linea px-4 py-4 text-secundario">Cargando…</p>
          ) : datos.avisos.length === 0 ? (
            <p className="border-t border-linea px-4 py-4 text-secundario">
              No tienes avisos. Cuando te escriban, aparecerán aquí.
            </p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto">
              {datos.avisos.map((aviso) => (
                <li key={aviso.id}>
                  <Link
                    href={aviso.enlace ?? '/mensajes'}
                    onClick={() => setAbierta(false)}
                    className="grid grid-cols-[8px_minmax(0,1fr)] items-start gap-x-3 border-t border-linea px-4 py-3 no-underline hover:bg-superficie"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 rounded-full ${aviso.leido ? '' : 'bg-tinta'}`}
                    />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className={aviso.leido ? '' : 'font-semibold'}>
                        {aviso.titulo}
                        {!aviso.leido && <span className="sr-only"> (sin leer)</span>}
                      </span>
                      {aviso.extracto && (
                        <span className="truncate text-secundario">{aviso.extracto}</span>
                      )}
                      <span className="text-nota text-detalle">
                        {haceRato(aviso.actualizado_en)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-linea px-4 pb-1 pt-3">
            <Link href="/mensajes" onClick={() => setAbierta(false)} className="font-semibold">
              Ver todos los mensajes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
