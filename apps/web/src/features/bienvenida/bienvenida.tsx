'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** Las cuatro pantallas del estilo B (OB_WebB, OB_CelB…OB_CelB4): un dibujo y su frase. */
const PANTALLAS: Array<{ titulo: string; texto: string; dibujo: ReactNode }> = [
  {
    titulo: 'Todo lo que buscas, en un solo lugar',
    texto:
      'El stock de todas las tiendas de Wilson, aquí. Sin ir stand por stand ni comparar Excels.',
    dibujo: <DibujoAntesAhora />,
  },
  {
    titulo: 'Cuando la venta no espera',
    texto: 'Ves quién lo tiene, en qué estado y a cuánto. Al instante, con el stock al día.',
    dibujo: <DibujoStock />,
  },
  {
    titulo: 'Tus precios, solo entre tiendas',
    texto: 'Aquí solo entran tiendas verificadas de Wilson. Un cliente final nunca ve tus precios.',
    dibujo: <DibujoPrecios />,
  },
  {
    titulo: '¿No lo encuentras? Pídelo en vivo',
    texto: 'Publica un «Busco» y las tiendas te responden en minutos.',
    dibujo: <DibujoBusco />,
  },
];

const tarjeta =
  'w-full max-w-[300px] rounded-2xl bg-white text-tinta shadow-[0_8px_24px_rgba(0,0,0,0.18)]';

function DibujoAntesAhora() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-1.5 px-3.5 py-3.5`}>
        <span className="text-etiqueta uppercase text-error">Antes</span>
        {[
          'Stand por stand: «¿tienes pase?»',
          'El Excel de cada tienda',
          'Comparar precios uno a uno',
        ].map((linea) => (
          <s key={linea} className="text-apoyo text-secundario">
            {linea}
          </s>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl bg-tinta px-3.5 py-3.5 text-white">
        <span className="text-etiqueta uppercase text-acento">Ahora</span>
        <span className="flex items-center gap-2.5 text-cuerpo font-bold">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          Todas las tiendas de Wilson, en un solo lugar
        </span>
      </div>
    </div>
  );
}

function DibujoStock() {
  const filas = [
    ['CGS', 'Nuevo · 4 disponibles', 'US$ 299'],
    ['Tienda F', 'Open box · 1 disponible', 'US$ 285'],
    ['MegaPC', 'Usado · 2 disponibles', 'US$ 260'],
  ];
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-2.5">
      <div className={`${tarjeta} flex flex-col`}>
        <b className="border-b border-linea px-3.5 py-3 text-cuerpo font-bold">
          RTX 4060 8 GB · 3 tiendas
        </b>
        {filas.map(([tienda, estado, precio]) => (
          <div
            key={tienda}
            className="flex items-center justify-between gap-3 border-b border-linea px-3.5 py-2.5 last:border-b-0"
          >
            <span className="flex flex-col">
              <b className="text-apoyo font-bold">{tienda}</b>
              <span className="text-nota text-secundario">{estado}</span>
            </span>
            <span className="rounded-full bg-tinta px-2.5 py-1 text-apoyo font-bold text-white">
              {precio}
            </span>
          </div>
        ))}
      </div>
      <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-nota font-bold text-marca">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-pase" />
        Stock al día · en segundos
      </span>
    </div>
  );
}

function DibujoPrecios() {
  return (
    <div className="flex w-full max-w-[300px] flex-col gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-2 px-3.5 py-3.5`}>
        <span className="text-etiqueta uppercase text-pase-texto">Lo que ve otra tienda</span>
        <b className="text-cuerpo font-bold">MSI RTX 3070 Ventus 3X</b>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-tinta px-2.5 py-1 text-cuerpo font-bold text-white">
            US$ 285
          </span>
          <span className="text-nota text-secundario">Tienda B · Stand 101</span>
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/60 px-3.5 py-3.5 text-white">
        <span className="text-etiqueta uppercase">Lo que ve un cliente</span>
        <span className="flex items-center gap-2 text-cuerpo font-bold">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Precio con sesión
        </span>
        <span className="text-nota">Ve que hay stock, pero nunca tu precio</span>
      </div>
    </div>
  );
}

function DibujoBusco() {
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-2.5">
      <div className={`${tarjeta} flex flex-col gap-1.5 px-3.5 py-3.5`}>
        <span className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-pase-medio px-2.5 py-1 text-nota font-bold text-marca">
            Busco
          </span>
          <span className="text-nota font-bold text-aviso">Termina en 1 h</span>
        </span>
        <b className="text-cuerpo font-bold">RTX 4060 8 GB</b>
        <span className="text-apoyo text-secundario">Pago hasta US$ 300</span>
      </div>
      <span className="flex w-full items-center gap-2.5 rounded-xl bg-contador px-3.5 py-3 text-apoyo font-bold text-tinta">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta" />3 tiendas dijeron «¡Lo
        tengo!»
      </span>
      <span className="text-nota font-bold text-white">en 6 minutos</span>
    </div>
  );
}

/**
 * La bienvenida del primer ingreso, estilo B (OB_WebB, OB_CelB): cuatro pantallas sobre el
 * verde de la marca, con «Saltar», puntos y «Atrás»/«Siguiente». Sale una sola vez: «Saltar»
 * o «¡Empezar!» lo guardan en la cuenta (`POST /v1/cuenta/bienvenida`). En la computadora es
 * una ventana encima del inicio; en el celular ocupa toda la pantalla.
 */
export function Bienvenida() {
  const [abierta, setAbierta] = useState(true);
  const [paso, setPaso] = useState(0);
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const ultimo = paso === PANTALLAS.length - 1;
  const pantalla = PANTALLAS[paso]!;

  useEffect(() => {
    const ventana = dialogo.current;
    if (abierta && ventana && !ventana.open) ventana.showModal();
  }, [abierta]);

  useEffect(() => {
    titulo.current?.focus();
  }, [paso]);

  function terminar() {
    setAbierta(false);
    dialogo.current?.close();
    llamarApi('/cuenta/bienvenida', { metodo: 'POST' }).catch(() => undefined);
  }

  if (!abierta) return null;
  return (
    <dialog
      ref={dialogo}
      aria-label="Bienvenida a PaseLibre"
      // Escape también cuenta como «Saltar».
      onCancel={terminar}
      className="m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent p-0 text-white backdrop:bg-tinta/55 md:m-auto md:h-auto md:max-h-[calc(100dvh-48px)] md:w-[560px]"
    >
      <div className="flex h-full flex-col gap-5 overflow-y-auto bg-[linear-gradient(170deg,#006B47_0%,#004D33_100%)] px-6 pb-6 pt-5 md:rounded-3xl md:px-6">
        <div className="flex items-center justify-between">
          <span className="text-nota font-bold text-pase-medio" aria-live="polite">
            {paso + 1} de {PANTALLAS.length}
          </span>
          <button
            type="button"
            onClick={terminar}
            className="h-10 rounded-full bg-white/15 px-4 text-apoyo font-bold text-white hover:bg-white/25"
          >
            Saltar
          </button>
        </div>

        <div className="flex min-h-[300px] flex-1 items-center justify-center rounded-3xl bg-white/10 px-5 py-10 md:min-h-[450px]">
          {pantalla.dibujo}
        </div>

        <div className="flex flex-col gap-2">
          <h2 ref={titulo} tabIndex={-1} className="text-[26px] font-bold leading-8 outline-none">
            {pantalla.titulo}
          </h2>
          <p className="text-cuerpo text-white/90">{pantalla.texto}</p>
        </div>

        <div className="flex justify-center gap-1.5" role="group" aria-label="Pantallas">
          {PANTALLAS.map((otra, indice) => (
            <button
              key={otra.titulo}
              type="button"
              aria-label={`Ir a la pantalla ${indice + 1}`}
              aria-current={indice === paso ? 'step' : undefined}
              onClick={() => setPaso(indice)}
              className="flex h-6 items-center"
            >
              <span
                className={`block h-2 rounded-full transition-[width] motion-reduce:transition-none ${
                  indice === paso ? 'w-[26px] bg-white' : 'w-2 bg-white/35'
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-2.5">
          {paso > 0 && (
            <button
              type="button"
              onClick={() => setPaso(paso - 1)}
              className="h-[52px] shrink-0 rounded-full border border-white/50 px-[22px] text-[16px] font-bold text-white hover:bg-white/10"
            >
              Atrás
            </button>
          )}
          <button
            type="button"
            onClick={ultimo ? terminar : () => setPaso(paso + 1)}
            className="h-[52px] flex-1 rounded-full bg-white px-5 text-[16px] font-bold text-marca hover:bg-pase-suave"
          >
            {ultimo ? '¡Empezar!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
