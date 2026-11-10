import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ProveedorEnVivo } from '@/features/en-vivo/contexto';
import { EnVivoFlotante } from '@/features/en-vivo/flotante';
import { obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraInferior } from '@/shared/ui/barra-inferior';
import { BarraDelSitio } from '@/shared/ui/barra-del-sitio';
import { PiePagina } from '@/shared/ui/pie-pagina';

/**
 * El catálogo: portada, resultados y ficha. Lo ve cualquiera; con sesión, la barra suma la
 * campanita, Mensajes y «Mi cuenta» (con el tiempo real) y la API suma precios y tiendas.
 * El resto de la barra es el mismo con sesión y sin ella.
 */
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (sesion?.usuario.debe_cambiar_clave) redirect('/ingresar');

  const pagina = (
    <ProveedorEnVivo>
      <div className="flex min-h-dvh flex-col">
        <BarraDelSitio sesion={sesion} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
          {children}
        </main>
        <PiePagina conSesion={Boolean(sesion?.tienda)} />
        {/* En vivo (D-53): aparece al entrar y sigue al usuario al bajar. */}
        <EnVivoFlotante conSesion={Boolean(sesion?.tienda)} />
        <BarraInferior conTienda={Boolean(sesion?.tienda)} />
      </div>
    </ProveedorEnVivo>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{pagina}</ProveedorTiempoReal> : pagina;
}
