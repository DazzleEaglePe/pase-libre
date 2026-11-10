'use client';

import { IconCheck, IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/** «+ Seguir» de una tienda sugerida (SEG_Web): sigue con los avisos por defecto y recarga. */
export function BotonSeguir({
  tiendaId,
  nombre,
  ancho = false,
}: {
  tiendaId: string;
  nombre: string;
  ancho?: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<'nada' | 'enviando' | 'listo'>('nada');
  const [error, setError] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  async function seguir() {
    setEstado('enviando');
    setError(null);
    try {
      await llamarApi(`/tiendas/${tiendaId}/seguir`, { metodo: 'POST', cuerpo: {} });
      setEstado('listo');
      iniciar(() => router.refresh());
    } catch (falla) {
      setEstado('nada');
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos seguirla.');
    }
  }

  return (
    <span className={`flex flex-col gap-1 ${ancho ? 'w-full' : ''}`}>
      <button
        type="button"
        disabled={estado !== 'nada'}
        aria-label={`Seguir a ${nombre}`}
        onClick={() => void seguir()}
        className={`flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-apoyo font-bold disabled:opacity-80 ${
          estado === 'listo' ? 'bg-pase-suave text-marca' : 'bg-tinta text-white'
        } ${ancho ? 'w-full' : ''}`}
      >
        {estado === 'listo' ? (
          <IconCheck size={16} stroke={2.4} aria-hidden="true" />
        ) : (
          <IconPlus size={16} stroke={2.4} aria-hidden="true" />
        )}
        {estado === 'listo' ? 'Siguiendo' : 'Seguir'}
      </button>
      {error && (
        <span role="alert" className="text-nota text-error">
          {error}
        </span>
      )}
    </span>
  );
}
