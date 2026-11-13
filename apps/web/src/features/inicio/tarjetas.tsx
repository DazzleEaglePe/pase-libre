import {
  formatearPrecio,
  urlFoto,
  type ChapitaInicio,
  type TarjetaInicio as DatosTarjetaInicio,
  type TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import { IconClock, IconFlame, IconTag, IconTrendingDown } from '@tabler/icons-react';
import Link from 'next/link';
import type { ComponentType } from 'react';

import { textoEstado } from '@/features/catalogo/textos';
import { haceRato } from '@/shared/fechas';
import { GlifoCategoria } from '@/shared/ui/glifo-categoria';
import { Miniatura } from '@/shared/ui/miniatura';
import { PastillasTitulo, PrecioBurbuja } from '@/shared/ui/tarjeta-producto';

const enlace = (tarjeta: TarjetaOfertaConVendedor) =>
  `/p/${tarjeta.producto.slug}?oferta=${tarjeta.oferta_id}`;

/** «Nuevo · Pegasus5000»: el estado y quién lo publica. */
const lineaDe = (tarjeta: TarjetaOfertaConVendedor) =>
  `${textoEstado(tarjeta.condicion)} · ${tarjeta.tienda.nombre}`;

type Icono = ComponentType<{ size?: number; stroke?: number; 'aria-hidden'?: boolean }>;

/**
 * Las 4 chapitas (doc 20, punto 22): ícono y texto de color sobre blanco. «Más barato» usa el
 * naranja oscuro del tablero P60 (el `contador` claro no se lee como texto sobre blanco).
 */
const CHAPITAS: Record<ChapitaInicio, { texto: string; color: string; Icono: Icono }> = {
  RECIEN: { texto: 'Recién publicado', color: '#00875A', Icono: IconClock },
  MAS_BARATO: { texto: 'Más barato de la galería', color: '#C2410C', Icono: IconTag },
  MUY_BUSCADO: { texto: 'Muy buscado hoy', color: '#6D3FD1', Icono: IconFlame },
  BAJO: { texto: 'Bajó de precio', color: '#1D5FD1', Icono: IconTrendingDown },
};

/** El texto de la chapita: «Bajó S/ 40» lleva cuánto bajó. */
export function textoChapita(tarjeta: DatosTarjetaInicio): string | null {
  if (!tarjeta.chapita) return null;
  if (tarjeta.chapita === 'BAJO' && tarjeta.bajo_centimos && tarjeta.precio) {
    return `Bajó ${formatearPrecio({
      moneda: tarjeta.precio.moneda,
      centimos: tarjeta.bajo_centimos,
      monto: (tarjeta.bajo_centimos / 100).toFixed(2),
    })}`;
  }
  return CHAPITAS[tarjeta.chapita].texto;
}

/**
 * La chapita blanca arriba a la derecha de la foto (doc 20, punto 22, diseño C): en la
 * computadora aparece al pasar el cursor, subiendo 6 px; en el celular se ve siempre, más chica.
 */
function Chapita({ tarjeta }: { tarjeta: DatosTarjetaInicio }) {
  const texto = textoChapita(tarjeta);
  if (!tarjeta.chapita || !texto) return null;
  const { color, Icono } = CHAPITAS[tarjeta.chapita];
  return (
    <span className="pl-chapita" style={{ color }} data-chapita={tarjeta.chapita}>
      <Icono size={13} stroke={2.2} aria-hidden />
      {texto}
    </span>
  );
}

/**
 * Una tarjeta del Inicio (doc 20, puntos 4, 18, 19 y 22): la foto de borde a borde en blanco, la
 * línea gris de 1 px entre la foto y el nombre, el precio con su burbujita, «Nuevo · Tienda» y
 * «Hace 5 min». Al pasar el cursor se pinta menta (la foto sigue blanca), entra la flechita «›» y
 * sube la chapita. Sin bordes ni marcas de destacada o fundadora: eso no se ve en el feed.
 */
export function TarjetaInicio({
  tarjeta,
  prioridad = false,
}: {
  tarjeta: DatosTarjetaInicio;
  prioridad?: boolean;
}) {
  const foto = tarjeta.producto.foto;
  return (
    <Link href={enlace(tarjeta)} className="pl-tarjeta-inicio">
      <span className="pl-foto-inicio">
        {foto ? (
          // Las fotos ya llegan en WebP y reducidas desde la API; `contain` no corta el modelo.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlFoto(foto)}
            alt=""
            loading={prioridad ? 'eager' : 'lazy'}
            fetchPriority={prioridad ? 'high' : 'auto'}
            className="h-full w-full object-contain"
          />
        ) : (
          <GlifoCategoria categoria={tarjeta.producto.categoria.slug} ancho={84} grosor={2} />
        )}
        <Chapita tarjeta={tarjeta} />
      </span>
      <span className="pl-texto-inicio">
        <b className="line-clamp-2 min-h-10 text-[15px] font-bold leading-5 max-sm:min-h-9 max-sm:text-[13px] max-sm:leading-[18px]">
          {tarjeta.producto.titulo}
          <PastillasTitulo variantes={tarjeta.variantes} titulo={tarjeta.producto.titulo} />
          <span aria-hidden="true" className="pl-flechita">
            ›
          </span>
        </b>
        <PrecioBurbuja
          precio={tarjeta.precio}
          socio={tarjeta.precio_socio}
          negociable={tarjeta.negociable}
        />
        <span className="flex min-w-0 flex-col text-[13px] leading-[18px] text-detalle max-sm:text-[12px] max-sm:leading-4">
          <span className="truncate">{lineaDe(tarjeta)}</span>
          {/* «Hace 5 min» puede cambiar entre el servidor y el navegador. */}
          <span suppressHydrationWarning className="truncate font-bold text-secundario">
            {haceRato(tarjeta.actualizada_en)}
          </span>
        </span>
      </span>
    </Link>
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
          <PastillasTitulo variantes={tarjeta.variantes} titulo={tarjeta.producto.titulo} />
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
