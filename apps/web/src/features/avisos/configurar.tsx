'use client';

import type { RespuestaAvisosCuenta } from '@paselibre/contracts';
import { IconMoon, IconVolume } from '@tabler/icons-react';
import { useEffect, useId, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Interruptor } from '@/shared/ui/interruptor';
import { EVENTO_AVISOS_GUARDADOS } from '@/shared/ui/que-no-se-pierda';

type Clave = keyof RespuestaAvisosCuenta['campanita'];

/** Las filas de «Configurar avisos» (AV_Web), en su orden. */
const FILAS: Array<[Clave, string, string]> = [
  ['EN_VIVO', 'Pedidos en vivo de lo que vendes', 'Te llegan al instante'],
  [
    'EN_VIVO_RESPUESTA',
    'Respuestas a tus pedidos en vivo',
    'Cuando alguien toca «¡Lo tengo!» o «¡Lo quiero!»',
  ],
  ['MENSAJE', 'Mensajes nuevos', 'Se agrupan si te escriben varios seguidos'],
  ['VENTA', 'Ventas y calificaciones', 'Ventas marcadas, «¿Se vendió?», estrellas'],
  ['SEGUIDA', 'Tiendas que sigues', 'Lo nuevo que publican, según lo que elegiste'],
  ['RECORDATORIO', 'Recordatorios', 'Publicaciones sin cambios, pedidos por vencer'],
  ['ALERTA', 'Alertas de búsqueda', 'Cuando aparece algo que guardaste'],
  ['EQUIPO', 'Novedades del equipo PaseLibre', 'Pocas veces al mes'],
];

const HORARIO_POR_DEFECTO = { desde: '21:00', hasta: '08:00' };

const HORA = new Intl.DateTimeFormat('es-PE', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
});
/** «21:00» → «9:00 p. m.» */
const legible = (valor: string) => {
  const [h, m] = valor.split(':').map(Number);
  return HORA.format(new Date(Date.UTC(2026, 0, 1, h ?? 0, m ?? 0))).replace(
    /\s?([ap])\.?\s?m\.?/i,
    ' $1. m.',
  );
};

/**
 * «Configurar avisos» (AV_Web, AV_CelAjustes): qué te avisamos, el sonido, el horario silencioso
 * y por dónde llegan. Cada cambio se guarda al momento. Apagar un aviso no apaga el chat.
 */
export function ConfigurarAvisos({ alAvisar }: { alAvisar?: (mensaje: string) => void }) {
  const id = useId();
  const [datos, setDatos] = useState<RespuestaAvisosCuenta | null>(null);
  const [horario, setHorario] = useState(HORARIO_POR_DEFECTO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos').then(
      (respuesta) => {
        setDatos(respuesta);
        if (respuesta.no_molestar) setHorario(respuesta.no_molestar);
      },
      () => setError('No pudimos cargar tus avisos.'),
    );
  }, []);

  async function guardar(nuevos: RespuestaAvisosCuenta) {
    const anteriores = datos;
    setDatos(nuevos);
    setError(null);
    try {
      const guardados = await llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos', {
        metodo: 'PUT',
        cuerpo: nuevos,
      });
      setDatos(guardados);
      // El sonido y «No molestar» valen al toque en esta pestaña (doc 19, punto 22).
      window.dispatchEvent(new CustomEvent(EVENTO_AVISOS_GUARDADOS, { detail: guardados }));
      alAvisar?.('Avisos guardados.');
    } catch (falla) {
      setDatos(anteriores);
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar tus avisos.');
    }
  }

  if (!datos) return <p className="text-secundario">{error ?? 'Cargando…'}</p>;

  const callado = datos.no_molestar !== null;
  const cambiarHora = (campo: 'desde' | 'hasta', valor: string) => {
    const nuevo = { ...horario, [campo]: valor };
    setHorario(nuevo);
    if (callado && valor) void guardar({ ...datos, no_molestar: nuevo });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="m-0 flex list-none flex-col p-0">
        {FILAS.filter(([clave]) => datos.campanita[clave] !== undefined).map(
          ([clave, titulo, detalle]) => (
            <li
              key={clave}
              className="flex items-center justify-between gap-4 border-b border-linea py-3 last:border-0"
            >
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">{titulo}</b>
                <span className="text-nota text-secundario">{detalle}</span>
              </span>
              <Interruptor
                etiqueta={titulo}
                activo={datos.campanita[clave] ?? true}
                alCambiar={(activo) =>
                  void guardar({ ...datos, campanita: { ...datos.campanita, [clave]: activo } })
                }
              />
            </li>
          ),
        )}
      </ul>

      {/* doc 19, punto 22: los dos sonidos, prendidos de entrada. */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-linea px-4 py-3">
        <span className="flex items-start gap-3">
          <IconVolume size={20} stroke={1.8} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex flex-col">
            <b className="text-apoyo font-bold">Sonido</b>
            <span className="text-nota text-secundario">
              {datos.sonido
                ? 'Suena al llegar un mensaje o un pedido en vivo. Nunca con ese chat abierto.'
                : 'Apagado: los mensajes y los pedidos en vivo llegan sin sonar.'}
            </span>
          </span>
        </span>
        <Interruptor
          etiqueta="Sonido"
          activo={datos.sonido}
          alCambiar={(activo) => void guardar({ ...datos, sonido: activo })}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-tinta px-4 py-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <b className="flex items-center gap-2 text-cuerpo font-bold">
            <IconMoon size={18} stroke={1.8} aria-hidden="true" />
            Horario silencioso
          </b>
          <Interruptor
            etiqueta="Horario silencioso"
            activo={callado}
            alCambiar={(activo) => void guardar({ ...datos, no_molestar: activo ? horario : null })}
          />
        </div>
        <p className="m-0 text-apoyo text-white/85">
          {callado
            ? `De ${legible(horario.desde)} a ${legible(horario.hasta)} no suena nada. Los avisos te esperan aquí en la mañana.`
            : 'Apagado: los avisos suenan a cualquier hora.'}
        </p>
        {callado && (
          <div className="flex flex-wrap items-center gap-3 text-apoyo">
            <label htmlFor={`${id}-desde`} className="flex items-center gap-2">
              Desde
              <input
                id={`${id}-desde`}
                type="time"
                step={300}
                value={horario.desde}
                onChange={(evento) => cambiarHora('desde', evento.target.value)}
                className="h-10 rounded-xl border border-white/30 bg-white/10 px-3 text-white [color-scheme:dark]"
              />
            </label>
            <label htmlFor={`${id}-hasta`} className="flex items-center gap-2">
              hasta
              <input
                id={`${id}-hasta`}
                type="time"
                step={300}
                value={horario.hasta}
                onChange={(evento) => cambiarHora('hasta', evento.target.value)}
                className="h-10 rounded-xl border border-white/30 bg-white/10 px-3 text-white [color-scheme:dark]"
              />
            </label>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <b className="text-apoyo font-bold">¿Por dónde te llegan?</b>
        <div className="flex gap-2">
          <span className="flex h-10 items-center rounded-full bg-tinta px-4 text-apoyo font-bold text-white">
            En la app
          </span>
          <span
            aria-disabled="true"
            className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium text-detalle"
          >
            SMS
          </span>
        </div>
        <span className="text-nota text-secundario">
          Por SMS solo llegan los de tu cuenta: aprobación y seguridad.
        </span>
      </div>
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
    </div>
  );
}
