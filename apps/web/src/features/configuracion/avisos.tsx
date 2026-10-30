'use client';

import type { RespuestaAvisosCuenta } from '@paselibre/contracts';
import { useEffect, useId, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Interruptor } from '@/shared/ui/interruptor';

const HORARIO_POR_DEFECTO = { desde: '22:00', hasta: '08:00' };

const campoHora =
  'h-11 rounded-xl border border-borde bg-white px-3 text-cuerpo text-tinta disabled:bg-superficie disabled:text-detalle';

/**
 * Configuración · Avisos (RF-59). Cada cambio se guarda al momento, como los interruptores
 * del lienzo: mensajes y, con En vivo encendido (D-53), los busco de lo que tienes publicado.
 * La columna de correo llega con RF-42.
 */
export function SeccionAvisos({ alAvisar }: { alAvisar: (mensaje: string) => void }) {
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
      setDatos(
        await llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos', { metodo: 'PUT', cuerpo: nuevos }),
      );
      alAvisar('Avisos guardados.');
    } catch (e) {
      setDatos(anteriores);
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar tus avisos.');
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
    <>
      <p className="-mt-2 text-secundario">Elige qué te avisamos en la campanita y cuándo.</p>
      <div className="overflow-hidden rounded-2xl border border-linea">
        <div className="flex items-center justify-between gap-4 border-b border-linea bg-superficie px-4 py-2.5 text-nota font-semibold text-detalle">
          <span>Aviso</span>
          <span>Campanita</span>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="flex flex-col">
            <b className="font-semibold">Mensajes nuevos</b>
            <span className="text-apoyo text-secundario">Cuando alguien te escribe</span>
          </span>
          <Interruptor
            etiqueta="Mensajes nuevos en la campanita"
            activo={datos.campanita.MENSAJE}
            alCambiar={(activo) =>
              void guardar({ ...datos, campanita: { ...datos.campanita, MENSAJE: activo } })
            }
          />
        </div>
        {datos.campanita.EN_VIVO !== undefined && (
          <div className="flex items-center justify-between gap-4 border-t border-linea px-4 py-3.5">
            <span className="flex flex-col">
              <b className="font-semibold">Pases del día</b>
              <span className="text-apoyo text-secundario">
                Cuando una tienda busca algo que tienes publicado
              </span>
            </span>
            <Interruptor
              etiqueta="Avisos de Pases del día en la campanita"
              activo={datos.campanita.EN_VIVO}
              alCambiar={(activo) =>
                void guardar({ ...datos, campanita: { ...datos.campanita, EN_VIVO: activo } })
              }
            />
          </div>
        )}
      </div>
      <p className="-mt-2 text-nota text-detalle">
        Apagarlo no apaga el chat: los mensajes siguen llegando a Mensajes. El aviso por correo
        llega más adelante.
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-linea px-4 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <b className="font-semibold">No molestar</b>
            <span className="text-apoyo text-secundario">
              En ese horario no suena la campanita; los avisos aparecen al terminar.
            </span>
          </span>
          <Interruptor
            etiqueta="No molestar"
            activo={callado}
            alCambiar={(activo) => void guardar({ ...datos, no_molestar: activo ? horario : null })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-apoyo">
          <label htmlFor={`${id}-desde`} className="flex items-center gap-2">
            Desde
            <input
              id={`${id}-desde`}
              type="time"
              step={300}
              disabled={!callado}
              value={horario.desde}
              onChange={(evento) => cambiarHora('desde', evento.target.value)}
              className={campoHora}
            />
          </label>
          <label htmlFor={`${id}-hasta`} className="flex items-center gap-2">
            hasta
            <input
              id={`${id}-hasta`}
              type="time"
              step={300}
              disabled={!callado}
              value={horario.hasta}
              onChange={(evento) => cambiarHora('hasta', evento.target.value)}
              className={campoHora}
            />
          </label>
          <span className="text-nota text-detalle">Hora de Lima</span>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
    </>
  );
}
