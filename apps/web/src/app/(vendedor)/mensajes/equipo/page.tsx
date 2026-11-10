import type { Metadata } from 'next';

import { ChatEquipo } from '@/features/mensajes/chat-equipo';

export const metadata: Metadata = { title: 'Equipo PaseLibre', robots: { index: false } };

/** `/mensajes/equipo` (REP_WebChatEquipo): el chat oficial con el equipo, fijado arriba. */
export default function ChatConElEquipo() {
  return <ChatEquipo />;
}
