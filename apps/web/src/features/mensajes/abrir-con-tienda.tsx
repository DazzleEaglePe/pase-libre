'use client';

import type { RespuestaConversaciones } from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/**
 * «Escribir» desde el perfil de una tienda (SG_Web): abre el último hilo con ella. Si todavía
 * no hablan, cada chat nace de un producto: se elige uno de su tienda.
 */
export function AbrirConTienda({ tiendaId }: { tiendaId: string }) {
  const router = useRouter();
  const [sinHilo, setSinHilo] = useState(false);

  useEffect(() => {
    llamarApi<RespuestaConversaciones>('/conversaciones?filtro=todas').then(
      (respuesta) => {
        const hilo = respuesta.conversaciones.find((c) => c.otro.tienda.id === tiendaId);
        if (hilo) router.replace(`/mensajes/${hilo.id}`);
        else setSinHilo(true);
      },
      () => setSinHilo(true),
    );
  }, [tiendaId, router]);

  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-[1.5px] border-linea p-8 text-center lg:rounded-none lg:border-0">
      {sinHilo ? (
        <>
          <b className="text-[18px] font-bold">Aún no hablan</b>
          <p className="m-0 max-w-[380px] text-secundario">
            Cada chat nace de un producto: elige uno de su tienda y toca «Enviar mensaje».
          </p>
          <Link
            href={`/tiendas/${tiendaId}`}
            className="flex h-11 items-center rounded-full bg-pase px-5 font-bold text-white no-underline"
          >
            Ver sus productos
          </Link>
        </>
      ) : (
        <p className="text-secundario">Abriendo la conversación…</p>
      )}
    </section>
  );
}
