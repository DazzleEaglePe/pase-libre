import type { Metadata } from 'next';

import { Terminos } from '@/features/informacion/terminos';

export const metadata: Metadata = {
  title: 'Términos de uso',
  description: 'Las reglas para usar PaseLibre.',
};

/** `/terminos`: términos de uso (RNF-22, RNF-23). */
export default function PaginaTerminos() {
  return <Terminos />;
}
