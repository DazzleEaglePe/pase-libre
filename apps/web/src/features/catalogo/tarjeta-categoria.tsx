import { IconLayoutGrid } from '@tabler/icons-react';
import Link from 'next/link';

import { GlifoCategoria } from '@/shared/ui/glifo-categoria';

export const textoProductos = (cantidad: number): string =>
  cantidad === 1 ? '1 producto' : `${cantidad} productos`;

/**
 * La tarjeta de una categoría: su dibujo, el nombre y cuántos productos hay (J, la misma
 * pieza en la portada, arriba de los resultados y en la página sin resultados). Sin `slug`
 * es «Todas». `compacta` es la de la fila que se desliza arriba de los resultados.
 */
export function TarjetaCategoria({
  href,
  slug,
  nombre,
  productos,
  elegida = false,
  compacta = false,
}: {
  href: string;
  slug: string | null;
  nombre: string;
  productos: number;
  elegida?: boolean;
  compacta?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={elegida ? 'true' : undefined}
      className={`flex flex-col items-center justify-center rounded-2xl border bg-white p-3 text-center text-tinta no-underline ${
        elegida ? 'border-tinta ring-1 ring-tinta' : 'border-linea hover:border-borde'
      } ${compacta ? 'h-[124px] w-[132px] shrink-0 gap-2 max-sm:h-[108px] max-sm:w-[112px]' : 'h-[156px] gap-3'}`}
    >
      <span aria-hidden="true" className="flex h-11 items-center justify-center text-secundario">
        {slug ? (
          <GlifoCategoria categoria={slug} ancho={compacta ? 60 : 72} grosor={compacta ? 4 : 3.2} />
        ) : (
          <IconLayoutGrid size={28} stroke={1.5} />
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-apoyo font-semibold">{nombre}</span>
        <span className="text-nota text-detalle">{textoProductos(productos)}</span>
      </span>
    </Link>
  );
}
