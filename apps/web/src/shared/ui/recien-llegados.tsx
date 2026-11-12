'use client';

import type { RespuestaRecienLlegados } from '@paselibre/contracts';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** Cada cuánto se vuelve a contar lo nuevo mientras la página sigue abierta. */
const CADA_MS = 60_000;

/**
 * «Recién llegados +N nuevo» de una tienda (N07, mejora 20): lo publicado desde su última visita
 * a la página, sin lo suyo y como máximo de las últimas 24 h. Al entrar a «Recién llegados» se
 * guarda la visita y vuelve a cero. No dibuja nada: le pasa el número a la barra.
 */
export function VigiaRecienLlegados({ alCambiar }: { alCambiar: (nuevos: number) => void }) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const enLaPagina = ruta === '/buscar' && parametros.get('orden') === 'recientes';

  useEffect(() => {
    if (enLaPagina) {
      alCambiar(0);
      void llamarApi('/recien-llegados/visto', { metodo: 'POST', cuerpo: {} }).catch(
        () => undefined,
      );
      return;
    }
    let vigente = true;
    const contar = () =>
      llamarApi<RespuestaRecienLlegados>('/recien-llegados').then(
        ({ nuevos }) => vigente && alCambiar(nuevos),
        () => undefined,
      );
    void contar();
    const reloj = window.setInterval(() => void contar(), CADA_MS);
    return () => {
      vigente = false;
      window.clearInterval(reloj);
    };
  }, [enLaPagina, alCambiar]);

  return null;
}
