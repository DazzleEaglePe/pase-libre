'use client';

import type { CategoriaResumen, Faceta, RespuestaBuscar } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

import { GlifoCategoria } from './glifo-categoria';

type Facetas = RespuestaBuscar['facetas'];

const MAX_POR_GRUPO = 6;

/**
 * «Comprar por categoría» (C_Header): las categorías a la izquierda y, para la que se señala,
 * sus marcas, su estado y sus galerías con cuántas ofertas hay de cada una. Los conteos salen
 * de las facetas de `/v1/buscar?categoria=…` (sin texto, así que no se registra como
 * búsqueda) y se piden una vez por categoría.
 */
export function MenuCategorias({ categorias }: { categorias: CategoriaResumen[] }) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState(categorias[0]?.slug ?? '');
  const [facetas, setFacetas] = useState<Record<string, Facetas>>({});
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => setAbierto(false), [ruta]);

  useEffect(() => {
    if (!abierto) return;
    const afuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !elegida || facetas[elegida]) return;
    llamarApi<RespuestaBuscar>(`/buscar?categoria=${encodeURIComponent(elegida)}`).then(
      (respuesta) => setFacetas((actuales) => ({ ...actuales, [elegida]: respuesta.facetas })),
      () => undefined,
    );
  }, [abierto, elegida, facetas]);

  if (categorias.length === 0) return null;
  const categoria = categorias.find((c) => c.slug === elegida) ?? categorias[0]!;
  const datos = facetas[categoria.slug];
  const enlace = (filtro: string, valor: string) =>
    `/buscar?categoria=${categoria.slug}&${filtro}=${encodeURIComponent(valor)}`;

  const grupos: Array<{ titulo: string; filtro: string; facetas: Faceta[] }> = datos
    ? [
        { titulo: 'Marcas', filtro: 'marca', facetas: datos.marcas },
        { titulo: 'Estado', filtro: 'condicion', facetas: datos.condiciones },
        { titulo: 'Galería', filtro: 'galeria', facetas: datos.galerias },
      ]
    : [];

  return (
    <div ref={caja} className="max-lg:hidden">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-categorias"
        aria-label="Comprar por categoría"
        onClick={() => setAbierto(!abierto)}
        className={`flex h-12 items-center gap-1.5 rounded-xl px-2.5 text-left text-nota font-medium leading-4 text-tinta ${
          abierto ? 'bg-superficie' : 'hover:bg-superficie'
        }`}
      >
        Comprar por
        <br />
        categoría
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={abierto ? 'rotate-180' : ''}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div
          id="menu-categorias"
          className="absolute left-0 right-0 top-full z-40 border-y border-linea bg-white shadow-[0_18px_40px_rgba(10,22,51,0.14)]"
        >
          <div className="mx-auto grid max-w-[1280px] grid-cols-[260px_minmax(0,1fr)] gap-8 px-8 py-6">
            <div
              role="tablist"
              aria-label="Categorías"
              aria-orientation="vertical"
              className="flex flex-col gap-0.5 border-r border-linea pr-4"
            >
              {categorias.map((opcion) => {
                const activa = opcion.slug === categoria.slug;
                return (
                  <button
                    key={opcion.slug}
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    onClick={() => setElegida(opcion.slug)}
                    onMouseEnter={() => setElegida(opcion.slug)}
                    onFocus={() => setElegida(opcion.slug)}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-cuerpo ${
                      activa ? 'bg-superficie font-semibold' : 'hover:bg-superficie'
                    }`}
                  >
                    <GlifoCategoria categoria={opcion.slug} ancho={28} />
                    <span className="flex-1">{opcion.nombre}</span>
                    <span className="text-nota font-normal text-detalle">{opcion.productos}</span>
                  </button>
                );
              })}
            </div>

            <div role="tabpanel" aria-label={categoria.nombre} className="flex flex-col gap-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-seccion">{categoria.nombre}</h2>
                <Link
                  href={`/buscar?categoria=${categoria.slug}`}
                  className="text-apoyo font-semibold"
                >
                  Ver todo en {categoria.nombre} ({categoria.productos})
                </Link>
              </div>
              {!datos ? (
                <p className="text-apoyo text-detalle">Cargando…</p>
              ) : grupos.every((grupo) => grupo.facetas.length === 0) ? (
                <p className="text-apoyo text-secundario">
                  Todavía no hay productos publicados en {categoria.nombre}.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-8">
                  {grupos.map((grupo) => (
                    <div key={grupo.titulo} className="flex flex-col gap-1">
                      <span className="pb-1 text-etiqueta uppercase text-detalle">
                        {grupo.titulo}
                      </span>
                      {grupo.facetas.slice(0, MAX_POR_GRUPO).map((faceta) => (
                        <Link
                          key={faceta.slug}
                          href={enlace(grupo.filtro, faceta.slug)}
                          className="flex min-h-8 items-center justify-between gap-3 text-apoyo text-tinta no-underline hover:underline"
                        >
                          {faceta.nombre}
                          <span className="text-nota text-detalle">{faceta.cantidad}</span>
                        </Link>
                      ))}
                      {grupo.facetas.length === 0 && (
                        <span className="text-apoyo text-detalle">—</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
