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
}: {
  href?: string;
  sobreOscuro?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="PaseLibre, ir al inicio"
      className="flex items-center no-underline"
    >
      <svg viewBox={`0 0 ${logo.ancho} ${logo.alto}`} aria-hidden="true" className="h-6 w-auto">
        <path fill={sobreOscuro ? color.acento : color.pase} fillRule="evenodd" d={logo.simbolo} />
        <g transform={`translate(${logo.palabra.x} ${logo.palabra.y})`} fill="currentColor">
          <path d={logo.palabra.pase} />
          <path d={logo.palabra.libre} />
        </g>
      </svg>
    </Link>
  );
}
