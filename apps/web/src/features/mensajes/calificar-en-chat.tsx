'use client';

import { IconStar } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { TarjetaCalificar } from '@/features/tiendas/calificar';

const clave = (ventaId: string) => `calificar-cerrada:${ventaId}`;

/**
 * La tarjeta de calificar en el chat (N03): con la X o «Ahora no» queda chiquita, «★ Calificar
 * a X · Calificar», y se abre otra vez al tocarla. Lo cerrado se recuerda en este navegador.
 */
export function CalificarEnChat({
  ventaId,
  tienda,
  deVendedor,
  alTerminar,
}: {
  ventaId: string;
  tienda: string;
  deVendedor: boolean;
  alTerminar: () => void;
}) {
  const [cerrada, setCerrada] = useState(false);

  useEffect(() => {
    try {
      setCerrada(localStorage.getItem(clave(ventaId)) === '1');
    } catch {
      setCerrada(false);
    }
  }, [ventaId]);

  function cambiar(valor: boolean) {
    setCerrada(valor);
    try {
      if (valor) localStorage.setItem(clave(ventaId), '1');
      else localStorage.removeItem(clave(ventaId));
    } catch {
      // Sin almacenamiento, igual se cierra mientras dure la página.
    }
  }

  if (cerrada) {
    return (
      <button
        type="button"
        onClick={() => cambiar(false)}
        className="flex min-h-11 w-full max-w-[420px] items-center gap-2.5 self-start rounded-full border-[1.5px] border-linea bg-white px-4 text-left"
      >
        <IconStar size={18} stroke={1.8} className="shrink-0 text-[#D49B00]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-apoyo">Calificar a {tienda}</span>
        <span className="shrink-0 text-apoyo font-bold text-pase-texto">Calificar</span>
      </button>
    );
  }
  return (
    <TarjetaCalificar
      ventaId={ventaId}
      tienda={tienda}
      deVendedor={deVendedor}
      alTerminar={alTerminar}
      alCerrar={() => cambiar(true)}
    />
  );
}
