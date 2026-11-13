'use client';

import { urlFoto, type MensajeChat } from '@paselibre/contracts';
import {
  IconArrowBackUp,
  IconBrandWhatsapp,
  IconCopy,
  IconDots,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { hora } from '@/shared/fechas';

import { claseDe, type EntradaMensaje } from './entradas';
import {
  enlaceWhatsapp,
  minutosQueQuedan,
  numeroConPrefijo,
  type EstadoCheck,
} from './estado-chat';

/** Lo que se puede hacer con un mensaje desde su menú (N01). */
export type AccionMensaje = 'responder' | 'copiar' | 'editar' | 'eliminar-todos' | 'eliminar-mi';

/**
 * Un check, dos grises o dos verdes (N01). Sobre la burbuja negra, los verdes son los claros;
 * sobre una clara (`fondo="claro"`), el verde y el gris del lienzo. Al pasar a «lo leyó» da un
 * rebote chico (doc 19, punto 19), salvo con «reducir movimiento».
 */
export function Checks({
  estado,
  fondo = 'oscuro',
}: {
  estado: EstadoCheck;
  fondo?: 'oscuro' | 'claro';
}) {
  const color =
    fondo === 'oscuro'
      ? estado === 'leido'
        ? '#3BDB8A'
        : '#AAB6B0'
      : estado === 'leido'
        ? '#00875A'
        : '#8A958F';
  const nombre = estado === 'leido' ? 'Lo leyó' : estado === 'recibido' ? 'Le llegó' : 'Enviado';
  // Solo rebota al cambiar mientras se mira, no al abrir el chat con todo ya leído.
  const antes = useRef(estado);
  const [rebote, setRebote] = useState(false);
  useEffect(() => {
    if (antes.current !== estado && estado === 'leido') setRebote(true);
    antes.current = estado;
  }, [estado]);
  return (
    <svg
      role="img"
      aria-label={nombre}
      width={estado === 'enviado' ? 16 : 20}
      height="12"
      viewBox={estado === 'enviado' ? '0 0 16 12' : '0 0 20 12'}
      data-check={`${fondo}-${estado}`}
      className={`shrink-0 ${rebote ? 'chat-check-rebote' : ''}`}
    >
      <title>{nombre}</title>
      <path
        d={estado === 'enviado' ? 'M1 6.5l3.5 3.5L11 2' : 'M1 6.5l3.5 3.5L11 2M8 9.5l.5.5L15 2'}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** «Responder · Copiar · Editar (quedan 11 min) · Eliminar para todos · Eliminar para mí». */
function MenuMensaje({
  m,
  ahora,
  posicion,
  alElegir,
  alCerrar,
}: {
  m: MensajeChat;
  ahora: Date;
  /** Dónde va en la pantalla: fijo, para que el historial no lo corte. */
  posicion: { top: number; left: number };
  alElegir: (accion: AccionMensaje) => void;
  alCerrar: () => void;
}) {
  const primero = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    primero.current?.focus();
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alCerrar();
    };
    // Si se mueve el chat, el menú ya no estaría junto a su mensaje.
    const alDesplazar = () => alCerrar();
    window.addEventListener('keydown', cerrar);
    window.addEventListener('resize', alDesplazar);
    document.addEventListener('scroll', alDesplazar, true);
    return () => {
      window.removeEventListener('keydown', cerrar);
      window.removeEventListener('resize', alDesplazar);
      document.removeEventListener('scroll', alDesplazar, true);
    };
  }, [alCerrar]);

  const quedan = minutosQueQuedan(m.cambiable_hasta, ahora);
  const seVe = !m.eliminado;
  const opciones: Array<{ accion: AccionMensaje; texto: string; icono: typeof IconCopy }> = [];
  if (seVe && (m.tipo === 'TEXTO' || m.tipo === 'FOTO')) {
    opciones.push({ accion: 'responder', texto: 'Responder', icono: IconArrowBackUp });
  }
  if (seVe && (m.texto || m.whatsapp)) {
    opciones.push({ accion: 'copiar', texto: 'Copiar', icono: IconCopy });
  }
  if (m.mio && m.tipo === 'TEXTO' && quedan > 0) {
    opciones.push({ accion: 'editar', texto: 'Editar', icono: IconPencil });
  }
  if (m.mio && quedan > 0) {
    opciones.push({ accion: 'eliminar-todos', texto: 'Eliminar para todos', icono: IconTrash });
  }
  opciones.push({ accion: 'eliminar-mi', texto: 'Eliminar para mí', icono: IconTrash });

  return (
    <>
      <button
        type="button"
        aria-label="Cerrar menú"
        tabIndex={-1}
        onClick={alCerrar}
        className="fixed inset-0 z-40 cursor-default"
      />
      <div
        role="menu"
        aria-label="Opciones del mensaje"
        style={posicion}
        className="fixed z-50 flex w-[240px] flex-col rounded-[14px] bg-white p-1.5 text-apoyo shadow-[0_10px_30px_rgba(15,20,18,0.18)]"
      >
        {opciones.map(({ accion, texto, icono: Icono }, indice) => {
          const peligro = accion.startsWith('eliminar');
          return (
            <button
              key={accion}
              ref={indice === 0 ? primero : undefined}
              type="button"
              role="menuitem"
              onClick={() => alElegir(accion)}
              className={`flex min-h-11 items-center gap-2.5 rounded-[10px] px-2.5 text-left hover:bg-superficie focus-visible:bg-superficie ${
                peligro ? 'text-error' : 'text-tinta'
              }`}
            >
              <Icono size={18} stroke={1.8} aria-hidden="true" />
              {texto}
              {accion === 'editar' && (
                <span className="ml-auto text-[12px] text-detalle">quedan {quedan} min</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** El ⋯ que sale al pasar el cursor (web) y el menú que abre; en el celular, mantener presionado. */
function ConMenu({
  m,
  ahora,
  alElegir,
  entrada,
  children,
}: {
  m: MensajeChat;
  ahora: Date;
  alElegir: (accion: AccionMensaje) => void;
  entrada?: EntradaMensaje | null;
  children: ReactNode;
}) {
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const abierto = posicion !== null;
  const burbuja = useRef<HTMLDivElement>(null);
  const presion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tactil = useRef(false);
  /** Debajo del mensaje si cabe en la pantalla; si no, encima. Alineado a su lado del chat. */
  const setAbierto = (valor: boolean) => {
    const caja = burbuja.current?.getBoundingClientRect();
    if (!valor || !caja) {
      setPosicion(null);
      return;
    }
    const alto = 5 * 44 + 12;
    const ancho = 240;
    const top =
      caja.bottom + 6 + alto <= window.innerHeight - 8
        ? caja.bottom + 6
        : Math.max(8, caja.top - 6 - alto);
    const left = m.mio ? caja.right - ancho : caja.left;
    setPosicion({ top, left: Math.min(Math.max(8, left), window.innerWidth - ancho - 8) });
  };
  const soltar = () => {
    if (presion.current) clearTimeout(presion.current);
    presion.current = null;
  };

  return (
    <div
      className={`group relative flex max-w-[85%] items-center gap-1.5 [-webkit-touch-callout:none] max-lg:select-none sm:max-w-[72%] ${
        m.mio ? 'flex-row-reverse self-end' : 'self-start'
      } ${claseDe(entrada)}`}
      // En el celular, mantener presionado abre el menú (y no el del navegador).
      onPointerDown={(evento) => {
        tactil.current = evento.pointerType === 'touch';
        if (!tactil.current) return;
        presion.current = setTimeout(() => setAbierto(true), 450);
      }}
      onPointerUp={soltar}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onContextMenu={(evento) => {
        if (!tactil.current) return;
        evento.preventDefault();
        soltar();
        setAbierto(true);
      }}
    >
      <div
        ref={burbuja}
        className={`min-w-0 rounded-2xl ${abierto ? 'outline outline-2 outline-offset-2 outline-[#3BDB8A]' : ''}`}
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Opciones del mensaje"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secundario opacity-0 hover:bg-superficie focus-visible:opacity-100 group-hover:opacity-100 max-lg:hidden"
      >
        <IconDots size={18} stroke={1.8} aria-hidden="true" />
      </button>
      {posicion && (
        <MenuMensaje
          m={m}
          ahora={ahora}
          posicion={posicion}
          alCerrar={() => setAbierto(false)}
          alElegir={(accion) => {
            setAbierto(false);
            alElegir(accion);
          }}
        />
      )}
    </div>
  );
}

const ICONO_WHATSAPP = <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />;

/** Píldora centrada del chat («Le pediste su WhatsApp · esperando que acepte»). */
function Pildora({ children, gris = false }: { children: ReactNode; gris?: boolean }) {
  return (
    <div
      role="status"
      className={`flex max-w-[85%] items-center gap-1.5 self-center rounded-full px-3.5 py-1.5 text-center text-[12px] font-bold ${
        gris ? 'bg-superficie text-secundario' : 'bg-pase-suave text-marca'
      }`}
    >
      {ICONO_WHATSAPP}
      <span>{children}</span>
    </div>
  );
}

/**
 * Pedir WhatsApp (N01). A quien le piden, la tarjeta verde «Aceptar / Ahora no»; a quien pide,
 * en qué quedó. Ninguna muestra un número.
 */
function PedidoWhatsapp({
  m,
  otro,
  puedesCompartir,
  alResponder,
  alCompartir,
}: {
  m: MensajeChat;
  otro: string;
  puedesCompartir: boolean;
  alResponder: (aceptar: boolean) => Promise<void>;
  alCompartir: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  if (m.mio) {
    if (m.pedido === 'PENDIENTE') {
      return <Pildora>Le pediste su WhatsApp · esperando que acepte</Pildora>;
    }
    if (m.pedido === 'ACEPTADO') return <Pildora>Le pediste su WhatsApp · lo compartió</Pildora>;
    return <Pildora gris>Le pediste su WhatsApp · por ahora siguen por el chat</Pildora>;
  }
  if (m.pedido === 'ACEPTADO')
    return <Pildora>{otro} te pidió tu WhatsApp · lo compartiste</Pildora>;
  if (m.pedido === 'RECHAZADO') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 self-center">
        <Pildora gris>{otro} te pidió tu WhatsApp · Ahora no</Pildora>
        {puedesCompartir && (
          <button
            type="button"
            onClick={alCompartir}
            className="text-[12px] font-bold text-pase-texto underline"
          >
            Compartir ahora
          </button>
        )}
      </div>
    );
  }
  const responder = async (aceptar: boolean) => {
    setEnviando(true);
    try {
      await alResponder(aceptar);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2.5 self-center rounded-2xl border-[1.5px] border-[#A7E3C3] bg-[#E8F8EE] px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <IconBrandWhatsapp
          size={22}
          stroke={1.8}
          className="shrink-0 text-[#1E8E4E]"
          aria-hidden="true"
        />
        <span className="flex flex-col">
          <b className="text-cuerpo font-bold">{otro} te pidió tu WhatsApp</b>
          <span className="text-nota text-secundario">
            Si aceptas, le llega tu número de la tienda.
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {puedesCompartir && (
          <button
            type="button"
            disabled={enviando}
            onClick={() => void responder(true)}
            className="h-11 rounded-full bg-pase px-5 font-bold text-white disabled:bg-borde-control"
          >
            Aceptar
          </button>
        )}
        <button
          type="button"
          disabled={enviando}
          onClick={() => void responder(false)}
          className="h-11 rounded-full border-[1.5px] border-tinta bg-white px-5 font-bold text-tinta"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}

/** «WhatsApp de X · +51 987 654 321 · Abrir» (N01); el tuyo, sin «Abrir». */
function TarjetaWhatsapp({ m, otro }: { m: MensajeChat; otro: string }) {
  if (!m.whatsapp) return null;
  return (
    <div className="flex w-full max-w-[420px] items-center gap-3 rounded-2xl border-[1.5px] border-[#A7E3C3] bg-white px-3.5 py-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white"
      >
        <IconBrandWhatsapp size={22} stroke={1.8} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-cuerpo font-bold">
          {m.mio ? 'Compartiste tu WhatsApp' : `WhatsApp de ${otro}`}
        </b>
        <span className="text-apoyo text-secundario">{numeroConPrefijo(m.whatsapp)}</span>
      </span>
      {!m.mio && (
        <a
          href={enlaceWhatsapp(m.whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 shrink-0 items-center rounded-full bg-pase px-5 font-bold text-white no-underline"
        >
          Abrir
        </a>
      )}
    </div>
  );
}

/** La franjita de arriba de una respuesta: a qué mensaje responde. */
function Cita({ m, otro }: { m: MensajeChat; otro: string }) {
  const cita = m.responde_a;
  if (!cita) return null;
  const texto = cita.eliminado
    ? 'Se eliminó este mensaje'
    : (cita.texto ?? (cita.foto ? 'Foto' : ''));
  return (
    <span
      className={`mb-1 flex flex-col rounded-lg border-l-[3px] px-2.5 py-1 text-nota ${
        m.mio
          ? 'border-[#3BDB8A] bg-white/10 text-white/80'
          : 'border-pase bg-white text-secundario'
      }`}
    >
      <b className="font-bold">{cita.mio ? 'Tú' : otro}</b>
      <span className="line-clamp-2 break-words">{texto}</span>
    </span>
  );
}

/**
 * Un mensaje del chat (N01): la burbuja con la cita si responde a otro, «editado ·», la hora,
 * quién lo escribió si su tienda tiene asesores y los checks en los tuyos. Eliminado, queda
 * «🚫 Eliminaste este mensaje». Los del WhatsApp son tarjetas.
 */
export function Burbuja({
  m,
  otro,
  check,
  ahora,
  puedesCompartir,
  alCargarFoto,
  alElegir,
  alResponderPedido,
  alCompartir,
  entrada = null,
}: {
  m: MensajeChat;
  /** El nombre de la otra tienda. */
  otro: string;
  check: EstadoCheck | null;
  ahora: Date;
  puedesCompartir: boolean;
  alCargarFoto: () => void;
  alElegir: (m: MensajeChat, accion: AccionMensaje) => void;
  alResponderPedido: (m: MensajeChat, aceptar: boolean) => Promise<void>;
  alCompartir: () => void;
  /** Llegó o lo enviaste recién, con el chat abierto (doc 19, punto 19). */
  entrada?: EntradaMensaje | null;
}) {
  if (m.tipo === 'SISTEMA') {
    return (
      <div
        role="status"
        className="max-w-[85%] self-center rounded-full bg-ok-fondo px-3.5 py-1.5 text-center text-nota font-semibold text-ok"
      >
        {m.texto}
      </div>
    );
  }
  if (m.tipo === 'PEDIDO_WHATSAPP') {
    return (
      <PedidoWhatsapp
        m={m}
        otro={otro}
        puedesCompartir={puedesCompartir}
        alResponder={(aceptar) => alResponderPedido(m, aceptar)}
        alCompartir={alCompartir}
      />
    );
  }
  const elegir = (accion: AccionMensaje) => alElegir(m, accion);
  if (m.eliminado) {
    return (
      <ConMenu m={m} ahora={ahora} alElegir={elegir} entrada={entrada}>
        <span className="block rounded-2xl border-[1.5px] border-dashed border-borde px-3.5 py-2 text-apoyo italic text-detalle">
          🚫 {m.mio ? 'Eliminaste este mensaje' : 'Se eliminó este mensaje'}
        </span>
      </ConMenu>
    );
  }
  if (m.tipo === 'WHATSAPP') {
    return (
      <ConMenu m={m} ahora={ahora} alElegir={elegir} entrada={entrada}>
        <TarjetaWhatsapp m={m} otro={otro} />
      </ConMenu>
    );
  }
  return (
    <ConMenu m={m} ahora={ahora} alElegir={elegir} entrada={entrada}>
      <div
        className={`flex flex-col gap-0.5 px-3.5 py-2.5 ${
          m.mio
            ? 'rounded-[18px_18px_6px_18px] bg-tinta text-white'
            : 'rounded-[18px_18px_18px_6px] bg-superficie'
        }`}
      >
        <Cita m={m} otro={otro} />
        {m.foto && (
          <a
            href={urlFoto(m.foto)}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1.5 block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlFoto(m.foto)}
              alt={m.mio ? 'Foto que enviaste' : 'Foto que te enviaron'}
              onLoad={alCargarFoto}
              className="max-h-[260px] w-[220px] max-w-full rounded-xl object-cover"
            />
          </a>
        )}
        {m.texto && <span className="whitespace-pre-wrap break-words">{m.texto}</span>}
        <span
          className={`flex items-center justify-end gap-1.5 text-[11px] ${
            m.mio ? 'text-[#AAB6B0]' : 'text-detalle'
          }`}
        >
          {m.editado && <span>editado ·</span>}
          {/* «17:20 · Luis» (N12): quién lo escribió, si su tienda tiene asesores. */}
          <span>{m.autor ? `${hora(m.creado_en)} · ${m.autor}` : hora(m.creado_en)}</span>
          {check && <Checks estado={check} />}
        </span>
      </div>
    </ConMenu>
  );
}
