'use client';

import {
  EVENTOS,
  type CategoriaAviso,
  type Contadores,
  type RespuestaAvisos,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FiltrosAvisos, ListaAvisos } from '@/features/avisos/lista-avisos';
import { llamarApi } from '@/shared/api/cliente';
import { useAgrupado } from '@/shared/agrupar';
import { conAvisoLeido, useAvisoLeido } from '@/shared/avisos-leidos';
import { useConexionTiempoReal, useEvento } from '@/shared/tiempo-real';

/**
 * Los contadores de Mensajes y la campanita. Se piden al entrar, al reconectar el socket y
 * cada vez que llega algo que los mueve. Tocar un aviso baja el de la campanita al toque
 * (N07, error 36), antes de que conteste la API.
 */
export function useContadores(): Contadores {
  const conexion = useConexionTiempoReal();
  const [contadores, setContadores] = useState<Contadores>({ mensajes: 0, avisos: 0 });
  const pedir = useCallback(() => {
    llamarApi<Contadores>('/contadores').then(setContadores, () => undefined);
  }, []);

  useEffect(pedir, [pedir, conexion]);
  // Un mensaje dispara hasta tres eventos seguidos: una sola consulta.
  const agrupado = useAgrupado(pedir);
  useEvento(EVENTOS.mensajeNuevo, agrupado);
  useEvento(EVENTOS.avisoNuevo, agrupado);
  useEvento(EVENTOS.contadores, agrupado);
  useAvisoLeido(
    useCallback(
      () =>
        setContadores((actuales) => ({ ...actuales, avisos: Math.max(0, actuales.avisos - 1) })),
      [],
    ),
  );
  return contadores;
}

/** Insignia naranja del contador; «9+» para no romper el círculo. */
export function Insignia({ cantidad }: { cantidad: number }) {
  if (cantidad <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute right-[3px] top-[3px] min-w-[17px] rounded-full bg-contador px-1 text-center text-[10px] font-semibold leading-[17px] text-tinta"
    >
      {cantidad > 9 ? '9+' : cantidad}
    </span>
  );
}

/**
 * La campanita (AV_WebPanel): en la computadora abre los avisos con sus filtros, los
 * nuevos arriba con su botón y «Ver todos los avisos»; en el celular lleva a /avisos.
 */
export function Campanita({
  sinLeer,
  sobreMarca = false,
}: {
  sinLeer: number;
  /** En la fila verde de la barra (D_Barra): la campana en blanco. */
  sobreMarca?: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [filtro, setFiltro] = useState<CategoriaAviso | 'TODOS'>('TODOS');
  const [datos, setDatos] = useState<RespuestaAvisos | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    const consulta = filtro === 'TODOS' ? '' : `?categoria=${filtro}`;
    llamarApi<RespuestaAvisos>(`/avisos${consulta}`).then(setDatos, () => undefined);
  }, [filtro]);

  useEffect(() => {
    if (abierta) cargar();
  }, [abierta, cargar, sinLeer]);
  useAvisoLeido(useCallback((leido) => setDatos((actuales) => conAvisoLeido(actuales, leido)), []));

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
        onClick={() => {
          // En el celular los avisos son una pantalla (AV_Cel), no una ventanita.
          if (window.matchMedia('(max-width: 767px)').matches) router.push('/avisos');
          else setAbierta(!abierta);
        }}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full ${
          sobreMarca
            ? `text-white ${abierta ? 'bg-white/15' : 'hover:bg-white/15'}`
            : abierta
              ? 'bg-superficie'
              : ''
        }`}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        <Insignia cantidad={sinLeer} />
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-label="Avisos"
          className="absolute right-0 top-[54px] z-40 flex max-h-[min(760px,calc(100dvh-90px))] w-[440px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[20px] border border-linea bg-white text-tinta shadow-[0_18px_40px_rgba(20,22,26,0.22)]"
        >
          <div className="flex flex-col gap-3 px-4 pb-3 pt-4">
            <div className="flex items-center justify-between gap-3">
              <b className="text-seccion">Avisos</b>
              <span className="flex items-center gap-2">
                {(datos?.sin_leer ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      llamarApi<RespuestaAvisos>('/avisos/leidos', {
                        metodo: 'POST',
                        cuerpo: {},
                      }).then(() => cargar())
                    }
                    className="h-9 rounded-full border border-borde px-3 text-nota font-semibold"
                  >
                    Marcar leídos
                  </button>
                )}
                <Link
                  href="/avisos#configurar"
                  aria-label="Configurar avisos"
                  onClick={() => setAbierta(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-borde text-tinta"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
                  </svg>
                </Link>
              </span>
            </div>
            <FiltrosAvisos datos={datos} elegido={filtro} alElegir={setFiltro} todos={false} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {datos === null ? (
              <p className="border-t border-linea px-4 py-4 text-secundario">Cargando…</p>
            ) : datos.avisos.length === 0 ? (
              <p className="border-t border-linea px-4 py-6 text-secundario">
                No tienes avisos{filtro === 'TODOS' ? '' : ' de este tipo'}. Cuando pase algo, te
                avisamos aquí.
              </p>
            ) : (
              <ListaAvisos avisos={datos.avisos} alAbrir={() => setAbierta(false)} />
            )}
          </div>
          <Link
            href="/avisos"
            onClick={() => setAbierta(false)}
            className="border-t border-linea py-3.5 text-center text-apoyo font-bold text-pase-texto"
          >
            Ver todos los avisos
          </Link>
        </div>
      )}
    </div>
  );
}
