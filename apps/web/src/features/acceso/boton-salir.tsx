'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

export function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <button
      type="button"
      disabled={saliendo}
      onClick={async () => {
        setSaliendo(true);
        try {
          await llamarApi('/sesion', { metodo: 'DELETE' });
        } finally {
          router.refresh();
          setSaliendo(false);
        }
      }}
      className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium"
    >
      {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
