import {
  formatearPrecio,
  TIENDA_RESERVADA,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
} from '@paselibre/contracts';
import { IconBuildingStore, IconMessageCircle } from '@tabler/icons-react';
import Link from 'next/link';

import { Miniatura } from '@/shared/ui/miniatura';

import { PrecioConSesion } from './precio-con-sesion';
import { textoCondiciones, textoEstado, textoStock } from './textos';

const ACCION =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-apoyo font-semibold no-underline';

/**
 * Un producto de los resultados (W2 y M_Resultados): su foto, la oferta más barata con la
 * tienda y el precio, cuántas más hay y «Chatear ahora» sin pasar por la ficha. Quien no ha
 * iniciado sesión ve el producto, el estado, la galería y el stock; no el precio ni la tienda.
 */
export function TarjetaResultado({
  producto,
  puedeChatear,
  conInsignia,
}: {
  producto: ProductoEnLista | ProductoEnListaConPrecio;
  /** El equipo mira sin escribir: no es una tienda. */
  puedeChatear: boolean;
  /** «Más barato» solo compara productos parecidos: se pone cuando todos son de una categoría. */
  conInsignia: boolean;
}) {
  const { ofertas } = producto;
  const href = `/p/${producto.slug}`;
  const destacada = 'oferta_destacada' in producto ? producto.oferta_destacada : null;
  const estado = destacada
    ? textoEstado(destacada.condicion)
    : textoCondiciones(ofertas.condiciones);
  const lugar = destacada?.galeria ?? (ofertas.galerias.join(', ') || 'Independiente');
  const stock = destacada ? destacada.stock : ofertas.stock_total;
  const otras = ofertas.cantidad - 1;
  const masBarata = conInsignia && destacada?.mas_barata === true;

  const insignia = (
    <span className="inline-flex h-6 items-center rounded-full bg-ok-fondo px-2.5 text-nota font-semibold text-ok">
      Más barato
    </span>
  );

  return (
    <article className="flex gap-3 rounded-2xl border border-linea bg-white p-3 sm:flex-col sm:gap-0 sm:overflow-hidden sm:p-0">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="relative shrink-0">
        <Miniatura
          ruta={producto.foto}
          categoria={producto.categoria.slug}
          className="h-[84px] w-[76px] rounded-xl sm:h-[168px] sm:w-full sm:rounded-none"
          glifo={96}
          grosor={3}
        />
        {masBarata && <span className="absolute left-3 top-3 max-sm:hidden">{insignia}</span>}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:gap-2 sm:p-4">
        <Link href={href} className="text-tarjeta text-tinta no-underline">
          {producto.titulo}
        </Link>

        <span className="flex flex-wrap items-center gap-x-1.5 text-nota text-detalle">
          <b className="font-semibold text-secundario">{estado}</b>
          {destacada ? (
            <>
              <span aria-hidden="true">·</span>
              <IconBuildingStore
                size={14}
                stroke={1.8}
                aria-hidden="true"
                className="text-secundario"
              />
              <span
                className={`font-semibold text-secundario ${destacada.tienda.nombre === TIENDA_RESERVADA ? 'italic' : ''}`}
              >
                {destacada.tienda.nombre}
              </span>
            </>
          ) : null}
          <span>· {lugar}</span>
        </span>

        {destacada ? (
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {destacada.precio ? (
              <b className="inline-flex items-center rounded-full bg-tinta px-3.5 py-1 text-precio text-white">
                {formatearPrecio(destacada.precio)}
              </b>
            ) : (
              <span className="text-apoyo font-semibold text-secundario">
                Al interno · consultar
              </span>
            )}
            {masBarata && <span className="sm:hidden">{insignia}</span>}
          </span>
        ) : (
          <PrecioConSesion className="mt-1 text-apoyo text-secundario" />
        )}

        <span className="flex flex-wrap items-center gap-x-1.5 text-nota text-detalle">
          <span className="inline-flex items-center gap-1.5 font-semibold text-tinta">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${stock > 0 ? 'bg-ok' : 'bg-borde-control'}`}
            />
            {stock > 0 ? textoStock(stock) : 'Sin stock'}
          </span>
          {otras > 0 && (
            <span>
              · {otras === 1 ? '1 tienda más lo tiene' : `${otras} tiendas más lo tienen`}
            </span>
          )}
        </span>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <Link
            href={href}
            className="inline-flex h-10 items-center text-apoyo font-semibold text-tinta underline"
          >
            Ver producto
          </Link>
          {destacada === null ? (
            <Link href="/ingresar" className={`${ACCION} border border-borde bg-white text-tinta`}>
              Inicia sesión para chatear
            </Link>
          ) : destacada.propia ? (
            <span className={`${ACCION} bg-superficie text-secundario`}>Tu publicación</span>
          ) : puedeChatear ? (
            <Link
              href={`/mensajes?oferta=${destacada.id}`}
              className={`${ACCION} bg-pase-suave text-[#1F3FC2]`}
            >
              <IconMessageCircle size={16} stroke={1.8} aria-hidden="true" />
              Chatear ahora
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
