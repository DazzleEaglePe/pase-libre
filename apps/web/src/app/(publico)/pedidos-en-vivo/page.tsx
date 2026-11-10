import type { CategoriaResumen, GaleriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PaginaEnVivo } from '@/features/en-vivo/pagina';
import { consultarApi, consultarApiCompartida, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Pedidos en vivo · busco y remates',
  description: 'Lo que las tiendas de Wilson necesitan o rematan hoy.',
};

/**
 * `/pedidos-en-vivo` (EV_Todos, D-53). Por dentro se llama En vivo. Con En vivo apagado (`EN_VIVO`), la API responde 404 y la
 * página tampoco existe.
 */
export default async function PedidosEnVivo({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tipo?: string }>;
}) {
  const [{ estado }, sesion, { cuerpo: categorias }, { cuerpo: galerias }, { id, tipo }] =
    await Promise.all([
      consultarApi('/en-vivo'),
      obtenerSesion(),
      consultarApiCompartida<CategoriaResumen[]>('/categorias'),
      consultarApiCompartida<GaleriaResumen[]>('/galerias'),
      searchParams,
    ]);
  if (estado === 404) notFound();
  const tipoInicial = tipo === 'remato' ? 'flash' : tipo === 'busco' ? 'busco' : 'todo';

  return (
    <PaginaEnVivo
      // Desde la barra se puede pasar de «Pedidos en vivo» a «Remates de hoy» sin salir.
      key={tipoInicial}
      tipoInicial={tipoInicial}
      conSesion={Boolean(sesion?.tienda)}
      categorias={categorias ?? []}
      galerias={galerias ?? []}
      resaltar={id ?? null}
    />
  );
}
