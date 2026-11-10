'use client';

import type { RespuestaOpiniones } from '@paselibre/contracts';
import { IconCheck, IconStarFilled } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';

import { decimal, Estrellas } from './perfil-tienda';

const FILTROS: Array<[string, string]> = [
  ['todas', 'Todas'],
  ['con_respuesta', 'Con respuesta'],
  ['cinco', '5 ★'],
  ['bajas', 'Bajas'],
];

/** «Hoy», «Ayer», «3 nov»: como en las opiniones del lienzo. */
const DIA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'short',
});
function cuando(iso: string): string {
  const dia = haceCuanto(iso);
  return dia === 'Hoy' || dia === 'Ayer' ? dia : DIA.format(new Date(iso)).replace('.', '');
}

/**
 * Las opiniones de una tienda (SG_WebOpiniones): a la izquierda el promedio con cuántas hay de
 * cada estrella y «Lo que dicen las tiendas»; a la derecha los filtros y cada opinión con
 * «Compra verificada», el producto y la respuesta. La tienda opinada responde desde aquí.
 */
export function ListaOpiniones({
  datos,
  tienda,
  alFiltrar,
}: {
  datos: RespuestaOpiniones;
  tienda: string;
  alFiltrar: (filtro: string) => void;
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState('todas');
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { reputacion, distribucion, aspectos, opiniones } = datos;
  const maximo = Math.max(1, ...distribucion.map((fila) => fila.cantidad));

  async function responder(id: string) {
    setError(null);
    try {
      await llamarApi(`/opiniones/${id}/respuesta`, { metodo: 'POST', cuerpo: { texto } });
      setRespondiendo(null);
      setTexto('');
      alFiltrar(filtro);
      router.refresh();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar tu respuesta.');
    }
  }

  if (reputacion.opiniones === 0) {
    return (
      <div className="flex max-w-[560px] flex-col gap-2 py-6">
        <b className="text-tarjeta">Todavía no tiene opiniones</b>
        <span className="text-secundario">
          Solo puede opinar una tienda que le compró: la venta se marca en el chat.
        </span>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 pb-8 lg:grid-cols-[440px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <div className="flex gap-6 rounded-[20px] border border-linea p-4">
          <div className="flex flex-col gap-1.5">
            <b className="text-[44px] font-bold leading-[48px]">
              {reputacion.promedio !== null ? decimal(reputacion.promedio) : '—'}
            </b>
            {reputacion.promedio !== null && <Estrellas valor={reputacion.promedio} />}
            <span className="text-nota text-secundario">
              {reputacion.opiniones === 1 ? '1 opinión' : `${reputacion.opiniones} opiniones`} ·{' '}
              {reputacion.ventas === 1 ? '1 venta' : `${reputacion.ventas} ventas`}
            </span>
          </div>
          <ul className="m-0 flex flex-1 list-none flex-col gap-1.5 p-0 text-nota">
            {distribucion.map((fila) => (
              <li key={fila.estrellas} className="flex items-center gap-2">
                <span className="flex w-7 items-center gap-0.5">
                  {fila.estrellas}
                  <IconStarFilled size={11} aria-hidden="true" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-superficie">
                  <span
                    className="block h-full rounded-r-full bg-[#F59E0B]"
                    style={{ width: `${Math.round((fila.cantidad / maximo) * 100)}%` }}
                  />
                </span>
                <span className="w-6 text-right text-secundario">{fila.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>

        {aspectos.length > 0 && (
          <div className="flex flex-col gap-3 rounded-[20px] border border-linea p-4">
            <b className="text-cuerpo font-bold">Lo que dicen las tiendas</b>
            {aspectos.map((aspecto) => (
              <div key={aspecto.aspecto} className="flex flex-col gap-1.5">
                <span className="flex justify-between text-apoyo">
                  {aspecto.aspecto}
                  <b className="font-bold">{aspecto.porcentaje} %</b>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-superficie">
                  <span
                    className="block h-full rounded-full bg-pase"
                    style={{ width: `${aspecto.porcentaje}%` }}
                  />
                </span>
              </div>
            ))}
            <span className="text-nota text-secundario">
              De cada 100 compras, en cuántas lo marcaron.
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div
          className="flex gap-2 overflow-x-auto [scrollbar-width:none]"
          role="group"
          aria-label="Filtrar opiniones"
        >
          {FILTROS.map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              aria-pressed={filtro === clave}
              onClick={() => {
                setFiltro(clave);
                alFiltrar(clave);
              }}
              className={`h-[34px] shrink-0 rounded-full border px-3.5 text-nota ${
                filtro === clave
                  ? 'border-tinta bg-tinta font-bold text-white'
                  : 'border-borde bg-white font-medium text-tinta'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {opiniones.length === 0 && (
          <p className="py-4 text-secundario">Ninguna opinión con ese filtro.</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {opiniones.map((opinion) => (
            <li
              key={opinion.id}
              className="flex flex-col gap-2.5 rounded-[18px] border border-linea p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pase-medio text-nota font-bold text-marca"
                  >
                    {opinion.autor.iniciales}
                  </span>
                  <span className="flex flex-col">
                    <b className="font-bold">{opinion.autor.nombre}</b>
                    <span className="text-nota text-secundario">
                      {[opinion.autor.galeria, cuando(opinion.creada_en)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </span>
                <Estrellas valor={opinion.estrellas} tamano={16} />
              </div>
              <span className="flex flex-wrap gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-pase-suave px-2.5 text-[12px] font-bold leading-6 text-marca">
                  <IconCheck size={12} stroke={2.4} aria-hidden="true" />
                  Compra verificada
                </span>
                {opinion.producto && (
                  <span className="rounded-full bg-superficie px-2.5 text-[12px] font-semibold leading-6 text-secundario">
                    {opinion.producto}
                  </span>
                )}
              </span>
              {opinion.texto && <p className="m-0 text-cuerpo">{opinion.texto}</p>}
              {opinion.aspectos.length > 0 && (
                <span className="text-nota text-secundario">{opinion.aspectos.join(' · ')}</span>
              )}
              {opinion.respuesta ? (
                <div className="rounded-xl border-l-[3px] border-pase bg-superficie px-3.5 py-2.5">
                  <b className="text-nota font-bold">Respuesta de {tienda}</b>
                  <p className="m-0 text-apoyo text-secundario">{opinion.respuesta}</p>
                </div>
              ) : (
                datos.puede_responder &&
                (respondiendo === opinion.id ? (
                  <form
                    onSubmit={(evento) => {
                      evento.preventDefault();
                      void responder(opinion.id);
                    }}
                    className="flex flex-col gap-2"
                  >
                    <label className="flex flex-col gap-1.5 text-apoyo font-semibold">
                      Tu respuesta (se ve en tu perfil)
                      <textarea
                        value={texto}
                        onChange={(evento) => setTexto(evento.target.value)}
                        rows={2}
                        maxLength={500}
                        className="rounded-xl border border-borde px-3.5 py-2.5 font-normal"
                      />
                    </label>
                    {error && (
                      <p role="alert" className="text-apoyo text-error">
                        {error}
                      </p>
                    )}
                    <span className="flex gap-2">
                      <button
                        type="submit"
                        disabled={texto.trim().length < 2}
                        className="h-10 rounded-full bg-pase px-4 text-apoyo font-bold text-white disabled:opacity-60"
                      >
                        Responder
                      </button>
                      <button
                        type="button"
                        onClick={() => setRespondiendo(null)}
                        className="h-10 rounded-full px-3 text-apoyo font-semibold"
                      >
                        Cancelar
                      </button>
                    </span>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRespondiendo(opinion.id);
                      setTexto('');
                    }}
                    className="h-9 self-start text-apoyo font-bold text-pase-texto underline"
                  >
                    Responder
                  </button>
                ))
              )}
            </li>
          ))}
        </ul>
        <span className="text-nota text-secundario">
          Solo puede opinar una tienda que le compró: la venta se marcó en el chat.
        </span>
      </div>
    </div>
  );
}
