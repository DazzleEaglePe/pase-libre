import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PaginaEnVivo } from '@/features/en-vivo/pagina';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'En vivo · busco y ofertas flash',
  description: 'Lo que las tiendas de Wilson necesitan o rematan hoy.',
};

/**
 * `/en-vivo` (EV_Todos, D-53). Con En vivo apagado (`EN_VIVO`), la API responde 404 y la
 * página tampoco existe.
 */
export default async function EnVivo({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const [{ estado }, sesion, { cuerpo: categorias }, { cuerpo: galerias }, { id }] =
    await Promise.all([
      consultarApi('/en-vivo'),
      obtenerSesion(),
      consultarApi<CategoriaResumen[]>('/categorias'),
      consultarApi<GaleriaResumen[]>('/galerias'),
      searchParams,
    ]);
  if (estado === 404) notFound();

  return (
    <PaginaEnVivo
      conSesion={Boolean(sesion?.tienda)}
      categorias={categorias ?? []}
      galerias={galerias ?? []}
      resaltar={id ?? null}
    />
  );
}
