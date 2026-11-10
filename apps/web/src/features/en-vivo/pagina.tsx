'use client';

import { IconClock, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Segmentado } from '@/shared/ui/segmentado';

import { useEnVivoMontado } from './contexto';
import { useAhora, useEnVivo } from './datos';
import { LoTuyo } from './lo-tuyo';
import { EtiquetaTipo } from './piezas';
import { BotonResponder } from './responder';
import {
  conVendedor,
  lineaPrecio,
  terminaEn,
  textoCierre,
  etiquetaTipo,
  type ItemEnVivo,
} from './textos';

export type Tipo = 'todo' | 'busco' | 'flash';

/** El botón naranja de las tarjetas (D_Pases): «¡Lo tengo!» o «¡Lo quiero!». */
const botonNaranja =
  'inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-contador px-4 text-apoyo font-bold text-tinta no-underline hover:brightness-95';

function Tarjeta({
  item,
  ahora,
  resaltada,
}: {
  item: ItemEnVivo;
  ahora: number;
  resaltada: boolean;
}) {
  const unidades =
    item.tipo === 'BUSCO' ? (item.cantidad === 1 ? '1 unidad' : `${item.cantidad} unidades`) : null;
  const detalle = [
    conVendedor(item) ? item.tienda.nombre : null,
    item.galeria ?? 'Independiente',
    unidades,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article
      id={`en-vivo-${item.id}`}
      className={`flex scroll-mt-40 flex-col gap-2 rounded-[20px] border bg-white p-4 sm:p-5 ${
        resaltada ? 'border-tinta ring-2 ring-pase-suave' : 'border-linea'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <EtiquetaTipo tipo={item.tipo} />
        <span className="flex items-center gap-1 text-nota font-bold text-aviso">
          <IconClock size={14} stroke={2} aria-hidden="true" />
          {terminaEn(item.vence_en, ahora)}
        </span>
      </div>
      {item.producto ? (
        <Link
          href={`/p/${item.producto.slug}`}
          className="text-[19px] font-bold leading-6 text-tinta no-underline hover:underline"
        >
          {item.titulo}
        </Link>
      ) : (
        <b className="text-[19px] font-bold leading-6">{item.titulo}</b>
      )}
      {conVendedor(item) && item.nota && <p className="m-0 text-cuerpo text-tinta">{item.nota}</p>}
      <span className="text-apoyo text-secundario">{detalle}</span>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-linea pt-3">
        <b className="text-cuerpo font-bold">{lineaPrecio(item)}</b>
        {conVendedor(item) && item.propio ? (
          <span className="text-nota font-bold text-detalle">Es tuyo</span>
        ) : (
          <BotonResponder item={item} className={botonNaranja} />
        )}
      </div>
    </article>
  );
}

/**
 * `/pedidos-en-vivo` (D_Pases, M_Pases, sección 9 del lienzo final): los busco y remates
 * vigentes, lo que vence primero arriba; los cerrados de hoy en una línea y, con sesión, «Tus
 * pedidos en vivo». `?id=` resalta uno (los avisos de la campanita llegan así).
 */
export function PaginaEnVivo({
  conSesion,
  resaltar,
  tipoInicial = 'todo',
}: {
  conSesion: boolean;
  resaltar: string | null;
  /** «Remates de hoy» de la barra llega con `?tipo=remato`. */
  tipoInicial?: Tipo;
}) {
  const [tipo, setTipo] = useState<Tipo>(tipoInicial);
  const { datos } = useEnVivo(`?tipo=${tipo}`);
  // El total de «Todos · 4» sale de la lista que ya tiene la barra.
  const todos = useEnVivoMontado()?.datos;
  const ahora = useAhora();

  useEffect(() => {
    if (!resaltar || !datos) return;
    document.getElementById(`en-vivo-${resaltar}`)?.scrollIntoView({ block: 'center' });
  }, [resaltar, datos]);

  const enVivo = datos?.en_vivo ?? [];
  const cerrados = datos?.cerrados_hoy ?? [];
  const total = todos?.en_vivo.length;

  return (
    <div className="flex flex-col gap-6">
      {/* La banda negra de arriba, de lado a lado de la pantalla. */}
      <header className="-mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 bg-tinta pb-7 pt-6 text-white shadow-[0_0_0_100vmax_#0F1412] [clip-path:inset(0_-100vmax)]">
        <div className="flex flex-col gap-2">
          <nav aria-label="Ruta" className="flex gap-2 text-nota text-white/70">
            <Link href="/" className="text-white/80">
              Inicio
            </Link>
            <span aria-hidden="true">›</span>
            <span>Pedidos en vivo</span>
          </nav>
          <h1 className="flex items-center gap-3 text-[30px] font-bold leading-9 sm:text-[36px] sm:leading-[44px]">
            <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full bg-vivo" />
            Pedidos en vivo
          </h1>
          <p className="m-0 text-cuerpo text-white/85">
            Lo que las tiendas necesitan o rematan hoy. Responde antes de que termine.
          </p>
        </div>
        <Link
          href={conSesion ? '/pedidos-en-vivo/publicar' : '/ingresar'}
          className="flex h-12 items-center gap-2 rounded-full bg-pase px-6 font-bold text-white no-underline max-sm:w-full max-sm:justify-center"
        >
          <IconPlus size={18} stroke={2.2} aria-hidden="true" />
          Publicar busco o remate
        </Link>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_364px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmentado
              llenoEnCelular
              etiqueta="Qué mostrar"
              valor={tipo}
              alCambiar={setTipo}
              opciones={[
                ['todo', total === undefined ? 'Todos' : `Todos · ${total}`],
                ['busco', 'Busco'],
                ['flash', 'Remato'],
              ]}
            />
            <span className="text-apoyo text-secundario">
              Orden: <b className="font-bold text-tinta">vence primero</b>
            </span>
          </div>

          {!datos && <p className="text-secundario">Cargando…</p>}
          {datos && enVivo.length === 0 && (
            <p className="m-0 rounded-[20px] border border-linea bg-white p-6 text-secundario">
              Ahora no hay {tipo === 'busco' ? 'busco' : tipo === 'flash' ? 'remates' : 'pedidos'}{' '}
              en vivo. Publica lo que buscas para un cliente y les avisamos a las tiendas que lo
              tienen.
            </p>
          )}
          {enVivo.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {enVivo.map((item) => (
                <Tarjeta key={item.id} item={item} ahora={ahora} resaltada={item.id === resaltar} />
              ))}
            </div>
          )}
          {cerrados.length > 0 && (
            <p className="m-0 text-apoyo text-secundario">
              Cerrados hoy · {cerrados.length} ·{' '}
              {cerrados
                .map(
                  (item) =>
                    `${etiquetaTipo(item.tipo)} ${item.titulo}, ${textoCierre(item).toLowerCase()}`,
                )
                .join(' · ')}
            </p>
          )}
        </div>
        {conSesion && <LoTuyo ahora={ahora} />}
      </div>
    </div>
  );
}
