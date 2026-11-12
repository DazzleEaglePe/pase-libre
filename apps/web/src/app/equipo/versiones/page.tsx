import type { Metadata } from 'next';

import { Versiones } from '@/features/equipo/versiones';

export const metadata: Metadata = { title: 'Versiones' };

/** `/equipo/versiones` (docs/18 §9): todas las versiones de PaseLibre con su detalle. */
export default function PaginaVersiones() {
  return <Versiones />;
}
