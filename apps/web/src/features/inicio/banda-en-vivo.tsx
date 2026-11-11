'use client';

import { IconClock } from '@tabler/icons-react';
import Link from 'next/link';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';
import { useAhora } from '@/features/en-vivo/datos';
import { EtiquetaTipo } from '@/features/en-vivo/piezas';
import { BotonResponder } from '@/features/en-vivo/responder';
import {
  conVendedor,
  cuantoQueda,
  datoPrecio,
  lineaLugar,
  type ItemEnVivo,
} from '@/features/en-vivo/textos';
import { PuntoQueLate } from '@/shared/ui/brasa';

/** «Termina en 1 h 40 min», en rojo ladrillo como el lienzo. */
function Termina({ item, ahora }: { item: ItemEnVivo; ahora: number }) {
  const queda = cuantoQueda(item.vence_en, ahora, true);
  return (
    <span className="flex shrink-0 items-center gap-1 text-nota font-bold text-aviso">
      <IconClock size={14} stroke={2} aria-hidden="true" />
      {queda === 'Venció' ? 'Venció' : `Termina en ${queda}`}
    </span>
  );
}

/** Una tarjeta blanca de la banda: tipo, cuánto falta, qué y quién. */
function Tarjeta({
  item,
  ahora,
  conBoton,
}: {
  item: ItemEnVivo;
  ahora: number;
  conBoton: boolean;
}) {
  const visitante = !conVendedor(item);
  return (
    <li className="flex w-[280px] shrink-0 flex-col gap-2 rounded-2xl bg-white p-4 text-tinta sm:w-auto sm:min-w-0">
      <span className="flex items-center justify-between gap-2">
        <EtiquetaTipo tipo={item.tipo} />
        <Termina item={item} ahora={ahora} />
      </span>
      <Link
        href={`/pedidos-en-vivo?id=${item.id}`}
        className="text-[17px] font-bold leading-6 text-tinta no-underline hover:underline"
      >
        {item.titulo}
      </Link>
      {visitante ? (
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-linea pt-3">
          <b className="text-apoyo font-bold">{datoPrecio(item)}</b>
          <Link
            href="/ingresar"
            className="flex h-10 items-center rounded-full bg-contador px-4 text-apoyo font-bold text-tinta no-underline"
          >
            Inicia sesión para responder
          </Link>
        </span>
      ) : (
        <>
          <span className="text-apoyo text-secundario">{lineaLugar(item)}</span>
          {conBoton && (
            <BotonResponder
              item={item}
              className="mt-1 inline-flex h-10 items-center self-start rounded-full bg-contador px-4 text-apoyo font-bold text-tinta no-underline"
            />
          )}
        </>
      )}
    </li>
  );
}

/**
 * «● Pedidos en vivo · 3» del inicio (FI_Web, FI_WebNormal, D_PortadaVisitante): la banda negra
 * con lo que vence primero. Sin pedidos, «Sé el primero»; con uno solo, «¡Lo tengo!» y «Pide tú
 * también». El visitante ve qué se pide, pero no quién ni cuánto (RF-77).
 */
export function BandaEnVivo({ visitante = false }: { visitante?: boolean }) {
  const compartido = useEnVivoMontado();
  const ahora = useAhora();
  if (compartido && !compartido.activo) return null;
  const lista = compartido?.datos?.en_vivo ?? [];
  const cargando = !compartido?.datos;

  return (
    <section
      aria-labelledby="banda-en-vivo"
      className="flex flex-col gap-4 rounded-[28px] bg-tinta px-4 py-5 text-white sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <h2
            id="banda-en-vivo"
            className="flex items-center gap-2 text-[22px] font-bold leading-7"
          >
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-vivo" />
            Pedidos en vivo{lista.length > 0 ? ` · ${lista.length}` : ''}
          </h2>
          {visitante && (
            <span className="text-apoyo text-white/80">
              Lo que las tiendas necesitan o rematan hoy. Responde antes de que termine.
            </span>
          )}
        </div>
        {visitante ? (
          <span className="flex gap-2">
            <Link
              href="/ingresar"
              className="flex h-11 items-center gap-2 rounded-full bg-brasa px-4 text-apoyo font-bold text-tinta no-underline"
            >
              <PuntoQueLate tamano={8} />
              Publicar busco o remate
            </Link>
            {lista.length > 0 && (
              <Link
                href="/pedidos-en-vivo"
                className="flex h-11 items-center rounded-full border border-white/40 px-4 text-apoyo font-bold text-white no-underline"
              >
                Ver los {lista.length} ›
              </Link>
            )}
          </span>
        ) : (
          lista.length > 1 && (
            <Link href="/pedidos-en-vivo" className="text-apoyo font-bold text-acento">
              Ver todos ›
            </Link>
          )
        )}
      </div>

      {cargando ? (
        <p className="m-0 text-apoyo text-white/70">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-white/[0.07] p-4 sm:p-5">
          <b className="text-[17px] font-bold">Aún no hay pedidos en vivo</b>
          <span className="text-apoyo text-white/85">
            Sé el primero. Lo que pidas les llega al instante a todas las tiendas que lo venden, y
            te responden aquí.
          </span>
          <Link
            href={visitante ? '/ingresar' : '/pedidos-en-vivo/publicar'}
            className="flex h-12 items-center gap-2 rounded-full bg-brasa px-5 font-bold text-tinta no-underline"
          >
            <PuntoQueLate tamano={8} />
            ¿Qué te falta hoy? Pídelo
          </Link>
        </div>
      ) : (
        <>
          <ul className="-mx-4 m-0 flex list-none gap-3 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {lista.slice(0, 3).map((item) => (
              <Tarjeta key={item.id} item={item} ahora={ahora} conBoton={lista.length === 1} />
            ))}
          </ul>
          {lista.length === 1 && !visitante && (
            <Link
              href="/pedidos-en-vivo/publicar"
              className="flex h-11 items-center gap-2 self-start rounded-full border border-white/40 px-4 text-apoyo font-bold text-white no-underline"
            >
              <PuntoQueLate tamano={8} />
              Pide tú también
            </Link>
          )}
        </>
      )}
    </section>
  );
}
