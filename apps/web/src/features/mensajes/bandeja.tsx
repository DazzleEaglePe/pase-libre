'use client';

import {
  EVENTOS,
  type ConversacionEnLista,
  type FiltroConversacion,
  type RespuestaConversaciones,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { horaCorta } from '@/shared/fechas';
import { useConexionTiempoReal, useEvento } from '@/shared/tiempo-real';

const FILTROS: Array<[FiltroConversacion, string]> = [
  ['todas', 'Todas'],
  ['no_leidas', 'No leídos'],
  ['archivadas', 'Archivados'],
];

/** «Tienda B» → «B», como los avatares del lienzo; «Jorge R.» → «J». */
export function inicial(nombre: string): string {
  const sinTienda = nombre.replace(/^tienda\s+/i, '');
  return (sinTienda[0] ?? nombre[0] ?? '?').toUpperCase();
}

function extracto(c: ConversacionEnLista): string {
  const m = c.ultimo_mensaje;
  if (!m) return '';
  const texto = m.tipo === 'FOTO' ? (m.texto ? `Foto · ${m.texto}` : 'Foto') : (m.texto ?? '');
  return m.mio ? `Tú: ${texto}` : texto;
}

function Renglon({ c, activa }: { c: ConversacionEnLista; activa: boolean }) {
  const sinLeer = c.no_leidos > 0 || c.no_leida;
  return (
    <li>
      <Link
        href={`/mensajes/${c.id}`}
        aria-current={activa ? 'page' : undefined}
        className={`flex gap-3 rounded-2xl p-3 no-underline ${activa ? 'bg-lima-suave' : 'hover:bg-superficie'}`}
      >
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white"
        >
          {inicial(c.otro.tienda.nombre)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex justify-between gap-2 text-apoyo">
            <b className="truncate font-semibold">{c.otro.tienda.nombre}</b>
            <span className="shrink-0 text-[12px] text-detalle">{horaCorta(c.actualizada_en)}</span>
          </span>
          <span className="truncate text-[12px] leading-4 text-detalle">
            {c.oferta.producto.titulo}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-nota ${sinLeer ? 'font-semibold text-tinta' : 'text-secundario'}`}
            >
              {extracto(c)}
            </span>
            {c.silenciada ? (
              <span className="shrink-0 text-[11px] font-semibold text-detalle">Silenciado</span>
            ) : (
              sinLeer && (
                <span className="min-w-5 shrink-0 rounded-full bg-lima px-1.5 text-center text-[11px] font-semibold leading-5">
                  {c.no_leidos > 0 ? c.no_leidos : ''}
                  <span className="sr-only"> sin leer</span>
                </span>
              )
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Mensajes (C_Mensajes, RF-55): la lista con buscador y filtros a la izquierda y la
 * conversación abierta a la derecha. En el celular se ve una cosa a la vez, como
 * C_MovilMensajes y F_MovilChat.
 */
export function Bandeja({ children }: { children: ReactNode }) {
  const parametros = useParams<{ id?: string }>();
  const busqueda = useSearchParams();
  const abierta = parametros.id ?? null;
  // En el celular, al llegar desde una ficha se muestra el chat que se está abriendo.
  const conChat = Boolean(abierta || busqueda.get('oferta'));
  const conexion = useConexionTiempoReal();
  const [filtro, setFiltro] = useState<FiltroConversacion>('todas');
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<RespuestaConversaciones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ultima = useRef(0);

  useEffect(() => {
    const espera = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [busca]);

  const cargar = useCallback(async () => {
    const numero = ++ultima.current;
    try {
      const respuesta = await llamarApi<RespuestaConversaciones>(
        `/conversaciones?filtro=${filtro}&q=${encodeURIComponent(q)}`,
      );
      if (numero === ultima.current) {
        setDatos(respuesta);
        setError(null);
      }
    } catch (e) {
      if (numero === ultima.current) {
        setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tus mensajes.');
      }
    }
  }, [filtro, q]);

  useEffect(() => {
    void cargar();
  }, [cargar, conexion]);
  useEvento(EVENTOS.mensajeNuevo, () => void cargar());
  useEvento(EVENTOS.contadores, () => void cargar());

  return (
    <div className="flex gap-5 lg:h-[calc(100dvh-170px)] lg:min-h-[560px]">
      <section
        aria-label="Conversaciones"
        className={`min-w-0 flex-col gap-2.5 overflow-hidden rounded-3xl border-[1.5px] border-linea p-3.5 lg:flex lg:w-[380px] lg:shrink-0 ${
          conChat ? 'hidden' : 'flex w-full'
        }`}
      >
        <h1 className="mx-1.5 my-1 text-titulo">Mensajes</h1>
        <label className="flex h-11 items-center gap-2 rounded-full bg-superficie px-3.5 text-secundario focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Buscar por tienda o producto</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por tienda o producto"
            className="h-10 min-w-0 flex-1 bg-transparent text-apoyo text-tinta placeholder:text-detalle focus-visible:outline-none"
          />
        </label>
        <div role="tablist" aria-label="Filtrar conversaciones" className="flex flex-wrap gap-1.5">
          {FILTROS.map(([valor, texto]) => {
            const elegido = valor === filtro;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={elegido}
                onClick={() => setFiltro(valor)}
                className={`h-9 rounded-full border-[1.5px] px-3 text-nota font-semibold ${
                  elegido ? 'border-tinta bg-tinta text-white' : 'border-borde bg-white'
                }`}
              >
                {texto} · {datos?.conteos[valor] ?? 0}
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mx-2 text-apoyo text-error">
            {error}
          </p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {datos === null && !error ? (
            <p className="mx-2 my-6 text-center text-apoyo text-secundario">Cargando…</p>
          ) : datos && datos.conversaciones.length === 0 ? (
            <p className="mx-2 my-6 text-center text-apoyo text-secundario">
              {q
                ? `Ninguna conversación coincide con «${q}».`
                : filtro === 'todas'
                  ? 'Todavía no tienes conversaciones. Escríbele a una tienda desde la ficha de un producto.'
                  : 'No hay conversaciones aquí.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {datos?.conversaciones.map((c) => (
                <Renglon key={c.id} c={c} activa={c.id === abierta} />
              ))}
            </ul>
          )}
        </div>
      </section>
      <div className={`min-w-0 flex-1 lg:flex ${conChat ? 'flex' : 'hidden'}`}>{children}</div>
    </div>
  );
}
