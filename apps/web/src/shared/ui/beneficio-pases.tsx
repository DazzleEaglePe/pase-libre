'use client';

import type { ReactNode } from 'react';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';

/** Lo de Pases del día en el pie solo aparece con Pases del día encendido (`EN_VIVO`). */
export function SiHayPasesDelDia({ children }: { children: ReactNode }) {
  const enVivo = useEnVivoMontado();
  return enVivo?.activo && enVivo.datos ? children : null;
}
