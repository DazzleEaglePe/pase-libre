'use client';

import { IconClock } from '@tabler/icons-react';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { useEnVivoMontado, usePedidosNuevos } from '@/features/en-vivo/contexto';
import { useAhora } from '@/features/en-vivo/datos';
import { conLosNuevosPrimero } from '@/features/en-vivo/nuevos';
import { EtiquetaNuevo, EtiquetaTipo } from '@/features/en-vivo/piezas';
import { BotonResponder } from '@/features/en-vivo/responder';
import {
  conVendedor,
  cuantoQueda,
  datoPrecio,
  lineaLugar,
  type ItemEnVivo,
} from '@/features/en-vivo/textos';
import { PuntoQueLate } from '@/shared/ui/brasa';
import { Miniatura } from '@/shared/ui/miniatura';

/**
 * El ancho de cada tarjeta: 280 px en el celular (se deslizan), dos en la tableta y tres en la
 * computadora. Va en `cqw` (el ancho de la lista) para que el contenido no se reacomode mientras
 * la tarjeta nueva crece desde 0.
 */
const ANCHO_TARJETA = 'w-[280px] sm:w-[calc((100cqw-12px)/2)] lg:w-[calc((100cqw-24px)/3)]';

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

/**
 * Una tarjeta blanca de la banda: tipo, cuánto falta, la foto, qué y quién. La que acaba de
 * entrar (doc 19, punto 22) crece desde la izquierda, su borde late naranja dos veces y lleva
 * «NUEVO» 10 s; `espera` la hace entrar detrás de otra que llegó junto con ella.
 */
function Tarjeta({
  item,
  ahora,
  conBoton,
  nueva,
}: {
  item: ItemEnVivo;
  ahora: number;
  conBoton: boolean;
  nueva: { espera: number } | null;
}) {
  const visitante = !conVendedor(item);
  return (
    <li
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-white ${ANCHO_TARJETA} ${
        nueva ? 'entra-en-vivo' : ''
      }`}
      style={nueva ? ({ '--espera': `${nueva.espera}ms` } as CSSProperties) : undefined}
    >
      <div className={`flex h-full flex-col gap-2 p-4 text-tinta ${ANCHO_TARJETA}`}>
        <span className="flex items-center justify-between gap-2 whitespace-nowrap">
          <span className="flex items-center gap-1.5">
            <EtiquetaTipo tipo={item.tipo} />
            {nueva && <EtiquetaNuevo espera={nueva.espera + 200} />}
          </span>
          <Termina item={item} ahora={ahora} />
        </span>
        <span className="flex items-center gap-2.5">
          <Miniatura
            ruta={item.foto}
            categoria={item.categoria.slug}
            className="h-[46px] w-[46px] rounded-[10px]"
            glifo={30}
            grosor={5}
          />
          <Link
            href={`/pedidos-en-vivo?id=${item.id}`}
            className="min-w-0 text-[17px] font-bold leading-6 text-tinta no-underline hover:underline"
          >
            {item.titulo}
          </Link>
        </span>
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
      </div>
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
  const nuevos = usePedidosNuevos();
  const ahora = useAhora();
  if (compartido && !compartido.activo) return null;
  // Los que entraron mientras miras van primero: entran por la izquierda y empujan a las demás.
  const lista = conLosNuevosPrimero(compartido?.datos?.en_vivo ?? [], nuevos.entrados);
  const cargando = !compartido?.datos;
  // Mientras brillan, las que empujaron siguen en la fila y salen por la derecha.
  const visibles = 3 + nuevos.marcados.size;

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
            <span>
              Pedidos en vivo
              {lista.length > 0 && (
                <>
                  {' · '}
                  {/* El número sube con un saltito cuando entra uno (doc 19, punto 22). */}
                  <span
                    key={nuevos.lote}
                    className={
                      nuevos.lote > 0
                        ? 'inline-block motion-safe:animate-[sube-numero-en-vivo_450ms_cubic-bezier(.2,1.6,.4,1)]'
                        : undefined
                    }
                  >
                    {lista.length}
                  </span>
                </>
              )}
            </span>
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
          {/* Arriba y abajo hay aire para el brillo naranja de la que entra. */}
          <ul className="-mx-4 -my-3 m-0 flex list-none gap-3 overflow-x-auto px-4 py-3 [container-type:inline-size] [scrollbar-width:none] sm:mx-0 sm:px-0 lg:overflow-hidden">
            {lista.slice(0, visibles).map((item) => (
              <Tarjeta
                key={item.id}
                item={item}
                ahora={ahora}
                conBoton={lista.length === 1}
                nueva={nuevos.marcados.get(item.id) ?? null}
              />
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
