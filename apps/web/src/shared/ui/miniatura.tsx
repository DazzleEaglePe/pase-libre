import { urlFoto } from '@paselibre/contracts';

import { GlifoCategoria } from './glifo-categoria';

/**
 * La foto del producto o de la oferta; sin foto, el dibujo de su categoría sobre el gris
 * del lienzo. El tamaño lo da `className` (por ejemplo `h-[42px] w-14`).
 */
export function Miniatura({
  ruta,
  categoria,
  className,
  glifo = 40,
  grosor,
}: {
  ruta: string | null;
  categoria: string;
  className: string;
  glifo?: number;
  grosor?: number;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-superficie ${className}`}
    >
      {ruta ? (
        // Las fotos ya llegan en WebP y reducidas desde la API.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urlFoto(ruta)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <GlifoCategoria categoria={categoria} ancho={glifo} grosor={grosor} />
      )}
    </span>
  );
}
