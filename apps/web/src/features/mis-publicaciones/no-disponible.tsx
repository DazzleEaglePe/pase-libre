'use client';

import { RAZONES_PAUSA, RAZON_SEPARADA, type OfertaPropia } from '@paselibre/contracts';
import { IconChevronDown, IconEyeOff, IconPencil } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

export type RazonNoDisponible = (typeof RAZONES_PAUSA)[number];

/** Lo que hace cada motivo, debajo de su nombre en el menú (doc 20, punto 16; tablero P34, C). */
const QUE_HACE: Record<RazonNoDisponible, string> = {
  'Se me acabó': 'Queda en «Sin stock». Vuelve sola cuando subes la cantidad.',
  'La separé para un cliente': 'Se oculta. En el chat dice «Separada».',
  'Otro motivo': 'Se oculta hasta que la vuelvas a mostrar.',
};

/**
 * «Editar» con el lápiz (doc 20, punto 14): siempre, en cada fila de Mis publicaciones. Lleva a la
 * pantalla de publicar con todo cargado (`/publicar?editar=`).
 */
export function BotonEditar({
  oferta,
  className = '',
}: {
  oferta: Pick<OfertaPropia, 'id' | 'producto'>;
  className?: string;
}) {
  return (
    <Link
      href={`/publicar?editar=${oferta.id}`}
      aria-label={`Editar ${oferta.producto.titulo}`}
      className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-tinta px-4 text-apoyo font-bold text-white no-underline hover:bg-black ${className}`}
    >
      <IconPencil size={15} stroke={2} aria-hidden="true" />
      Editar
    </Link>
  );
}

/**
 * «No disponible ▾» con el ojo tachado (doc 20, punto 16): un solo botón que abre «¿Por qué no
 * está disponible?». «Se me acabó» deja el stock en 0; las otras dos la ocultan con su razón.
 */
export function MenuNoDisponible({
  titulo,
  abierto,
  alAbrir,
  alElegir,
  className = '',
}: {
  titulo: string;
  abierto: boolean;
  alAbrir: (abrir: boolean) => void;
  alElegir: (razon: RazonNoDisponible) => void;
  className?: string;
}) {
  const caja = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  // La función cambia en cada dibujo de la lista: así el menú no vuelve a tomar el foco.
  const abrir = useRef(alAbrir);
  abrir.current = alAbrir;

  useEffect(() => {
    if (!abierto) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const afuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) abrir.current(false);
    };
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        abrir.current(false);
        caja.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return;
      }
      if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
      const opciones = [
        ...(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []),
      ];
      if (opciones.length === 0) return;
      evento.preventDefault();
      const ahora = opciones.indexOf(document.activeElement as HTMLButtonElement);
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      opciones[(ahora + paso + opciones.length) % opciones.length]?.focus();
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', teclas);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', teclas);
    };
  }, [abierto]);

  return (
    <span ref={caja} className={`relative flex ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`No disponible: ${titulo}`}
        onClick={() => alAbrir(!abierto)}
        className="flex h-10 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-borde bg-white px-4 text-apoyo font-bold text-tinta hover:bg-superficie"
      >
        <IconEyeOff size={16} stroke={2} aria-hidden="true" />
        No disponible
        <IconChevronDown size={14} stroke={2.2} aria-hidden="true" />
      </button>
      {abierto && (
        <div
          ref={menu}
          role="menu"
          aria-label="¿Por qué no está disponible?"
          className="absolute right-0 top-12 z-40 flex w-[min(330px,calc(100vw-64px))] flex-col rounded-2xl border border-linea bg-white p-1.5 text-left shadow-[0_18px_40px_rgba(20,22,26,0.18)]"
        >
          <span
            aria-hidden="true"
            className="px-3 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[.06em] text-secundario"
          >
            ¿Por qué no está disponible?
          </span>
          {RAZONES_PAUSA.map((razon) => (
            <button
              key={razon}
              type="button"
              role="menuitem"
              onClick={() => {
                alAbrir(false);
                alElegir(razon);
              }}
              className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left hover:bg-superficie focus-visible:bg-superficie focus-visible:outline-none"
            >
              <b className="text-apoyo font-bold text-tinta">{razon}</b>
              <span className="text-nota text-secundario">{QUE_HACE[razon]}</span>
            </button>
          ))}
          <span className="mt-1 border-t border-linea px-3 pb-2 pt-2.5 text-nota text-secundario">
            Mientras no esté disponible, no sale en búsquedas ni en el feed.
          </span>
        </div>
      )}
    </span>
  );
}

/**
 * Por qué no está disponible, en la pestaña «No disponibles»: «Sin stock», o la razón con que se
 * ocultó («Se me acabó», «Separada para un cliente», «Otro motivo»).
 */
export function motivoNoDisponible(oferta: Pick<OfertaPropia, 'estado' | 'razon_pausa'>): string {
  if (oferta.estado === 'ACTIVA') return 'Sin stock';
  if (oferta.razon_pausa === RAZON_SEPARADA) return 'Separada para un cliente';
  return oferta.razon_pausa ?? 'Oculta';
}
