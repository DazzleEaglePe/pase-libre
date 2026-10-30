'use client';

import type { RespuestaEnVivo } from '@paselibre/contracts';
import { createContext, useContext, type ReactNode } from 'react';

import { useEnVivo } from './datos';

interface EnVivoCompartido {
  datos: RespuestaEnVivo | null;
  activo: boolean;
}

const Contexto = createContext<EnVivoCompartido | null>(null);

/**
 * Una sola lista de En vivo por página para la ventana flotante y la entrada de la banda de
 * categorías: así no se pide dos veces. Va dentro del tiempo real, si hay sesión.
 */
export function ProveedorEnVivo({ children }: { children: ReactNode }) {
  const { datos, activo } = useEnVivo();
  return <Contexto.Provider value={{ datos, activo }}>{children}</Contexto.Provider>;
}

/** Nulo fuera del proveedor (el panel del equipo, por ejemplo). */
export function useEnVivoCompartido(): EnVivoCompartido | null {
  return useContext(Contexto);
}
