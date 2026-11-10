'use client';

import type { RespuestaConversaciones } from '@paselibre/contracts';
import { IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/**
 * El lado derecho de Mensajes sin un chat abierto. Sin ninguna conversación todavía, «Aún no
 * tienes chats» con cómo se empieza (EV_WebChats); con alguna, «Elige una conversación».
 */
export function PanelVacio() {
  const [hay, setHay] = useState<boolean | null>(null);

  useEffect(() => {
    llamarApi<RespuestaConversaciones>('/conversaciones').then(
      (respuesta) => setHay(respuesta.conteos.todas > 0),
      () => setHay(true),
    );
  }, []);

  if (hay === null) return <section className="flex-1 rounded-3xl border-[1.5px] border-linea" />;
  if (hay) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-2 rounded-3xl border-[1.5px] border-linea p-8 text-center">
        <p className="text-tarjeta">Elige una conversación</p>
        <p className="max-w-[360px] text-apoyo text-secundario">
          Para escribirle a otra tienda, entra a un producto y toca «Chatear ahora».
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border-[1.5px] border-linea px-6 py-10 text-center">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[24px] font-bold leading-8">Aún no tienes chats</h2>
        <p className="m-0 text-cuerpo text-secundario">
          Aquí van a aparecer tus conversaciones con otras tiendas. Así se empieza:
        </p>
      </div>
      <ol className="m-0 flex w-full max-w-[440px] list-none flex-col gap-2.5 p-0 text-left">
        {[
          'Busca un producto o mira los pedidos en vivo',
          'Toca «Chatear ahora» o «¡Lo tengo!»',
          'Coordinan y cierran el pase aquí',
        ].map((paso, indice) => (
          <li key={paso} className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tinta text-apoyo font-bold text-white">
              {indice + 1}
            </span>
            <span className="text-apoyo font-semibold">{paso}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link
          href="/buscar"
          className="flex h-12 items-center gap-2 rounded-full bg-pase px-5 font-bold text-white no-underline"
        >
          <IconSearch size={18} stroke={1.8} aria-hidden="true" />
          Buscar productos
        </Link>
        <Link
          href="/pedidos-en-vivo"
          className="flex h-12 items-center gap-2 rounded-full border border-borde px-5 font-bold text-tinta no-underline"
        >
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
          Ver pedidos en vivo
        </Link>
      </div>
    </section>
  );
}
