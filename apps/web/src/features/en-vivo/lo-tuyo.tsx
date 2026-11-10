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

import { EtiquetaTipo } from './piezas';
import { terminaEn, textoCierre } from './textos';

const boton =
  'flex h-10 items-center rounded-full px-4 text-apoyo font-bold no-underline whitespace-nowrap';

function Propio({
  item,
  ahora,
  alCambiar,
}: {
  item: EnVivoPropio;
  ahora: number;
  alCambiar: (accion: 'sumar_hora' | 'cerrar') => void;
}) {
  const [verChats, setVerChats] = useState(false);
  const vivo = item.estado === 'VIVO';
  const respuestas = item.respuestas_recibidas.length;
  const resumen =
    item.tipo === 'FLASH'
      ? `${respuestas === 1 ? '1 interesado' : `${respuestas} interesados`} · vendiste ${item.vendidas} de ${item.cantidad + item.vendidas}`
      : respuestas === 0
        ? `Nadie respondió aún · avisamos a ${item.avisadas} ${item.avisadas === 1 ? 'tienda' : 'tiendas'}`
        : `${respuestas} ${respuestas === 1 ? 'tienda respondió' : 'tiendas respondieron'}`;

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-white p-4">
      <span className="flex items-center justify-between gap-2">
        <EtiquetaTipo tipo={item.tipo} />
        <span className={`text-nota font-bold ${vivo ? 'text-aviso' : 'text-detalle'}`}>
          {vivo ? terminaEn(item.vence_en, ahora) : textoCierre(item)}
        </span>
      </span>
      <b className="text-cuerpo font-bold">{item.titulo}</b>
      <span className="text-apoyo text-secundario">{resumen}</span>
      <span className="mt-1 flex flex-wrap gap-2">
        {respuestas > 0 && (
          <button
            type="button"
            aria-expanded={verChats}
            onClick={() => setVerChats(!verChats)}
            className={`${boton} bg-pase-suave text-marca`}
          >
            Ver chats ({respuestas})
          </button>
        )}
        {vivo && respuestas === 0 && (
          <button
            type="button"
            onClick={() => alCambiar('sumar_hora')}
            className={`${boton} border border-borde bg-white`}
          >
            Sumar 1 hora
          </button>
        )}
        {vivo && (
          <button
            type="button"
            onClick={() => alCambiar('cerrar')}
            className={`${boton} ${
              item.tipo === 'BUSCO' ? 'bg-tinta text-white' : 'border border-borde bg-white'
            }`}
          >
            {item.tipo === 'BUSCO' ? 'Ya lo conseguí' : 'Cerrar remate'}
          </button>
        )}
      </span>
      {verChats && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {item.respuestas_recibidas.map((respuesta) => (
            <li key={respuesta.conversacion_id}>
              <Link
                href={`/mensajes/${respuesta.conversacion_id}`}
                className="text-apoyo font-bold text-pase-texto"
              >
                Chat con {respuesta.tienda} ›
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * «Tus pedidos en vivo» (D_Pases, RF-75): sumar una hora, cerrar y los chats de cada
 * respuesta, en la columna gris de la derecha.
 */
export function LoTuyo({ ahora }: { ahora: number }) {
  const [datos, setDatos] = useState<RespuestaMisEnVivo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaMisEnVivo>('/en-vivo/mios'));
    } catch {
      setError('No pudimos cargar tus pedidos en vivo.');
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
      className="flex flex-col gap-3 rounded-[24px] bg-superficie p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lo-tuyo" className="text-[19px] font-bold">
          Tus pedidos en vivo
        </h2>
        {datos && (
          <span className="text-apoyo text-secundario">
            {usados} de {MAX_EN_VIVO_POR_CUENTA}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="m-0 text-nota text-error">
          {error}
        </p>
      )}
      {datos && datos.en_vivo.length === 0 && datos.cerrados_hoy.length === 0 && (
        <p className="m-0 rounded-2xl bg-white p-4 text-apoyo text-secundario">
          Publica lo que necesitas para un cliente o lo que quieres rematar hoy.{' '}
          <Link href="/pedidos-en-vivo/publicar" className="font-bold text-pase-texto">
            Publicar
          </Link>
        </p>
      )}
      {datos && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
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
      <p className="m-0 text-nota text-secundario">
        Hasta {MAX_EN_VIVO_POR_CUENTA} a la vez. Duran 1 h, 3 h o hasta el cierre de hoy. Cada
        respuesta llega a tu chat y a la campanita.
      </p>
    </section>
  );
}
