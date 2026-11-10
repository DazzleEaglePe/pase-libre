import { color } from '@paselibre/ui';
import Link from 'next/link';

import { LOGO_HORIZONTAL as logo } from './marca-trazos';

/**
 * Logo de PaseLibre (branding/): la entrada con la flecha y la palabra. La palabra toma el
 * color del texto, así sirve en la barra clara y en la oscura del equipo; el símbolo va en
 * verde pase y, sobre fondo oscuro, en el acento.
 */
export function Marca({
  href = '/',
  sobreOscuro = false,
  sobreMarca = false,
  conFrase = false,
}: {
  href?: string;
  sobreOscuro?: boolean;
  /** Sobre el verde de la marca (el pie): el símbolo en blanco, con la flecha calada en el verde. */
  sobreMarca?: boolean;
  /** «Pases entre tiendas de Wilson» debajo del logo, como en la barra del lienzo. */
  conFrase?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="PaseLibre, ir al inicio"
      className={`flex no-underline ${sobreMarca ? 'text-white' : ''} ${conFrase ? 'flex-col items-start gap-1' : 'items-center'}`}
    >
      <svg
        viewBox={`0 0 ${logo.ancho} ${logo.alto}`}
        aria-hidden="true"
        className={conFrase ? 'h-7 w-auto' : 'h-6 w-auto'}
      >
        <path
          fill={sobreMarca ? '#FFFFFF' : sobreOscuro ? color.acento : color.pase}
          fillRule="evenodd"
          d={logo.simbolo}
        />
        <g transform={`translate(${logo.palabra.x} ${logo.palabra.y})`} fill="currentColor">
          <path d={logo.palabra.pase} />
          <path d={logo.palabra.libre} />
        </g>
      </svg>
      {conFrase && (
        <span
          className={`text-[12px] leading-4 max-sm:hidden ${sobreMarca ? 'text-pase-medio' : 'text-secundario'}`}
        >
          Pases entre tiendas de Wilson
        </span>
      )}
    </Link>
  );
}
