'use client';

import { siguienteInsignia, type ResumenCuenta } from '@paselibre/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { enPlural } from '@/shared/plural';

/**
 * «Tu mes · Solo tú lo ves» (N04_PerfilB_Web): en tu propio perfil, cuántas ventas te faltan para
 * la insignia del mes, cuántos chats esperan tu respuesta y «Ver mi panel ›». Nadie más lo ve.
 */
export function FranjaTuMes() {
  const [resumen, setResumen] = useState<ResumenCuenta | null>(null);

  useEffect(() => {
    llamarApi<ResumenCuenta>('/cuenta/resumen').then(setResumen, () => undefined);
  }, []);

  const ventas = resumen?.ventas_mes ?? 0;
  const insignia = siguienteInsignia(ventas);
  const avance = insignia ? Math.round((ventas / insignia.meta) * 100) : 100;
  const sinResponder = resumen?.sin_responder ?? 0;

  return (
    <section
      aria-label="Tu mes, solo tú lo ves"
      className="flex flex-col gap-3 rounded-2xl border-2 border-[#A7E3C3] bg-white px-[18px] py-3.5 md:flex-row md:flex-wrap md:items-center md:gap-[18px]"
    >
      <span className="flex items-center gap-2">
        <span className="rounded-full bg-tinta px-2.5 py-0.5 text-[12px] font-extrabold text-white">
          Solo tú lo ves
        </span>
        <h2 className="text-[16px] font-bold">Tu mes</h2>
      </span>
      <span className="flex min-w-[220px] flex-1 flex-col gap-1">
        <span className="text-nota">
          {resumen === null ? (
            'Contando tus ventas…'
          ) : insignia ? (
            <>
              {insignia.emoji}{' '}
              <b className="font-bold">
                {ventas} de {insignia.meta}
              </b>{' '}
              ventas para {insignia.nombre}
            </>
          ) : (
            <>
              🥇 <b className="font-bold">¡Insignia de oro este mes!</b> {ventas} ventas
            </>
          )}
        </span>
        <span
          role="progressbar"
          aria-label="Ventas del mes para la siguiente insignia"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={avance}
          className="h-2 overflow-hidden rounded-full bg-[#E2E7E4]"
        >
          <span className="block h-full rounded-full bg-pase" style={{ width: `${avance}%` }} />
        </span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-x-[18px] gap-y-2">
        <Link href="/mensajes" className="text-apoyo text-tinta no-underline hover:underline">
          💬 <b className="font-bold">{sinResponder}</b>{' '}
          {enPlural(sinResponder, 'chat sin responder', 'chats sin responder')}
        </Link>
        <Link
          href="/cuenta"
          className="text-apoyo font-extrabold text-marca no-underline hover:underline"
        >
          Ver mi panel ›
        </Link>
      </span>
    </section>
  );
}
