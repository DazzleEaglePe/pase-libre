import type { CategoriaResumen, GaleriaResumen, RespuestaYo } from '@paselibre/contracts';
import type { ReactNode } from 'react';

import { ProveedorEnVivo } from '@/features/en-vivo/contexto';
import { EntradaEnVivo } from '@/features/en-vivo/entrada-banda';
import { consultarApiCompartida } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';

import { Cabecera } from './cabecera';
import { PiePagina } from './pie-pagina';

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
  const [{ cuerpo: categorias }, { cuerpo: galerias }] = await Promise.all([
    consultarApiCompartida<CategoriaResumen[]>('/categorias'),
    consultarApiCompartida<GaleriaResumen[]>('/galerias'),
  ]);

  const marco = (
    <ProveedorEnVivo>
      <div className="flex min-h-dvh flex-col">
        <Cabecera
          sesion={sesion}
          categorias={categorias ?? []}
          galerias={galerias ?? []}
          enBanda={<EntradaEnVivo />}
        />
        {children}
        <PiePagina conSesion={Boolean(sesion?.tienda)} />
      </div>
    </ProveedorEnVivo>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{marco}</ProveedorTiempoReal> : marco;
}
