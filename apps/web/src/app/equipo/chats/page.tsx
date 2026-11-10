import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ChatsEquipo } from '@/features/equipo/chats';

export const metadata: Metadata = { title: 'Chats' };

/** `/equipo/chats`: los chats oficiales con las tiendas. */
export default function PaginaChatsEquipo() {
  return (
    <Suspense fallback={null}>
      <ChatsEquipo />
    </Suspense>
  );
}
