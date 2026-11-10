'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * La cabecera verde propia de las pantallas del celular que no llevan la barra del sitio
 * (M_Ficha, M_Resultados): «volver» a la izquierda y, en el medio, un título o lo que se pase
 * (el buscador). `derecha` va al otro lado (compartir). Solo en el celular; se queda arriba al
 * bajar. Se pone al principio de la página: anula el margen de arriba del `<main>`.
 */
export function CabeceraMovil({
  titulo,
  centro,
  children,
}: {
  titulo?: string;
  /** En lugar del título: el buscador de M_Resultados. */
  centro?: ReactNode;
  /** A la derecha. */
  children?: ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="sticky top-0 z-30 -mx-4 -mt-5 mb-1 flex min-h-[60px] items-center gap-1 rounded-b-[20px] bg-marca px-2 py-2 text-white md:hidden">
      <button
        type="button"
        aria-label="Volver"
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      {centro ?? (
        <span className="min-w-0 flex-1 truncate text-center text-cuerpo font-bold">{titulo}</span>
      )}
      {children ?? (centro ? null : <span aria-hidden="true" className="w-11 shrink-0" />)}
    </div>
  );
}
