'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/**
 * Al abrir Versiones (doc 19, punto 8): guarda que ya viste la versión que corre y refresca la
 * barra para que se apague el puntito verde de la pastilla. No muestra nada.
 */
export function MarcarVersionVista() {
  const router = useRouter();
  const enviado = useRef(false);

  useEffect(() => {
    // En desarrollo React monta dos veces: un solo pedido.
    if (enviado.current) return;
    enviado.current = true;
    llamarApi('/equipo/versiones/vista', { metodo: 'POST' }).then(
      () => router.refresh(),
      () => undefined,
    );
  }, [router]);

  return null;
}
