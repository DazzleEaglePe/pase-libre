import type { Metadata } from 'next';

import { CatalogoEquipo } from '@/features/equipo/catalogo';

export const metadata: Metadata = { title: 'Catálogo' };

const PESTANAS = ['productos', 'revisar', 'excel', 'agregar'] as const;

/** `/equipo/catalogo` (COR15): productos, por revisar, subir archivo y agregar uno (`?tab=`). */
export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <CatalogoEquipo pestanaInicial={PESTANAS.find((p) => p === tab) ?? 'productos'} />;
}
