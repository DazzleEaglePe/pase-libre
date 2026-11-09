import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';

/**
 * La última pieza de «Recién publicado» (versión C): una tarjeta punteada que lleva a todo el
 * catálogo, o al de la galería que está elegida.
 */
export function TarjetaVerTodo({
  href,
  titulo,
  detalle,
}: {
  href: string;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-acento bg-pase-suave/60 p-6 text-center no-underline hover:bg-pase-suave"
    >
      <span
        aria-hidden="true"
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-pase text-white"
      >
        <IconArrowRight size={20} stroke={1.8} />
      </span>
      <span className="text-tarjeta text-[#1F3FC2]">{titulo}</span>
      <span className="text-nota text-detalle">{detalle}</span>
    </Link>
  );
}
