'use client';

import type { CategoriaResumen } from '@paselibre/contracts';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Formulario({
  className,
  categorias,
}: {
  className: string;
  categorias: CategoriaResumen[];
}) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  // Quien llega a los resultados ve en la barra lo que buscó, y en qué categoría.
  const enResultados = ruta === '/buscar';
  const valor = enResultados ? (parametros.get('q') ?? '') : '';
  const categoria = enResultados ? (parametros.get('categoria') ?? '') : '';

  return (
    <form key={`${valor}|${categoria}`} action="/buscar" role="search" className={className}>
      <label htmlFor="buscar-q" className="sr-only">
        Buscar componentes
      </label>
      <div className="flex h-11 items-center gap-2 rounded-full border border-borde-control bg-white pl-4 pr-1.5 focus-within:border-tinta">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-detalle"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          id="buscar-q"
          name="q"
          type="search"
          defaultValue={valor}
          autoComplete="off"
          placeholder="Busca marca o modelo"
          className="h-full min-w-0 flex-1 bg-transparent text-cuerpo text-tinta outline-none placeholder:text-detalle"
        />
        {categorias.length > 0 && (
          <>
            <label htmlFor="buscar-categoria" className="sr-only">
              Categoría
            </label>
            {/* En el celular no entra: ahí la categoría se elige en la fila de abajo. */}
            <select
              id="buscar-categoria"
              name="categoria"
              defaultValue={categoria}
              className="hidden h-8 max-w-[150px] shrink-0 cursor-pointer border-l border-linea bg-transparent pl-3 pr-1 text-apoyo text-secundario outline-none sm:block"
            >
              <option value="">Todas</option>
              {categorias.map((opcion) => (
                <option key={opcion.slug} value={opcion.slug}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="submit"
          className="h-8 shrink-0 rounded-full bg-pase px-4 text-apoyo font-semibold text-white"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}

/**
 * El buscador de la barra (C_Header): un formulario común que lleva a
 * `/buscar?q=…&categoria=…`. Con las categorías suma su selector, como en el lienzo.
 */
export function Buscador({
  className = '',
  categorias = [],
}: {
  className?: string;
  categorias?: CategoriaResumen[];
}) {
  return (
    <Suspense fallback={<div className={className} />}>
      <Formulario className={className} categorias={categorias} />
    </Suspense>
  );
}
