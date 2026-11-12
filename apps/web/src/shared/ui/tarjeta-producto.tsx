import { formatearPrecio, type Precio } from '@paselibre/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Miniatura } from './miniatura';

const pildora =
  'inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-[14px] font-extrabold leading-5';
const burbuja =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-[9px] py-0.5 text-[12px] font-extrabold leading-4';

function IconoCandado() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconoSocios() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5M15 14.6c2.6.2 4.4 2 5 5.4" />
    </svg>
  );
}

/** «Socio» en verde con borde dorado y su chispa (N06). */
export function BurbujaSocio() {
  return (
    <span
      className={`${burbuja} border-[#E2B93B] bg-[linear-gradient(135deg,#16A673,#0B6B4A)] text-white`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#F5D06A" aria-hidden="true">
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
      </svg>
      Socio
    </span>
  );
}

/** «Negociable» en amarillo (N06): pase que se puede conversar. */
export function BurbujaNegociable() {
  return (
    <span className={`${burbuja} border-[#F2D675] bg-[#FEF6C7] text-[#7A5B00]`}>Negociable</span>
  );
}

/**
 * El precio con su burbujita al costado (N06), igual en todas las tarjetas del sitio:
 * - «S/ 3,886 · Pase»: precio de pase, lo ven todas las tiendas.
 * - «S/ 3,886 · Pase · Negociable»: pase que se puede conversar.
 * - «S/ 1,240 · Socio» (verde claro, burbuja con dorado): solo lo ven tus socios.
 * - «Por chat» (plomo, con candado): privado, el precio se pide por chat.
 * Sin leyenda: la burbujita lo explica sola.
 */
export function PrecioBurbuja({
  precio,
  socio = false,
  negociable = false,
}: {
  /** Nulo: «Por chat». */
  precio: Precio | null;
  socio?: boolean;
  negociable?: boolean;
}) {
  if (!precio) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={`${pildora} border-[1.5px] border-borde bg-[#E2E7E4] text-secundario`}>
          <IconoCandado />
          Por chat
        </span>
      </span>
    );
  }
  if (socio) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={`${pildora} border-[1.5px] border-[#7FD0A8] bg-[#D3F2E2] text-[#0B5E40]`}>
          <IconoSocios />
          {formatearPrecio(precio)}
        </span>
        <BurbujaSocio />
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${pildora} bg-pase text-white`}>{formatearPrecio(precio)}</span>
      <span className={`${burbuja} border-pase bg-white text-marca`}>Pase</span>
      {negociable && <BurbujaNegociable />}
    </span>
  );
}

/**
 * La tarjeta de producto de todo el sitio (N04 B, N06, N15): blanca con borde de 2 px para que
 * se separe aunque cada foto traiga su propio fondo, la foto con «Hace 5 min» encima, el
 * producto en dos líneas, el precio con su burbujita y «Nuevo · Pegasus5000» abajo. La usan el
 * feed, el perfil de la tienda y los demás listados tal cual.
 */
export function TarjetaProducto({
  href,
  titulo,
  foto,
  categoria,
  precio,
  socio = false,
  negociable = false,
  linea,
  etiqueta,
  pie,
  prioridad = false,
}: {
  href: string;
  titulo: string;
  foto: string | null;
  /** Slug de la categoría: su dibujo cuando no hay foto. */
  categoria: string;
  /** Nulo: «Por chat». */
  precio: Precio | null;
  socio?: boolean;
  negociable?: boolean;
  /** «Nuevo · Pegasus5000». */
  linea?: string;
  /** «Hace 5 min», en una píldora sobre la foto. */
  etiqueta?: string;
  /** Algo más al final (las vistas y los chats en tu propio perfil, por ejemplo). */
  pie?: ReactNode;
  prioridad?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 flex-col gap-1.5 rounded-[18px] border-2 border-borde bg-white p-2.5 text-tinta no-underline hover:border-borde-control"
    >
      <span className="relative block">
        <Miniatura
          ruta={foto}
          categoria={categoria}
          className="h-[120px] w-full rounded-xl"
          glifo={84}
          grosor={2}
          prioridad={prioridad}
        />
        {etiqueta && (
          <span className="absolute left-2 top-2 rounded-full border border-[#E2E7E4] bg-white px-2 py-0.5 text-[11px] font-extrabold leading-4 text-secundario">
            {etiqueta}
          </span>
        )}
      </span>
      <b className="line-clamp-2 min-h-9 text-[13px] font-bold leading-[18px] group-hover:underline">
        {titulo}
      </b>
      <PrecioBurbuja precio={precio} socio={socio} negociable={negociable} />
      {linea && <span className="truncate text-[12px] leading-4 text-detalle">{linea}</span>}
      {pie}
    </Link>
  );
}
