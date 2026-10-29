'use client';

import { usePathname } from 'next/navigation';

import { PieCompacto } from './pie-compacto';
import { PiePagina } from './pie-pagina';

/**
 * El pie de las páginas del vendedor: el completo, salvo en Mensajes, que lleva el compacto
 * como en el lienzo (C_Mensajes) para que el chat no quede con un pie alto debajo.
 */
export function Pie() {
  const ruta = usePathname();
  return ruta.startsWith('/mensajes') ? <PieCompacto /> : <PiePagina />;
}
