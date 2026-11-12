import type { TarjetaOfertaConVendedor } from '@paselibre/contracts';
import Link from 'next/link';

import { textoEstado } from '@/features/catalogo/textos';
import { haceRato } from '@/shared/fechas';
import { Miniatura } from '@/shared/ui/miniatura';
import { PrecioBurbuja, TarjetaProducto } from '@/shared/ui/tarjeta-producto';

const enlace = (tarjeta: TarjetaOfertaConVendedor) =>
  `/p/${tarjeta.producto.slug}?oferta=${tarjeta.oferta_id}`;

/** «Nuevo · Pegasus5000»: el estado y quién lo publica. */
const lineaDe = (tarjeta: TarjetaOfertaConVendedor) =>
  `${textoEstado(tarjeta.condicion)} · ${tarjeta.tienda.nombre}`;

/**
 * Una tarjeta de «Recién publicado» (N15): la de todo el sitio, con el precio con su burbujita y
 * «Hace 5 min» en su línea, debajo de «Nuevo · Tienda» (docs/18 §5).
 */
export function TarjetaInicio({
  tarjeta,
  prioridad = false,
}: {
  tarjeta: TarjetaOfertaConVendedor;
  prioridad?: boolean;
}) {
  return (
    <TarjetaProducto
      href={enlace(tarjeta)}
      titulo={tarjeta.producto.titulo}
      foto={tarjeta.producto.foto}
      categoria={tarjeta.producto.categoria.slug}
      precio={tarjeta.precio}
      socio={tarjeta.precio_socio}
      negociable={tarjeta.negociable}
      etiqueta={haceRato(tarjeta.actualizada_en)}
      linea={lineaDe(tarjeta)}
      prioridad={prioridad}
    />
  );
}

/**
 * «Lo nuevo en la galería» (N16, primera semana): en lista y no en cuadrícula, para que 3
 * productos no se vean como huecos. La foto, el producto, el precio con su burbujita, «Nuevo ·
 * Pegasus5000 · hace 5 min» y «Ver».
 */
export function FilaNueva({ tarjeta }: { tarjeta: TarjetaOfertaConVendedor }) {
  return (
    <li className="relative flex items-center gap-4 border-b-[1.5px] border-linea py-3.5">
      <Miniatura
        ruta={tarjeta.producto.foto}
        categoria={tarjeta.producto.categoria.slug}
        className="h-[74px] w-[74px] rounded-[14px] border-[1.5px] border-linea max-sm:h-16 max-sm:w-16"
        glifo={46}
        grosor={3}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          href={enlace(tarjeta)}
          className="line-clamp-2 text-[16px] font-bold leading-[22px] text-tinta no-underline after:absolute after:inset-0 hover:underline"
        >
          {tarjeta.producto.titulo}
        </Link>
        <PrecioBurbuja
          precio={tarjeta.precio}
          socio={tarjeta.precio_socio}
          negociable={tarjeta.negociable}
        />
        <span className="truncate text-nota text-detalle">
          {lineaDe(tarjeta)} · {haceRato(tarjeta.actualizada_en).toLowerCase()}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="flex h-10 shrink-0 items-center rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold max-sm:hidden"
      >
        Ver
      </span>
    </li>
  );
}
