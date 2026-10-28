'use client';

import {
  MAX_RESPUESTAS_RAPIDAS,
  type Moneda,
  type RespuestaCuenta,
  type RespuestaRapida,
} from '@paselibre/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonSecundario, campo } from '@/shared/ui/estilos';
import { Segmentado } from '@/shared/ui/segmentado';

/**
 * Configuración · Preferencias: los valores por defecto al publicar (RF-48) y las
 * respuestas rápidas del chat (RF-56). Cada cambio se guarda al momento.
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
  const id = useId();
  const [rapidas, setRapidas] = useState<string[] | null>(null);
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tienda = cuenta.tienda;

  useEffect(() => {
    llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas').then(
      (lista) => setRapidas(lista.map((r) => r.texto)),
      () => setRapidas([]),
    );
  }, []);

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

  async function guardarRapidas(textos: string[], mensaje: string) {
    setError(null);
    try {
      const lista = await llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas', {
        metodo: 'PUT',
        cuerpo: { textos },
      });
      setRapidas(lista.map((r) => r.texto));
      alAvisar(mensaje);
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar las respuestas rápidas.');
      return false;
    }
  }

  async function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = nueva.trim();
    if (!texto || !rapidas) return;
    if (await guardarRapidas([...rapidas, texto], 'Respuesta rápida agregada.')) setNueva('');
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
          Aparecen sobre la caja de texto del chat. Hasta {MAX_RESPUESTAS_RAPIDAS}.
        </span>
        {rapidas === null ? (
          <p className="text-secundario">Cargando…</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {rapidas.map((texto) => (
              <li
                key={texto}
                className="flex h-9 items-center gap-1 rounded-full border-[1.5px] border-borde bg-white pl-3 pr-1 text-nota font-semibold"
              >
                {texto}
                <button
                  type="button"
                  aria-label={`Quitar: ${texto}`}
                  onClick={() =>
                    void guardarRapidas(
                      rapidas.filter((otra) => otra !== texto),
                      'Respuesta rápida quitada.',
                    )
                  }
                  className="flex h-7 w-7 items-center justify-center rounded-full text-cuerpo text-secundario hover:bg-superficie"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {rapidas && rapidas.length < MAX_RESPUESTAS_RAPIDAS && (
          <form onSubmit={agregar} className="flex flex-wrap items-end gap-3">
            <label
              htmlFor={`${id}-nueva`}
              className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5 text-apoyo font-medium"
            >
              Nueva respuesta rápida
              <input
                id={`${id}-nueva`}
                maxLength={120}
                value={nueva}
                onChange={(evento) => setNueva(evento.target.value)}
                placeholder="Ej.: Lo tengo, ¿para cuándo lo necesitas?"
                className={campo}
              />
            </label>
            <button type="submit" disabled={!nueva.trim()} className={botonSecundario}>
              Agregar
            </button>
          </form>
        )}
      </div>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
    </>
  );
}
