'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Formulario({ className }: { className: string }) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  // Quien llega a los resultados ve en la barra lo que buscó.
  const valor = ruta === '/buscar' ? (parametros.get('q') ?? '') : '';

  return (
    <form key={valor} action="/buscar" role="search" className={className}>
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

/** El buscador de la barra (C_Header): un formulario común que lleva a `/buscar?q=…`. */
export function Buscador({ className = '' }: { className?: string }) {
  return (
    <Suspense fallback={<div className={className} />}>
      <Formulario className={className} />
    </Suspense>
  );
}
