import type { Metadata } from 'next';

import { GaleriasPanel } from '@/features/equipo/galerias';

export const metadata: Metadata = { title: 'Galerías' };

/** `/equipo/galerias` (docs/18 §3): la lista de galerías, su orden y los avisos de galerías nuevas. */
export default function PaginaGalerias() {
  return <GaleriasPanel />;
}
