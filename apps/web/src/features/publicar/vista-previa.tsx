'use client';

import type { Condicion, TiendaDeSesion } from '@paselibre/contracts';
import { useState } from 'react';

import { Miniatura } from '@/shared/ui/miniatura';
import { Segmentado } from '@/shared/ui/segmentado';

const CONDICION = { NUEVO: 'Nuevo', USADO: 'Usado' } as const;

/**
 * «Así lo verán» (F_Publicar): la tarjeta como la ve otro vendedor con sesión y como la
 * ve un visitante, que nunca ve precio, tienda ni stand (RF-44).
 */
export function VistaPrevia({
  titulo,
  foto,
  categoria,
  condicion,
  stock,
  precio,
  visible,
  tienda,
}: {
  titulo: string;
  foto: string | null;
  categoria: string;
  condicion: Condicion;
  stock: number;
  /** Ya formateado, o nulo si no hay monto. */
  precio: string | null;
  visible: boolean;
  tienda: TiendaDeSesion;
}) {
  const [como, setComo] = useState<'vendedor' | 'visitante'>('vendedor');
  const conSesion = como === 'vendedor';
  const galeria = tienda.galeria ?? 'Independiente';

  return (
    <aside
      aria-label="Vista previa"
      className="sticky top-6 hidden w-full max-w-[360px] flex-[1_1_300px] flex-col gap-3.5 lg:flex"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-etiqueta uppercase text-detalle">Así lo verán</span>
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
          {CONDICION[condicion]} · {stock === 1 ? '1 disponible' : `${stock} disponibles`}
        </span>
        <span className="font-medium">{titulo}</span>
        {conSesion && visible && precio ? (
          <span className="text-precio">{precio}</span>
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
          {conSesion ? `${tienda.nombre} · ${galeria}` : galeria} · Actualizado ahora
        </span>
      </div>
      <span className="text-nota text-detalle">
        {conSesion
          ? 'Los vendedores ven tu tienda, tu stand y el precio si lo haces visible.'
          : 'Los visitantes no ven precio, tienda ni stand.'}
      </span>
    </aside>
  );
}
