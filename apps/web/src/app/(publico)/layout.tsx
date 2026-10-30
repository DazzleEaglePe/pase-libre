import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { EnVivoFlotante } from '@/features/en-vivo/flotante';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { Cabecera } from '@/shared/ui/cabecera';
import { PiePagina } from '@/shared/ui/pie-pagina';

/**
 * El catálogo: portada, resultados y ficha. Lo ve cualquiera; con sesión, la barra suma la
 * campanita, Mensajes y «Mi cuenta» (con el tiempo real) y la API suma precios y tiendas.
 * El resto de la barra es el mismo con sesión y sin ella.
 */
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const [sesion, { cuerpo: categorias }, { cuerpo: galerias }] = await Promise.all([
    obtenerSesion(),
    // Si la API no responde, la barra sale sin categorías y la página muestra su propio error.
    consultarApi<CategoriaResumen[]>('/categorias'),
    consultarApi<GaleriaResumen[]>('/galerias'),
  ]);
  if (sesion?.usuario.debe_cambiar_clave) redirect('/ingresar');

  const pagina = (
    <div className="flex min-h-dvh flex-col">
      <Cabecera sesion={sesion} categorias={categorias ?? []} galerias={galerias ?? []} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
        {children}
      </main>
      <PiePagina />
      {/* En vivo (D-53): aparece al entrar y sigue al usuario al bajar. */}
      <EnVivoFlotante conSesion={Boolean(sesion?.tienda)} />
    </div>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{pagina}</ProveedorTiempoReal> : pagina;
}
