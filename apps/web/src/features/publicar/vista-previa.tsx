'use client';

import { TIENDA_RESERVADA, type TiendaDeSesion } from '@paselibre/contracts';
import { useState, type ReactNode } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';
import { Segmentado } from '@/shared/ui/segmentado';

/**
 * «Así lo verán» (F_Publicar): la tarjeta como la ve otro vendedor con sesión y como la
 * ve un visitante, que nunca ve precio, tienda ni stand (RF-44).
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
  children,
}: {
  titulo: string;
  foto: string | null;
  categoria: string;
  /** «Nuevo sellado», «Open box»… */
  estado: string;
  stock: number;
  /** Ya formateado, o nulo si no hay monto. */
  precio: string | null;
  visible: boolean;
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
      className="sticky top-36 hidden w-full max-w-[360px] flex-[1_1_300px] flex-col gap-3.5 lg:flex"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-tarjeta font-bold">Así lo verán las tiendas</span>
        <Segmentado
          etiqueta="Ver como"
          chico
          valor={como}
          alCambiar={setComo}
          opciones={[
            ['vendedor', 'Vendedores'],
            ['visitante', 'Visitantes'],
          ]}
        />
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-linea p-4">
        <Miniatura
          ruta={foto}
          categoria={categoria}
          className="aspect-[4/3] w-full rounded-xl"
          glifo={160}
          grosor={1.12}
        />
        <span className="text-nota text-detalle">
          {estado} · {stock === 1 ? '1 disponible' : `${stock} disponibles`}
          {enAlmacen ? ' · en almacén' : ' · en el stand'}
        </span>
        <span className="font-medium">{titulo}</span>
        {conSesion && visible && precio ? (
          <span className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2">
              <span className="text-etiqueta uppercase text-detalle">Pase</span>
              <span className="rounded-full bg-tinta px-2.5 text-apoyo font-bold leading-7 text-white">
                {precio}
              </span>
            </span>
            {socio && (
              <span className="flex items-center gap-2 text-nota text-secundario">
                <span className="rounded-full bg-marca px-2 text-[11px] font-bold leading-5 text-white">
                  Socio
                </span>
                {socio}
              </span>
            )}
          </span>
        ) : conSesion ? (
          <span className="font-medium leading-6">Al interno · consultar</span>
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
          · Actualizado ahora
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
