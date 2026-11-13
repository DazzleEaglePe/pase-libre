'use client';

import { urlFoto } from '@paselibre/contracts';
import { useEffect, useRef } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';

import type { FotoFicha } from './fotos-ficha';

const FLECHA =
  'absolute top-1/2 flex h-[38px] w-[38px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-[22px] font-extrabold leading-none text-tinta shadow-[0_2px_8px_rgba(0,0,0,0.15)] hover:bg-pase-suave max-md:hidden';

const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Las fotos de la ficha (doc 20 · punto 23, tableros P61 y P64): la foto grande en blanco y
 * entera (`object-fit: contain`), con las flechas ‹ › a los lados y «1 / 4» abajo; debajo, las
 * miniaturas (la activa con borde verde). En el celular se desliza con el dedo y, en vez de
 * miniaturas, puntitos. Con una sola foto no hay flechas, ni contador, ni miniaturas.
 *
 * La foto grande es una fila que se desliza (`scroll-snap`): el dedo la mueve en el celular y
 * las flechas y las miniaturas la llevan a su lugar en la computadora.
 */
export function GaleriaFicha({
  fotos,
  categoria,
  actual,
  alCambiar,
}: {
  fotos: FotoFicha[];
  /** Slug de la categoría: su dibujo cuando no hay ninguna foto. */
  categoria: string;
  actual: number;
  alCambiar: (indice: number) => void;
}) {
  const pista = useRef<HTMLDivElement>(null);
  /** El cambio vino del dedo: la fila ya está ahí, no hay que moverla. */
  const delDedo = useRef(false);
  const total = fotos.length;
  const indice = Math.min(actual, Math.max(total - 1, 0));

  useEffect(() => {
    if (delDedo.current) {
      delDedo.current = false;
      return;
    }
    const fila = pista.current;
    if (!fila) return;
    fila.scrollTo?.({
      left: indice * fila.clientWidth,
      behavior: sinMovimiento() ? 'auto' : 'smooth',
    });
  }, [indice]);

  if (total === 0) {
    return (
      <Miniatura
        ruta={null}
        categoria={categoria}
        className="aspect-[4/3] w-full rounded-[20px] border-[1px] border-[#DDE4E0] max-md:aspect-[358/240]"
        glifo={240}
        grosor={0.8}
      />
    );
  }

  const ir = (destino: number) => alCambiar((destino + total) % total);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="relative">
        <div
          ref={pista}
          onScroll={(evento) => {
            const fila = evento.currentTarget;
            if (fila.clientWidth === 0) return;
            const cerca = Math.round(fila.scrollLeft / fila.clientWidth);
            if (cerca !== indice && cerca >= 0 && cerca < total) {
              delDedo.current = true;
              alCambiar(cerca);
            }
          }}
          className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[20px] border-[1px] border-[#DDE4E0] bg-foto-fondo [scrollbar-width:none] max-md:aspect-[358/240] [&::-webkit-scrollbar]:hidden"
        >
          {fotos.map((foto, posicion) => (
            <div
              key={foto.ruta}
              aria-hidden={posicion !== indice}
              className="flex h-full w-full shrink-0 snap-center items-center justify-center"
            >
              {/* Las fotos ya llegan en WebP y reducidas desde la API. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlFoto(foto.ruta)}
                alt={total > 1 ? `Foto ${posicion + 1} de ${total}` : ''}
                loading={posicion === 0 ? 'eager' : 'lazy'}
                fetchPriority={posicion === 0 ? 'high' : 'auto'}
                draggable={false}
                className="h-full w-full object-contain"
              />
            </div>
          ))}
        </div>
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => ir(indice - 1)}
              className={`${FLECHA} left-3`}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={() => ir(indice + 1)}
              className={`${FLECHA} right-3`}
            >
              <span aria-hidden="true">›</span>
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-3 right-3.5 inline-flex items-center whitespace-nowrap rounded-full bg-[rgba(15,20,18,0.7)] px-2.5 py-[3px] text-[12px] font-extrabold leading-4 text-white"
            >
              {indice + 1} / {total}
            </span>
          </>
        )}
      </div>

      {total > 1 && (
        <>
          {/* Computadora: las miniaturas, la primera es la portada de la tienda. */}
          <div role="tablist" aria-label="Fotos" className="flex flex-wrap gap-2.5 max-md:hidden">
            {fotos.map((foto, posicion) => (
              <button
                key={foto.ruta}
                type="button"
                role="tab"
                aria-selected={posicion === indice}
                aria-label={`Foto ${posicion + 1} de ${total}`}
                onClick={() => alCambiar(posicion)}
                className="flex flex-col items-center gap-1 p-0"
              >
                <span
                  className={`flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-xl bg-foto-fondo ${
                    posicion === indice
                      ? 'border-[3px] border-marca'
                      : 'border-[1.5px] border-[#DDE4E0] hover:border-borde-control'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlFoto(foto.ruta)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="text-[11px] leading-4 text-detalle">
                  {foto.origen === 'catalogo' ? 'Del catálogo' : 'De la tienda'}
                </span>
              </button>
            ))}
          </div>

          {/* Celular: puntitos en vez de miniaturas (se desliza con el dedo). */}
          <div aria-hidden="true" className="flex justify-center gap-1.5 md:hidden">
            {fotos.map((foto, posicion) => (
              <span
                key={foto.ruta}
                className={`h-[7px] w-[7px] rounded-full ${
                  posicion === indice ? 'bg-marca' : 'bg-borde'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
