'use client';

import Link from 'next/link';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';

/**
 * La tarjeta oscura «Publicar un busco» (J): al pie del menú de categorías, al final de los
 * resultados y en la página sin resultados, para que ninguna búsqueda termine en nada. Lleva
 * lo buscado al formulario. No aparece con Pedidos en vivo apagado (`EN_VIVO`).
 */
export function TarjetaBusco({
  titulo,
  texto,
  conSesion,
  que = '',
  categoria = null,
  grande = false,
}: {
  titulo: string;
  texto: string;
  conSesion: boolean;
  que?: string;
  categoria?: string | null;
  grande?: boolean;
}) {
  const enVivo = useEnVivoMontado();
  if (!enVivo?.activo || !enVivo.datos) return null;

  const consulta = new URLSearchParams({
    ...(que ? { que } : {}),
    ...(categoria ? { categoria } : {}),
  }).toString();
  const href = conSesion
    ? `/pedidos-en-vivo/publicar${consulta ? `?${consulta}` : ''}`
    : '/ingresar';

  return (
    <section
      className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-4 bg-tinta text-white ${
        grande ? 'rounded-3xl p-6 sm:px-8 sm:py-7' : 'rounded-[20px] px-6 py-5'
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] flex-col items-start gap-1.5">
        {grande && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-[3px] text-etiqueta uppercase">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
            Pedidos en vivo
          </span>
        )}
        <b
          className={
            grande
              ? 'text-[22px] font-semibold leading-[30px]'
              : 'text-[17px] font-semibold leading-6'
          }
        >
          {titulo}
        </b>
        <span className="text-apoyo text-[#C7D2CC]">{texto}</span>
      </div>
      <Link
        href={href}
        className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full px-5 text-cuerpo font-semibold no-underline ${
          conSesion ? 'bg-pase text-white' : 'bg-white text-tinta'
        }`}
      >
        {conSesion ? 'Publicar un busco' : 'Inicia sesión para publicar'}
      </Link>
    </section>
  );
}
