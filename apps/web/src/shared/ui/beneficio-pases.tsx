'use client';

import type { ReactNode } from 'react';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';

/** Lo de Pedidos en vivo en el pie solo aparece con Pedidos en vivo encendido (`EN_VIVO`). */
export function SiHayPasesDelDia({ children }: { children: ReactNode }) {
  const enVivo = useEnVivoMontado();
  return enVivo?.activo && enVivo.datos ? children : null;
}
