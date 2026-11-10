'use client';

import {
  FILTROS_TIENDAS_PANEL,
  type DetalleTiendaPanel,
  type TiendaEnPanel,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { conPlural } from '@/shared/plural';

const FILTROS: Record<(typeof FILTROS_TIENDAS_PANEL)[number], string> = {
  todas: 'Todas',
  activas: 'Activas',
  advertidas: 'Con advertencias',
  suspendidas: 'Suspendidas',
};

const MOTIVOS_ADVERTENCIA = [
  'Publicó un estado que no era',
  'Pidió adelanto antes de ver el producto',
  'Mal trato con otra tienda',
  'Precio distinto al publicado',
];

/**
 * «Tiendas» del panel (ADM_WebTiendas, sección 20 del lienzo final): buscar y filtrar; al tocar
 * una, sus datos, advertencias y reportes, y «Escribirle», «Advertencia» o «Suspender».
 */
export function TiendasPanel() {
  const busqueda = useSearchParams();
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<(typeof FILTROS_TIENDAS_PANEL)[number]>('todas');
  const [lista, setLista] = useState<TiendaEnPanel[] | null>(null);
  const [elegida, setElegida] = useState<string | null>(busqueda.get('tienda'));
  const [detalle, setDetalle] = useState<DetalleTiendaPanel | null>(null);
  const [modo, setModo] = useState<'nada' | 'advertir' | 'suspender'>('nada');
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const espera = setTimeout(() => {
      llamarApi<TiendaEnPanel[]>(
        `/equipo/panel/tiendas?filtro=${filtro}&q=${encodeURIComponent(q)}`,
      ).then(
        (respuesta) => {
          setLista(respuesta);
          setElegida((actual) => actual ?? respuesta[0]?.id ?? null);
        },
        () => setError('No pudimos cargar las tiendas.'),
      );
    }, 250);
    return () => clearTimeout(espera);
  }, [q, filtro]);

  const cargarDetalle = useCallback(async (id: string) => {
    setDetalle(await llamarApi<DetalleTiendaPanel>(`/equipo/panel/tiendas/${id}`));
  }, []);
  useEffect(() => {
    if (!elegida) return;
    setModo('nada');
    setMotivo('');
    void cargarDetalle(elegida).catch(() => setError('No pudimos abrir la tienda.'));
  }, [elegida, cargarDetalle]);

  async function confirmar() {
    if (!detalle) return;
    setError(null);
    try {
      if (modo === 'advertir') {
        await llamarApi(`/equipo/panel/tiendas/${detalle.id}/advertencia`, {
          metodo: 'POST',
          cuerpo: { motivo },
        });
        setAviso(`Advertencia enviada a ${detalle.nombre} por el chat oficial.`);
      } else {
        await llamarApi(`/equipo/panel/tiendas/${detalle.id}/suspension`, {
          metodo: 'POST',
          cuerpo: { suspender: !detalle.suspendida, ...(motivo ? { motivo } : {}) },
        });
        setAviso(
          detalle.suspendida
            ? `${detalle.nombre} está activa de nuevo.`
            : `Suspendiste a ${detalle.nombre}.`,
        );
      }
      setModo('nada');
      setMotivo('');
      await cargarDetalle(detalle.id);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardarlo.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Tiendas</h1>
        <span className="text-secundario">
          Todas las tiendas de PaseLibre. Toca una para ver su historial y qué hacer.
        </span>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="flex flex-col gap-3 rounded-[24px] border border-linea bg-white p-4">
          <label className="flex flex-col gap-1.5 text-apoyo font-bold">
            Buscar tienda
            <input
              value={q}
              onChange={(evento) => setQ(evento.target.value)}
              placeholder="Buscar por nombre, galería o stand"
              className="h-11 rounded-full border border-borde px-4 text-cuerpo font-normal"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {FILTROS_TIENDAS_PANEL.map((clave) => (
              <button
                key={clave}
                type="button"
                aria-pressed={filtro === clave}
                onClick={() => setFiltro(clave)}
                className={`h-9 rounded-full border px-3.5 text-apoyo ${
                  filtro === clave
                    ? 'border-tinta bg-tinta font-bold text-white'
                    : 'border-borde bg-white font-medium'
                }`}
              >
                {FILTROS[clave]}
              </button>
            ))}
          </div>
          <span className="text-nota text-secundario">
            {lista ? conPlural(lista.length, 'tienda', 'tiendas') : 'Cargando…'}
          </span>
          <ul className="m-0 flex max-h-[620px] list-none flex-col overflow-y-auto p-0">
            {lista?.map((tienda) => (
              <li key={tienda.id}>
                <button
                  type="button"
                  aria-current={elegida === tienda.id ? 'true' : undefined}
                  onClick={() => setElegida(tienda.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left ${
                    elegida === tienda.id ? 'bg-pase-suave' : 'hover:bg-superficie'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tinta text-nota font-bold text-white"
                  >
                    {iniciales(tienda.nombre)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-apoyo font-bold">{tienda.nombre}</b>
                    <span className="truncate text-nota text-secundario">
                      {[
                        tienda.galeria ?? 'Independiente',
                        tienda.stand && `Stand ${tienda.stand}`,
                        tienda.con_ruc ? 'con RUC' : 'sin RUC',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-nota">
                    {tienda.suspendida ? (
                      <span className="rounded-full bg-error-fondo px-2 font-bold text-error">
                        Suspendida
                      </span>
                    ) : tienda.advertencias > 0 ? (
                      <span className="rounded-full bg-aviso-fondo px-2 font-bold text-aviso">
                        {tienda.advertencias} adv.
                      </span>
                    ) : null}
                    {tienda.reportes > 0 && (
                      <span className="text-secundario">{tienda.reportes} rep.</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4 rounded-[24px] border border-linea bg-white p-5 sm:p-6">
          {aviso && (
            <p
              role="status"
              className="m-0 rounded-xl bg-pase-suave px-3.5 py-2.5 text-apoyo font-bold text-marca"
            >
              {aviso}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
            >
              {error}
            </p>
          )}
          {!detalle ? (
            <p className="m-0 text-secundario">{elegida ? 'Cargando…' : 'Elige una tienda.'}</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-tinta text-[18px] font-bold text-white"
                >
                  {iniciales(detalle.nombre)}
                </span>
                <span className="flex flex-col">
                  <h2 className="text-[24px] font-bold leading-7">{detalle.nombre}</h2>
                  <span className="text-apoyo text-secundario">
                    {detalle.suspendida ? 'Suspendida' : 'Activa'} ·{' '}
                    {detalle.con_ruc ? 'Verificada con RUC' : 'Verificada sin RUC'}
                  </span>
                </span>
              </div>
              <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ['Galería', detalle.galeria ?? 'Independiente'],
                  [
                    'Stand',
                    [detalle.piso && `Piso ${detalle.piso}`, detalle.stand]
                      .filter(Boolean)
                      .join(' · ') || '—',
                  ],
                  ['WhatsApp', detalle.whatsapp],
                  ['Horario', detalle.horario ?? '—'],
                  ['Cuentas', String(detalle.cuentas)],
                  [
                    'Publicaciones',
                    `${detalle.publicaciones} · ${conPlural(detalle.ventas, 'venta', 'ventas')}`,
                  ],
                  ['En PaseLibre desde', cuandoFue(detalle.desde)],
                ].map(([clave, valor]) => (
                  <div key={clave} className="flex flex-col rounded-xl bg-superficie px-3 py-2.5">
                    <dt className="text-nota text-secundario">{clave}</dt>
                    <dd className="m-0 text-apoyo font-bold">{valor}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2 text-apoyo">
                <b className="font-bold">Advertencias</b>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={`h-3 w-3 rounded-full ${i < detalle.advertencias ? 'bg-aviso' : 'bg-linea'}`}
                  />
                ))}
                <span className="text-secundario">
                  {detalle.advertencias} de 3 · {detalle.reportes}{' '}
                  {detalle.reportes === 1 ? 'reporte' : 'reportes'}
                </span>
              </div>
              {detalle.historial.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-apoyo">
                  {detalle.historial.slice(0, 8).map((fila) => (
                    <li
                      key={`${fila.tipo}-${fila.fecha}`}
                      className="flex justify-between gap-3 border-b border-linea pb-1.5"
                    >
                      <span>{fila.texto}</span>
                      <span className="shrink-0 text-nota text-secundario">
                        {cuandoFue(fila.fecha)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {modo === 'nada' ? (
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/equipo/chats?tienda=${detalle.id}`}
                    className="flex h-11 items-center rounded-full bg-tinta px-5 text-apoyo font-bold text-white no-underline"
                  >
                    Escribirle
                  </Link>
                  {!detalle.suspendida && (
                    <button
                      type="button"
                      onClick={() => setModo('advertir')}
                      className="h-11 rounded-full border border-borde px-5 text-apoyo font-bold"
                    >
                      Advertencia
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setModo('suspender')}
                    className={`h-11 rounded-full px-5 text-apoyo font-bold ${
                      detalle.suspendida ? 'bg-pase text-white' : 'border border-error text-error'
                    }`}
                  >
                    {detalle.suspendida ? 'Reactivar' : 'Suspender'}
                  </button>
                </div>
              ) : (
                <div
                  className={`flex flex-col gap-3 rounded-2xl p-4 ${modo === 'suspender' && !detalle.suspendida ? 'bg-error-fondo' : 'bg-superficie'}`}
                >
                  <b className="text-cuerpo font-bold">
                    {modo === 'advertir'
                      ? '¿Por qué la advertencia?'
                      : detalle.suspendida
                        ? `¿Reactivar a ${detalle.nombre}?`
                        : 'Suspender es lo último'}
                  </b>
                  <span className="text-apoyo text-secundario">
                    {modo === 'advertir'
                      ? 'Le llega al chat oficial. Sus publicaciones siguen activas. Con 3, revisamos la cuenta.'
                      : detalle.suspendida
                        ? 'Vuelve a entrar y sus publicaciones se ven otra vez.'
                        : 'No puede publicar y sus publicaciones dejan de verse. Solo con estafa comprobada, suplantación o 3 advertencias.'}
                  </span>
                  {modo === 'advertir' && (
                    <div className="flex flex-wrap gap-2">
                      {MOTIVOS_ADVERTENCIA.map((opcion) => (
                        <button
                          key={opcion}
                          type="button"
                          aria-pressed={motivo === opcion}
                          onClick={() => setMotivo(opcion)}
                          className={`h-9 rounded-full border px-3.5 text-apoyo ${
                            motivo === opcion
                              ? 'border-tinta bg-tinta font-bold text-white'
                              : 'border-borde bg-white'
                          }`}
                        >
                          {opcion}
                        </button>
                      ))}
                    </div>
                  )}
                  <input
                    value={motivo}
                    onChange={(evento) => setMotivo(evento.target.value)}
                    maxLength={200}
                    placeholder={
                      modo === 'advertir' ? 'O escribe el motivo' : 'Motivo (queda anotado)'
                    }
                    className="h-11 rounded-xl border border-borde bg-white px-3.5 text-cuerpo"
                  />
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={modo === 'advertir' && motivo.trim().length < 3}
                      onClick={() => void confirmar()}
                      className={`h-11 rounded-full px-5 text-apoyo font-bold text-white disabled:bg-borde ${
                        modo === 'suspender' && !detalle.suspendida ? 'bg-error' : 'bg-tinta'
                      }`}
                    >
                      {modo === 'advertir'
                        ? 'Enviar advertencia'
                        : detalle.suspendida
                          ? 'Reactivar'
                          : 'Confirmar suspensión'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModo('nada')}
                      className="h-11 rounded-full px-4 text-apoyo font-bold text-secundario"
                    >
                      Cancelar
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
