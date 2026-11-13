import {
  formatearPrecio,
  pastillasDeVariantes,
  type Precio,
  type TonoPastilla,
  type VariantesOferta,
} from '@paselibre/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Miniatura } from './miniatura';

const pildora =
  'inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-[14px] font-extrabold leading-5';
const burbuja =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border-[1.5px] px-[9px] py-0.5 text-[12px] font-extrabold leading-4';

function IconoCandado() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconoSocios() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5M15 14.6c2.6.2 4.4 2 5 5.4" />
    </svg>
  );
}

/** «Socio» en verde con borde dorado y su chispa (N06). */
export function BurbujaSocio() {
  return (
    <span
      className={`${burbuja} border-[#E2B93B] bg-[linear-gradient(135deg,#16A673,#0B6B4A)] text-white`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#F5D06A" aria-hidden="true">
        <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" />
      </svg>
      Socio
    </span>
  );
}

const COLOR_PASTILLA: Record<Exclude<TonoPastilla, 'negrita'>, string> = {
  intel: 'bg-[#1d5fd1]',
  ryzen: 'bg-[#e8590c]',
  oem: 'bg-[#6b7872]',
};

/**
 * Las pastillas pegadas al final del título (docs/19 §13): Intel XMP en azul, EXPO Ryzen en
 * naranja (el color de AMD), OEM sin caja en gris, con letra blanca y en 800. OC va solo en
 * negrita, sin color. `grande` es la de la ficha.
 */
export function PastillasTitulo({
  variantes,
  titulo = '',
  grande = false,
}: {
  variantes: Partial<VariantesOferta> | null | undefined;
  /** Para no repetir «OC» si el título ya lo dice. */
  titulo?: string;
  grande?: boolean;
}) {
  const pastillas = pastillasDeVariantes(variantes, titulo);
  if (pastillas.length === 0) return null;
  return (
    <>
      {pastillas.map((pastilla) =>
        pastilla.tono === 'negrita' ? (
          <b key={pastilla.texto} className="ml-1 font-extrabold text-tinta">
            {pastilla.texto}
          </b>
        ) : (
          <span
            key={pastilla.texto}
            className={`ml-1 inline-block whitespace-nowrap font-extrabold text-white ${
              COLOR_PASTILLA[pastilla.tono]
            } ${
              grande
                ? 'rounded-md px-2 py-0.5 align-middle text-[14px] leading-5'
                : 'rounded-[5px] px-[5px] py-px align-[1px] text-[11px] leading-4'
            }`}
          >
            {pastilla.texto}
          </span>
        ),
      )}
    </>
  );
}

/** «Negociable» en amarillo (N06): pase que se puede conversar. */
export function BurbujaNegociable() {
  return (
    <span className={`${burbuja} border-[#F2D675] bg-[#FEF6C7] text-[#7A5B00]`}>Negociable</span>
  );
}

/**
 * El precio con su burbujita al costado (N06), igual en todas las tarjetas del sitio:
 * - «S/ 3,886 · Pase»: precio de pase, lo ven todas las tiendas.
 * - «S/ 3,886 · Pase · Negociable»: pase que se puede conversar.
 * - «S/ 1,240 · Socio» (verde claro, burbuja con dorado): solo lo ven tus socios.
 * - «Por chat» (plomo, con candado): privado, el precio se pide por chat.
 * Sin leyenda: la burbujita lo explica sola.
 */
export function PrecioBurbuja({
  precio,
  socio = false,
  negociable = false,
}: {
  /** Nulo: «Por chat». */
  precio: Precio | null;
  socio?: boolean;
  negociable?: boolean;
}) {
  if (!precio) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={`${pildora} border-[1.5px] border-borde bg-[#E2E7E4] text-secundario`}>
          <IconoCandado />
          Por chat
        </span>
      </span>
    );
  }
  if (socio) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className={`${pildora} border-[1.5px] border-[#7FD0A8] bg-[#D3F2E2] text-[#0B5E40]`}>
          <IconoSocios />
          {formatearPrecio(precio)}
        </span>
        <BurbujaSocio />
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`${pildora} bg-pase text-white`}>{formatearPrecio(precio)}</span>
      <span className={`${burbuja} border-pase bg-white text-marca`}>Pase</span>
      {negociable && <BurbujaNegociable />}
    </span>
  );
}

/**
 * La tarjeta de producto de todo el sitio (N04 B, N06, N15): blanca con borde de 2 px para que
 * se separe aunque cada foto traiga su propio fondo, la foto, el producto en dos líneas, el
 * precio con su burbujita, «Nuevo · Pegasus5000» y, en su propia línea, «Hace 5 min». La usan el
 * feed, el perfil de la tienda y los demás listados tal cual.
 */
export function TarjetaProducto({
  href,
  titulo,
  foto,
  categoria,
  precio,
  socio = false,
  negociable = false,
  linea,
  etiqueta,
  pie,
  variantes,
  prioridad = false,
  className = '',
  accion,
  enVezDelPrecio,
  sobreFoto,
  alTocar,
}: {
  href: string;
  titulo: string;
  foto: string | null;
  /** Slug de la categoría: su dibujo cuando no hay foto. */
  categoria: string;
  /** Nulo: «Por chat». */
  precio: Precio | null;
  socio?: boolean;
  negociable?: boolean;
  /** «Nuevo · Pegasus5000». */
  linea?: string;
  /**
   * «Hace 5 min», en su línea debajo de «Nuevo · Pegasus5000» (docs/18 §5): sobre la foto tapaba
   * el nombre del producto que trae la imagen.
   */
  etiqueta?: string;
  /** Algo más al final (las vistas y los chats en tu propio perfil, por ejemplo). */
  pie?: ReactNode;
  /** Las pastillas del título (docs/19 §13): Intel XMP, EXPO Ryzen, OEM, OC. */
  variantes?: Partial<VariantesOferta> | null;
  prioridad?: boolean;
  /** Clases de más (el perfil propio la levanta al pasar el mouse). */
  className?: string;
  /**
   * Un botón a la derecha del precio, en su misma línea (el tachito del perfil propio, docs/19
   * §12). Con él la tarjeta deja de ser un enlace entero: el enlace va en el título y se estira
   * por encima de todo, y el botón queda arriba de él.
   */
  accion?: ReactNode;
  /** Lo que va en vez del precio («Se elimina» al marcarla para eliminar). */
  enVezDelPrecio?: ReactNode;
  /** Lo que va encima de la foto (el tinte rojo de «Se elimina»). */
  sobreFoto?: ReactNode;
  /** Al tocarla no se abre: hace esto (marcar al eliminar varias). */
  alTocar?: () => void;
}) {
  const contenido = (
    <>
      <span className="relative block">
        <Miniatura
          ruta={foto}
          categoria={categoria}
          className="aspect-square w-full rounded-xl"
          glifo={84}
          grosor={2}
          prioridad={prioridad}
        />
        {sobreFoto}
      </span>
      <b className="line-clamp-2 min-h-9 text-[13px] font-bold leading-[18px] group-hover:underline">
        {accion ? (
          <Link
            href={href}
            onClick={
              alTocar
                ? (evento) => {
                    evento.preventDefault();
                    alTocar();
                  }
                : undefined
            }
            className="text-tinta no-underline after:absolute after:inset-0 after:rounded-[18px] after:content-['']"
          >
            {titulo}
          </Link>
        ) : (
          titulo
        )}
        <PastillasTitulo variantes={variantes} titulo={titulo} />
      </b>
      {accion ? (
        <span className="flex min-h-[26px] items-center justify-between gap-2">
          {enVezDelPrecio ?? (
            <PrecioBurbuja precio={precio} socio={socio} negociable={negociable} />
          )}
          <span className="relative z-10 flex shrink-0">{accion}</span>
        </span>
      ) : (
        (enVezDelPrecio ?? <PrecioBurbuja precio={precio} socio={socio} negociable={negociable} />)
      )}
      {linea && <span className="truncate text-[12px] leading-4 text-detalle">{linea}</span>}
      {etiqueta && (
        // «Hace 5 min» puede cambiar entre el servidor y el navegador.
        <span
          suppressHydrationWarning
          className={`truncate text-[12px] font-bold leading-4 text-secundario ${linea ? '-mt-1.5' : ''}`}
        >
          {etiqueta}
        </span>
      )}
      {pie}
    </>
  );
  const clases = `group flex h-full min-w-0 flex-col gap-1.5 rounded-[18px] border-2 border-borde bg-white p-2.5 text-tinta no-underline hover:border-borde-control ${className}`;
  if (accion) return <div className={`relative ${clases}`}>{contenido}</div>;
  return (
    <Link
      href={href}
      onClick={
        alTocar
          ? (evento) => {
              evento.preventDefault();
              alTocar();
            }
          : undefined
      }
      className={clases}
    >
      {contenido}
    </Link>
  );
}
