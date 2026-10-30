'use client';

import {
  EVENTOS,
  MAX_EN_VIVO_POR_CUENTA,
  type EnVivoPropio,
  type RespuestaMisEnVivo,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { useEvento } from '@/shared/tiempo-real';
import { botonLista } from '@/shared/ui/estilos';

import { EtiquetaTipo } from './piezas';
import { cuantoQueda, textoCierre } from './textos';

function Propio({
  item,
  ahora,
  alCambiar,
}: {
  item: EnVivoPropio;
  ahora: number;
  alCambiar: (accion: 'sumar_hora' | 'cerrar') => void;
}) {
  const vivo = item.estado === 'VIVO';
  const respuestas = item.respuestas_recibidas.length;
  const resumen =
    item.tipo === 'FLASH'
      ? `${respuestas === 1 ? '1 interesado' : `${respuestas} interesados`} · vendiste ${item.vendidas}`
      : respuestas === 0
        ? `Nadie respondió aún · avisamos a ${item.avisadas} ${item.avisadas === 1 ? 'tienda' : 'tiendas'}`
        : `${respuestas} ${respuestas === 1 ? 'tienda respondió' : 'tiendas respondieron'}`;

  return (
    <li className="flex flex-col gap-2 border-t border-linea py-3 first:border-t-0">
      <span className="flex flex-wrap items-center gap-1.5">
        <EtiquetaTipo tipo={item.tipo} />
        <span className={`text-nota font-semibold ${vivo ? 'text-aviso' : 'text-detalle'}`}>
          {vivo ? cuantoQueda(item.vence_en, ahora) : textoCierre(item)}
        </span>
      </span>
      <b className="text-apoyo font-semibold">{item.titulo}</b>
      <span className="text-nota text-secundario">{resumen}</span>
      {respuestas > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {item.respuestas_recibidas.map((r) => (
            <li key={r.conversacion_id}>
              <Link href={`/mensajes/${r.conversacion_id}`} className="text-nota font-medium">
                Chat con {r.tienda}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {vivo && (
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => alCambiar('sumar_hora')} className={botonLista}>
            Sumar 1 hora
          </button>
          <button type="button" onClick={() => alCambiar('cerrar')} className={botonLista}>
            {item.tipo === 'BUSCO' ? 'Ya lo conseguí' : 'Cerrar remate'}
          </button>
        </span>
      )}
    </li>
  );
}

/** «Tus pases del día» (EV_Todos, RF-75): sumar una hora, cerrar y los chats de cada respuesta. */
export function LoTuyo({ ahora }: { ahora: number }) {
  const [datos, setDatos] = useState<RespuestaMisEnVivo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaMisEnVivo>('/en-vivo/mios'));
    } catch {
      setError('No pudimos cargar tus pases del día.');
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  useEvento(EVENTOS.enVivoCambio, () => void cargar());

  async function cambiar(id: string, accion: 'sumar_hora' | 'cerrar') {
    setError(null);
    try {
      await llamarApi(`/en-vivo/${id}`, { metodo: 'PATCH', cuerpo: { accion } });
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
  }

  const usados = datos ? MAX_EN_VIVO_POR_CUENTA - datos.disponibles : 0;
  return (
    <section
      aria-labelledby="lo-tuyo"
      className="flex flex-col gap-1 rounded-2xl border border-linea p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lo-tuyo" className="text-tarjeta">
          Tus pases del día
        </h2>
        {datos && (
          <span className="text-nota text-detalle">
            {usados} de {MAX_EN_VIVO_POR_CUENTA}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-nota text-error">
          {error}
        </p>
      )}
      {datos && datos.en_vivo.length === 0 && datos.cerrados_hoy.length === 0 && (
        <p className="text-apoyo text-secundario">
          Publica lo que necesitas para un cliente o lo que quieres rematar hoy.
        </p>
      )}
      {datos && (
        <ul className="flex flex-col">
          {[...datos.en_vivo, ...datos.cerrados_hoy].map((item) => (
            <Propio
              key={item.id}
              item={item}
              ahora={ahora}
              alCambiar={(accion) => void cambiar(item.id, accion)}
            />
          ))}
        </ul>
      )}
      <p className="pt-1 text-nota text-detalle">
        Cada respuesta llega a tu chat y a la campanita.
      </p>
    </section>
  );
}
