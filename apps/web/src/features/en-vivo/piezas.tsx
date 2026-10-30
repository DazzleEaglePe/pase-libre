import type { TipoEnVivo } from '@paselibre/contracts';
import Link from 'next/link';

import { Miniatura } from '@/shared/ui/miniatura';

import { BotonResponder } from './responder';
import { cuantoQueda, etiquetaTipo, lineaLugar, type ItemEnVivo } from './textos';

/** «● EN VIVO» del lienzo. */
export function PildoraEnVivo() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-error-fondo px-2.5 py-[3px] text-etiqueta uppercase text-error">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#C8331F]" />
      En vivo
    </span>
  );
}

export function EtiquetaTipo({ tipo }: { tipo: TipoEnVivo }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-nota font-semibold ${
        tipo === 'BUSCO' ? 'bg-pase-suave text-[#1F3FC2]' : 'bg-aviso-fondo text-aviso'
      }`}
    >
      {etiquetaTipo(tipo)}
    </span>
  );
}

export const botonResponder =
  'inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-borde bg-white px-3 text-nota font-semibold text-tinta hover:border-borde-control';

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
          href={`/en-vivo?id=${item.id}`}
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
