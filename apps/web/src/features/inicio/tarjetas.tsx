import { formatearPrecio, type TarjetaOfertaConVendedor } from '@paselibre/contracts';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

import { textoEstado } from '@/features/catalogo/textos';
import { haceRato } from '@/shared/fechas';
import { Miniatura } from '@/shared/ui/miniatura';

/** «US$ 285» en la píldora negra, o «Al interno» si no lo muestran. */
function Precio({ tarjeta }: { tarjeta: TarjetaOfertaConVendedor }) {
  return tarjeta.precio ? (
    <span className="inline-flex h-7 items-center self-start rounded-full bg-tinta px-2.5 text-apoyo font-bold text-white">
      {formatearPrecio(tarjeta.precio)}
    </span>
  ) : (
    <span className="text-apoyo font-semibold text-secundario">Al interno · consultar</span>
  );
}

/**
 * Una tarjeta de «Recién publicado» (FI_WebNormal) o de «De tiendas que sigues» (SG_WebFeed):
 * la foto con «Hace 5 min» o «Sigues» encima, el producto, el precio y quién.
 */
export function TarjetaInicio({
  tarjeta,
  seguida = false,
}: {
  tarjeta: TarjetaOfertaConVendedor;
  seguida?: boolean;
}) {
  return (
    <Link
      href={`/p/${tarjeta.producto.slug}?oferta=${tarjeta.oferta_id}`}
      className="flex min-w-0 flex-col gap-2 text-tinta no-underline"
    >
      <span className="relative block">
        <Miniatura
          ruta={tarjeta.producto.foto}
          categoria={tarjeta.producto.categoria.slug}
          className="aspect-[4/3] w-full rounded-2xl"
          glifo={84}
          grosor={2}
        />
        {seguida ? (
          <span className="absolute left-2 top-2 flex h-6 items-center gap-1 rounded-full bg-pase px-2 text-[12px] font-bold text-white">
            <IconCheck size={12} stroke={3} aria-hidden="true" />
            Sigues
          </span>
        ) : (
          <span className="absolute left-2 top-2 flex h-6 items-center rounded-full bg-white px-2 text-[12px] font-medium text-tinta">
            {haceRato(tarjeta.actualizada_en)}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-apoyo font-bold leading-5 hover:underline">
        {tarjeta.producto.titulo}
      </span>
      <Precio tarjeta={tarjeta} />
      <span className="truncate text-nota text-secundario">
        {seguida
          ? `${tarjeta.tienda.nombre} · ${haceRato(tarjeta.actualizada_en).toLowerCase()}`
          : `${textoEstado(tarjeta.condicion)} · ${tarjeta.tienda.nombre}`}
      </span>
    </Link>
  );
}

/** «Lo nuevo · 3 publicaciones» (FI_WebPocas): la tarjeta a lo ancho, con el precio al costado. */
export function TarjetaNueva({ tarjeta }: { tarjeta: TarjetaOfertaConVendedor }) {
  return (
    <Link
      href={`/p/${tarjeta.producto.slug}?oferta=${tarjeta.oferta_id}`}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-linea bg-white p-3 text-tinta no-underline hover:border-borde"
    >
      <Miniatura
        ruta={tarjeta.producto.foto}
        categoria={tarjeta.producto.categoria.slug}
        className="h-14 w-16 rounded-xl"
        glifo={40}
        grosor={4}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="line-clamp-2 text-apoyo font-bold leading-5">{tarjeta.producto.titulo}</b>
        <span className="truncate text-nota text-secundario">
          {textoEstado(tarjeta.condicion)} · {tarjeta.tienda.nombre}
        </span>
        <span className="text-nota text-detalle">{haceRato(tarjeta.actualizada_en)}</span>
      </span>
      <b className="shrink-0 text-cuerpo font-bold">
        {tarjeta.precio ? formatearPrecio(tarjeta.precio) : 'Al interno'}
      </b>
    </Link>
  );
}

/**
 * Una tarjeta de «RECIÉN LLEGADOS» (COR25): blanca, con la foto sobre gris, el producto, la
 * tienda y el precio en la píldora negra.
 */
export function TarjetaRecienLlegada({ tarjeta }: { tarjeta: TarjetaOfertaConVendedor }) {
  return (
    <Link
      href={`/p/${tarjeta.producto.slug}?oferta=${tarjeta.oferta_id}`}
      className="flex min-w-0 flex-col gap-2 rounded-[20px] border border-linea bg-white p-3 text-tinta no-underline hover:border-borde"
    >
      <Miniatura
        ruta={tarjeta.producto.foto}
        categoria={tarjeta.producto.categoria.slug}
        className="aspect-[16/7] w-full rounded-xl bg-superficie"
        glifo={84}
        grosor={2}
      />
      <span className="line-clamp-2 text-[15px] font-bold leading-5">
        {tarjeta.producto.titulo}
      </span>
      <span className="truncate text-nota text-secundario">{tarjeta.tienda.nombre}</span>
      <span className="mt-auto">
        <Precio tarjeta={tarjeta} />
      </span>
    </Link>
  );
}
