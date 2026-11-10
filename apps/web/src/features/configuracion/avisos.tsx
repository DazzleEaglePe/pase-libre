'use client';

import { ConfigurarAvisos } from '@/features/avisos/configurar';

/** Configuración · Avisos (RF-59): lo mismo que «Configurar avisos» de la página Avisos. */
export function SeccionAvisos({ alAvisar }: { alAvisar: (mensaje: string) => void }) {
  return <ConfigurarAvisos alAvisar={alAvisar} />;
}
