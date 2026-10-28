import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraVendedor } from '@/shared/ui/barra-vendedor';
import { BarraVisitante } from '@/shared/ui/barra-visitante';
import { PieCompacto } from '@/shared/ui/pie-compacto';

/**
 * El catálogo: portada, resultados y ficha. Lo ve cualquiera; con sesión, la barra es la de
 * la tienda (con el tiempo real para la campanita) y la API suma precios y tiendas.
 */
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const sesion = await obtenerSesion();
  if (sesion?.usuario.debe_cambiar_clave) redirect('/ingresar');

  const pagina = (
    <div className="flex min-h-dvh flex-col">
      {sesion?.tienda ? (
        <BarraVendedor tienda={sesion.tienda} />
      ) : (
        <BarraVisitante sesion={sesion} />
      )}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
        {children}
      </main>
      <PieCompacto />
    </div>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{pagina}</ProveedorTiempoReal> : pagina;
}
