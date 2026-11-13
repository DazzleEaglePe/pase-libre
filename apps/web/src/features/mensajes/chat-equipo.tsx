'use client';

import {
  EVENTOS,
  type EventoMensajeEquipo,
  type MensajeChatEquipo,
  type RespuestaChatEquipo,
} from '@paselibre/contracts';
import { IconCheck, IconFlag, IconSend, IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { diaDelChat, hora } from '@/shared/fechas';
import { useConexionTiempoReal, useEvento, useRespaldo } from '@/shared/tiempo-real';

const RAPIDAS = ['Ya lo corregí', '¿Cómo lo edito?', 'Gracias'];

function Caso({ caso }: { caso: NonNullable<MensajeChatEquipo['caso']> }) {
  return (
    <div className="flex w-full max-w-[380px] items-start gap-3 self-center rounded-2xl border border-dashed border-borde bg-white px-4 py-3">
      <IconFlag size={18} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col text-apoyo">
        <b className="font-bold">
          Caso {caso.codigo} · {caso.motivo}
        </b>
      </span>
      <span className="shrink-0 rounded-full bg-aviso-fondo px-2.5 py-0.5 text-nota font-bold text-aviso">
        {caso.estado}
      </span>
    </div>
  );
}

/**
 * «Recibiste 1 advertencia de 3» (N14): cuenta las advertencias que dio el equipo después de
 * revisar, no los reportes recibidos.
 */
function Advertencias({
  advertencias,
  alVerMotivo,
  alEscribir,
}: {
  advertencias: NonNullable<RespuestaChatEquipo['advertencias']>;
  alVerMotivo: () => void;
  alEscribir: () => void;
}) {
  const { total, maximo, ultima } = advertencias;
  return (
    <div className="mx-3 mt-3 flex flex-col gap-2 rounded-2xl border-[1.5px] border-[#F5D5BC] bg-aviso-fondo px-4 py-3.5">
      <b className="flex items-center gap-2 text-cuerpo font-bold">
        <IconFlag size={18} stroke={1.8} className="text-aviso" aria-hidden="true" />
        Recibiste {total} {total === 1 ? 'advertencia' : 'advertencias'} de {maximo}
      </b>
      <p className="m-0 text-apoyo text-secundario">
        Motivo: {ultima.motivo}
        {ultima.caso && !ultima.motivo.includes(ultima.caso) ? ` (caso ${ultima.caso})` : ''}. Si
        llegas a {maximo}, tu cuenta puede suspenderse.
      </p>
      <span className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={alVerMotivo}
          className="h-10 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold"
        >
          Ver el motivo
        </button>
        <button
          type="button"
          onClick={alEscribir}
          className="h-10 text-apoyo font-semibold underline"
        >
          Escribir al Equipo
        </button>
      </span>
    </div>
  );
}

/**
 * El chat oficial con el equipo (REP_WebChatEquipo, REP_ChatEquipo): banda negra con el escudo,
 * «Canal oficial. Nunca te pediremos contraseñas, códigos ni pagos.», los mensajes del equipo
 * con quién escribe y respuestas rápidas. Se lee al abrirlo.
 */
export function ChatEquipo() {
  const [datos, setDatos] = useState<RespuestaChatEquipo | null>(null);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const conexion = useConexionTiempoReal();

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaChatEquipo>('/equipo-chat?leer=1'));
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos abrir el chat.');
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar, conexion]);
  // Su propio evento, aparte de la campanita: llega aunque esté en «No molestar» (doc 19, A3).
  useEvento<EventoMensajeEquipo>(EVENTOS.mensajeEquipo, () => void cargar());
  useRespaldo(cargar);
  useLayoutEffect(() => {
    if (caja.current) caja.current.scrollTop = caja.current.scrollHeight;
  }, [datos]);

  async function enviar(texto: string) {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const mensaje = await llamarApi<MensajeChatEquipo>('/equipo-chat/mensajes', {
        metodo: 'POST',
        cuerpo: { texto: texto.trim() },
      });
      setDatos((antes) => ({
        ...antes,
        mensajes: [...(antes?.mensajes ?? []), mensaje],
        sin_leer: 0,
      }));
      setBorrador('');
      // La primera vez (o tras 12 h) llega también la respuesta automática (N14).
      void cargar();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No se pudo enviar.');
    } finally {
      setEnviando(false);
    }
  }

  const mensajes = datos?.mensajes ?? [];
  const advertencias = datos?.advertencias ?? null;
  return (
    <section
      aria-label="Chat con el equipo PaseLibre"
      className="flex h-[calc(100dvh-130px)] min-h-[480px] min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border-[1.5px] border-linea lg:h-auto lg:min-h-0 lg:rounded-none lg:border-0"
    >
      <div className="flex items-center gap-3 bg-tinta px-4 py-3.5 text-white">
        <Link
          href="/mensajes"
          aria-label="Volver a Mensajes"
          className="flex h-11 w-8 shrink-0 items-center justify-center text-white lg:hidden"
        >
          ‹
        </Link>
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca"
        >
          <IconShieldCheck size={24} stroke={1.8} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2">
            <b className="text-cuerpo font-bold">Equipo PaseLibre</b>
            <span className="flex h-5 items-center gap-0.5 rounded-full bg-pase-medio px-1.5 text-[11px] font-bold text-marca">
              <IconCheck size={11} stroke={3} aria-hidden="true" />
              Oficial
            </span>
          </span>
          <span className="text-nota text-white/75">
            Te atiende el equipo · responde en máx. 3 h
          </span>
        </span>
      </div>
      <p className="m-0 flex items-center gap-2 bg-pase-suave px-4 py-2.5 text-apoyo text-marca">
        <IconShieldCheck size={17} stroke={1.8} aria-hidden="true" />
        <span>
          <b className="font-bold">Canal oficial.</b> Nunca te pediremos contraseñas, códigos ni
          pagos.
        </span>
      </p>
      {advertencias && (
        <Advertencias
          advertencias={advertencias}
          alVerMotivo={() => {
            const motivo = [...mensajes]
              .reverse()
              .find((m) => m.de_equipo && m.texto.includes(advertencias.ultima.motivo));
            document
              .getElementById(motivo ? `mensaje-${motivo.id}` : 'fin-del-chat')
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          alEscribir={() => document.getElementById('mensaje-al-equipo')?.focus()}
        />
      )}

      <div ref={caja} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
        {datos === null && !error && <p className="m-auto text-secundario">Cargando…</p>}
        {datos && mensajes.length === 0 && (
          <p className="m-auto max-w-[360px] text-center text-apoyo text-secundario">
            ¿Una duda, un problema con una venta o algo que no funciona? Escríbenos aquí: te
            responde una persona del equipo.
          </p>
        )}
        {mensajes.map((mensaje, i) => {
          const dia = diaDelChat(mensaje.creado_en);
          const anterior = mensajes[i - 1];
          return (
            <Fragment key={mensaje.id}>
              {(!anterior || diaDelChat(anterior.creado_en) !== dia) && (
                <span className="self-center text-[12px] text-detalle first-letter:uppercase">
                  {dia}
                </span>
              )}
              {mensaje.caso && <Caso caso={mensaje.caso} />}
              {mensaje.de_equipo ? (
                <div
                  id={`mensaje-${mensaje.id}`}
                  className="flex max-w-[85%] flex-col gap-1 self-start sm:max-w-[75%]"
                >
                  {mensaje.automatica ? (
                    <span className="self-start rounded-full bg-marca px-2 text-[11px] font-bold leading-5 text-acento">
                      Respuesta automática
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-nota font-bold text-marca">
                      <IconShieldCheck size={13} stroke={2} aria-hidden="true" />
                      {mensaje.autor} · Equipo PaseLibre
                    </span>
                  )}
                  <span className="rounded-[18px_18px_18px_6px] bg-tinta px-4 py-3 text-cuerpo text-white">
                    <span className="whitespace-pre-wrap break-words">{mensaje.texto}</span>
                    <span className="block text-right text-[11px] text-white/60">
                      {hora(mensaje.creado_en)}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="max-w-[85%] self-end rounded-[18px_18px_6px_18px] bg-pase-medio px-4 py-3 text-cuerpo sm:max-w-[75%]">
                  <span className="whitespace-pre-wrap break-words">{mensaje.texto}</span>
                  <span className="block text-right text-[11px] text-secundario">
                    {hora(mensaje.creado_en)}
                  </span>
                </div>
              )}
            </Fragment>
          );
        })}
        <span id="fin-del-chat" />
      </div>

      {error && (
        <p
          role="alert"
          className="m-0 border-t border-linea bg-error-fondo px-4 py-2.5 text-apoyo text-error"
        >
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2.5 border-t border-linea p-3">
        <div aria-label="Respuestas rápidas" className="flex gap-1.5 overflow-x-auto">
          {RAPIDAS.map((texto) => (
            <button
              key={texto}
              type="button"
              disabled={enviando}
              onClick={() => void enviar(texto)}
              className="h-9 shrink-0 rounded-full border-[1.5px] border-pase px-3.5 text-nota font-bold text-marca"
            >
              {texto}
            </button>
          ))}
        </div>
        <form
          onSubmit={(evento: FormEvent<HTMLFormElement>) => {
            evento.preventDefault();
            void enviar(borrador);
          }}
          className="flex items-center gap-2"
        >
          <label className="flex min-w-0 flex-1">
            <span className="sr-only">Mensaje al equipo</span>
            <input
              id="mensaje-al-equipo"
              value={borrador}
              onChange={(evento) => setBorrador(evento.target.value)}
              placeholder="Escribe al equipo"
              maxLength={2000}
              className="h-12 min-w-0 flex-1 rounded-full border-[1.5px] border-borde px-4 text-cuerpo placeholder:text-detalle"
            />
          </label>
          <button
            type="submit"
            aria-label="Enviar"
            disabled={enviando || !borrador.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta text-white disabled:bg-superficie disabled:text-borde-control"
          >
            <IconSend size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}
