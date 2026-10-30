'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useEnVivoCompartido } from './contexto';

/**
 * La entrada fija a Pases del día en la banda de categorías: «● Pases del día 4». Así se
 * llega aunque la tarjeta mini esté oculta. No aparece con En vivo apagado (`EN_VIVO`).
 */
export function EntradaEnVivo() {
  const ruta = usePathname();
  const compartido = useEnVivoCompartido();
  if (!compartido?.activo || !compartido.datos) return null;

  const cantidad = compartido.datos.en_vivo.length;
  const aqui = ruta === '/pases-del-dia';
  return (
    <Link
      href="/pases-del-dia"
      aria-current={aqui ? 'page' : undefined}
      className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-apoyo font-semibold text-white no-underline ${
        aqui ? 'border-acento' : 'border-transparent hover:border-white/40'
      }`}
    >
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#FF7A66]" />
      Pases del día
      {cantidad > 0 && (
        <span className="rounded-full bg-white/15 px-1.5 text-nota font-semibold">{cantidad}</span>
      )}
    </Link>
  );
}
