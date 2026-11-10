'use client';

import type { ComunicadoEnviado, GaleriaResumen } from '@paselibre/contracts';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';

/**
 * «Comunicados» (ADM_WebComunicados, sección 20 del lienzo final): un mensaje del equipo para
 * todas las tiendas o las de una galería. Llega a la campanita; los enviados quedan abajo.
 */
export function Comunicados() {
  const [galerias, setGalerias] = useState<GaleriaResumen[]>([]);
  const [enviados, setEnviados] = useState<ComunicadoEnviado[] | null>(null);
  const [para, setPara] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    llamarApi<GaleriaResumen[]>('/galerias').then(
      (lista) => setGalerias(lista.filter((g) => g.slug !== 'independientes')),
      () => undefined,
    );
    llamarApi<ComunicadoEnviado[]>('/equipo/comunicados').then(setEnviados, () => setEnviados([]));
  }, []);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const nuevo = await llamarApi<ComunicadoEnviado>('/equipo/comunicados', {
        metodo: 'POST',
        cuerpo: { titulo, texto, ...(para ? { galeria: para } : {}) },
      });
      setEnviados((antes) => [nuevo, ...(antes ?? [])]);
      setAviso(
        `Enviado a ${nuevo.enviados} ${nuevo.enviados === 1 ? 'persona' : 'personas'} (${nuevo.para.toLowerCase()}).`,
      );
      setTitulo('');
      setTexto('');
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos enviarlo.');
    } finally {
      setEnviando(false);
    }
  }

  const chip = (activo: boolean) =>
    `h-10 rounded-full border px-4 text-apoyo ${activo ? 'border-tinta bg-tinta font-bold text-white' : 'border-borde bg-white font-medium'}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Comunicados</h1>
        <span className="text-secundario">Un mensaje del equipo para muchas tiendas a la vez.</span>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex flex-col gap-4 rounded-[24px] border border-linea bg-white p-5 sm:p-6">
          <h2 className="text-[19px] font-bold">Nuevo comunicado</h2>
          <div className="flex flex-col gap-2">
            <b className="text-apoyo font-bold">¿Para quién?</b>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={para === ''}
                onClick={() => setPara('')}
                className={chip(para === '')}
              >
                Todas las tiendas
              </button>
              {galerias.map((galeria) => (
                <button
                  key={galeria.slug}
                  type="button"
                  aria-pressed={para === galeria.slug}
                  onClick={() => setPara(galeria.slug)}
                  className={chip(para === galeria.slug)}
                >
                  {galeria.nombre}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-apoyo font-bold">
            Título
            <input
              value={titulo}
              maxLength={120}
              onChange={(evento) => setTitulo(evento.target.value)}
              placeholder="Corte de luz el sábado en la galería"
              className="h-11 rounded-xl border border-borde px-3.5 text-cuerpo font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-apoyo font-bold">
            Mensaje
            <textarea
              rows={4}
              value={texto}
              maxLength={600}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="La galería cierra a las 6 p. m. Los pedidos en vivo se cierran solos a esa hora."
              className="rounded-xl border border-borde px-3.5 py-3 text-cuerpo font-normal"
            />
          </label>
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
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={enviando || titulo.trim().length < 3 || texto.trim().length < 3}
              onClick={() => void enviar()}
              className="h-12 rounded-full bg-tinta px-6 font-bold text-white disabled:bg-borde"
            >
              {enviando ? 'Enviando…' : 'Enviar comunicado'}
            </button>
            <span className="text-nota text-secundario">
              Llega a la campanita de cada persona de esas tiendas.
            </span>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-[24px] border border-linea bg-white p-5">
          <h2 className="text-[19px] font-bold">Enviados</h2>
          {enviados === null ? (
            <p className="m-0 text-secundario">Cargando…</p>
          ) : enviados.length === 0 ? (
            <p className="m-0 text-apoyo text-secundario">Todavía no enviaron comunicados.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {enviados.map((comunicado) => (
                <li
                  key={comunicado.id}
                  className="flex flex-col gap-0.5 border-b border-linea py-3 last:border-0"
                >
                  <b className="text-apoyo font-bold">{comunicado.titulo}</b>
                  <span className="text-apoyo text-secundario">{comunicado.texto}</span>
                  <span className="text-nota text-detalle">
                    {comunicado.para} · {conPlural(comunicado.enviados, 'persona', 'personas')} ·{' '}
                    {comunicado.autor} · {cuandoFue(comunicado.fecha)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
