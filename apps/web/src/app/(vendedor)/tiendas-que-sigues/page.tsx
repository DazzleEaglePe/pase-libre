import type { RespuestaNovedades } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { PaginaSeguidas } from '@/features/seguidas/pagina-seguidas';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'De tiendas que sigues', robots: { index: false } };

const TIPOS = ['todo', 'nuevos', 'remates', 'en_vivo'] as const;

/** `/tiendas-que-sigues` (SEG_Web, SEG_Cel): las novedades de las tiendas que sigues. */
export default async function TiendasQueSigues({
  searchParams,
}: {
  searchParams: Promise<{ tienda?: string; tipo?: string }>;
}) {
  // Sin sesión con tienda el layout manda a ingresar. La página se renderiza a la vez que el
  // layout: si pidiera los datos igual, la API respondería 401 y quedaría un error en el registro.
  const sesion = await obtenerSesion();
  if (!sesion?.tienda || sesion.usuario.debe_cambiar_clave) return null;
  const consulta = await searchParams;
  const tipo = TIPOS.find((valor) => valor === consulta.tipo) ?? 'todo';
  const tienda =
    consulta.tienda && /^[0-9a-f-]{36}$/i.test(consulta.tienda) ? consulta.tienda : null;
  const parametros = new URLSearchParams({ tipo });
  if (tienda) parametros.set('tienda', tienda);
  const datos = await cargarApi<RespuestaNovedades>(`/seguidas/novedades?${parametros.toString()}`);
  return <PaginaSeguidas datos={datos} tienda={tienda} tipo={tipo} />;
}
