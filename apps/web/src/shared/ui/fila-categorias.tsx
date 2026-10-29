'use client';

import type { CategoriaResumen } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Fila({ categorias }: { categorias: CategoriaResumen[] }) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const enResultados = ruta === '/buscar';
  const actual = enResultados ? parametros.get('categoria') : null;

  const clase = (activa: boolean) =>
    `flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-apoyo no-underline ${
      activa
        ? 'border-tinta font-semibold text-tinta'
        : 'border-transparent font-medium text-secundario hover:text-tinta'
    }`;

  return (
    <nav aria-label="Categorías" className="border-b border-linea">
      <div className="mx-auto flex max-w-[1280px] items-center gap-x-6 overflow-x-auto px-4 [scrollbar-width:none] sm:px-8">
        <Link
          href="/buscar"
          aria-current={enResultados && !actual ? 'page' : undefined}
          className={clase(enResultados && !actual)}
        >
          Todas las categorías
        </Link>
        {categorias.map((categoria) => {
          const activa = actual === categoria.slug;
          return (
            <Link
              key={categoria.slug}
              href={`/buscar?categoria=${categoria.slug}`}
              aria-current={activa ? 'page' : undefined}
              className={clase(activa)}
            >
              {categoria.nombre}
              <span className="text-nota font-normal text-detalle">{categoria.productos}</span>
            </Link>
          );
        })}
        <Link href="/ayuda" className={`${clase(ruta === '/ayuda')} ml-auto max-md:hidden`}>
          Ayuda
        </Link>
      </div>
    </nav>
  );
}

/**
 * La fila de categorías de C_Header, debajo de la barra en todo el catálogo, con sesión o sin
 * ella. Marca la categoría de los resultados que se están viendo.
 */
export function FilaCategorias({ categorias }: { categorias: CategoriaResumen[] }) {
  if (categorias.length === 0) return null;
  return (
    <Suspense fallback={<div className="h-11 border-b border-linea" />}>
      <Fila categorias={categorias} />
    </Suspense>
  );
}
