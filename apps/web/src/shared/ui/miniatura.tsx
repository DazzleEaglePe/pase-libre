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
  prioridad = false,
}: {
  ruta: string | null;
  categoria: string;
  className: string;
  glifo?: number;
  grosor?: number;
  /** La foto más grande de la página (LCP): sin espera y antes que las demás. */
  prioridad?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${
        ruta ? 'bg-white' : 'bg-superficie'
      } ${className}`}
    >
      {ruta ? (
        // Las fotos ya llegan en WebP y reducidas desde la API. `contain`: la foto de una caja o
        // de un producto sobre blanco no se corta (con `cover` se perdía el modelo escrito).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFoto(ruta)}
          alt=""
          loading={prioridad ? 'eager' : 'lazy'}
          fetchPriority={prioridad ? 'high' : 'auto'}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <GlifoCategoria categoria={categoria} ancho={glifo} grosor={grosor} />
      )}
    </span>
  );
}
