import { urlFoto } from '@paselibre/contracts';

import { GlifoCategoria } from './glifo-categoria';

/** Si las clases ya le ponen un borde («border», «border-2», «sm:border-b»…). */
const CON_BORDE = /(^|\s)([\w[\]-]+:)*border(-|\s|$)/;

/**
 * La foto del producto o de la oferta; sin foto, el dibujo de su categoría sobre el gris
 * del lienzo. El tamaño lo da `className` (por ejemplo `h-[42px] w-14`).
 *
 * La foto va sobre blanco, `foto-fondo` (doc 20 · punto 3): las fotos se guardan en blanco o
 * transparentes. Para que una foto blanca no quede «blanco sobre blanco» sin borde, lleva un
 * filete gris de 1 px por dentro (`marco`), salvo que las clases ya le den un borde. Las fotos
 * que van de borde a borde de su tarjeta (con su línea debajo) lo apagan con `marco={false}`.
 */
export function Miniatura({
  ruta,
  categoria,
  className,
  glifo = 40,
  grosor,
  prioridad = false,
  marco,
}: {
  ruta: string | null;
  categoria: string;
  className: string;
  glifo?: number;
  grosor?: number;
  /** La foto más grande de la página (LCP): sin espera y antes que las demás. */
  prioridad?: boolean;
  /** El filete gris de 1 px. Por defecto, solo si las clases no le ponen un borde. */
  marco?: boolean;
}) {
  const conMarco = ruta !== null && (marco ?? !CON_BORDE.test(className));
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden ${
        ruta ? 'bg-foto-fondo' : 'bg-superficie'
      } ${conMarco ? 'shadow-[inset_0_0_0_1px_#DDE4E0]' : ''} ${className}`}
    >
      {ruta ? (
        // Las fotos ya llegan en WebP y reducidas desde la API. `contain`: la foto de una caja o
        // de un producto sobre blanco no se corta (con `cover` se perdía el modelo escrito). Al
        // 86 % queda un margen blanco alrededor, como en la maqueta.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFoto(ruta)}
          alt=""
          loading={prioridad ? 'eager' : 'lazy'}
          fetchPriority={prioridad ? 'high' : 'auto'}
          className="h-[86%] w-[86%] object-contain"
        />
      ) : (
        <GlifoCategoria categoria={categoria} ancho={glifo} grosor={grosor} />
      )}
    </span>
  );
}
