'use client';

import type { Moneda, RespuestaCuenta } from '@paselibre/contracts';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Segmentado } from '@/shared/ui/segmentado';

import { RespuestasRapidas } from './respuestas-rapidas';

/**
 * Configuración · Preferencias: los valores por defecto al publicar (RF-48) y las
 * respuestas rápidas del chat por papel (RF-56, N11). Cada cambio se guarda al momento.
 */
export function SeccionPreferencias({
  cuenta,
  alGuardar,
  alAvisar,
}: {
  cuenta: RespuestaCuenta;
  alGuardar: (cuenta: RespuestaCuenta, mensaje: string) => void;
  alAvisar: (mensaje: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const tienda = cuenta.tienda;

  async function guardarDefecto(cambios: {
    moneda_defecto?: Moneda;
    precio_visible_defecto?: boolean;
  }) {
    setError(null);
    try {
      const nuevaCuenta = await llamarApi<RespuestaCuenta>('/cuenta', {
        metodo: 'PATCH',
        cuerpo: { tienda: cambios },
      });
      alGuardar(nuevaCuenta, 'Se usará al publicar.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
  }

  return (
    <>
      {tienda && (
        <div className="flex flex-col gap-3">
          <b className="text-tarjeta">Al publicar</b>
          <div className="flex flex-col divide-y divide-linea rounded-2xl border border-linea">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>Moneda</span>
              <Segmentado
                etiqueta="Moneda al publicar"
                valor={tienda.moneda_defecto}
                alCambiar={(moneda) => void guardarDefecto({ moneda_defecto: moneda })}
                opciones={[
                  ['USD', 'US$'],
                  ['PEN', 'S/'],
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>Precio</span>
              <Segmentado
                etiqueta="Precio al publicar"
                valor={tienda.precio_visible_defecto ? 'visible' : 'oculto'}
                alCambiar={(valor) =>
                  void guardarDefecto({ precio_visible_defecto: valor === 'visible' })
                }
                opciones={[
                  ['oculto', 'Oculto'],
                  ['visible', 'Visible'],
                ]}
              />
            </div>
          </div>
          <span className="text-nota text-detalle">
            Cada publicación los puede cambiar. Los visitantes nunca ven precios.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-linea pt-5">
        <b className="text-tarjeta">Respuestas rápidas</b>
        <span className="-mt-2 text-apoyo text-secundario">
          En cada chat salen las del papel que tienes: si te escribieron por algo tuyo, las de
          vender; si tú preguntaste, las de comprar.
        </span>
        <RespuestasRapidas alAvisar={alAvisar} />
      </div>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
    </>
  );
}
