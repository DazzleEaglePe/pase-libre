'use client';

import type { DetalleConversacion, RespuestaVendido } from '@paselibre/contracts';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/**
 * «Marcar vendido» en la franja «Hablan de» (N02, elegido A): blanco, verde suave al pasar el
 * cursor, la confirmación «¿Se la vendiste a…?» y, ya vendido, verde sólido con «Deshacer».
 * Solo lo ve quien vende. Sin stock y sin venta, «Reponer stock».
 */
export function MarcarVendido({
  detalle,
  alVender,
  alDeshacer,
  alError,
}: {
  detalle: DetalleConversacion;
  alVender: (venta: RespuestaVendido) => void;
  alDeshacer: (venta: RespuestaVendido) => void;
  alError: (mensaje: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const si = useRef<HTMLButtonElement>(null);
  const { venta, oferta, otro } = detalle;

  useEffect(() => {
    if (!confirmando) return;
    si.current?.focus();
    const cerrar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setConfirmando(false);
    };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [confirmando]);

  if (detalle.rol !== 'vendedor') return null;

  async function vender() {
    setEnviando(true);
    try {
      const respuesta = await llamarApi<RespuestaVendido>(`/ofertas/${oferta.id}/vendido`, {
        metodo: 'POST',
        cuerpo: { conversacion_id: detalle.id },
      });
      setConfirmando(false);
      alVender(respuesta);
    } catch (e) {
      alError(e instanceof ErrorApi ? e.message : 'No pudimos registrar la venta.');
    } finally {
      setEnviando(false);
    }
  }

  async function deshacer() {
    if (!venta) return;
    setEnviando(true);
    try {
      alDeshacer(
        await llamarApi<RespuestaVendido>(`/ventas/${venta.id}/deshacer`, { metodo: 'POST' }),
      );
    } catch (e) {
      alError(e instanceof ErrorApi ? e.message : 'No pudimos deshacer la venta.');
    } finally {
      setEnviando(false);
    }
  }

  if (venta && venta.mi_lado === 'vendedor') {
    return (
      <span className="flex shrink-0 items-center gap-2.5">
        <span
          role="status"
          className="flex h-9 items-center gap-1.5 rounded-full bg-pase px-3.5 text-nota font-bold text-white"
        >
          <IconCheck size={16} stroke={2.4} aria-hidden="true" />
          Vendido
        </span>
        {venta.puede_deshacer && (
          <button
            type="button"
            disabled={enviando}
            onClick={() => void deshacer()}
            className="text-nota font-medium text-tinta underline disabled:text-detalle"
          >
            Deshacer
          </button>
        )}
      </span>
    );
  }

  if (!detalle.puede_vender) {
    return oferta.stock === 0 ? (
      <Link href="/mis-publicaciones" className="shrink-0 text-nota font-bold">
        Reponer stock
      </Link>
    ) : null;
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={confirmando}
        onClick={() => setConfirmando(!confirmando)}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-nota font-bold transition-colors ${
          confirmando
            ? 'border-pase bg-pase-suave text-pase-texto'
            : 'border-borde bg-white text-tinta hover:border-pase hover:bg-pase-suave hover:text-pase-texto'
        }`}
      >
        <IconCheck size={16} stroke={2.2} aria-hidden="true" />
        Marcar vendido
      </button>
      {confirmando && (
        <>
          <button
            type="button"
            aria-label="Cancelar"
            tabIndex={-1}
            onClick={() => setConfirmando(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="dialog"
            aria-label={`¿Se la vendiste a ${otro.tienda.nombre}?`}
            className="absolute right-3 top-full z-20 mt-1.5 flex w-[min(380px,calc(100%-24px))] flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(15,20,18,0.18)] sm:right-4"
          >
            <b className="text-cuerpo font-bold">¿Se la vendiste a {otro.tienda.nombre}?</b>
            <span className="text-apoyo text-secundario">
              Baja 1 unidad de tu stock y le pide que te califique.
            </span>
            <span className="flex gap-2">
              <button
                ref={si}
                type="button"
                disabled={enviando}
                onClick={() => void vender()}
                className="h-11 rounded-full bg-pase px-5 font-bold text-white disabled:bg-borde-control"
              >
                {enviando ? 'Registrando…' : 'Sí, vendido'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="h-11 rounded-full border-[1.5px] border-tinta bg-white px-5 font-bold"
              >
                Cancelar
              </button>
            </span>
          </div>
        </>
      )}
    </>
  );
}
