'use client';

import {
  RECIEN_POR_PAGINA,
  RECIEN_POR_PAGINA_CELULAR,
  type RespuestaRecienInicio,
  type TarjetaInicio as DatosTarjetaInicio,
} from '@paselibre/contracts';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

import {
  botonesDePaginas,
  desdeDe,
  paginaDe,
  paginasEnCelular,
  type BotonPagina,
} from './paginas-inicio';
import { TarjetaInicio } from './tarjetas';

/** «Ver todas las publicaciones»: la búsqueda sin filtro, de lo más nuevo a lo más antiguo. */
const TODAS = '/buscar?orden=recientes';

const circulo =
  'flex h-10 min-w-10 items-center justify-center rounded-full px-1 text-[15px] font-extrabold';

/** `‹ 1 2 3 … 7 Siguiente ›` (doc 20, punto 4). */
function Paginacion({
  actual,
  total,
  ocupada,
  alIr,
  className,
}: {
  actual: number;
  total: number;
  ocupada: boolean;
  alIr: (pagina: number) => void;
  className: string;
}) {
  if (total <= 1) return null;
  const botones: BotonPagina[] = botonesDePaginas(actual, total);
  return (
    <nav aria-label="Páginas del Inicio" className={`justify-center pt-1.5 ${className}`}>
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-1.5 p-0 sm:gap-2">
        {actual > 1 && (
          <li>
            <button
              type="button"
              disabled={ocupada}
              onClick={() => alIr(actual - 1)}
              aria-label="Página anterior"
              className={`${circulo} border-[1.5px] border-linea bg-white text-tinta hover:border-tinta`}
            >
              <IconChevronLeft size={18} stroke={2.4} aria-hidden="true" />
            </button>
          </li>
        )}
        {botones.map((boton) =>
          boton.tipo === 'puntos' ? (
            <li
              key={boton.clave}
              aria-hidden="true"
              className={`${circulo} border-[1.5px] border-linea bg-white text-tinta`}
            >
              …
            </li>
          ) : (
            <li key={boton.numero}>
              <button
                type="button"
                disabled={ocupada || boton.numero === actual}
                onClick={() => alIr(boton.numero)}
                aria-label={`Página ${boton.numero}`}
                aria-current={boton.numero === actual ? 'page' : undefined}
                className={`${circulo} ${
                  boton.numero === actual
                    ? 'bg-tinta text-white'
                    : 'border-[1.5px] border-linea bg-white text-tinta hover:border-tinta'
                }`}
              >
                {boton.numero}
              </button>
            </li>
          ),
        )}
        {actual < total && (
          <li>
            <button
              type="button"
              disabled={ocupada}
              onClick={() => alIr(actual + 1)}
              className="flex h-10 items-center gap-1 rounded-full border-[1.5px] border-tinta bg-white px-3.5 text-[14px] font-extrabold text-tinta hover:bg-fondo sm:px-4"
            >
              Siguiente
              <IconChevronRight size={16} stroke={2.6} aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

/**
 * El Inicio sin títulos (doc 20, puntos 4 y 22): una sola grilla de 5 por fila y 4 filas (20 por
 * página) con la paginación abajo y «Ver todas las publicaciones». En el celular, 2 por fila y 10
 * por página: cada página del celular es una mitad de la de la computadora, así que las dos
 * paginaciones están siempre y el CSS muestra la que toca (sin saltos al cargar). La página 1
 * llega con el inicio; las demás se piden al tocarlas y se guardan.
 */
export function GrillaInicio({
  primera,
  totalPaginas,
  enPaginas,
  total,
}: {
  primera: DatosTarjetaInicio[];
  totalPaginas: number;
  /** Cuántas hay en todas las páginas: de ahí salen las páginas del celular. */
  enPaginas: number;
  /** «Ver todas las publicaciones (130)». */
  total: number;
}) {
  // La primera tarjeta que se ve: de ahí salen la página de la computadora y la del celular.
  const [desde, setDesde] = useState(0);
  const [paginas, setPaginas] = useState(() => new Map([[1, primera]]));
  const [ocupada, setOcupada] = useState(false);
  const [error, setError] = useState(false);
  const arriba = useRef<HTMLElement>(null);

  if (primera.length === 0) return null;
  const pagina = paginaDe(desde, false);
  const tarjetas = paginas.get(pagina) ?? [];
  // Qué mitad de la página de la computadora es la del celular.
  const mitad = Math.floor((desde % RECIEN_POR_PAGINA) / RECIEN_POR_PAGINA_CELULAR);

  async function ir(nuevoDesde: number) {
    const numero = paginaDe(nuevoDesde, false);
    setError(false);
    if (!paginas.has(numero)) {
      setOcupada(true);
      try {
        const respuesta = await llamarApi<RespuestaRecienInicio>(`/inicio/recien?pagina=${numero}`);
        setPaginas((antes) => new Map(antes).set(numero, respuesta.tarjetas));
      } catch {
        setError(true);
        return;
      } finally {
        setOcupada(false);
      }
    }
    setDesde(nuevoDesde);
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    arriba.current?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section
      ref={arriba}
      aria-label="Publicaciones de las tiendas"
      className="flex scroll-mt-4 flex-col gap-3.5"
    >
      <ul
        aria-busy={ocupada}
        className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 sm:grid-cols-3 sm:gap-3.5 md:grid-cols-4 lg:grid-cols-5 lg:gap-4"
      >
        {tarjetas.map((tarjeta, i) => (
          <li
            key={tarjeta.oferta_id}
            className={
              Math.floor(i / RECIEN_POR_PAGINA_CELULAR) === mitad
                ? 'min-w-0'
                : 'min-w-0 max-sm:hidden'
            }
          >
            <TarjetaInicio tarjeta={tarjeta} prioridad={desde === 0 && i < 5} />
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 text-center text-apoyo text-error">
          No pudimos traer esa página. Vuelve a intentarlo.
        </p>
      )}
      <Paginacion
        className="flex max-sm:hidden"
        actual={pagina}
        total={totalPaginas}
        ocupada={ocupada}
        alIr={(numero) => void ir(desdeDe(numero, false))}
      />
      <Paginacion
        className="flex sm:hidden"
        actual={paginaDe(desde, true)}
        total={paginasEnCelular(enPaginas)}
        ocupada={ocupada}
        alIr={(numero) => void ir(desdeDe(numero, true))}
      />
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
    </section>
  );
}
