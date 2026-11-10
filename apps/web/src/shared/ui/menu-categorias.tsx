'use client';

import { formatearPrecio, type CategoriaResumen, type RespuestaBarra } from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';
import { conVendedor, cuantoQueda, etiquetaTipo, type ItemEnVivo } from '@/features/en-vivo/textos';
import { haceRato } from '@/shared/fechas';

/** Las categorías por su grupo, en el orden del menú (CAT_Web1). Sin grupo, al final. */
export function agruparCategorias(
  categorias: CategoriaResumen[],
): Array<{ grupo: string; categorias: CategoriaResumen[] }> {
  const grupos = new Map<string, CategoriaResumen[]>();
  for (const categoria of categorias) {
    const grupo = categoria.grupo ?? 'Más';
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), categoria]);
  }
  return [...grupos.entries()].map(([grupo, lista]) => ({ grupo, categorias: lista }));
}

/** «21 categorías · 876 productos en Wilson». */
export function resumenCategorias(categorias: CategoriaResumen[]): string {
  const productos = categorias.reduce((total, categoria) => total + categoria.productos, 0);
  return `${categorias.length} categorías · ${productos} ${productos === 1 ? 'producto' : 'productos'} en Wilson`;
}

/**
 * La línea de abajo de un pedido en vivo en el menú: «hasta US$ 820 · hace 6 min» o
 * «US$ 205 · termina en 40 min». Sin sesión, sin precio (RF-77).
 */
function detallePedido(item: ItemEnVivo, ahora: number): string {
  const precio =
    conVendedor(item) && item.precio
      ? item.tipo === 'BUSCO'
        ? `hasta ${formatearPrecio(item.precio)}`
        : formatearPrecio(item.precio)
      : null;
  const tiempo =
    item.tipo === 'BUSCO'
      ? haceRato(item.creado_en, new Date(ahora)).toLowerCase()
      : `termina en ${cuantoQueda(item.vence_en, ahora, true)}`;
  return [precio, tiempo].filter(Boolean).join(' · ');
}

/**
 * «Todas las categorías» (CAT_Web1): el botón de la banda oscura abre, debajo de toda la barra,
 * las categorías en cuatro columnas con cuántos productos hay en cada una y, a la derecha,
 * los pedidos en vivo y lo más buscado hoy. Se cierra con Escape, al tocar afuera o al ir a
 * otra página. El panel va con posición fija: la banda se desliza de costado y lo cortaría.
 */
export function MenuCategorias({
  categorias,
  barra,
  conSesion,
  claseBoton,
  icono,
}: {
  categorias: CategoriaResumen[];
  barra: RespuestaBarra | null;
  conSesion: boolean;
  claseBoton: (activa: boolean) => string;
  icono: ReactNode;
}) {
  const ruta = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [arriba, setArriba] = useState(0);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const enVivo = useEnVivoMontado();
  const pedidos = enVivo?.activo && enVivo.datos ? enVivo.datos.en_vivo : null;

  useEffect(() => setAbierto(false), [ruta]);

  useEffect(() => {
    if (!abierto) return;
    const medir = () => {
      const barraArriba = boton.current?.closest('header');
      setArriba(barraArriba?.getBoundingClientRect().bottom ?? 0);
    };
    medir();
    const afuera = (evento: MouseEvent) => {
      const objetivo = evento.target as Node;
      if (!panel.current?.contains(objetivo) && !boton.current?.contains(objetivo)) {
        setAbierto(false);
      }
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, { passive: true });
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir);
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  if (categorias.length === 0) return null;
  const grupos = agruparCategorias(categorias);
  const ahora = Date.now();
  const posicion: CSSProperties = { top: arriba };

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-expanded={abierto}
        aria-controls="menu-categorias"
        onClick={() => setAbierto(!abierto)}
        className={claseBoton(abierto || ruta === '/categorias')}
      >
        {icono}
        Todas las categorías
      </button>

      {abierto && (
        <>
          <div
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 z-30 bg-tinta/30"
            style={posicion}
          />
          <div className="fixed inset-x-0 z-40 px-4 sm:px-8" style={posicion}>
            <div
              ref={panel}
              id="menu-categorias"
              className="mx-auto grid max-h-[calc(100dvh-140px)] max-w-[1280px] grid-cols-[minmax(0,1fr)_312px] gap-9 overflow-y-auto rounded-b-[20px] bg-white py-6 pl-[35px] pr-6 text-tinta shadow-[0_18px_40px_rgba(15,20,18,0.18)] max-lg:grid-cols-1"
            >
              <div className="flex min-w-0 flex-col gap-5 py-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <h2 className="text-seccion">Todas las categorías</h2>
                  <span className="text-nota text-secundario">{resumenCategorias(categorias)}</span>
                </div>
                <div className="grid grid-cols-4 gap-x-11 gap-y-6 max-xl:grid-cols-2">
                  {grupos.map(({ grupo, categorias: lista }) => (
                    <div key={grupo} className="flex min-w-0 flex-col">
                      <span className="pb-2.5 text-etiqueta uppercase text-detalle">{grupo}</span>
                      {lista.map((categoria) => (
                        <Link
                          key={categoria.slug}
                          href={`/buscar?categoria=${categoria.slug}`}
                          className="flex min-h-[43px] items-center justify-between gap-3 text-cuerpo font-semibold text-tinta no-underline hover:text-pase-texto"
                        >
                          <span className="min-w-0">{categoria.nombre}</span>
                          <span className="text-nota font-normal text-detalle">
                            {categoria.productos}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <aside className="flex flex-col gap-3 self-start rounded-2xl bg-superficie p-4">
                {pedidos !== null && (
                  <>
                    <Link
                      href="/pedidos-en-vivo"
                      className="flex items-center gap-2 text-etiqueta uppercase text-secundario no-underline hover:text-tinta"
                    >
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
                      Pedidos en vivo · {pedidos.length}
                    </Link>
                    {pedidos.length === 0 ? (
                      <p className="text-apoyo text-secundario">
                        Ahora nadie busca ni remata. Cuando alguien publique, lo ves aquí.
                      </p>
                    ) : (
                      pedidos.slice(0, 2).map((pedido) => (
                        <Link
                          key={pedido.id}
                          href="/pedidos-en-vivo"
                          className="flex flex-col gap-0.5 rounded-xl border border-linea bg-white px-3 py-2.5 no-underline hover:border-borde"
                        >
                          <b className="text-apoyo font-bold text-tinta">
                            {etiquetaTipo(pedido.tipo)} {pedido.titulo}
                          </b>
                          <span className="text-[12px] leading-4 text-secundario">
                            {detallePedido(pedido, ahora)}
                          </span>
                        </Link>
                      ))
                    )}
                  </>
                )}
                {(barra?.mas_buscado.length ?? 0) > 0 && (
                  <>
                    <span className="pt-2 text-etiqueta uppercase text-secundario">
                      {barra?.mas_buscado_hoy ? 'Lo más buscado hoy' : 'Lo más buscado'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {barra?.mas_buscado.map((termino) => (
                        <Link
                          key={termino}
                          href={`/buscar?q=${encodeURIComponent(termino)}`}
                          className="flex h-9 items-center rounded-full border border-borde bg-white px-3 text-apoyo font-semibold text-tinta no-underline hover:border-borde-control"
                        >
                          {termino}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
                {!conSesion && (
                  <p className="pt-1 text-nota text-secundario">
                    Los precios y las tiendas se ven al{' '}
                    <Link href="/ingresar" className="font-semibold text-pase-texto">
                      iniciar sesión
                    </Link>
                    .
                  </p>
                )}
              </aside>
            </div>
          </div>
        </>
      )}
    </>
  );
}
