'use client';

import {
  EVENTOS,
  TIENDA_RESERVADA,
  type ConversacionEnLista,
  type EventoPresencia,
  type FiltroConversacion,
  type RespuestaChatEquipo,
  type RespuestaConversaciones,
} from '@paselibre/contracts';
import { IconCheck, IconPin, IconShieldCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { horaCorta } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { useAgrupado } from '@/shared/agrupar';
import { useConexionTiempoReal, useEvento } from '@/shared/tiempo-real';

import { extractoDeMensaje } from './estado-chat';

type Filtro = FiltroConversacion | 'compras' | 'ventas';

/** PCH_WebTienda: «Todos · No leídos · En vivo · Compras · Ventas» (y los archivados). */
const FILTROS: Array<[Filtro, string]> = [
  ['todas', 'Todos'],
  ['no_leidas', 'No leídos'],
  ['pases', 'En vivo'],
  ['compras', 'Compras'],
  ['ventas', 'Ventas'],
  ['archivadas', 'Archivados'],
];

/** Los hilos con una misma tienda, juntos en un renglón (L-3: la base sigue por producto). */
interface Grupo {
  clave: string;
  tienda: string;
  hilos: ConversacionEnLista[];
}

function agrupar(conversaciones: ConversacionEnLista[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const c of conversaciones) {
    // Una tienda reservada no se junta con nada: delataría quién es.
    const clave =
      c.otro.tienda.id && c.otro.tienda.nombre !== TIENDA_RESERVADA
        ? `t:${c.otro.tienda.id}`
        : `c:${c.id}`;
    const grupo = grupos.get(clave) ?? { clave, tienda: c.otro.tienda.nombre, hilos: [] };
    grupo.hilos.push(c);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()];
}

/** «MSI GeForce RTX 3070 Ventus 3X» → «RTX 3070»: el modelo, para las pastillas. */
function corto(titulo: string): string {
  const palabras = titulo.split(' ');
  const i = palabras.findIndex((palabra) => /\d/.test(palabra));
  if (i <= 0) return palabras.slice(0, 2).join(' ');
  return palabras.slice(Math.max(0, i - 1), i + 1).join(' ');
}

function extracto(c: ConversacionEnLista): string {
  return c.ultimo_mensaje ? extractoDeMensaje(c.ultimo_mensaje) : '';
}

function Renglon({
  grupo,
  abierta,
  enLinea,
}: {
  grupo: Grupo;
  abierta: string | null;
  /** El puntito verde (N01): la tienda está conectada ahora. */
  enLinea: boolean;
}) {
  const [ultimo] = grupo.hilos;
  if (!ultimo) return null;
  const activa = grupo.hilos.some((c) => c.id === abierta);
  const noLeidos = grupo.hilos.reduce((suma, c) => suma + c.no_leidos, 0);
  const sinLeer = noLeidos > 0 || grupo.hilos.some((c) => c.no_leida);
  const enVivo = grupo.hilos.some((c) => c.pase_del_dia);
  return (
    <li>
      <Link
        href={`/mensajes/${ultimo.id}`}
        aria-current={activa ? 'page' : undefined}
        className={`flex gap-3 border-b border-linea px-4 py-3.5 no-underline ${
          activa ? 'bg-pase-suave' : 'hover:bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-tinta text-apoyo font-bold text-white"
        >
          {iniciales(grupo.tienda)}
          {enLinea && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-[2.5px] border-white bg-[#22C55E]" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex justify-between gap-2">
            <b className="truncate text-cuerpo font-bold">
              {grupo.tienda}
              {enLinea && <span className="sr-only"> (conectada ahora)</span>}
            </b>
            <span className="shrink-0 text-nota text-secundario">
              {horaCorta(ultimo.actualizada_en)}
            </span>
          </span>
          <span className="flex flex-wrap gap-1">
            {enVivo && (
              <span className="flex h-6 items-center gap-1 rounded-full bg-aviso-fondo px-2 text-[11px] font-bold text-aviso">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-vivo" />
                En vivo
              </span>
            )}
            {grupo.hilos.slice(0, 2).map((c) => (
              <span
                key={c.id}
                className="flex h-6 max-w-[130px] items-center truncate rounded-full bg-superficie px-2 text-[11px] font-bold text-secundario"
              >
                {corto(c.oferta.producto.titulo)}
              </span>
            ))}
            {grupo.hilos.length > 2 && (
              <span className="flex h-6 items-center px-1 text-[11px] font-bold text-secundario">
                +{grupo.hilos.length - 2}
              </span>
            )}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-apoyo ${sinLeer ? 'font-bold text-tinta' : 'text-secundario'}`}
            >
              {extracto(ultimo)}
            </span>
            {ultimo.silenciada ? (
              <span className="shrink-0 text-[11px] font-semibold text-detalle">Silenciado</span>
            ) : (
              sinLeer && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
                  {noLeidos > 0 ? noLeidos : ''}
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

/** El chat oficial, fijado arriba (REP_WebChatEquipo). */
function RenglonEquipo({ chat, activo }: { chat: RespuestaChatEquipo | null; activo: boolean }) {
  const ultimo = chat?.mensajes[chat.mensajes.length - 1];
  const sinLeer = (chat?.sin_leer ?? 0) > 0;
  return (
    <li>
      <Link
        href="/mensajes/equipo"
        aria-current={activo ? 'page' : undefined}
        className={`flex gap-3 border-b border-l-4 border-b-linea px-4 py-3.5 no-underline ${
          activo ? 'border-l-pase bg-pase-suave' : 'border-l-pase bg-white hover:bg-superficie'
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-marca text-white"
        >
          <IconShieldCheck size={24} stroke={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <b className="truncate text-cuerpo font-bold">Equipo PaseLibre</b>
              <span className="flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-pase-medio px-1.5 text-[11px] font-bold text-marca">
                <IconCheck size={11} stroke={3} aria-hidden="true" />
                Oficial
              </span>
            </span>
            {ultimo && (
              <span className="shrink-0 text-nota text-secundario">
                {horaCorta(ultimo.creado_en)}
              </span>
            )}
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-apoyo ${sinLeer ? 'font-bold text-tinta' : 'text-secundario'}`}
            >
              {ultimo
                ? `${ultimo.mio ? 'Tú' : ultimo.autor}: ${ultimo.texto}`
                : '¿Dudas o un problema? Escríbenos aquí.'}
            </span>
            {sinLeer && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
                {chat?.sin_leer}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-detalle">
            <IconPin size={11} stroke={2} aria-hidden="true" />
            Fijado arriba
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
  const ruta = usePathname();
  const enEquipo = ruta === '/mensajes/equipo';
  const abierta = parametros.id ?? null;
  // En el celular, al llegar desde una ficha se muestra el chat que se está abriendo.
  const conChat = Boolean(abierta || enEquipo || busqueda.get('oferta') || busqueda.get('tienda'));
  const conexion = useConexionTiempoReal();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [equipo, setEquipo] = useState<RespuestaChatEquipo | null>(null);
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<RespuestaConversaciones | null>(null);
  // Lo que llegó por el socket desde la última carga: tienda → conectada (N01).
  const [presencia, setPresencia] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const ultima = useRef(0);

  useEffect(() => {
    const espera = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [busca]);

  const cargar = useCallback(async () => {
    const numero = ++ultima.current;
    try {
      const deApi = filtro === 'compras' || filtro === 'ventas' ? 'todas' : filtro;
      const [respuesta, chatEquipo] = await Promise.all([
        llamarApi<RespuestaConversaciones>(
          `/conversaciones?filtro=${deApi}&q=${encodeURIComponent(q)}`,
        ),
        llamarApi<RespuestaChatEquipo>('/equipo-chat').catch(() => null),
      ]);
      if (numero === ultima.current) setEquipo(chatEquipo);
      if (numero === ultima.current) {
        setDatos(respuesta);
        setPresencia({});
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
  // Un mensaje dispara los dos eventos: se piden juntos, una vez.
  const recargar = useAgrupado(() => void cargar());
  // Al abrir el chat del equipo se marca leído: la lista se pone al día.
  useEffect(() => {
    if (!enEquipo) return;
    const espera = setTimeout(() => void cargar(), 900);
    return () => clearTimeout(espera);
  }, [enEquipo, cargar]);
  useEvento(EVENTOS.mensajeNuevo, recargar);
  useEvento(EVENTOS.mensajeCambio, recargar);
  useEvento(EVENTOS.contadores, recargar);
  // El puntito verde se prende y se apaga solo, sin recargar la lista.
  useEvento<EventoPresencia>(EVENTOS.presencia, (evento) =>
    setPresencia((antes) => ({ ...antes, [evento.tienda_id]: evento.en_linea })),
  );
  const conectada = (grupo: Grupo) =>
    grupo.hilos.some((c) =>
      c.otro.tienda.id && c.otro.tienda.id in presencia
        ? presencia[c.otro.tienda.id]
        : c.otro.en_linea,
    );

  const visibles = (datos?.conversaciones ?? []).filter((c) =>
    filtro === 'compras'
      ? c.rol === 'comprador'
      : filtro === 'ventas'
        ? c.rol === 'vendedor'
        : true,
  );
  const grupos = agrupar(visibles);
  const cuenta = (valor: Filtro): number | null => {
    if (!datos) return null;
    if (valor === 'compras' || valor === 'ventas') return null;
    return datos.conteos[valor];
  };

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-180px)] lg:min-h-[600px]">
      <h1 className="text-titulo max-lg:hidden">Mensajes</h1>
      <div className="flex min-h-0 flex-1 overflow-hidden lg:rounded-[24px] lg:border lg:border-linea lg:bg-white">
        <section
          aria-label="Conversaciones"
          className={`min-w-0 flex-col gap-3 overflow-hidden lg:flex lg:w-[400px] lg:shrink-0 lg:border-r lg:border-linea ${
            conChat ? 'hidden' : 'flex w-full'
          }`}
        >
          <h1 className="mx-1 text-titulo lg:hidden">Mensajes</h1>
          <div className="flex flex-col gap-3 lg:px-4 lg:pt-4">
            <label className="flex h-12 items-center gap-2 rounded-full border border-borde bg-white px-4 text-secundario focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
              <span className="sr-only">Buscar por tienda o producto</span>
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar por tienda o producto"
                className="h-10 min-w-0 flex-1 bg-transparent text-cuerpo text-tinta placeholder:text-detalle focus-visible:outline-none"
              />
            </label>
            <div
              role="tablist"
              aria-label="Filtrar conversaciones"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:px-0"
            >
              {FILTROS.map(([valor, texto]) => {
                const elegido = valor === filtro;
                const numero = cuenta(valor);
                // «En vivo» y «Archivados» salen cuando hay algo (D-53).
                if ((valor === 'pases' || valor === 'archivadas') && !elegido && !numero) {
                  return null;
                }
                return (
                  <button
                    key={valor}
                    type="button"
                    role="tab"
                    aria-selected={elegido}
                    onClick={() => setFiltro(valor)}
                    className={`h-10 shrink-0 rounded-full border px-4 text-apoyo ${
                      elegido
                        ? 'border-tinta bg-tinta font-bold text-white'
                        : 'border-borde bg-white font-medium'
                    }`}
                  >
                    {texto}
                    {valor === 'no_leidas' && numero ? ` · ${numero}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
          {error && (
            <p role="alert" className="mx-4 text-apoyo text-error">
              {error}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="m-0 flex list-none flex-col p-0">
              {filtro === 'todas' && !q && <RenglonEquipo chat={equipo} activo={enEquipo} />}
              {grupos.map((grupo) => (
                <Renglon
                  key={grupo.clave}
                  grupo={grupo}
                  abierta={abierta}
                  enLinea={conectada(grupo)}
                />
              ))}
            </ul>
            {datos === null && !error ? (
              <p className="mx-2 my-6 text-center text-apoyo text-secundario">Cargando…</p>
            ) : (
              datos &&
              grupos.length === 0 && (
                <p className="mx-2 my-6 text-center text-apoyo text-secundario">
                  {q
                    ? `Ninguna conversación coincide con «${q}».`
                    : filtro === 'todas'
                      ? 'Todavía nada por aquí.'
                      : 'No hay conversaciones aquí.'}
                </p>
              )
            )}
          </div>
        </section>
        <div className={`min-w-0 flex-1 lg:flex ${conChat ? 'flex' : 'hidden'}`}>{children}</div>
      </div>
    </div>
  );
}
