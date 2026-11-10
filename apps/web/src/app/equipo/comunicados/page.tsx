import type { Metadata } from 'next';
import { Suspense } from 'react';

import { Comunicados } from '@/features/equipo/comunicados';

export const metadata: Metadata = { title: 'Comunicados' };

/** `/equipo/comunicados` (ADM_WebComunicados): mensajes para muchas tiendas a la vez. */
export default function PaginaComunicados() {
  return (
    <Suspense fallback={null}>
      <Comunicados />
    </Suspense>
  );
}
