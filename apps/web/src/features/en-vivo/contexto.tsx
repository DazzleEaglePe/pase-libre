'use client';

import type { RespuestaEnVivo } from '@paselibre/contracts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

/**
 * Como `useEnVivoCompartido`, pero nulo hasta que el componente se montó. El HTML del
 * servidor nunca trae Pases del día: si la lista llega antes de que una parte que se hidrata
 * tarde (dentro de un Suspense, como la banda de categorías) termine de hidratarse, React
 * vería un enlace que el servidor no dibujó y rehace esa parte entera.
 */
export function useEnVivoMontado(): EnVivoCompartido | null {
  const compartido = useContext(Contexto);
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return montado ? compartido : null;
}
