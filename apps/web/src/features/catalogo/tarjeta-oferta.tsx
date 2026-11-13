import {
  type Audiencia,
  type TarjetaOferta,
  type TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import Link from 'next/link';

import { haceCuanto } from '@/shared/fechas';
import { Miniatura } from '@/shared/ui/miniatura';
import { PastillasTitulo, PrecioBurbuja } from '@/shared/ui/tarjeta-producto';

import { PrecioConSesion } from './precio-con-sesion';
import { textoEstado, textoStock } from './textos';

/** Una oferta de «Recién publicado»: la foto, el producto, el precio (si hay sesión) y dónde está. */
export function TarjetaOfertaPortada({
  tarjeta,
  audiencia,
}: {
  tarjeta: TarjetaOferta | TarjetaOfertaConVendedor;
  audiencia: Audiencia;
}) {
  const conTienda = audiencia !== 'visitante' && 'tienda' in tarjeta;
  const lugar = conTienda
    ? [
        tarjeta.tienda.nombre,
        tarjeta.galeria ?? 'Independiente',
        tarjeta.tienda.stand && `Stand ${tarjeta.tienda.stand}`,
      ]
    : [tarjeta.galeria ?? 'Independiente'];

  return (
    <Link
      href={`/p/${tarjeta.producto.slug}`}
      className="flex min-w-0 flex-col gap-3 rounded-[18px] border-2 border-borde bg-white p-3 no-underline hover:border-borde-control"
    >
      <Miniatura
        ruta={tarjeta.producto.foto}
        categoria={tarjeta.producto.categoria.slug}
        className="aspect-square w-full rounded-xl"
        glifo={96}
        grosor={2}
      />
      {/* Como D_Portada: el producto, luego estado · lugar · cuándo, y el precio. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="line-clamp-2 text-apoyo font-semibold text-tinta">
          {tarjeta.producto.titulo}
          <PastillasTitulo variantes={tarjeta.variantes} titulo={tarjeta.producto.titulo} />
        </span>
        <span className="text-nota text-detalle">
          {[textoEstado(tarjeta.condicion), ...lugar, haceCuanto(tarjeta.actualizada_en)]
            .filter(Boolean)
            .join(' · ')}
        </span>
        {tarjeta.stock === 0 && (
          <span className="text-nota font-semibold text-aviso">{textoStock(0)}</span>
        )}
        <span className="mt-auto pt-1">
          {conTienda ? (
            <PrecioBurbuja
              precio={tarjeta.precio_visible || tarjeta.precio_socio ? tarjeta.precio : null}
              socio={tarjeta.precio_socio}
              negociable={tarjeta.negociable}
            />
          ) : (
            <PrecioConSesion className="text-apoyo text-secundario" />
          )}
        </span>
      </span>
    </Link>
  );
}
