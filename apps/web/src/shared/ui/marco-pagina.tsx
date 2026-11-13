import type { RespuestaYo } from '@paselibre/contracts';
import type { ReactNode } from 'react';

import { ProveedorEnVivo } from '@/features/en-vivo/contexto';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';

import { BarraDelSitio } from './barra-del-sitio';
import { PiePagina } from './pie-pagina';
import { QueNoSePierda } from './que-no-se-pierda';

/**
 * La barra y el pie de siempre, para las páginas que no cuelgan de los layouts del catálogo
 * ni del vendedor: el ingreso, el panel del equipo y el «no encontramos esa página» general.
 * Así todas las pantallas llevan la misma barra arriba y el mismo pie abajo. Cada página
 * trae su propio `<main>`. Con tienda va dentro del tiempo real, como en el catálogo.
 */
export async function MarcoPagina({
  sesion,
  children,
}: {
  sesion: RespuestaYo | null;
  children: ReactNode;
}) {
  const marco = (
    <ProveedorEnVivo>
      <div className="flex min-h-dvh flex-col">
        <BarraDelSitio sesion={sesion} />
        {children}
        <PiePagina conSesion={Boolean(sesion?.tienda)} />
        {/* Sonidos y aviso en la pestaña (doc 19, punto 22). */}
        {sesion?.tienda && !sesion.soporte && <QueNoSePierda />}
      </div>
    </ProveedorEnVivo>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{marco}</ProveedorTiempoReal> : marco;
}
