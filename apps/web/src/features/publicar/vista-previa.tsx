'use client';

import { TIENDA_RESERVADA, type Precio, type TiendaDeSesion } from '@paselibre/contracts';
import { useState, type ReactNode } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';
import { PrecioBurbuja } from '@/shared/ui/tarjeta-producto';

/**
 * «Así lo verán» (F_Publicar, N06): la tarjeta como la ve otra tienda con sesión, con la
 * burbujita del precio («Pase», «Negociable», «Socio» o «Por chat»), y como la ve un
 * visitante, que nunca ve precio, tienda ni stand (RF-44).
 */
export function VistaPrevia({
  titulo,
  foto,
  categoria,
  estado,
  stock,
  precio,
  visible,
  tiendaVisible = true,
  tienda,
  socio = null,
  enAlmacen = false,
  soloSocios = false,
  negociable = false,
  children,
}: {
  titulo: string;
  foto: string | null;
  categoria: string;
  /** «Nuevo sellado», «Open box»… */
  estado: string;
  stock: number;
  /** Nulo si no hay monto. */
  precio: Precio | null;
  visible: boolean;
  /** «Solo mis socios»: las demás lo ven «Por chat»; tus socios, con «Socio». */
  soloSocios?: boolean;
  negociable?: boolean;
  /** «Mostrar el nombre de mi tienda»: apagado, las tiendas ven «Tienda reservada». */
  tiendaVisible?: boolean;
  tienda: TiendaDeSesion;
  /** «Tus socios: US$ 237 pase» (PS_Precio). */
  socio?: string | null;
  enAlmacen?: boolean;
  /** Lo que va debajo de la tarjeta: «Antes de publicar». */
  children?: ReactNode;
}) {
  const [como, setComo] = useState<'vendedor' | 'visitante'>('vendedor');
  const conSesion = como === 'vendedor';
  const galeria = tienda.galeria ?? 'Independiente';

  return (
    <aside
      aria-label="Vista previa"
      className="sticky top-36 hidden w-[360px] flex-none flex-col gap-3.5 rounded-[20px] border border-linea bg-[#E2EAE6] p-4 lg:flex"
    >
      <span className="flex items-center gap-2 text-tarjeta font-bold">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Vista previa
      </span>
      <div
        role="radiogroup"
        aria-label="Ver como"
        className="grid grid-cols-2 rounded-full border border-linea bg-white p-1"
      >
        {(
          [
            ['vendedor', 'Tiendas con cuenta'],
            ['visitante', 'Sin cuenta'],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="radio"
            aria-checked={como === clave}
            onClick={() => setComo(clave)}
            className={`h-9 rounded-full text-nota font-bold ${
              como === clave ? 'bg-tinta text-white' : 'text-tinta'
            }`}
          >
            {como === clave ? '✓ ' : ''}
            {texto}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-linea bg-white p-3.5">
        <Miniatura
          ruta={foto}
          categoria={categoria}
          className="aspect-[4/3] w-full rounded-xl"
          glifo={160}
          grosor={1.12}
        />
        <span className="font-bold">{titulo}</span>
        <span className="text-nota text-secundario">{estado}</span>
        {conSesion ? (
          <span className="flex flex-col gap-1.5">
            <PrecioBurbuja
              precio={visible ? precio : null}
              socio={soloSocios}
              negociable={negociable}
            />
            {socio && !soloSocios && <span className="text-nota text-secundario">{socio}</span>}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-apoyo font-medium leading-6 text-secundario">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Precio con sesión
          </span>
        )}
        <span className="text-nota text-detalle">
          {conSesion ? (
            <>
              <span className={tiendaVisible ? '' : 'italic'}>
                {tiendaVisible ? tienda.nombre : TIENDA_RESERVADA}
              </span>{' '}
              · {galeria}
            </>
          ) : (
            galeria
          )}{' '}
        </span>
        <span className="flex items-center gap-1.5 text-nota font-bold text-pase-texto">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-pase" />
          {stock === 1 ? '1 disponible' : `${stock} disponibles`}
          {enAlmacen ? ' · en almacén' : ''}
        </span>
      </div>
      <span className="text-nota text-detalle">
        {conSesion
          ? tiendaVisible
            ? 'Los vendedores ven tu tienda, tu stand y el precio si lo haces visible.'
            : 'Los vendedores ven «Tienda reservada» y tu galería, y te escriben solo por el chat.'
          : 'Los visitantes no ven precio, tienda ni stand.'}
      </span>
      {children}
    </aside>
  );
}
