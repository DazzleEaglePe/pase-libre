'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { posicionDeLaFila, type PosicionFila } from './carrusel-medidas';

/** Hasta cuántas páginas se dibujan como puntos; con más (el celular), una barra de avance. */
const MAXIMO_DE_PUNTOS = 7;

const FLECHA = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-white';

interface Estado extends PosicionFila {
  /** Falso hasta que se midió la fila en el navegador: el servidor no sabe cuánto cabe. */
  medido: boolean;
}

const SIN_MEDIR: Estado = {
  medido: false,
  paginas: 1,
  pagina: 0,
  alInicio: true,
  alFinal: true,
  paso: 1,
  maximo: 0,
  visible: 1,
  avance: 0,
};

function leerFila(fila: HTMLUListElement): PosicionFila {
  const estilo = getComputedStyle(fila);
  return posicionDeLaFila({
    anchoTotal: fila.scrollWidth,
    anchoVisible: fila.clientWidth,
    desplazado: fila.scrollLeft,
    hueco: parseFloat(estilo.columnGap) || 0,
    relleno: (parseFloat(estilo.paddingLeft) || 0) + (parseFloat(estilo.paddingRight) || 0),
  });
}

const iguales = (a: Estado, b: Estado): boolean =>
  a.medido === b.medido &&
  a.paginas === b.paginas &&
  a.pagina === b.pagina &&
  a.alInicio === b.alInicio &&
  a.alFinal === b.alFinal &&
  a.visible === b.visible &&
  a.avance === b.avance;

/**
 * Una fila de tarjetas que se desliza (versión C del lienzo): flechas y puntos debajo, y lo
 * que sigue asoma a la derecha. En computadora caben 4, 3 o 2 por página; en el celular se
 * desliza con el dedo y la tarjeta siguiente queda a medio ver. Si todo cabe, no dibuja
 * flechas ni puntos. Cada hijo es una pieza de la fila.
 */
export function Carrusel({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  const fila = useRef<HTMLUListElement>(null);
  const cuadro = useRef(0);
  const [estado, setEstado] = useState<Estado>(SIN_MEDIR);

  const medir = useCallback(() => {
    if (!fila.current) return;
    const nuevo: Estado = { ...leerFila(fila.current), medido: true };
    setEstado((previo) => (iguales(previo, nuevo) ? previo : nuevo));
  }, []);

  /** Mide a lo sumo una vez por cuadro: el desplazamiento dispara muchos eventos seguidos. */
  const programar = useCallback(() => {
    if (cuadro.current) return;
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = 0;
      medir();
    });
  }, [medir]);

  useEffect(() => {
    const elemento = fila.current;
    if (!elemento) return;
    medir();
    const observador = new ResizeObserver(programar);
    observador.observe(elemento);
    return () => {
      observador.disconnect();
      if (cuadro.current) cancelAnimationFrame(cuadro.current);
      cuadro.current = 0;
    };
  }, [medir, programar]);

  const irA = (izquierda: number) => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    fila.current?.scrollTo({ left: izquierda, behavior: reducido ? 'auto' : 'smooth' });
  };
  const anterior = () => fila.current && irA(fila.current.scrollLeft - estado.paso);
  const siguiente = () => fila.current && irA(fila.current.scrollLeft + estado.paso);
  const irAPagina = (indice: number) => irA(Math.min(estado.maximo, indice * estado.paso));

  const conControles = !estado.medido || estado.paginas > 1;

  return (
    <div
      role="group"
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      className="flex flex-col gap-4"
    >
      <ul
        ref={fila}
        onScroll={programar}
        className="-m-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-1 p-1 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (pieza) => (
          <li className="flex shrink-0 grow-0 basis-[72%] snap-start sm:basis-[calc((100%-16px)/2)] md:basis-[calc((100%-32px)/3)] lg:basis-[calc((100%-48px)/4)] [&>*]:min-w-0 [&>*]:flex-1">
            {pieza}
          </li>
        ))}
      </ul>

      {conControles && (
        <div
          // Antes de medir ocupa su lugar sin verse, para que la página no salte cuando se miden las flechas.
          className={`flex min-h-11 items-center justify-center gap-4 ${estado.medido ? '' : 'invisible'}`}
        >
          <button
            type="button"
            aria-label="Ver anteriores"
            disabled={estado.alInicio}
            onClick={anterior}
            className={`${FLECHA} ${
              estado.alInicio
                ? 'cursor-default border-linea text-borde'
                : 'border-borde text-tinta hover:border-borde-control'
            }`}
          >
            <IconChevronLeft size={20} stroke={1.8} aria-hidden="true" />
          </button>

          {estado.paginas <= MAXIMO_DE_PUNTOS ? (
            <div role="group" aria-label="Páginas" className="flex items-center">
              {Array.from({ length: estado.paginas }, (_, indice) => {
                const actual = indice === estado.pagina;
                return (
                  <button
                    key={indice}
                    type="button"
                    aria-label={`Ir a la página ${indice + 1}`}
                    aria-current={actual ? 'true' : undefined}
                    onClick={() => irAPagina(indice)}
                    className="flex h-6 items-center justify-center px-1"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-2 rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                        actual ? 'w-6 bg-tinta' : 'w-2 bg-borde'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <div aria-hidden="true" className="relative h-1.5 w-40 rounded-full bg-linea">
              <span
                className="absolute inset-y-0 rounded-full bg-tinta"
                style={{
                  width: `${estado.visible * 100}%`,
                  left: `${estado.avance * (1 - estado.visible) * 100}%`,
                }}
              />
            </div>
          )}

          <button
            type="button"
            aria-label="Ver siguientes"
            disabled={estado.alFinal}
            onClick={siguiente}
            className={`${FLECHA} ${
              estado.alFinal
                ? 'cursor-default border-linea text-borde'
                : 'border-borde text-tinta hover:border-borde-control'
            }`}
          >
            <IconChevronRight size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {estado.paginas > 1 ? `Página ${estado.pagina + 1} de ${estado.paginas}` : ''}
      </p>
    </div>
  );
}
