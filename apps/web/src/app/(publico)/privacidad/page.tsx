import type { Metadata } from 'next';

import { Privacidad } from '@/features/informacion/privacidad';

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos guarda PaseLibre, para qué los usa y quién los ve.',
};

/** `/privacidad`: política de privacidad (RNF-21 a RNF-24). */
export default function PaginaPrivacidad() {
  return <Privacidad />;
}
