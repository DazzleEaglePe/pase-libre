'use client';

import type { DetalleConversacion, RespuestaVendido } from '@paselibre/contracts';
import { IconTag } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/** «Baja 1 unidad de tu stock»: la venta a la tienda de este chat (RF-47). */
export function registrarVenta(detalle: DetalleConversacion): Promise<RespuestaVendido> {
  return llamarApi<RespuestaVendido>(`/ofertas/${detalle.oferta.id}/vendido`, {
    metodo: 'POST',
    cuerpo: { conversacion_id: detalle.id },
  });
}

/** «Deshacer» la venta (N02): vuelve la unidad al stock. */
export function deshacerVenta(ventaId: string): Promise<RespuestaVendido> {
  return llamarApi<RespuestaVendido>(`/ventas/${ventaId}/deshacer`, { metodo: 'POST' });
}

/**
 * «Marcar vendido» en la cabecera del chat, al lado de «Pedir WhatsApp» (doc 19, punto 17,
 * botón A sin X): negro con el ícono de etiqueta; en el celular, solo el ícono y «Vendido».
 * Ya vendido, una pastilla verde suave «Vendido · quedan N» y «Deshacer» subrayado. Solo lo ve
 * quien vende. Sin stock y sin venta, «Reponer stock».
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
      const respuesta = await registrarVenta(detalle);
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
      alDeshacer(await deshacerVenta(venta.id));
    } catch (e) {
      alError(e instanceof ErrorApi ? e.message : 'No pudimos deshacer la venta.');
    } finally {
      setEnviando(false);
    }
  }

  if (venta && venta.mi_lado === 'vendedor') {
    // En el celular no entra todo en la cabecera: «Deshacer» va en el menú ⋯ del chat.
    return (
      <span className="flex shrink-0 items-center gap-2">
        <span
          role="status"
          className="flex h-[38px] items-center gap-[7px] whitespace-nowrap rounded-full bg-[#e9f7ef] pl-3 pr-3.5 text-[13.5px] font-extrabold text-[#006b47] max-sm:gap-1.5 max-sm:px-2.5"
        >
          <IconTag size={17} stroke={2} aria-hidden="true" />
          Vendido
          <span className="max-sm:sr-only xl:max-2xl:sr-only">· quedan {oferta.stock}</span>
        </span>
        {venta.puede_deshacer && (
          <button
            type="button"
            disabled={enviando}
            onClick={() => void deshacer()}
            className="text-[12.5px] text-secundario underline disabled:text-detalle max-sm:hidden"
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
        className="flex h-[38px] shrink-0 items-center gap-[7px] rounded-full bg-[#0f1412] pl-[13px] pr-4 text-[13.5px] font-bold text-white max-sm:px-3"
      >
        <IconTag size={17} stroke={2} aria-hidden="true" />
        <span className="max-sm:hidden xl:max-2xl:hidden">Marcar vendido</span>
        <span className="sm:hidden xl:max-2xl:inline">Vendido</span>
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
