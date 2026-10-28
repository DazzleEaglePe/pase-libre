import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Bandeja } from '@/features/mensajes/bandeja';

export const metadata: Metadata = {
  title: 'Mensajes',
  robots: { index: false },
};

/** `/mensajes` y `/mensajes/:conversacion` (C_Mensajes): la lista queda fija al cambiar de hilo. */
export default function LayoutMensajes({ children }: { children: ReactNode }) {
  return <Bandeja>{children}</Bandeja>;
}
