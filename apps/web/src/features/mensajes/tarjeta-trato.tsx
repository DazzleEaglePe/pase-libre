'use client';

import {
  debePreguntarTrato,
  type DetalleConversacion,
  type EstadoTrato,
  type MensajeChat,
  type ResponderTrato,
  type RespuestaVendido,
} from '@paselibre/contracts';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Miniatura } from '@/shared/ui/miniatura';

import { registrarVenta } from './marcar-vendido';

/**
 * Si la tarjeta va: lo que el servidor ya sabe (aun lo que no está cargado) o, con lo que llegó
 * en vivo, las mismas reglas de `debePreguntarTrato`. Solo para quien vende y puede vender.
 */
export function mostrarTarjetaTrato(
  detalle: DetalleConversacion,
  mensajes: readonly MensajeChat[],
  ahora = new Date(),
): boolean {
  const { trato } = detalle;
  if (!trato || detalle.rol !== 'vendedor') return false;
  const vendido = detalle.venta !== null;
  // El «preguntar» del servidor vale mientras no se venda, se acabe el stock o se responda
  // (al responder, la pantalla lo pone en falso).
  if (trato.preguntar && !vendido && detalle.puede_vender && !trato.descartada) return true;
  return debePreguntarTrato({
    mensajes,
    pospuesta_en: trato.pospuesta_en,
    descartada: trato.descartada,
    vendido,
    hay_stock: detalle.puede_vender,
    ahora,
  });
}

/**
 * «¿Lograste cerrar el trato?» (doc 19, punto 17, tarjeta 1): dentro del chat, centrada como un
 * mensaje más, con la foto, «{producto} · quedan N», «Sí, se vendió» (negro), «Todavía no» y
 * una X chiquita. «Todavía no» la esconde 24 h; la X, para siempre en este chat. Entra subiendo
 * 14 px (escala 0.97 → 1, 250 ms).
 */
export function TarjetaTrato({
  detalle,
  alResponder,
  alVender,
  alError,
}: {
  detalle: DetalleConversacion;
  alResponder: (estado: EstadoTrato) => void;
  alVender: (venta: RespuestaVendido) => void;
  alError: (mensaje: string) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const { oferta } = detalle;

  async function responder(respuesta: ResponderTrato['respuesta']) {
    setEnviando(true);
    try {
      alResponder(
        await llamarApi<EstadoTrato>(`/conversaciones/${detalle.id}/trato`, {
          metodo: 'POST',
          cuerpo: { respuesta },
        }),
      );
    } catch (e) {
      alError(e instanceof ErrorApi ? e.message : 'No pudimos guardar tu respuesta.');
    } finally {
      setEnviando(false);
    }
  }

  async function vender() {
    setEnviando(true);
    try {
      alVender(await registrarVenta(detalle));
    } catch (e) {
      alError(e instanceof ErrorApi ? e.message : 'No pudimos registrar la venta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      role="group"
      aria-label="¿Lograste cerrar el trato?"
      className="trato-entra relative flex w-[88%] max-w-[440px] shrink-0 flex-col gap-2.5 self-center rounded-2xl border-[1.5px] border-[#e3e8e5] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(15,20,18,0.08)]"
    >
      <button
        type="button"
        aria-label="No volver a preguntar en este chat"
        title="No volver a preguntar en este chat"
        disabled={enviando}
        onClick={() => void responder('NO_PREGUNTAR')}
        className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#f1f4f2] text-secundario"
      >
        <IconX size={14} stroke={2.2} aria-hidden="true" />
      </button>
      <span className="flex items-center gap-2.5 pr-8">
        <Miniatura
          ruta={oferta.producto.foto}
          categoria={oferta.producto.categoria.slug}
          className="h-10 w-10 shrink-0 rounded-[10px]"
          glifo={28}
          grosor={4}
        />
        <span className="flex min-w-0 flex-col leading-[1.35]">
          <b className="text-[14px] font-bold">¿Lograste cerrar el trato?</b>
          <span className="truncate text-[12px] text-detalle">
            {oferta.producto.titulo} · quedan {oferta.stock}
          </span>
        </span>
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          disabled={enviando}
          onClick={() => void vender()}
          className="h-9 flex-1 rounded-full bg-tinta text-apoyo font-bold text-white disabled:bg-borde-control"
        >
          Sí, se vendió
        </button>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void responder('TODAVIA_NO')}
          className="h-9 flex-1 rounded-full border-[1.5px] border-[#d6ddd9] bg-white text-apoyo font-bold"
        >
          Todavía no
        </button>
      </span>
    </div>
  );
}
