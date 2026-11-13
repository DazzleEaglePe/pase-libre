'use client';

import {
  ORDENES_PERFIL,
  TEXTO_ORDEN_PERFIL,
  type CategoriaDelPerfil,
  type OrdenPerfil,
  type ProductoDeTienda,
} from '@paselibre/contracts';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import { textoEstado } from '@/features/catalogo/textos';
import { TarjetaProducto } from '@/shared/ui/tarjeta-producto';

/** «Más barato de la galería» (doc 20, puntos 20 y 22): sobre la foto, arriba a la izquierda. */
export function ChapitaMasBarato() {
  return (
    <span className="absolute left-2 top-2 inline-flex h-[22px] items-center rounded-full bg-contador px-2 text-[11.5px] font-extrabold text-tinta shadow-[0_2px_8px_rgba(15,20,18,0.12)]">
      Más barato de la galería
    </span>
  );
}

/** Una publicación del perfil con la tarjeta de todo el sitio. */
export function TarjetaDelPerfil({
  producto,
  galeria,
}: {
  producto: ProductoDeTienda;
  galeria: string | null;
}) {
  return (
    <TarjetaProducto
      href={`/p/${producto.producto.slug}?oferta=${producto.oferta_id}`}
      titulo={producto.producto.titulo}
      foto={producto.producto.foto}
      categoria={producto.producto.categoria.slug}
      precio={producto.precio}
      socio={producto.precio_socio}
      negociable={producto.negociable}
      variantes={producto.variantes}
      linea={[textoEstado(producto.condicion), galeria].filter(Boolean).join(' · ')}
      sobreFoto={producto.mas_barato ? <ChapitaMasBarato /> : undefined}
    />
  );
}

/**
 * «Lo nuevo de esta semana» y «Sus mejores precios» (doc 20, punto 20, opción C): el título con su
 * explicación y una fila de tarjetas que se desliza de costado. Sin nada, no aparece.
 */
export function FilaDeSeccion({
  titulo,
  detalle,
  productos,
  galeria,
}: {
  titulo: string;
  detalle: string;
  productos: ProductoDeTienda[];
  galeria: string | null;
}) {
  if (productos.length === 0) return null;
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-2.5">
      <h2 className="flex flex-wrap items-baseline gap-x-2 text-[17px] font-bold leading-6">
        {titulo}
        <span className="text-nota font-normal text-detalle">{detalle}</span>
      </h2>
      <ul className="m-0 flex list-none snap-x gap-3 overflow-x-auto p-0 pb-1 [scrollbar-width:thin] md:gap-3.5">
        {productos.map((producto) => (
          <li
            key={producto.oferta_id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-3*14px)/4)]"
          >
            <TarjetaDelPerfil producto={producto} galeria={galeria} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Las burbujas de «Todo»: «Todo · 16» y solo las categorías que vende la tienda con cuántas tiene.
 * Se pueden marcar varias a la vez (se suman); «Todo» las desmarca.
 */
export function BurbujasCategorias({
  categorias,
  total,
  elegidas,
  alCambiar,
}: {
  categorias: CategoriaDelPerfil[];
  total: number;
  elegidas: string[];
  alCambiar: (elegidas: string[]) => void;
}) {
  const burbuja = (activa: boolean) =>
    `h-9 shrink-0 rounded-full border-[1.5px] px-3.5 text-apoyo ${
      activa
        ? 'border-tinta bg-tinta font-bold text-white'
        : 'border-borde bg-white font-semibold text-tinta hover:border-borde-control'
    }`;
  return (
    <div role="group" aria-label="Categorías" className="flex flex-wrap gap-2">
      <button
        type="button"
        aria-pressed={elegidas.length === 0}
        onClick={() => alCambiar([])}
        className={burbuja(elegidas.length === 0)}
      >
        Todo · {total}
      </button>
      {categorias.map((categoria) => {
        const activa = elegidas.includes(categoria.slug);
        return (
          <button
            key={categoria.slug}
            type="button"
            aria-pressed={activa}
            onClick={() =>
              alCambiar(
                activa
                  ? elegidas.filter((slug) => slug !== categoria.slug)
                  : [...elegidas, categoria.slug],
              )
            }
            className={burbuja(activa)}
          >
            {categoria.nombre} · {categoria.cantidad}
          </button>
        );
      })}
    </div>
  );
}

/** «Ordenar: Recién publicados ▾» a la derecha de las burbujas. */
export function MenuOrdenar({
  orden,
  alCambiar,
}: {
  orden: OrdenPerfil;
  alCambiar: (orden: OrdenPerfil) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', conEscape);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', conEscape);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-tinta bg-white px-3.5 text-apoyo font-bold text-tinta"
      >
        Ordenar: {TEXTO_ORDEN_PERFIL[orden]}
        <IconChevronDown size={16} stroke={2} aria-hidden="true" />
      </button>
      {abierto && (
        <div
          role="menu"
          aria-label="Ordenar"
          className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[230px] flex-col rounded-[14px] border border-linea bg-white p-1.5 shadow-[0_18px_40px_rgba(15,20,18,0.16)]"
        >
          {ORDENES_PERFIL.map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="menuitemradio"
              aria-checked={opcion === orden}
              onClick={() => {
                setAbierto(false);
                if (opcion !== orden) alCambiar(opcion);
              }}
              className={`rounded-[10px] px-3 py-2 text-left text-apoyo ${
                opcion === orden
                  ? 'bg-superficie font-bold text-tinta'
                  : 'text-tinta hover:bg-superficie'
              }`}
            >
              {TEXTO_ORDEN_PERFIL[opcion]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
