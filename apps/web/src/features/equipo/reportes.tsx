'use client';

import { type AccionReporte, type DetalleReporte, type ReporteEnCola } from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue, diaCorto, hora } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';

const ACCIONES: Array<[AccionReporte, string, string]> = [
  [
    'ESCRIBIR',
    'Escribirle a la tienda',
    'Chat oficial con la tienda. Sus publicaciones siguen activas.',
  ],
  ['ADVERTIR', 'Dar advertencia', 'Queda en su historial. Con 3, revisamos la cuenta.'],
  ['SUSPENDER', 'Suspender la tienda', 'Solo con estafa comprobada.'],
  ['NADA', 'Cerrar sin cambios', 'No encontramos nada que corregir.'],
];

const CONFIRMAR: Record<AccionReporte, string> = {
  ESCRIBIR: 'Escribirle',
  ADVERTIR: 'Enviar advertencia',
  SUSPENDER: 'Confirmar suspensión',
  NADA: 'Cerrar sin cambios',
};

function quedan(iso: string): string {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutos <= 0) return 'Venció el plazo';
  if (minutos < 60) return `Quedan ${minutos} min`;
  return `Quedan ${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

/**
 * «Por revisar · urgentes primero» (REP_WebEquipo, sección 20 del lienzo final): la cola a la
 * izquierda y el caso a la derecha con lo que envió, el chat adjunto, la tienda reportada y
 * «¿Qué hacemos?». A quien reportó le llega el resultado sin saber quién decidió.
 */
export function ColaReportes() {
  const [cola, setCola] = useState<ReporteEnCola[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleReporte | null>(null);
  const [accion, setAccion] = useState<AccionReporte | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargarCola = useCallback(async () => {
    const lista = await llamarApi<ReporteEnCola[]>('/equipo/reportes');
    setCola(lista);
    setElegido((actual) => actual ?? lista[0]?.id ?? null);
  }, []);
  useEffect(() => {
    void cargarCola().catch(() => setError('No pudimos cargar los reportes.'));
  }, [cargarCola]);
  useEffect(() => {
    if (!elegido) return;
    setDetalle(null);
    setAccion(null);
    setTexto('');
    setHecho(null);
    llamarApi<DetalleReporte>(`/equipo/reportes/${elegido}`).then(setDetalle, () =>
      setError('No pudimos abrir el reporte.'),
    );
  }, [elegido]);

  async function decidir() {
    if (!detalle || !accion) return;
    setEnviando(true);
    setError(null);
    try {
      const nuevo = await llamarApi<DetalleReporte>(`/equipo/reportes/${detalle.id}/decision`, {
        metodo: 'POST',
        cuerpo: { accion, ...(texto.trim() ? { texto: texto.trim() } : {}) },
      });
      setDetalle(nuevo);
      setHecho(nuevo.resolucion);
      await cargarCola();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardarlo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside
        aria-label="Reportes por revisar"
        className="flex flex-col overflow-hidden rounded-[24px] border border-linea bg-white"
      >
        <h1 className="m-0 border-b border-linea px-4 py-4 text-[19px] font-bold">
          Por revisar · urgentes primero
        </h1>
        {cola === null ? (
          <p className="m-0 px-4 py-6 text-secundario">Cargando…</p>
        ) : cola.length === 0 ? (
          <p className="m-0 px-4 py-6 text-secundario">No hay reportes por revisar. 🎉</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {cola.map((reporte) => (
              <li key={reporte.id}>
                <button
                  type="button"
                  aria-current={elegido === reporte.id ? 'true' : undefined}
                  onClick={() => setElegido(reporte.id)}
                  className={`flex w-full flex-col gap-1 border-b border-l-4 border-b-linea px-4 py-3.5 text-left ${
                    elegido === reporte.id
                      ? 'border-l-pase bg-pase-suave'
                      : 'border-l-transparent hover:bg-superficie'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-cuerpo font-bold">{reporte.motivo}</b>
                    {reporte.urgente && (
                      <span className="rounded-full bg-error-fondo px-2 py-0.5 text-nota font-bold text-error">
                        Urgente
                      </span>
                    )}
                  </span>
                  <span className="text-apoyo">{reporte.tienda ?? 'Sin tienda'}</span>
                  <span className="text-nota text-secundario">
                    {reporte.codigo} · {quedan(reporte.vence_en)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 px-4 py-3 text-nota text-secundario">
          Nunca pausamos publicaciones por un reporte: primero le escribimos a la tienda.
        </p>
      </aside>

      <section
        aria-label="El reporte"
        className="flex min-w-0 flex-col gap-5 rounded-[24px] border border-linea bg-white p-5 sm:p-6"
      >
        {error && (
          <p
            role="alert"
            className="m-0 rounded-xl bg-error-fondo px-3 py-2.5 text-apoyo text-error"
          >
            {error}
          </p>
        )}
        {!detalle ? (
          <p className="m-0 text-secundario">{elegido ? 'Cargando…' : 'Elige un reporte.'}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-apoyo text-secundario">
                {detalle.codigo} · {quedan(detalle.vence_en)}
              </span>
              <h2 className="text-[26px] font-bold leading-8">{detalle.motivo}</h2>
              <span className="text-cuerpo text-secundario">
                Reportada: <b className="font-bold text-tinta">{detalle.tienda ?? 'sin tienda'}</b>{' '}
                · Lo envió:{' '}
                <b className="font-bold text-tinta">
                  {detalle.denunciante.tienda ?? detalle.denunciante.nombre}
                </b>{' '}
                (solo lo ve el equipo) · {detalle.sobre}
              </span>
            </div>
            {detalle.texto && (
              <blockquote className="m-0 rounded-xl border-l-4 border-borde bg-superficie px-4 py-3 text-cuerpo">
                «{detalle.texto}»
              </blockquote>
            )}
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="flex flex-col gap-2">
                <b className="text-apoyo font-bold">Chat adjunto</b>
                {detalle.chat ? (
                  <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto rounded-2xl bg-superficie p-3">
                    {detalle.chat.map((mensaje) => (
                      <div
                        key={mensaje.id}
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-apoyo ${
                          mensaje.de_reportada ? 'self-start bg-white' : 'self-end bg-pase-medio'
                        }`}
                      >
                        {mensaje.texto ?? 'Foto'}
                        <span className="block text-right text-[11px] text-secundario">
                          {diaCorto(mensaje.creado_en)}, {hora(mensaje.creado_en)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 rounded-2xl bg-superficie p-4 text-apoyo text-secundario">
                    No adjuntó el chat.
                  </p>
                )}
              </div>
              {detalle.tienda_reportada && (
                <div className="flex flex-col gap-2">
                  <b className="text-apoyo font-bold">Sobre la tienda reportada</b>
                  <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-linea p-0 text-apoyo">
                    <li className="border-b border-linea px-4 py-3 font-bold">
                      {detalle.tienda_reportada.con_ruc
                        ? 'Verificada con RUC'
                        : 'Verificada sin RUC'}
                      {detalle.tienda_reportada.suspendida ? ' · suspendida' : ''}
                    </li>
                    <li className="border-b border-linea px-4 py-3 font-bold">
                      {detalle.tienda_reportada.estrellas !== null
                        ? `★ ${detalle.tienda_reportada.estrellas.toLocaleString('es-PE')} · `
                        : ''}
                      {conPlural(detalle.tienda_reportada.ventas, 'venta', 'ventas')} ·{' '}
                      {detalle.tienda_reportada.advertencias}{' '}
                      {detalle.tienda_reportada.advertencias === 1 ? 'advertencia' : 'advertencias'}{' '}
                      de 3
                      <span className="block text-nota font-normal text-secundario">
                        «1 de 3» cuenta advertencias que dio el Equipo después de revisar, no
                        reportes recibidos.
                      </span>
                    </li>
                    <li className="flex flex-col border-b border-linea px-4 py-3">
                      <b className="font-bold">
                        {detalle.tienda_reportada.reportes_antes.length === 0
                          ? 'Sin reportes antes'
                          : detalle.tienda_reportada.reportes_antes.length === 1
                            ? '1 reporte antes'
                            : `${detalle.tienda_reportada.reportes_antes.length} reportes antes`}
                      </b>
                      {detalle.tienda_reportada.reportes_antes.length > 0 && (
                        <span className="text-nota text-secundario">
                          {detalle.tienda_reportada.reportes_antes
                            .map(
                              (r) =>
                                `${r.motivo.toLowerCase()} (${diaCorto(r.fecha)}), ${r.estado}`,
                            )
                            .join(' · ')}
                        </span>
                      )}
                    </li>
                    <li className="flex flex-col px-4 py-3">
                      <b className="font-bold">En PaseLibre desde</b>
                      <span className="text-nota text-secundario">
                        {cuandoFue(detalle.tienda_reportada.desde)}
                      </span>
                    </li>
                  </ul>
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link
                      href={`/equipo/tiendas/${detalle.tienda_reportada.id}?pestana=conversaciones`}
                      className="text-apoyo font-bold text-pase-texto"
                    >
                      Ver el chat ›
                    </Link>
                    <Link
                      href={`/equipo/tiendas/${detalle.tienda_reportada.id}`}
                      className="text-apoyo font-bold text-pase-texto"
                    >
                      Ver la ficha de la tienda ›
                    </Link>
                  </span>
                </div>
              )}
            </div>

            {hecho || detalle.estado === 'REVISADA' || detalle.estado === 'DESCARTADA' ? (
              <p
                role="status"
                className="m-0 rounded-2xl bg-pase-suave px-4 py-3 text-apoyo font-bold text-marca"
              >
                {hecho ?? detalle.resolucion} Queda anotado quién decidió y cuándo.
                {detalle.tienda_reportada && (
                  <>
                    {' '}
                    <Link
                      href={`/equipo/chats?tienda=${detalle.tienda_reportada.id}`}
                      className="text-marca"
                    >
                      Ver el chat
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <b className="text-apoyo font-bold">¿Qué hacemos?</b>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {ACCIONES.map(([clave, titulo, ayuda]) => (
                    <button
                      key={clave}
                      type="button"
                      aria-pressed={accion === clave}
                      disabled={clave !== 'NADA' && !detalle.tienda_reportada}
                      onClick={() => setAccion(clave)}
                      className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-left disabled:opacity-50 ${
                        accion === clave
                          ? clave === 'SUSPENDER'
                            ? 'border-error bg-error-fondo'
                            : 'border-tinta'
                          : 'border-linea'
                      }`}
                    >
                      <b className="text-cuerpo font-bold">{titulo}</b>
                      <span className="text-nota text-secundario">{ayuda}</span>
                    </button>
                  ))}
                </div>
                {(accion === 'ESCRIBIR' || accion === 'ADVERTIR') && (
                  <label className="flex flex-col gap-1.5 text-apoyo font-bold">
                    Lo que le escribimos (opcional)
                    <textarea
                      rows={3}
                      value={texto}
                      maxLength={1000}
                      onChange={(evento) => setTexto(evento.target.value)}
                      placeholder="Si lo dejas vacío, le escribimos un mensaje tipo con el caso."
                      className="rounded-xl border border-borde px-3.5 py-3 text-cuerpo font-normal"
                    />
                  </label>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={!accion || enviando}
                    onClick={() => void decidir()}
                    className={`h-12 rounded-full px-6 font-bold text-white disabled:bg-borde ${
                      accion === 'SUSPENDER' ? 'bg-error' : 'bg-tinta'
                    }`}
                  >
                    {enviando ? 'Guardando…' : accion ? CONFIRMAR[accion] : 'Elige qué hacer'}
                  </button>
                  <span className="text-nota text-secundario">
                    Queda anotado quién decidió y cuándo.
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
