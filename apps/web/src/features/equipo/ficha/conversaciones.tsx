'use client';

import type {
  ActividadDeTienda,
  LecturaDeChat,
  RespuestaChatsDeTienda,
} from '@paselibre/contracts';
import { IconEye } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue, horaCorta } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';

import { ruta, tarjetaFicha } from './comun';

/**
 * Pestaña Conversaciones (N14, mejoras 42 y 49): los últimos 10 chats; al tocar uno se abre
 * directo en solo lectura, con los editados y los borrados. No pregunta el motivo: queda anotado
 * quién lo abrió y cuándo, en «Historial de cambios».
 */
export function PestanaConversaciones({
  tiendaId,
  chatInicial,
}: {
  tiendaId: string;
  chatInicial: string | null;
}) {
  const [lista, setLista] = useState<RespuestaChatsDeTienda | null>(null);
  const [abierto, setAbierto] = useState<string | null>(chatInicial);
  const [chat, setChat] = useState<LecturaDeChat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    llamarApi<RespuestaChatsDeTienda>(ruta(tiendaId, '/conversaciones')).then(setLista, () =>
      setError('No pudimos cargar los chats.'),
    );
  }, [tiendaId]);

  useEffect(() => {
    if (!abierto) return;
    setChat(null);
    llamarApi<LecturaDeChat>(ruta(tiendaId, `/conversaciones/${abierto}`)).then(setChat, (e) =>
      setError(e instanceof ErrorApi ? e.message : 'No pudimos abrir el chat.'),
    );
  }, [tiendaId, abierto]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <section aria-label="Últimos 10 chats" className={tarjetaFicha}>
        <h2 className="text-[18px] font-bold">Últimos 10 chats</h2>
        {!lista && !error && <p className="m-0 text-secundario">Cargando…</p>}
        {lista && lista.chats.length === 0 && !lista.equipo && (
          <p className="m-0 text-apoyo text-secundario">Esta tienda todavía no tiene chats.</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {lista?.chats.map((fila) => (
            <li key={fila.id}>
              <button
                type="button"
                aria-current={abierto === fila.id ? 'true' : undefined}
                onClick={() => setAbierto(fila.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                  abierto === fila.id ? 'bg-pase-suave' : 'hover:bg-superficie'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie text-nota font-bold"
                >
                  {iniciales(fila.con)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-apoyo font-bold">{fila.con}</b>
                  <span className="truncate text-nota text-secundario">
                    {fila.producto}
                    {fila.ultimo ? ` · «${fila.ultimo}»` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-nota text-secundario">{horaCorta(fila.fecha)}</span>
              </button>
            </li>
          ))}
          {lista?.equipo && (
            <li>
              <Link
                href={`/equipo/chats?tienda=${tiendaId}`}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-tinta no-underline hover:bg-superficie"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie text-nota font-bold"
                >
                  EQ
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-apoyo font-bold">Equipo PaseLibre</b>
                  <span className="truncate text-nota text-secundario">
                    {lista.equipo.ultimo ? `«${lista.equipo.ultimo}»` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-nota text-secundario">
                  {horaCorta(lista.equipo.fecha)}
                </span>
              </Link>
            </li>
          )}
        </ul>
        {lista && lista.total > 0 && (
          <span className="text-nota text-secundario">
            Mostrando {lista.chats.length} de {lista.total}.
          </span>
        )}
      </section>

      <section aria-label="Chat en solo lectura" className={tarjetaFicha}>
        {error && (
          <p
            role="alert"
            className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
          >
            {error}
          </p>
        )}
        {!abierto ? (
          <p className="m-0 text-apoyo text-secundario">
            Toca un chat para leerlo. Se abre en solo lectura y queda anotado quién lo abrió y
            cuándo.
          </p>
        ) : !chat ? (
          <p className="m-0 text-secundario">Abriendo…</p>
        ) : (
          <>
            <h2 className="flex flex-wrap items-baseline gap-2 text-[18px] font-bold">
              {chat.con}
              <span className="text-nota font-normal text-secundario">· {chat.producto}</span>
            </h2>
            <p className="m-0 flex items-center gap-2 rounded-xl bg-aviso-fondo px-3.5 py-2.5 text-apoyo font-bold text-aviso">
              <IconEye size={17} stroke={1.8} aria-hidden="true" />
              Solo lectura · incluye editados y borrados
            </p>
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
              {chat.mensajes.map((mensaje) =>
                mensaje.autor === null ? (
                  <span
                    key={mensaje.id}
                    className="self-center rounded-full bg-superficie px-3 py-1 text-nota text-secundario"
                  >
                    {mensaje.texto}
                  </span>
                ) : (
                  <div
                    key={mensaje.id}
                    className={`flex max-w-[80%] flex-col gap-0.5 rounded-2xl px-3.5 py-2.5 text-apoyo ${
                      mensaje.borrado_por
                        ? 'bg-error-fondo'
                        : mensaje.de_la_tienda
                          ? 'self-end border-[1.5px] border-linea bg-white'
                          : 'self-start bg-superficie'
                    } ${mensaje.de_la_tienda ? 'self-end' : 'self-start'}`}
                  >
                    <span className="text-[11px] font-bold text-secundario">{mensaje.autor}</span>
                    <span className="whitespace-pre-wrap break-words">
                      {mensaje.texto ?? (mensaje.foto ? 'Foto' : '')}
                      {mensaje.antes !== null && (
                        <i className="text-nota text-secundario">
                          {' '}
                          (antes decía: «{mensaje.antes}»)
                        </i>
                      )}
                      {mensaje.borrado_por && (
                        <i className="text-nota text-secundario">
                          {' '}
                          (borrado por {mensaje.borrado_por})
                        </i>
                      )}
                    </span>
                    <span className="text-right text-[11px] text-secundario">
                      {cuandoFue(mensaje.creado_en)}
                    </span>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * Pestaña Actividad (mejora 49): búsquedas y vistas de los últimos 30 días por categoría, sin
 * leer chats. Es la misma base que usará el algoritmo.
 */
export function PestanaActividad({ tiendaId }: { tiendaId: string }) {
  const [actividad, setActividad] = useState<ActividadDeTienda | null>(null);
  useEffect(() => {
    llamarApi<ActividadDeTienda>(ruta(tiendaId, '/actividad')).then(setActividad, () =>
      setActividad({ dias: 30, categorias: [] }),
    );
  }, [tiendaId]);
  const mayor = Math.max(1, ...(actividad?.categorias.map((c) => c.total) ?? [1]));
  return (
    <section aria-label="Actividad" className={`${tarjetaFicha} max-w-[640px]`}>
      <h2 className="text-[18px] font-bold">Actividad (resumen, sin leer chats)</h2>
      {!actividad && <p className="m-0 text-secundario">Cargando…</p>}
      {actividad && actividad.categorias.length === 0 && (
        <p className="m-0 text-apoyo text-secundario">
          En los últimos {actividad.dias} días no buscó ni vio publicaciones.
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {actividad?.categorias.map((fila) => (
          <li
            key={fila.categoria}
            className="grid grid-cols-[minmax(0,160px)_1fr_40px] items-center gap-3"
          >
            <span className="truncate text-apoyo">{fila.categoria}</span>
            <span
              className="h-2.5 overflow-hidden rounded-full bg-superficie"
              title={`${fila.busquedas} búsquedas · ${fila.vistas} vistas`}
            >
              <span
                className="block h-full rounded-full bg-acento"
                style={{ width: `${Math.round((fila.total / mayor) * 100)}%` }}
              />
            </span>
            <b className="text-right text-apoyo font-bold">{fila.total}</b>
          </li>
        ))}
      </ul>
      <p className="m-0 text-nota text-secundario">
        Búsquedas y vistas de los últimos {actividad?.dias ?? 30} días. Es la misma base que usará
        el algoritmo.
      </p>
    </section>
  );
}
