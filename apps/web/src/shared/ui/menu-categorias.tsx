'use client';

import type {
  CategoriaResumen,
  Faceta,
  RespuestaBuscar,
  RespuestaMasBuscado,
} from '@paselibre/contracts';
import { IconArrowRight, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { MasBuscado } from '@/features/catalogo/mas-buscado';
import { TarjetaBusco } from '@/features/catalogo/tarjeta-busco';
import { textoProductos } from '@/features/catalogo/tarjeta-categoria';
import { useEnVivoMontado } from '@/features/en-vivo/contexto';
import { llamarApi } from '@/shared/api/cliente';

import { botonPrincipal } from './estilos';
import { GlifoCategoria } from './glifo-categoria';

type Facetas = RespuestaBuscar['facetas'];

const MAX_MARCAS = 8;

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-etiqueta uppercase text-detalle">{titulo}</span>
      {children}
    </div>
  );
}

function Chips({ facetas, enlace }: { facetas: Faceta[]; enlace: (slug: string) => string }) {
  if (facetas.length === 0) return <span className="text-apoyo text-detalle">—</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {facetas.map((faceta) => (
        <Link
          key={faceta.slug}
          href={enlace(faceta.slug)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-borde px-3.5 text-apoyo font-medium text-tinta no-underline hover:border-borde-control"
        >
          {faceta.nombre}
          <span className="font-normal text-detalle">{faceta.cantidad}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * «Comprar por categoría» (J1): a la izquierda Pases del día y las categorías, con su dibujo
 * y cuántos productos hay; a la derecha, la que se señala: sus marcas, estado y galerías con
 * cuántas ofertas hay de cada una, lo más buscado en ella y, al pie, «Publicar un busco».
 * Los conteos salen de las facetas de `/v1/buscar?categoria=…` (sin texto, así que no se
 * registra como búsqueda) y lo más buscado de `/v1/buscar/populares?categoria=…`; ambos se
 * piden una vez por categoría.
 */
export function MenuCategorias({
  categorias,
  conSesion,
}: {
  categorias: CategoriaResumen[];
  conSesion: boolean;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState(categorias[0]?.slug ?? '');
  const [facetas, setFacetas] = useState<Record<string, Facetas>>({});
  const [populares, setPopulares] = useState<Record<string, string[]>>({});
  const caja = useRef<HTMLDivElement>(null);
  const enVivo = useEnVivoMontado();
  const pases = enVivo?.activo && enVivo.datos ? enVivo.datos.en_vivo.length : null;

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
    const slug = encodeURIComponent(elegida);
    llamarApi<RespuestaBuscar>(`/buscar?categoria=${slug}`).then(
      (respuesta) => setFacetas((actuales) => ({ ...actuales, [elegida]: respuesta.facetas })),
      () => undefined,
    );
    llamarApi<RespuestaMasBuscado>(`/buscar/populares?categoria=${slug}`).then(
      (respuesta) => setPopulares((actuales) => ({ ...actuales, [elegida]: respuesta.terminos })),
      () => undefined,
    );
  }, [abierto, elegida, facetas]);

  if (categorias.length === 0) return null;
  const categoria = categorias.find((c) => c.slug === elegida) ?? categorias[0]!;
  const datos = facetas[categoria.slug];
  const enlace = (filtro: string) => (valor: string) =>
    `/buscar?categoria=${categoria.slug}&${filtro}=${encodeURIComponent(valor)}`;
  const sinNada =
    datos !== undefined &&
    datos.marcas.length === 0 &&
    datos.condiciones.length === 0 &&
    datos.galerias.length === 0;

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
        <IconChevronDown
          size={14}
          stroke={1.5}
          aria-hidden="true"
          className={abierto ? 'rotate-180' : ''}
        />
      </button>

      {abierto && (
        <div
          id="menu-categorias"
          className="absolute left-0 right-0 top-full z-40 border-y border-linea bg-white shadow-[0_18px_40px_rgba(10,22,51,0.14)]"
        >
          <div className="mx-auto grid max-w-[1280px] grid-cols-[300px_minmax(0,1fr)] px-8">
            <div className="flex flex-col border-r border-linea py-3">
              {/* Pases del día va primero, como las campañas de temporada de un menú de tienda. */}
              {pases !== null && (
                <>
                  <Link
                    href="/pases-del-dia"
                    className="flex min-h-[60px] items-center gap-3 pl-1 pr-4 text-tinta no-underline hover:bg-superficie"
                  >
                    <span aria-hidden="true" className="flex w-12 shrink-0 justify-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C8331F]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-cuerpo font-semibold">Pases del día</span>
                      <span className="text-nota text-detalle">
                        {pases === 0 ? 'Busco y remates de hoy' : `${pases} busco y remates ahora`}
                      </span>
                    </span>
                    <IconChevronRight
                      size={18}
                      stroke={1.5}
                      aria-hidden="true"
                      className="text-detalle"
                    />
                  </Link>
                  <div aria-hidden="true" className="my-1 ml-4 mr-4 h-px bg-linea" />
                </>
              )}
              <div
                role="tablist"
                aria-label="Categorías"
                aria-orientation="vertical"
                className="flex flex-col"
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
                      className={`flex min-h-[60px] items-center gap-3 pl-1 pr-4 text-left ${
                        activa ? 'bg-pase-suave font-semibold' : 'hover:bg-superficie'
                      }`}
                    >
                      <span aria-hidden="true" className="flex w-12 shrink-0 justify-center">
                        <GlifoCategoria categoria={opcion.slug} ancho={44} grosor={5} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-cuerpo">{opcion.nombre}</span>
                        <span className="text-nota font-normal text-detalle">
                          {textoProductos(opcion.productos)}
                        </span>
                      </span>
                      <IconChevronRight
                        size={18}
                        stroke={1.5}
                        aria-hidden="true"
                        className="text-detalle"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              role="tabpanel"
              aria-label={categoria.nombre}
              className="flex min-w-0 flex-col gap-6 py-7 pl-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="flex items-center gap-3.5">
                  <GlifoCategoria categoria={categoria.slug} ancho={56} grosor={4.2} />
                  <h2 className="text-seccion">{categoria.nombre}</h2>
                </div>
                <Link
                  href={`/buscar?categoria=${categoria.slug}`}
                  className={`${botonPrincipal} gap-1.5 no-underline`}
                >
                  Ver {textoProductos(categoria.productos)}
                  <IconArrowRight size={18} stroke={1.8} aria-hidden="true" />
                </Link>
              </div>

              {!datos ? (
                <p className="text-apoyo text-detalle">Cargando…</p>
              ) : sinNada ? (
                <p className="text-apoyo text-secundario">
                  Todavía no hay productos publicados en {categoria.nombre}.
                </p>
              ) : (
                <>
                  <Grupo titulo="Marcas">
                    <Chips facetas={datos.marcas.slice(0, MAX_MARCAS)} enlace={enlace('marca')} />
                  </Grupo>
                  <div className="grid grid-cols-2 gap-6">
                    <Grupo titulo="Estado">
                      <Chips facetas={datos.condiciones} enlace={enlace('condicion')} />
                    </Grupo>
                    <Grupo titulo="Galería">
                      <Chips facetas={datos.galerias} enlace={enlace('galeria')} />
                    </Grupo>
                  </div>
                  {(populares[categoria.slug]?.length ?? 0) > 0 && (
                    <Grupo titulo={`Lo más buscado en ${categoria.nombre}`}>
                      <MasBuscado
                        terminos={populares[categoria.slug] ?? []}
                        categoria={categoria.slug}
                      />
                    </Grupo>
                  )}
                </>
              )}

              <div className="mt-auto pt-2">
                <TarjetaBusco
                  titulo="¿Buscas algo para un cliente?"
                  texto="Publica un busco y te avisan las tiendas que lo tienen."
                  conSesion={conSesion}
                  categoria={categoria.slug}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
