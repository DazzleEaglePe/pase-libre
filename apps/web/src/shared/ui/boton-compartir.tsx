'use client';

import { IconCheck, IconShare } from '@tabler/icons-react';
import { useState } from 'react';

/**
 * «Compartir» de la ficha (M_Ficha): en el celular abre el menú del sistema para mandar el
 * enlace por WhatsApp u otra app; donde no lo hay, copia el enlace.
 */
export function BotonCompartir({ titulo }: { titulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: titulo, url });
      } catch {
        // Cerró el menú sin compartir: no es un error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso para copiar: no hay nada más que hacer.
    }
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-borde bg-white px-3.5 text-apoyo font-semibold text-tinta"
    >
      {copiado ? (
        <IconCheck size={18} stroke={1.8} aria-hidden="true" />
      ) : (
        <IconShare size={18} stroke={1.8} aria-hidden="true" />
      )}
      <span aria-live="polite">{copiado ? 'Enlace copiado' : 'Compartir'}</span>
    </button>
  );
}
