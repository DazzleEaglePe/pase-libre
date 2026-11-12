'use client';

import type { RespuestaYo } from '@paselibre/contracts';
import { IconUser } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

function minutosHasta(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60_000));
}

/**
 * La franja de «Ayudar como la tienda» (N14): arriba de todo mientras el equipo ve PaseLibre
 * como el dueño. Dice a quién ayuda, cuánto queda y que no se puede chatear ni cerrar ventas.
 * Al vencer se refresca (la API ya volvió a ser la cuenta del equipo).
 */
export function FranjaSoporte({ soporte }: { soporte: NonNullable<RespuestaYo['soporte']> }) {
  const router = useRouter();
  const [quedan, setQuedan] = useState(() => minutosHasta(soporte.vence_en));
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const reloj = setInterval(() => {
      const minutos = minutosHasta(soporte.vence_en);
      setQuedan(minutos);
      if (minutos === 0) {
        clearInterval(reloj);
        router.replace(`/equipo/tiendas/${soporte.tienda_id}`);
        router.refresh();
      }
    }, 20_000);
    return () => clearInterval(reloj);
  }, [soporte.vence_en, soporte.tienda_id, router]);

  async function salir() {
    setSaliendo(true);
    try {
      await llamarApi('/soporte/salir', { metodo: 'POST' });
    } finally {
      router.replace(`/equipo/tiendas/${soporte.tienda_id}`);
      router.refresh();
    }
  }

  return (
    <div role="status" className="relative z-40 bg-brasa text-tinta">
      <div className="mx-auto flex min-h-[60px] max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 sm:px-6">
        <span className="flex min-w-0 flex-1 items-center gap-2.5 text-apoyo font-bold sm:text-cuerpo">
          <IconUser size={20} stroke={1.8} className="shrink-0" aria-hidden="true" />
          <span>
            Estás ayudando a <span className="underline">{soporte.tienda}</span> · modo soporte ·
            quedan {quedan} min
          </span>
        </span>
        <span className="text-nota font-bold max-sm:hidden">
          No puedes chatear ni cerrar ventas
        </span>
        <button
          type="button"
          disabled={saliendo}
          onClick={() => void salir()}
          className="h-10 rounded-full bg-tinta px-5 text-apoyo font-bold text-white"
        >
          {saliendo ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </div>
  );
}
