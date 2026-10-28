import {
  formatearPrecio,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
} from '@paselibre/contracts';
import Link from 'next/link';

import { haceCuanto } from '@/shared/fechas';
import { Miniatura } from '@/shared/ui/miniatura';

import { PrecioConSesion } from './precio-con-sesion';
import { textoCondiciones, textoOfertas, textoStock } from './textos';

/** Un producto de los resultados, con sus ofertas agrupadas (F_Resultados). */
export function FilaProducto({
  producto,
  conSesion,
}: {
  producto: ProductoEnLista | ProductoEnListaConPrecio;
  conSesion: boolean;
}) {
  const { ofertas } = producto;
  const href = `/p/${producto.slug}`;
  const precios = 'precios_desde' in ofertas ? ofertas : null;

  return (
    <article className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-linea py-5 sm:flex-nowrap">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <Miniatura
          ruta={producto.foto}
          categoria={producto.categoria.slug}
          className="h-[72px] w-24 rounded-xl"
          glifo={56}
          grosor={3}
        />
      </Link>
      <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <Link href={href} className="text-tarjeta text-tinta">
          {producto.titulo}
        </Link>
        <span className="text-nota text-detalle">
          {[producto.categoria.nombre, producto.marca].filter(Boolean).join(' · ')}
        </span>
        <span className="text-apoyo text-secundario">
          {textoOfertas(ofertas.cantidad)} · {ofertas.galerias.join(', ') || 'Independiente'}
        </span>
        <span className="text-nota text-detalle">
          {textoCondiciones(ofertas.condiciones)} · {textoStock(ofertas.stock_total)} ·{' '}
          {haceCuanto(ofertas.actualizada_en)}
        </span>
      </div>
      <div className="flex min-w-[140px] flex-col sm:items-end sm:text-right">
        {conSesion && precios ? (
          precios.precios_desde.length > 0 ? (
            <>
              <span className="text-nota text-detalle">Desde</span>
              <span className="text-precio text-tinta">
                {precios.precios_desde.map(formatearPrecio).join(' · ')}
              </span>
              {precios.al_interno > 0 && (
                <span className="text-nota text-detalle">+ {precios.al_interno} al interno</span>
              )}
            </>
          ) : (
            <span className="text-apoyo font-semibold text-secundario">Al interno · consultar</span>
          )
        ) : (
          <PrecioConSesion className="text-apoyo text-secundario" />
        )}
      </div>
      <Link
        href={href}
        className="flex h-10 shrink-0 items-center rounded-full border border-borde px-4 text-apoyo font-medium text-tinta no-underline"
      >
        {ofertas.cantidad === 1 ? 'Ver oferta' : 'Ver ofertas'}
      </Link>
    </article>
  );
}
