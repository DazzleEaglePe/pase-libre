import type { Metadata } from 'next';

import { PaginaAvisos } from '@/features/avisos/pagina-avisos';

export const metadata: Metadata = { title: 'Avisos', robots: { index: false } };

/** `/avisos` (AV_Web, AV_Cel): todos los avisos y su configuración. */
export default function Avisos() {
  return <PaginaAvisos />;
}
