'use client';

import { useEffect } from 'react';

/**
 * Lo que queda fijo abajo en el celular (la barra inferior, los botones de la ficha) avisa su
 * alto en `--abajo`. Así la barra de Pases del día flota encima en vez de taparlo.
 */
export function useReservarAbajo(alto: number, activo = true): void {
  useEffect(() => {
    if (!activo) return;
    const raiz = document.documentElement;
    raiz.style.setProperty('--abajo', `${alto}px`);
    return () => {
      raiz.style.removeProperty('--abajo');
    };
  }, [alto, activo]);
}
