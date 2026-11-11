import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Todo lo «en vivo» va en Brasa (guía del lienzo final): el degradado naranja con texto negro y
 * un punto blanco que late. «¡Lo tengo!» va aparte, en naranja sólido, para no confundirse.
 */
export const claseBrasa = 'bg-brasa text-tinta';

/** El punto blanco que late: se apaga y prende cada 1,4 s; quieto con «reducir movimiento». */
export function PuntoQueLate({ tamano = 9 }: { tamano?: number }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 animate-latido rounded-full bg-white"
      style={{ width: tamano, height: tamano }}
    />
  );
}

/** «● EN VIVO»: la etiqueta de cada pedido en vivo. */
export function EtiquetaEnVivo() {
  return (
    <span className="inline-flex h-[26px] shrink-0 items-center gap-[5px] rounded-full bg-brasa px-2.5 text-[11px] font-extrabold tracking-[0.05em] text-tinta">
      <PuntoQueLate tamano={7} />
      EN VIVO
    </span>
  );
}

/** El botón Brasa: «Pedir algo en vivo», «Publicar en vivo», «¿Es urgente? Publicar en vivo». */
export function BotonBrasa({
  href,
  children,
  grande = false,
  className = '',
}: {
  href: string;
  children: ReactNode;
  grande?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brasa font-bold text-tinta no-underline hover:brightness-105 ${
        grande ? 'h-[52px] px-6 text-[16px]' : 'h-[46px] px-5 text-[15px]'
      } ${className}`}
    >
      <PuntoQueLate />
      {children}
    </Link>
  );
}
