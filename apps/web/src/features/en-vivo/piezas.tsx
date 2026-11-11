import type { TipoEnVivo } from '@paselibre/contracts';
import Link from 'next/link';

import { PuntoQueLate } from '@/shared/ui/brasa';
import { Miniatura } from '@/shared/ui/miniatura';

import { BotonResponder } from './responder';
import { cuantoQueda, etiquetaTipo, lineaLugar, type ItemEnVivo } from './textos';

/** «● PEDIDOS EN VIVO»: la etiqueta de la sección, en Brasa (guía del lienzo final). */
export function PildoraEnVivo() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brasa px-2.5 py-[3px] text-etiqueta uppercase text-tinta">
      <PuntoQueLate tamano={7} />
      Pedidos en vivo
    </span>
  );
}

export function EtiquetaTipo({ tipo }: { tipo: TipoEnVivo }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-nota font-semibold ${
        tipo === 'BUSCO' ? 'bg-pase-suave text-pase-texto' : 'bg-aviso-fondo text-aviso'
      }`}
    >
      {etiquetaTipo(tipo)}
    </span>
  );
}

/**
 * El botón «¡Lo tengo!» / «¡Lo quiero!» sin alto: cada lugar pone el suyo. En naranja sólido con
 * texto negro (guía del lienzo final), para no confundirse con el Brasa de lo «en vivo».
 */
const baseResponder =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-contador font-bold text-tinta no-underline hover:brightness-95';
/** En las filas y en la tarjeta mini: 36 px, porque van con el mouse. */
export const botonResponder = `${baseResponder} h-9 pl-2.5 pr-3.5 text-nota`;
/** En las tarjetas de la página y en la barra del celular: 40 px, para el dedo. */
export const botonResponderGrande = `${baseResponder} h-10 pl-3 pr-4 text-apoyo`;

/** Un renglón de la ventana y de la hoja (EV_SigueEntrar): dibujo, tipo, cuánto falta y responder. */
export function FilaEnVivo({ item, ahora }: { item: ItemEnVivo; ahora: number }) {
  return (
    <li className="flex items-center gap-3 border-t border-linea py-2.5">
      <Miniatura
        ruta={item.producto?.foto ?? null}
        categoria={item.categoria.slug}
        className="h-12 w-14 rounded-[10px]"
        glifo={40}
        grosor={4.5}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <EtiquetaTipo tipo={item.tipo} />
          <span className="text-nota font-semibold text-aviso">
            {cuantoQueda(item.vence_en, ahora)}
          </span>
        </span>
        <Link
          href={`/pedidos-en-vivo?id=${item.id}`}
          className="truncate text-cuerpo font-semibold no-underline hover:underline"
        >
          {item.titulo}
        </Link>
        <span className="truncate text-nota text-detalle">{lineaLugar(item)}</span>
      </span>
      <BotonResponder item={item} className={botonResponder} />
    </li>
  );
}
