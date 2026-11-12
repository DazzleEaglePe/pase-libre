'use client';

import {
  RECIEN_POR_PAGINA,
  type RespuestaRecienInicio,
  type TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

import { TarjetaInicio } from './tarjetas';

/** Hasta cuántas páginas se dibujan con puntitos; con más, solo «25–48 de 300». */
const MAX_PUNTOS = 8;

/**
 * «Recién publicado» del inicio normal (N15): hasta 4 filas de 6 (24), mezclado por tienda. La
 * flechita negra de la derecha (en el celular, «Siguientes 24») trae las siguientes 24 sin fin;
 * se piden de a 24 y las que ya llegaron no se vuelven a pedir.
 */
export function RecienPublicado({
  primeras,
  total,
}: {
  primeras: TarjetaOfertaConVendedor[];
  total: number;
}) {
  const seccion = useRef<HTMLElement>(null);
  const [paginas, setPaginas] = useState<TarjetaOfertaConVendedor[][]>([primeras]);
  const [actual, setActual] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (primeras.length === 0) return null;
  const tarjetas = paginas[actual] ?? [];
  const desde = actual * RECIEN_POR_PAGINA;
  const hasta = desde + tarjetas.length;
  const quedan = Math.max(0, total - hasta);
  const cuantasPaginas = Math.ceil(total / RECIEN_POR_PAGINA);

  function irA(pagina: number) {
    setActual(pagina);
    const arriba = seccion.current?.getBoundingClientRect().top ?? 0;
    // Si el comienzo de la sección quedó arriba de la pantalla, se vuelve a él.
    if (arriba < 0) seccion.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function siguientes() {
    const pagina = actual + 1;
    setError(null);
    if (paginas[pagina]) {
      irA(pagina);
      return;
    }
    setCargando(true);
    try {
      const respuesta = await llamarApi<RespuestaRecienInicio>(
        `/inicio/recien?desde=${pagina * RECIEN_POR_PAGINA}`,
      );
      setPaginas((anteriores) => {
        const copia = [...anteriores];
        copia[pagina] = respuesta.tarjetas;
        return copia;
      });
      irA(pagina);
    } catch {
      setError('No pudimos traer las siguientes. Vuelve a intentarlo.');
    } finally {
      setCargando(false);
    }
  }

  const flecha =
    'flex h-[52px] w-[52px] items-center justify-center rounded-full bg-tinta text-white shadow-[0_6px_18px_rgba(15,20,18,0.28)] hover:bg-secundario disabled:opacity-60';

  return (
    <section
      ref={seccion}
      aria-labelledby="recien-publicado"
      className="flex scroll-mt-40 flex-col gap-3.5"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2
            id="recien-publicado"
            className="tit text-[22px] leading-7 max-sm:text-[19px] max-sm:leading-6"
          >
            Recién publicado
          </h2>
          <Link
            href="/buscar?orden=recientes"
            className="shrink-0 text-apoyo font-extrabold text-marca underline"
          >
            Ver {total === 1 ? 'la publicación' : `las ${total}`} ›
          </Link>
        </div>
        <span className="text-nota text-detalle">
          Mezclado por tienda: nunca salen dos seguidos de la misma.
        </span>
      </div>

      <div className="relative">
        <ul
          aria-live="polite"
          aria-busy={cargando}
          className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-6 lg:gap-3.5"
        >
          {tarjetas.map((tarjeta, n) => (
            <li key={tarjeta.oferta_id} className="min-w-0">
              <TarjetaInicio tarjeta={tarjeta} prioridad={actual === 0 && n < 6} />
            </li>
          ))}
        </ul>
        {actual > 0 && (
          <button
            type="button"
            onClick={() => irA(actual - 1)}
            aria-label={`Ver las ${RECIEN_POR_PAGINA} anteriores`}
            className={`${flecha} absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 max-lg:hidden`}
          >
            <IconChevronLeft size={24} stroke={2.4} aria-hidden="true" />
          </button>
        )}
        {quedan > 0 && (
          <span className="absolute right-0 top-1/2 flex -translate-y-1/2 translate-x-1/2 flex-col items-center gap-1.5 max-lg:hidden">
            <button
              type="button"
              onClick={() => void siguientes()}
              disabled={cargando}
              aria-label={`Ver las siguientes ${Math.min(quedan, RECIEN_POR_PAGINA)}`}
              className={flecha}
            >
              <IconChevronRight size={24} stroke={2.4} aria-hidden="true" />
            </button>
            <span
              aria-hidden="true"
              className="rounded-full bg-tinta px-2 text-[11px] font-extrabold leading-5 text-white"
            >
              +{quedan}
            </span>
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}

      <div className="flex flex-col items-center gap-2.5">
        <div className="flex flex-wrap items-center justify-center gap-2 lg:hidden">
          {actual > 0 && (
            <button
              type="button"
              onClick={() => irA(actual - 1)}
              className="flex h-12 items-center gap-1 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold"
            >
              <IconChevronLeft size={18} stroke={2.2} aria-hidden="true" />
              Anteriores
            </button>
          )}
          {quedan > 0 && (
            <button
              type="button"
              onClick={() => void siguientes()}
              disabled={cargando}
              className="flex h-12 items-center gap-2.5 rounded-full bg-tinta pl-5 pr-2 text-[15px] font-extrabold text-white disabled:opacity-60"
            >
              {cargando ? 'Cargando…' : `Siguientes ${Math.min(quedan, RECIEN_POR_PAGINA)}`}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <IconChevronRight size={18} stroke={2.4} aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
        <span className="flex items-center gap-2.5 text-nota text-detalle">
          {cuantasPaginas > 1 && cuantasPaginas <= MAX_PUNTOS && (
            <span aria-hidden="true" className="flex items-center gap-1.5">
              {Array.from({ length: cuantasPaginas }, (_, pagina) => (
                <span
                  key={pagina}
                  className={`h-1.5 rounded-full ${
                    pagina === actual ? 'w-[22px] bg-tinta' : 'w-1.5 bg-borde'
                  }`}
                />
              ))}
            </span>
          )}
          {desde + 1}–{hasta} de {total}
        </span>
      </div>
    </section>
  );
}
