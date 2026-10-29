import { color } from '@paselibre/ui';
import Link from 'next/link';

import { LOGO_HORIZONTAL as logo } from './marca-trazos';

/**
 * Logo de PaseLibre (branding/): la entrada con la flecha y la palabra. La palabra toma el
 * color del texto, así sirve en la barra clara y en la oscura del equipo; el símbolo va en
 * azul pase y, sobre fondo oscuro, en el acento.
 */
export function Marca({
  href = '/',
  sobreOscuro = false,
  conFrase = false,
}: {
  href?: string;
  sobreOscuro?: boolean;
  /** «Pases entre tiendas de Wilson» debajo del logo, como en la barra del lienzo. */
  conFrase?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="PaseLibre, ir al inicio"
      className={`flex no-underline ${conFrase ? 'flex-col items-start gap-1' : 'items-center'}`}
    >
      <svg
        viewBox={`0 0 ${logo.ancho} ${logo.alto}`}
        aria-hidden="true"
        className={conFrase ? 'h-7 w-auto sm:h-8' : 'h-6 w-auto'}
      >
        <path fill={sobreOscuro ? color.acento : color.pase} fillRule="evenodd" d={logo.simbolo} />
        <g transform={`translate(${logo.palabra.x} ${logo.palabra.y})`} fill="currentColor">
          <path d={logo.palabra.pase} />
          <path d={logo.palabra.libre} />
        </g>
      </svg>
      {conFrase && (
        <span className="text-nota text-secundario max-sm:hidden">
          Pases entre tiendas de Wilson
        </span>
      )}
    </Link>
  );
}
