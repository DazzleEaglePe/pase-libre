import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TiendasPanel } from '@/features/equipo/tiendas';

export const metadata: Metadata = { title: 'Tiendas' };

/** `/equipo/tiendas` (ADM_WebTiendas): buscar, ver su historial, advertir o suspender. */
export default function PaginaTiendasPanel() {
  return (
    <Suspense fallback={null}>
      <TiendasPanel />
    </Suspense>
  );
}
