import type { CategoriaResumen } from '@paselibre/contracts';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { ProveedorTiempoReal } from '@/shared/tiempo-real';
import { BarraVendedor } from '@/shared/ui/barra-vendedor';
import { BarraVisitante } from '@/shared/ui/barra-visitante';
import { FilaCategorias } from '@/shared/ui/fila-categorias';
import { PiePagina } from '@/shared/ui/pie-pagina';

/**
 * El catálogo: portada, resultados y ficha. Lo ve cualquiera; con sesión, la barra es la de
 * la tienda (con el tiempo real para la campanita) y la API suma precios y tiendas. El
 * buscador y la fila de categorías son los mismos con sesión y sin ella.
 */
export default async function LayoutPublico({ children }: { children: ReactNode }) {
  const [sesion, { cuerpo: categorias }] = await Promise.all([
    obtenerSesion(),
    // Si la API no responde, la barra sale sin categorías y la página muestra su propio error.
    consultarApi<CategoriaResumen[]>('/categorias'),
  ]);
  if (sesion?.usuario.debe_cambiar_clave) redirect('/ingresar');
  const lista = categorias ?? [];

  const pagina = (
    <div className="flex min-h-dvh flex-col">
      {sesion?.tienda ? (
        <BarraVendedor tienda={sesion.tienda} categorias={lista} />
      ) : (
        <BarraVisitante sesion={sesion} categorias={lista} />
      )}
      <FilaCategorias categorias={lista} />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-5 sm:px-8">
        {children}
      </main>
      <PiePagina />
    </div>
  );
  return sesion?.tienda ? <ProveedorTiempoReal>{pagina}</ProveedorTiempoReal> : pagina;
}
