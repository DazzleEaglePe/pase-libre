'use client';

import {
  EVENTOS,
  type EventoMensajeEquipo,
  type EventoVistoEquipo,
  type HiloEquipoEnLista,
  type MensajeChatEquipo,
  type RespuestaAutomatica,
  type RespuestaChatEquipo,
} from '@paselibre/contracts';
import { IconSend } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { Checks } from '@/features/mensajes/burbuja';
import { checkDeEquipo, claseDe, useEntradas } from '@/features/mensajes/entradas';
import { Puntitos } from '@/features/mensajes/puntitos';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { useAvisarEscribiendo, useEscribiendo } from '@/shared/escribiendo';
import { cuandoFue, hora, horaCorta } from '@/shared/fechas';
import { useConexionTiempoReal, useEvento, useRespaldo } from '@/shared/tiempo-real';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';

/** ✓ / ✓✓ gris / ✓✓ verde en lo que escribiste (doc 19, punto 18), sobre la burbuja oscura. */
function ChecksDelEquipo({ mensaje }: { mensaje: MensajeChatEquipo }) {
  const estado = checkDeEquipo(mensaje);
  return estado ? <Checks estado={estado} /> : null;
}

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
  // Doc 19, punto 19: lo nuevo entra con animación y se ve quién está escribiendo.
  const { entradaDe, marcarNuevos, marcar, reiniciar } = useEntradas();
  const [vuelo, setVuelo] = useState(0);
  const escribiendo = useEscribiendo();
  useAvisarEscribiendo(tienda ? { equipo: true, tienda_id: tienda } : null, borrador);
  const tiendaEscribe = escribiendo.enEquipo(tienda);

  const cargarHilos = useCallback(async () => {
    setHilos(await llamarApi<HiloEquipoEnLista[]>('/equipo/chats'));
  }, []);
  const conexion = useConexionTiempoReal();
  useEffect(() => {
    void cargarHilos().catch(() => setError('No pudimos cargar los chats.'));
  }, [cargarHilos, conexion]);
  const cargarChat = useCallback(
    (tiendaId: string) =>
      llamarApi<RespuestaChatEquipo>(`/equipo/chats/${tiendaId}`).then(
        (respuesta) => {
          marcarNuevos(respuesta.mensajes);
          setChat(respuesta);
          void cargarHilos();
        },
        () => setError('No pudimos abrir el chat.'),
      ),
    [cargarHilos, marcarNuevos],
  );
  useEffect(() => {
    if (!tienda) return;
    setChat(null);
    reiniciar();
    void cargarChat(tienda);
  }, [tienda, cargarChat, reiniciar]);
  // Lo que escriben las tiendas llega sin recargar (doc 19, A3): la lista y, si es la abierta,
  // el chat.
  useEvento<EventoMensajeEquipo>(EVENTOS.mensajeEquipo, (evento) => {
    if (evento.tienda_id === tienda) void cargarChat(tienda);
    else void cargarHilos().catch(() => undefined);
  });
  // La tienda recibió o leyó lo tuyo: ✓✓ gris o verde (doc 19, punto 18).
  useEvento<EventoVistoEquipo>(EVENTOS.vistoEquipo, (evento) => {
    if (evento.tienda_id === tienda) void cargarChat(tienda);
  });
  useRespaldo(() => {
    if (tienda) void cargarChat(tienda);
    else void cargarHilos().catch(() => undefined);
  });
  useLayoutEffect(() => {
    if (caja.current) caja.current.scrollTop = caja.current.scrollHeight;
  }, [chat, tiendaEscribe]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!tienda || !borrador.trim()) return;
    setError(null);
    try {
      setVuelo((n) => n + 1);
      const mensaje = await llamarApi<MensajeChatEquipo>(`/equipo/chats/${tienda}/mensajes`, {
        metodo: 'POST',
        cuerpo: { texto: borrador.trim() },
      });
      marcar(mensaje, 'sale');
      setChat((antes) => ({
        ...antes,
        mensajes: [...(antes?.mensajes ?? []), mensaje],
        sin_leer: 0,
      }));
      setBorrador('');
      void cargarHilos();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No se pudo enviar.');
    }
  }

  const actual = hilos?.find((hilo) => hilo.tienda.id === tienda);
  // «Visto por {tienda} a las 00:51», debajo del último (doc 19, punto 18).
  const vistoPor =
    chat?.visto_hasta && chat.mensajes.some((m) => m.mio && m.estado === 'visto')
      ? `Visto por ${actual?.tienda.nombre ?? 'la tienda'} a las ${hora(chat.visto_hasta)}`
      : null;
  return (
    <div className="grid items-stretch gap-5 lg:h-[calc(100dvh-160px)] lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-linea bg-white">
        <h1 className="m-0 border-b border-linea px-4 py-4 text-[19px] font-bold">
          Chats con las tiendas
        </h1>
        <EditarRespuestaAutomatica />
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
                <AvatarTienda
                  nombre={hilo.tienda.nombre}
                  logo={hilo.tienda.logo}
                  letra={13}
                  fondo="bg-tinta font-bold text-white"
                  oculto
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex justify-between gap-2">
                    <b className="truncate text-apoyo font-bold">{hilo.tienda.nombre}</b>
                    <span className="shrink-0 text-nota text-secundario">
                      {horaCorta(hilo.actualizado_en)}
                    </span>
                  </span>
                  {escribiendo.enEquipo(hilo.tienda.id) ? (
                    <i className="truncate text-nota font-bold text-pase-texto">escribiendo…</i>
                  ) : (
                    <span
                      className={`truncate text-nota ${hilo.sin_leer ? 'font-bold text-tinta' : 'text-secundario'}`}
                    >
                      {hilo.ultimo
                        ? `${hilo.ultimo.de_equipo ? `${hilo.ultimo.autor}: ` : ''}${hilo.ultimo.texto}`
                        : ''}
                    </span>
                  )}
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
              {tiendaEscribe ? (
                <i className="block text-nota font-bold text-pase-texto">escribiendo…</i>
              ) : (
                actual && (
                  <span className="block text-nota text-secundario">
                    {[actual.tienda.galeria, actual.tienda.stand && `Stand ${actual.tienda.stand}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )
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
                  } ${claseDe(entradaDe(mensaje.id))}`}
                >
                  {mensaje.caso && (
                    <span className="text-nota font-bold opacity-80">
                      Caso {mensaje.caso.codigo} · {mensaje.caso.motivo}
                    </span>
                  )}
                  <span className="whitespace-pre-wrap break-words">{mensaje.texto}</span>
                  <span className="flex items-center justify-end gap-1.5 text-[11px]">
                    <span className="opacity-70">
                      {mensaje.automatica
                        ? 'Respuesta automática · '
                        : mensaje.de_equipo
                          ? `${mensaje.autor} · `
                          : ''}
                      {cuandoFue(mensaje.creado_en)}
                    </span>
                    <ChecksDelEquipo mensaje={mensaje} />
                  </span>
                </div>
              ))}
              {vistoPor && <span className="self-end text-[12px] text-secundario">{vistoPor}</span>}
              {tiendaEscribe && <Puntitos quien={actual?.tienda.nombre ?? 'La tienda'} />}
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
                <IconSend
                  key={vuelo}
                  size={20}
                  stroke={1.8}
                  aria-hidden="true"
                  className={vuelo > 0 ? 'chat-avioncito' : undefined}
                />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

/**
 * «Respuesta automática» (N14, mejoras 37 y 38): sale la primera vez que una tienda escribe (o
 * tras 12 h sin conversación). «{tienda}» se cambia por su nombre.
 */
function EditarRespuestaAutomatica() {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta || texto !== null) return;
    llamarApi<RespuestaAutomatica>('/equipo/chats/respuesta-automatica').then(
      (respuesta) => setTexto(respuesta.texto),
      () => setEstado('No pudimos cargarla.'),
    );
  }, [abierta, texto]);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (texto === null) return;
    try {
      await llamarApi('/equipo/chats/respuesta-automatica', { metodo: 'PUT', cuerpo: { texto } });
      setEstado('Guardada. Sale desde el próximo mensaje.');
    } catch (falla) {
      setEstado(falla instanceof ErrorApi ? falla.message : 'No pudimos guardarla.');
    }
  }

  return (
    <div className="border-b border-linea px-4 py-3">
      <button
        type="button"
        aria-expanded={abierta}
        onClick={() => setAbierta(!abierta)}
        className="flex w-full items-center justify-between text-apoyo font-bold"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-marca px-2 text-[11px] leading-5 text-acento">
            Respuesta automática
          </span>
          La primera vez o tras 12 h
        </span>
        <span aria-hidden="true">{abierta ? '−' : '+'}</span>
      </button>
      {abierta && (
        <form onSubmit={(evento) => void guardar(evento)} className="mt-3 flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 text-nota text-secundario">
            Lo que reciben. «{'{tienda}'}» se cambia por el nombre de la tienda.
            <textarea
              rows={5}
              maxLength={1000}
              value={texto ?? ''}
              disabled={texto === null}
              onChange={(evento) => setTexto(evento.target.value)}
              className="rounded-xl border border-borde px-3.5 py-3 text-apoyo text-tinta"
            />
          </label>
          <span className="flex items-center gap-3">
            <button
              type="submit"
              disabled={texto === null || texto.trim().length < 10}
              className="h-10 rounded-full bg-tinta px-4 text-apoyo font-bold text-white disabled:bg-borde"
            >
              Guardar
            </button>
            {estado && (
              <span role="status" className="text-nota text-secundario">
                {estado}
              </span>
            )}
          </span>
        </form>
      )}
    </div>
  );
}
