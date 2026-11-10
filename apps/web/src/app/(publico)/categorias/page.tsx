import type { CategoriaResumen } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { TodasLasCategorias } from '@/features/catalogo/todas-las-categorias';
import { consultarApiCompartida } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Todas las categorías',
  description: 'Las categorías de PaseLibre con cuántos productos hay hoy en Wilson.',
};

/** «Todas las categorías» en el celular (CAT_Cel1); en la computadora es el menú de la barra. */
export default async function PaginaCategorias() {
  const { cuerpo: categorias } = await consultarApiCompartida<CategoriaResumen[]>('/categorias');
  return <TodasLasCategorias categorias={categorias ?? []} />;
}
