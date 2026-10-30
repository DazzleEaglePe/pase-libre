import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PaginaEnVivo } from '@/features/en-vivo/pagina';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Pases del día · busco y remates',
  description: 'Lo que las tiendas de Wilson necesitan o rematan hoy.',
};

/**
 * `/pases-del-dia` (EV_Todos, D-53). Por dentro se llama En vivo. Con En vivo apagado (`EN_VIVO`), la API responde 404 y la
 * página tampoco existe.
 */
export default async function PasesDelDia({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
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
