'use client';

import type {
  HiloEquipoEnLista,
  MensajeChatEquipo,
  RespuestaChatEquipo,
} from '@paselibre/contracts';
import { IconSend } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue, horaCorta } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';

/**
 * Los chats oficiales con las tiendas, del lado del equipo: la lista (las que esperan respuesta
 * arriba) y el chat. Con `?tienda=` se le escribe aunque todavía no haya hilo: el equipo puede
 * escribir primero.
 */
export function ChatsEquipo() {
  const busqueda = useSearchParams();
  const [hilos, setHilos] = useState<HiloEquipoEnLista[] | null>(null);
  const [tienda, setTienda] = useState<string | null>(busqueda.get('tienda'));
  const [chat, setChat] = useState<RespuestaChatEquipo | null>(null);
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  const cargarHilos = useCallback(async () => {
    setHilos(await llamarApi<HiloEquipoEnLista[]>('/equipo/chats'));
  }, []);
  useEffect(() => {
    void cargarHilos().catch(() => setError('No pudimos cargar los chats.'));
  }, [cargarHilos]);
  useEffect(() => {
    if (!tienda) return;
    setChat(null);
    llamarApi<RespuestaChatEquipo>(`/equipo/chats/${tienda}`).then(
      (respuesta) => {
        setChat(respuesta);
        void cargarHilos();
      },
      () => setError('No pudimos abrir el chat.'),
    );
  }, [tienda, cargarHilos]);
  useLayoutEffect(() => {
    if (caja.current) caja.current.scrollTop = caja.current.scrollHeight;
  }, [chat]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!tienda || !borrador.trim()) return;
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChatEquipo>(`/equipo/chats/${tienda}/mensajes`, {
        metodo: 'POST',
        cuerpo: { texto: borrador.trim() },
      });
      setChat((antes) => ({ mensajes: [...(antes?.mensajes ?? []), mensaje], sin_leer: 0 }));
      setBorrador('');
      void cargarHilos();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No se pudo enviar.');
    }
  }

  const actual = hilos?.find((hilo) => hilo.tienda.id === tienda);
  return (
    <div className="grid items-stretch gap-5 lg:h-[calc(100dvh-160px)] lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-linea bg-white">
        <h1 className="m-0 border-b border-linea px-4 py-4 text-[19px] font-bold">
          Chats con las tiendas
        </h1>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
          {hilos?.length === 0 && (
            <li className="px-4 py-6 text-apoyo text-secundario">
              Todavía ninguna tienda le escribió al equipo. Para escribirle tú, elige una en
              Tiendas.
            </li>
          )}
          {hilos?.map((hilo) => (
            <li key={hilo.tienda.id}>
              <button
                type="button"
                onClick={() => setTienda(hilo.tienda.id)}
                className={`flex w-full items-center gap-3 border-b border-linea px-4 py-3 text-left ${
                  tienda === hilo.tienda.id ? 'bg-pase-suave' : 'hover:bg-superficie'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tinta text-nota font-bold text-white"
                >
                  {iniciales(hilo.tienda.nombre)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex justify-between gap-2">
                    <b className="truncate text-apoyo font-bold">{hilo.tienda.nombre}</b>
                    <span className="shrink-0 text-nota text-secundario">
                      {horaCorta(hilo.actualizado_en)}
                    </span>
                  </span>
                  <span
                    className={`truncate text-nota ${hilo.sin_leer ? 'font-bold text-tinta' : 'text-secundario'}`}
                  >
                    {hilo.ultimo
                      ? `${hilo.ultimo.de_equipo ? `${hilo.ultimo.autor}: ` : ''}${hilo.ultimo.texto}`
                      : ''}
                  </span>
                </span>
                {hilo.sin_leer > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
                    {hilo.sin_leer}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-[24px] border border-linea bg-white">
        {!tienda ? (
          <p className="m-auto text-secundario">Elige un chat.</p>
        ) : (
          <>
            <div className="border-b border-linea px-5 py-3.5">
              <b className="text-cuerpo font-bold">{actual?.tienda.nombre ?? 'Nuevo chat'}</b>
              {actual && (
                <span className="block text-nota text-secundario">
                  {[actual.tienda.galeria, actual.tienda.stand && `Stand ${actual.tienda.stand}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </div>
            <div
              ref={caja}
              className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4"
            >
              {chat?.mensajes.length === 0 && (
                <p className="m-auto max-w-[360px] text-center text-apoyo text-secundario">
                  Escríbele primero: le llega a la campanita de su tienda y queda en su chat
                  oficial.
                </p>
              )}
              {chat?.mensajes.map((mensaje) => (
                <div
                  key={mensaje.id}
                  className={`flex max-w-[78%] flex-col gap-0.5 rounded-2xl px-4 py-2.5 text-cuerpo ${
                    mensaje.de_equipo ? 'self-end bg-tinta text-white' : 'self-start bg-superficie'
                  }`}
                >
                  {mensaje.caso && (
                    <span className="text-nota font-bold opacity-80">
                      Caso {mensaje.caso.codigo} · {mensaje.caso.motivo}
                    </span>
                  )}
                  <span className="whitespace-pre-wrap break-words">{mensaje.texto}</span>
                  <span className="text-right text-[11px] opacity-70">
                    {mensaje.de_equipo ? `${mensaje.autor} · ` : ''}
                    {cuandoFue(mensaje.creado_en)}
                  </span>
                </div>
              ))}
            </div>
            {error && (
              <p role="alert" className="m-0 bg-error-fondo px-4 py-2.5 text-apoyo text-error">
                {error}
              </p>
            )}
            <form
              onSubmit={(evento) => void enviar(evento)}
              className="flex items-center gap-2 border-t border-linea p-3"
            >
              <input
                value={borrador}
                onChange={(evento) => setBorrador(evento.target.value)}
                maxLength={2000}
                placeholder="Escribe como equipo PaseLibre"
                aria-label="Mensaje"
                className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-borde px-4 text-cuerpo"
              />
              <button
                type="submit"
                aria-label="Enviar"
                disabled={!borrador.trim()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-tinta text-white disabled:bg-superficie disabled:text-borde-control"
              >
                <IconSend size={20} stroke={1.8} aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
