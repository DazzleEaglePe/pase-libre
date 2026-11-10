import type { RespuestaNovedades } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { PaginaSeguidas } from '@/features/seguidas/pagina-seguidas';
import { cargarApi } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'De tiendas que sigues', robots: { index: false } };

const TIPOS = ['todo', 'nuevos', 'remates', 'en_vivo'] as const;

/** `/tiendas-que-sigues` (SEG_Web, SEG_Cel): las novedades de las tiendas que sigues. */
export default async function TiendasQueSigues({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string; tipo?: string }>;
}) {
  const consulta = await searchParams;
  const tipo = TIPOS.find((valor) => valor === consulta.tipo) ?? 'todo';
  const tienda =
    consulta.tienda && /^[0-9a-f-]{36}$/i.test(consulta.tienda) ? consulta.tienda : null;
  const parametros = new URLSearchParams({ tipo });
  if (tienda) parametros.set('tienda', tienda);
  const datos = await cargarApi<RespuestaNovedades>(`/seguidas/novedades?${parametros.toString()}`);
  return <PaginaSeguidas datos={datos} tienda={tienda} tipo={tipo} />;
}
