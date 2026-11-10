import type { RespuestaPreciosCategoria } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PaginaCategoria } from '@/features/categoria/pagina-categoria';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = { title: 'Precios por modelo', robots: { index: false } };

const ORDENES = ['vendidos', 'baratos', 'bajaron'] as const;

/**
 * `/categorias/<slug>` (CAT_Web4, CAT_Cel4): los precios de pase por modelo de una categoría.
 * Sin sesión, a los resultados de esa categoría: los clientes nunca ven esta página.
 */
export default async function Categoria({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, consulta, sesion] = await Promise.all([params, searchParams, obtenerSesion()]);
  if (!sesion) redirect(`/buscar?categoria=${encodeURIComponent(slug)}`);
  const parametros = new URLSearchParams();
  for (const clave of ['orden', 'marca', 'estado', 'galeria']) {
    const valor = consulta[clave];
    if (valor) parametros.set(clave, valor);
  }
  const respuesta = await consultarApi<RespuestaPreciosCategoria>(
    `/categorias/${encodeURIComponent(slug)}/precios?${parametros.toString()}`,
  );
  if (respuesta.estado === 404) notFound();
  // Un filtro que no existe (una dirección vieja o escrita a mano): la categoría sin filtros.
  if (respuesta.estado !== 200 || !respuesta.cuerpo) redirect(`/categorias/${slug}`);
  const orden = ORDENES.find((valor) => valor === consulta.orden) ?? 'vendidos';
  return (
    <PaginaCategoria datos={respuesta.cuerpo} orden={orden} consulta={parametros.toString()} />
  );
}
