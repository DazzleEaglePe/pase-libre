import type { Metadata } from 'next';

import { Ayuda } from '@/features/informacion/ayuda';

export const metadata: Metadata = {
  title: 'Ayuda',
  description: 'Respuestas a lo que más se pregunta sobre PaseLibre: cuentas, publicar y mensajes.',
};

/** `/ayuda`: preguntas frecuentes. */
export default function PaginaAyuda() {
  return <Ayuda />;
}
