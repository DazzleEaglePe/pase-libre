'use client';

import type { InteresadoOferta, RespuestaVendido } from '@paselibre/contracts';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { Ventana } from '@/shared/ui/ventana';

/**
 * «¿A quién se lo vendiste?» (F_MovilChat, RF-47): entre quienes escribieron por la
 * oferta, con esta conversación primero, y el stock antes y después.
 */
export function VentanaVendido({
  abierta,
  ofertaId,
  conversacionId,
  producto,
  stock,
  alCerrar,
  alVender,
}: {
  abierta: boolean;
  ofertaId: string;
  conversacionId: string;
  producto: string;
  stock: number;
  alCerrar: () => void;
  /** Con la conversación en la que quedó el aviso de la venta. */
  alVender: (venta: RespuestaVendido, conversacionId: string) => void;
}) {
  const [interesados, setInteresados] = useState<InteresadoOferta[] | null>(null);
  const [elegido, setElegido] = useState(conversacionId);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setElegido(conversacionId);
    setError(null);
    llamarApi<InteresadoOferta[]>(`/ofertas/${ofertaId}/interesados`).then(
      (lista) =>
        setInteresados([
          ...lista.filter((i) => i.conversacion_id === conversacionId),
          ...lista.filter((i) => i.conversacion_id !== conversacionId),
        ]),
      (e: unknown) => setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar la lista.'),
    );
  }, [abierta, ofertaId, conversacionId]);

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const venta = await llamarApi<RespuestaVendido>(`/ofertas/${ofertaId}/vendido`, {
        metodo: 'POST',
        cuerpo: { conversacion_id: elegido },
      });
      alVender(venta, elegido);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos registrar la venta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Ventana titulo="¿A quién se lo vendiste?" abierta={abierta} alCerrar={alCerrar}>
      <p className="-mt-2 text-nota text-detalle">Entre quienes te escribieron por {producto}</p>
      {interesados === null && !error ? (
        <p className="text-secundario">Cargando…</p>
      ) : (
        <div role="radiogroup" aria-label="Comprador" className="flex flex-col">
          {interesados?.map((i) => {
            const marcado = i.conversacion_id === elegido;
            return (
              <button
                key={i.conversacion_id}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => setElegido(i.conversacion_id)}
                className="grid min-h-14 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 border-b border-linea text-left"
              >
                <span
                  aria-hidden="true"
                  className={`h-5 w-5 rounded-full ${
                    marcado ? 'border-[6px] border-tinta' : 'border-[1.5px] border-borde-control'
                  }`}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{i.persona.tienda.nombre}</span>
                  <span className="text-[12px] leading-4 text-detalle">
                    {i.conversacion_id === conversacionId
                      ? 'Esta conversación'
                      : `${i.persona.nombre} · te escribió ${haceRato(i.ultimo_mensaje_en).toLowerCase()}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between rounded-xl bg-superficie px-3.5 py-2.5 text-apoyo">
        <span>Stock</span>
        <b className="font-semibold">
          {stock} → {Math.max(0, stock - 1)}
        </b>
      </div>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={enviando || !interesados?.length}
        onClick={confirmar}
        className="h-[52px] w-full rounded-full bg-pase text-tarjeta text-white disabled:bg-borde-control"
      >
        {enviando ? 'Registrando…' : 'Confirmar venta'}
      </button>
    </Ventana>
  );
}
