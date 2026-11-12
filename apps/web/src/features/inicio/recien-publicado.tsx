'use client';

import type { TarjetaOfertaConVendedor } from '@paselibre/contracts';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useRef, useState, type CSSProperties, type FocusEvent } from 'react';

import {
  flechasDeLaFila,
  hayMasQueElInicio,
  piezasDeLaFila,
  posicionAnterior,
  posicionParaVer,
  posicionSiguiente,
  repartirEnFilas,
  type PiezaFila,
} from './filas-recien';
import { TarjetaInicio } from './tarjetas';

/** «Recién llegados» (la de la cabecera): todo, de lo más nuevo a lo más antiguo. */
const TODAS = '/buscar?orden=recientes';
/** Desde aquí las filas tienen flecha y se corren solas (en el celular, con el dedo). */
const COMPUTADORA = '(min-width: 1024px)';

const flecha =
  'absolute top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-tinta text-white opacity-[0.35] shadow-[0_6px_18px_rgba(15,20,18,0.28)] transition-opacity duration-200 hover:bg-secundario focus-visible:opacity-100 group-hover/fila:opacity-100 motion-reduce:transition-none max-lg:hidden';

/**
 * «Recién publicado» del inicio normal (N15, docs/18 §5): 4 filas, cada una una tira propia con
 * hasta 18 (las 6 que se ven y 2 clics más). Se reparten por turnos: la 1, 5, 9… en la fila 1; la
 * 2, 6, 10… en la 2. En la computadora, cada fila tiene su flecha negra (transparente hasta que
 * el cursor pasa por la fila) y se corre sola; en el celular se desliza con el dedo. Si hay más
 * que las 72 del inicio, las filas llenas terminan en «Ver todas» y abajo sale el botón.
 */
export function RecienPublicado({
  tarjetas,
  total,
}: {
  tarjetas: TarjetaOfertaConVendedor[];
  total: number;
}) {
  if (tarjetas.length === 0) return null;
  const filas = repartirEnFilas(tarjetas);

  return (
    <section aria-labelledby="recien-publicado" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="recien-publicado"
            className="tit text-[22px] leading-7 max-sm:text-[19px] max-sm:leading-6"
          >
            Recién publicado
          </h2>
          <Link href={TODAS} className="shrink-0 text-apoyo font-extrabold text-marca underline">
            Ver {total === 1 ? 'la publicación' : `las ${total}`} ›
          </Link>
        </div>
        <span className="text-nota text-detalle">
          Lo más nuevo primero, mezclado entre tiendas.
        </span>
      </div>

      <div className="flex flex-col gap-3.5">
        {filas.map((fila, n) => (
          <FilaRecien
            key={n}
            numero={n + 1}
            piezas={piezasDeLaFila(fila, total)}
            total={total}
            prioridad={n === 0}
          />
        ))}
      </div>

      {hayMasQueElInicio(total) && (
        <div className="flex justify-center pt-1.5">
          <Link
            href={TODAS}
            className="inline-flex h-12 items-center gap-2.5 rounded-full border-[1.5px] border-tinta bg-white pl-[22px] pr-2.5 text-[15px] font-extrabold text-tinta no-underline hover:bg-fondo max-sm:w-full max-sm:justify-center"
          >
            Ver todas las publicaciones ({total})
            <span
              aria-hidden="true"
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-tinta text-white"
            >
              <IconChevronRight size={18} stroke={2.4} />
            </span>
          </Link>
        </div>
      )}
    </section>
  );
}

/**
 * Una fila: en la computadora se corre con `transform` (solo ella, 0,45 s) y las flechas salen
 * según lo que queda; en el celular es una tira con `scroll-snap` de tarjetas de 150 px, con un
 * pedazo de la siguiente a la vista.
 */
function FilaRecien({
  numero,
  piezas,
  total,
  prioridad,
}: {
  numero: number;
  piezas: PiezaFila<TarjetaOfertaConVendedor>[];
  total: number;
  prioridad: boolean;
}) {
  const ventana = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState(0);
  const { anterior, siguiente } = flechasDeLaFila(posicion, piezas.length);
  // Cada paso es una tarjeta más su hueco: (ancho de la fila + 14 px) / 6.
  const corrida = { '--corrida': `calc(${posicion} * (100% + 14px) / -6)` } as CSSProperties;

  // Con el tabulador, la tarjeta que recibe el foco tiene que verse: la fila se corre hasta ella
  // y se deshace el desplazamiento que el navegador le hace a la ventana para mostrarla.
  function alEnfocar(evento: FocusEvent<HTMLDivElement>) {
    if (!window.matchMedia(COMPUTADORA).matches) return;
    const indice = Number(
      (evento.target as HTMLElement).closest<HTMLElement>('[data-indice]')?.dataset.indice,
    );
    if (Number.isNaN(indice)) return;
    setPosicion((actual) => posicionParaVer(actual, indice, piezas.length));
    requestAnimationFrame(() => {
      if (ventana.current) ventana.current.scrollLeft = 0;
    });
  }

  return (
    <div className="group/fila relative">
      <div
        ref={ventana}
        onFocus={alEnfocar}
        className="-my-1 -ml-1 -mr-4 snap-x snap-mandatory scroll-pl-1 overflow-x-auto py-1 pl-1 pr-4 [scrollbar-width:none] sm:-mr-8 sm:pr-8 lg:-mr-1 lg:snap-none lg:overflow-hidden lg:pr-1 [&::-webkit-scrollbar]:hidden"
      >
        <ul
          aria-label={`Fila ${numero} de Recién publicado`}
          style={corrida}
          className="m-0 flex list-none gap-2.5 p-0 lg:gap-3.5 lg:[transform:translateX(var(--corrida))] lg:motion-safe:transition-transform lg:motion-safe:duration-[450ms] lg:motion-safe:ease-[cubic-bezier(0.22,0.8,0.3,1)]"
        >
          {piezas.map((pieza, i) => (
            <li
              key={pieza.tipo === 'tarjeta' ? pieza.tarjeta.oferta_id : 'ver-todas'}
              data-indice={i}
              className="w-[150px] shrink-0 snap-start lg:w-[calc((100%-70px)/6)]"
            >
              {pieza.tipo === 'tarjeta' ? (
                <TarjetaInicio tarjeta={pieza.tarjeta} prioridad={prioridad && i < 6} />
              ) : (
                <TarjetaVerTodas total={total} />
              )}
            </li>
          ))}
        </ul>
      </div>
      {anterior && (
        <button
          type="button"
          onClick={() => setPosicion(posicionAnterior)}
          aria-label="Ver las anteriores de esta fila"
          className={`${flecha} left-0 -translate-x-1/2`}
        >
          <IconChevronLeft size={24} stroke={2.4} aria-hidden="true" />
        </button>
      )}
      {siguiente && (
        <button
          type="button"
          onClick={() => setPosicion((actual) => posicionSiguiente(actual, piezas.length))}
          aria-label="Ver más de esta fila"
          className={`${flecha} right-0 translate-x-1/2`}
        >
          <IconChevronRight size={24} stroke={2.4} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** El final de una fila llena cuando hay más que las 72 del inicio. */
function TarjetaVerTodas({ total }: { total: number }) {
  return (
    <Link
      href={TODAS}
      className="flex h-full flex-col items-center justify-center gap-2.5 rounded-[18px] border-2 border-dashed border-[#7FD0A8] bg-pase-suave p-4 text-center text-marca no-underline hover:underline"
    >
      <span
        aria-hidden="true"
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-marca text-white"
      >
        <IconChevronRight size={26} stroke={2.6} />
      </span>
      <b className="text-[16px] leading-[21px]">Ver todas las publicaciones</b>
      <span className="text-[13px] leading-[18px] text-secundario">
        Hay {total} en Recién llegados
      </span>
    </Link>
  );
}
