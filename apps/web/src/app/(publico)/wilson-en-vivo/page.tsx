import type { RespuestaWilson } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { PaginaWilson } from '@/features/wilson/pagina-wilson';
import { cargarApi } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Wilson en vivo',
  description: 'Qué hay publicado en cada galería de la avenida Wilson y qué tan lejos está.',
};

/** `/wilson-en-vivo` (CAT_Web3, CAT_Cel3): las galerías de la avenida y lo de cada una. */
export default async function WilsonEnVivo({
  searchParams,
}: {
  searchParams: Promise<{ galeria?: string; categoria?: string; vista?: string }>;
}) {
  const { galeria, categoria, vista } = await searchParams;
  const parametros = new URLSearchParams();
  if (galeria) parametros.set('galeria', galeria);
  if (categoria) parametros.set('categoria', categoria);
  const datos = await cargarApi<RespuestaWilson>(
    `/wilson${parametros.size > 0 ? `?${parametros.toString()}` : ''}`,
  );
  return <PaginaWilson datos={datos} vista={vista === 'tiendas' ? 'tiendas' : 'publicado'} />;
}
