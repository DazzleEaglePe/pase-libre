'use client';

import type { CategoriaAviso, RespuestaAvisos } from '@paselibre/contracts';
import { EVENTOS } from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { useAgrupado } from '@/shared/agrupar';
import { conAvisoLeido, marcarAvisosVistos, useAvisoLeido } from '@/shared/avisos-leidos';
import { useEvento } from '@/shared/tiempo-real';

import { ConfigurarAvisos } from './configurar';
import { FiltrosAvisos, ListaAvisos } from './lista-avisos';

/**
 * «Avisos» (AV_Web, AV_Cel): todos los avisos con sus filtros y, a la derecha (en el celular,
 * abajo con «Configurar»), qué te avisamos y cuándo. Se actualiza solo cuando llega algo.
 */
export function PaginaAvisos() {
  const [filtro, setFiltro] = useState<CategoriaAviso | 'TODOS'>('TODOS');
  const [datos, setDatos] = useState<RespuestaAvisos | null>(null);
  const [configurar, setConfigurar] = useState(false);

  const cargar = useCallback(() => {
    const consulta = filtro === 'TODOS' ? '?limite=60' : `?limite=60&categoria=${filtro}`;
    llamarApi<RespuestaAvisos>(`/avisos${consulta}`).then(setDatos, () => undefined);
  }, [filtro]);
  useEffect(cargar, [cargar]);
  const agrupado = useAgrupado(cargar);
  useEvento(EVENTOS.avisoNuevo, agrupado);
  // Abrir un chat en otra pestaña (o tocar un aviso allá) también lo marca leído aquí.
  useEvento(EVENTOS.contadores, agrupado);
  useAvisoLeido(useCallback((leido) => setDatos((actuales) => conAvisoLeido(actuales, leido)), []));

  useEffect(() => {
    if (window.location.hash === '#configurar') setConfigurar(true);
    // En el celular la campanita lleva aquí: abrir la página cuenta como abrirla (doc 19, 15).
    marcarAvisosVistos();
  }, []);

  async function marcarTodo() {
    await llamarApi('/avisos/leidos', { metodo: 'POST', cuerpo: {} });
    cargar();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-titulo">Avisos</h1>
          <span className="text-apoyo text-secundario">
            <b className="font-bold text-tinta">{datos?.sin_leer ?? 0}</b> sin leer
          </span>
        </div>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfigurar(!configurar)}
            aria-expanded={configurar}
            className="h-10 rounded-full border border-borde px-4 text-apoyo font-bold lg:hidden"
          >
            Configurar
          </button>
          {(datos?.sin_leer ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => void marcarTodo()}
              className="h-10 rounded-full border border-tinta px-4 text-apoyo font-bold"
            >
              Marcar todo como leído
            </button>
          )}
        </span>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <FiltrosAvisos datos={datos} elegido={filtro} alElegir={setFiltro} />
          <div className="overflow-hidden rounded-[20px] border border-linea">
            {datos === null ? (
              <p className="px-4 py-6 text-secundario">Cargando…</p>
            ) : datos.avisos.length === 0 ? (
              <div className="flex flex-col gap-1 px-5 py-10 text-center">
                <b className="text-tarjeta">No tienes avisos</b>
                <span className="text-apoyo text-secundario">
                  Cuando una tienda te responda, te califique o busque algo que tienes, te avisamos
                  aquí.
                </span>
              </div>
            ) : (
              <ListaAvisos avisos={datos.avisos} />
            )}
          </div>
        </div>

        <aside
          id="configurar"
          className={`scroll-mt-40 flex-col gap-3 rounded-[20px] border border-linea p-5 lg:flex ${configurar ? 'flex' : 'hidden'}`}
        >
          <h2 className="text-seccion">Configurar avisos</h2>
          <ConfigurarAvisos />
        </aside>
      </div>
    </div>
  );
}
