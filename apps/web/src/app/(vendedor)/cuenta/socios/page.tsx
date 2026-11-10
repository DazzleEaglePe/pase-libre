import type { Metadata } from 'next';

import { TusSocios } from '@/features/socios/tus-socios';

export const metadata: Metadata = { title: 'Tus socios', robots: { index: false } };

/** `/cuenta/socios` (PS_SociosWeb, PS_SociosCel). */
export default function PaginaSocios() {
  return <TusSocios />;
}
