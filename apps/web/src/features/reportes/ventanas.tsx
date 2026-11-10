'use client';

import type { RespuestaDenuncia } from '@paselibre/contracts';
import {
  IconBan,
  IconBellOff,
  IconCheck,
  IconChevronLeft,
  IconEye,
  IconFlag,
  IconInfoCircle,
  IconMessage,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

type Motivo = 'ESTAFA' | 'DESCRITO' | 'TRATO';

export const MOTIVOS: Array<{ clave: Motivo; titulo: string; detalle: string; urgente?: boolean }> =
  [
    {
      clave: 'ESTAFA',
      titulo: 'Estafa o intento de estafa',
      detalle:
        'Te pidió adelanto, depósito o Yape antes de verlo, o te dio algo distinto a lo pagado.',
      urgente: true,
    },
    {
      clave: 'DESCRITO',
      titulo: 'No cumplió con lo descrito',
      detalle: 'El modelo, el estado, la garantía o lo acordado no era lo que decía.',
    },
    {
      clave: 'TRATO',
      titulo: 'Mal trato o acoso',
      detalle: 'Insultos, amenazas o mensajes que no paran.',
    },
  ];

export const tituloMotivo = (clave: Motivo | null) =>
  MOTIVOS.find((motivo) => motivo.clave === clave)?.titulo ?? 'Reporte';

const EJEMPLOS: Record<Motivo, string> = {
  ESTAFA: 'Ej.: me pidió S/ 200 por Yape para separarla.',
  DESCRITO: 'Ej.: la publicó como «Nuevo sellado» y llegó abierta.',
  TRATO: 'Ej.: me insultó cuando le dije que no.',
};

const HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
/** «7:06 p. m.» */
export const horaReloj = (iso: string) =>
  HORA.format(new Date(iso)).replace(/\s?([ap])\.?\s?m\.?/i, ' $1. m.');

/** Un `<dialog>` del tamaño del lienzo: centrado en la computadora, hoja desde abajo en el celular. */
function Dialogo({
  etiqueta,
  alCerrar,
  children,
}: {
  etiqueta: string;
  alCerrar: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={etiqueta}
      onCancel={alCerrar}
      onClick={(evento) => {
        if (evento.target === ref.current) alCerrar();
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-full rounded-t-[24px] bg-white p-0 text-tinta backdrop:bg-tinta/45 md:m-auto md:w-[560px] md:rounded-[24px]"
    >
      {children}
    </dialog>
  );
}

function Encabezado({
  titulo,
  alVolver,
  alCerrar,
}: {
  titulo: string;
  alVolver?: () => void;
  alCerrar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-5 pb-1 pt-4">
      {alVolver && (
        <button
          type="button"
          aria-label="Volver"
          onClick={alVolver}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-superficie"
        >
          <IconChevronLeft size={22} stroke={1.8} aria-hidden="true" />
        </button>
      )}
      <h2 className="min-w-0 flex-1 text-[20px] font-bold leading-7">{titulo}</h2>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={alCerrar}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-superficie"
      >
        <IconX size={20} stroke={1.8} aria-hidden="true" />
      </button>
    </div>
  );
}

function Interruptor({
  etiqueta,
  activo,
  alCambiar,
}: {
  etiqueta: string;
  activo: boolean;
  alCambiar: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={alCambiar}
      className={`flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-1 ${
        activo ? 'justify-end bg-pase' : 'justify-start bg-borde'
      }`}
    >
      <span className="h-[22px] w-[22px] rounded-full bg-white shadow" />
    </button>
  );
}

/**
 * Reportar (REP_Web, REP_Cel): elegir uno de los tres motivos, contar qué pasó (con el chat
 * adjunto si viene de uno y «Bloquear también») y el aviso de que llegó, con su código y los
 * tres pasos. Lo revisa una persona del equipo en máximo 3 horas.
 */
export function VentanaReporte({
  objeto,
  objetoId,
  tienda,
  sobre,
  conversacionId = null,
  alCerrar,
  alBloquear,
}: {
  objeto: 'OFERTA' | 'TIENDA' | 'CONVERSACION' | 'EN_VIVO';
  objetoId: string;
  /** El nombre de la tienda, o nulo si no se ve (tienda reservada): entonces no se nombra. */
  tienda: string | null;
  /** «Publicación · RTX 3070 Ventus 3X» o «Tienda · Computer Shock». */
  sobre: string;
  /** Viene de un chat: se ofrece «Adjuntar este chat». */
  conversacionId?: string | null;
  alCerrar: () => void;
  /** Se marcó «Bloquear también»: quien abrió la ventana actualiza lo suyo. */
  alBloquear?: () => void;
}) {
  const [paso, setPaso] = useState<'motivo' | 'detalle' | 'enviado'>('motivo');
  const [motivo, setMotivo] = useState<Motivo | null>(null);
  const [texto, setTexto] = useState('');
  const [adjuntar, setAdjuntar] = useState(true);
  const [bloquear, setBloquear] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState<RespuestaDenuncia | null>(null);
  const nombre = tienda ?? 'La tienda';
  const equipo = enlaceWhatsappEquipo('Hola, quiero contarle algo al equipo de PaseLibre.');

  async function enviar() {
    if (!motivo) return;
    setEnviando(true);
    setError(null);
    try {
      const hecho = await llamarApi<RespuestaDenuncia>('/denuncias', {
        metodo: 'POST',
        cuerpo: {
          objeto,
          objeto_id: objetoId,
          tipo: motivo,
          ...(texto.trim() ? { motivo: texto.trim() } : {}),
          ...(conversacionId && adjuntar ? { conversacion_id: conversacionId } : {}),
          bloquear,
        },
      });
      setRespuesta(hecho);
      setPaso('enviado');
      if (hecho.bloqueada) alBloquear?.();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos enviar tu reporte.');
    } finally {
      setEnviando(false);
    }
  }

  if (paso === 'enviado' && respuesta) {
    return (
      <Dialogo etiqueta="Reporte enviado" alCerrar={alCerrar}>
        <div className="flex justify-end px-4 pt-4">
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-superficie"
          >
            <IconX size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 px-5 pb-5 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-pase-medio text-marca">
            <IconCheck size={34} stroke={2.2} aria-hidden="true" />
          </span>
          <h2 className="text-[22px] font-bold leading-8">Ya nos llegó tu reporte</h2>
          <span className="rounded-full bg-superficie px-3 text-nota font-semibold leading-7">
            {respuesta.codigo} · {tituloMotivo(motivo)}
          </span>
          <p className="m-0 text-cuerpo text-secundario">
            Una persona del equipo lo revisa antes de las {horaReloj(respuesta.revisar_antes_de)}
            {motivo === 'ESTAFA' ? ' (los de estafa van primero)' : ''} y, si hace falta, le escribe
            directo a la tienda. Te avisamos en la campanita qué pasó.
          </p>
          {respuesta.bloqueada && (
            <p className="m-0 text-apoyo font-semibold">Además bloqueaste a {nombre}.</p>
          )}
          <ol className="m-0 grid w-full list-none grid-cols-3 gap-2 rounded-2xl bg-superficie p-4 text-nota">
            {['Enviado', 'Lo revisa una persona', 'Te avisamos qué pasó'].map((paso, indice) => (
              <li key={paso} className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold ${
                    indice === 0
                      ? 'bg-pase text-white'
                      : indice === 1
                        ? 'bg-contador text-tinta'
                        : 'border-2 border-borde text-secundario'
                  }`}
                >
                  {indice === 0 ? (
                    <IconCheck size={14} stroke={2.6} aria-hidden="true" />
                  ) : (
                    indice + 1
                  )}
                </span>
                <span className={indice === 1 ? 'font-bold' : 'text-secundario'}>{paso}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-2.5 border-t border-linea px-5 py-4">
          <Link
            href="/cuenta/configuracion?seccion=reportes"
            className="flex h-12 items-center justify-center rounded-full border border-borde font-bold text-tinta no-underline"
          >
            Mis reportes
          </Link>
          <button
            type="button"
            onClick={alCerrar}
            className="h-12 rounded-full bg-tinta font-bold text-white"
          >
            Listo
          </button>
        </div>
      </Dialogo>
    );
  }

  if (paso === 'detalle' && motivo) {
    const urgente = motivo === 'ESTAFA';
    return (
      <Dialogo etiqueta="Reportar" alCerrar={alCerrar}>
        <Encabezado
          titulo="Cuéntanos un poco más"
          alVolver={() => setPaso('motivo')}
          alCerrar={alCerrar}
        />
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4 pt-2">
          <span className="flex flex-wrap gap-2">
            <span className="rounded-full bg-superficie px-3 text-nota font-semibold leading-8">
              {sobre}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-tinta px-3 text-nota font-bold leading-8 text-white">
              <IconFlag size={14} stroke={2} aria-hidden="true" />
              {tituloMotivo(motivo)}
            </span>
          </span>
          {urgente && (
            <p className="m-0 rounded-xl bg-aviso-fondo px-3.5 py-3 text-apoyo text-aviso">
              Mientras lo revisamos, no envíes adelantos. En PaseLibre el pase se paga en el stand,
              con el producto en la mano. Nunca por Yape antes de verlo.
            </p>
          )}
          <label className="flex flex-col gap-2 text-apoyo font-bold">
            <span>
              Cuéntanos qué pasó <span className="font-normal text-secundario">(opcional)</span>
            </span>
            <textarea
              rows={3}
              maxLength={500}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder={EJEMPLOS[motivo]}
              className="rounded-xl border border-borde px-3.5 py-3 text-cuerpo font-normal"
            />
          </label>
          {conversacionId && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-linea px-4 py-3">
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">Adjuntar este chat</b>
                <span className="text-nota text-secundario">
                  Solo lo lee la persona del equipo que revisa tu reporte.
                </span>
              </span>
              <Interruptor
                etiqueta="Adjuntar este chat"
                activo={adjuntar}
                alCambiar={() => setAdjuntar(!adjuntar)}
              />
            </div>
          )}
          {tienda && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-linea px-4 py-3">
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">Bloquear también a {tienda}</b>
                <span className="text-nota text-secundario">
                  No podrá escribirte y no verás lo suyo.
                </span>
              </span>
              <Interruptor
                etiqueta={`Bloquear también a ${tienda}`}
                activo={bloquear}
                alCambiar={() => setBloquear(!bloquear)}
              />
            </div>
          )}
          <span className="flex items-center gap-2 text-nota text-secundario">
            <IconShieldCheck size={18} stroke={1.8} aria-hidden="true" className="text-pase" />
            {tienda
              ? `${tienda} no sabrá quién la reportó.`
              : 'La tienda no sabrá quién la reportó.'}
          </span>
          {error && (
            <p role="alert" className="m-0 text-apoyo text-error">
              {error}
            </p>
          )}
        </div>
        <div className="border-t border-linea px-5 py-4">
          <button
            type="button"
            disabled={enviando}
            onClick={() => void enviar()}
            className="h-[50px] w-full rounded-full bg-tinta text-[16px] font-bold text-white disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Enviar reporte'}
          </button>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo etiqueta="Reportar" alCerrar={alCerrar}>
      <Encabezado titulo={tienda ? `¿Qué pasó con ${tienda}?` : '¿Qué pasó?'} alCerrar={alCerrar} />
      <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-4 pt-1">
        <p className="m-0 text-apoyo text-secundario">
          {objeto === 'OFERTA' ? `Sobre: ${sobre.replace(/^Publicación · /, '')}. ` : ''}Elige una.
          Lo revisa una persona del equipo, no un robot.
        </p>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="sr-only">Motivo</legend>
          {MOTIVOS.map((opcion) => (
            <label
              key={opcion.clave}
              className={`flex cursor-pointer items-start gap-3 rounded-[14px] border-2 px-3.5 py-3 ${
                motivo === opcion.clave ? 'border-tinta bg-superficie' : 'border-linea bg-white'
              }`}
            >
              <input
                type="radio"
                name="motivo"
                checked={motivo === opcion.clave}
                onChange={() => setMotivo(opcion.clave)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-tinta"
              />
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-cuerpo font-bold">{opcion.titulo}</b>
                  {opcion.urgente && (
                    <span className="rounded-full bg-error-fondo px-2 text-[11px] font-bold leading-5 text-error">
                      Lo vemos primero
                    </span>
                  )}
                </span>
                <span className="text-nota text-secundario">{opcion.detalle}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {equipo ? (
          <a
            href={equipo}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-apoyo font-semibold text-pase-texto"
          >
            ¿Es otra cosa? Escríbele al equipo PaseLibre
          </a>
        ) : (
          <Link href="/ayuda" className="self-start text-apoyo font-semibold text-pase-texto">
            ¿Es otra cosa? Escríbele al equipo PaseLibre
          </Link>
        )}
      </div>
      <div className="border-t border-linea px-5 py-4">
        <button
          type="button"
          aria-disabled={!motivo}
          onClick={() => motivo && setPaso('detalle')}
          className={`h-[50px] w-full rounded-full text-[16px] font-bold ${
            motivo ? 'bg-tinta text-white' : 'bg-linea text-detalle'
          }`}
        >
          {motivo ? 'Siguiente' : 'Elige un motivo'}
        </button>
      </div>
    </Dialogo>
  );
}

/**
 * «¿Bloquear a…?» (REP_CelBloquear): qué pasa al bloquear y «Reportarla también al equipo».
 * `alBloquear` hace el bloqueo (desde el chat o desde el perfil); con el reporte marcado, abre
 * después la ventana de reportar.
 */
export function VentanaBloquear({
  tienda,
  alCerrar,
  alBloquear,
  alReportar,
}: {
  tienda: string;
  alCerrar: () => void;
  alBloquear: () => Promise<void>;
  alReportar: () => void;
}) {
  const [reportar, setReportar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function bloquear() {
    setEnviando(true);
    setError(null);
    try {
      await alBloquear();
      if (reportar) alReportar();
      else alCerrar();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos bloquear a esta tienda.');
      setEnviando(false);
    }
  }

  const punto = (icono: ReactNode, texto: ReactNode) => (
    <li className="flex items-start gap-3 text-cuerpo">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-superficie text-secundario">
        {icono}
      </span>
      <span className="pt-1">{texto}</span>
    </li>
  );

  return (
    <Dialogo etiqueta="Bloquear tienda" alCerrar={alCerrar}>
      <Encabezado titulo={`¿Bloquear a ${tienda}?`} alCerrar={alCerrar} />
      <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4 pt-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-error-fondo text-error">
          <IconBan size={28} stroke={1.8} aria-hidden="true" />
        </span>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {punto(
            <IconMessage size={16} stroke={1.8} aria-hidden="true" />,
            'No podrá escribirte ni responder tus pedidos en vivo.',
          )}
          {punto(
            <IconEye size={16} stroke={1.8} aria-hidden="true" />,
            'Dejarás de ver sus publicaciones y sus pedidos en vivo.',
          )}
          {punto(
            <IconBellOff size={16} stroke={1.8} aria-hidden="true" />,
            'No le avisamos. Para ella, simplemente no apareces.',
          )}
          {punto(
            <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />,
            <>
              Puedes desbloquearla cuando quieras en{' '}
              <b className="font-bold">Tu cuenta › Tiendas bloqueadas</b>.
            </>,
          )}
        </ul>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-linea px-4 py-3">
          <input
            type="checkbox"
            checked={reportar}
            onChange={() => setReportar(!reportar)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-tinta"
          />
          <span className="flex flex-col">
            <b className="text-apoyo font-bold">Reportarla también al equipo</b>
            <span className="text-nota text-secundario">
              Si te quiso estafar o te faltó el respeto, así lo revisamos y protegemos a las demás
              tiendas.
            </span>
          </span>
        </label>
        {error && (
          <p role="alert" className="m-0 text-apoyo text-error">
            {error}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-t border-linea px-5 py-4">
        <button
          type="button"
          onClick={alCerrar}
          className="h-12 rounded-full border border-borde font-bold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void bloquear()}
          className="h-12 rounded-full bg-error font-bold text-white disabled:opacity-60"
        >
          {reportar ? 'Bloquear y reportar' : 'Bloquear'}
        </button>
      </div>
    </Dialogo>
  );
}
