'use client';

import type { RespuestaContacto } from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/**
 * «Enviar mensaje» desde la ficha (RF-21): la ficha solo enlaza a `/mensajes?oferta=<id>`
 * y aquí se abre el hilo con el responsable (o el que ya existía) y se va a él.
 */
export function AbrirDesdeOferta({ ofertaId }: { ofertaId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // En desarrollo React monta dos veces: así se registra un solo clic (RF-23).
  const pedido = useRef(false);

  useEffect(() => {
    if (pedido.current) return;
    pedido.current = true;
    llamarApi<RespuestaContacto>(`/ofertas/${encodeURIComponent(ofertaId)}/contacto`, {
      metodo: 'POST',
      cuerpo: { canal: 'CHAT' },
    }).then(
      (respuesta) => {
        if (respuesta.canal === 'CHAT') router.replace(`/mensajes/${respuesta.conversacion_id}`);
      },
      (e: unknown) =>
        setError(e instanceof ErrorApi ? e.message : 'No pudimos abrir la conversación.'),
    );
  }, [ofertaId, router]);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-linea p-8 text-center">
      {error ? (
        <>
          <p role="alert" className="text-secundario">
            {error}
          </p>
          <Link href="/mensajes" className="font-medium">
            Volver a Mensajes
          </Link>
        </>
      ) : (
        <p className="text-secundario">Abriendo la conversación…</p>
      )}
    </section>
  );
}
