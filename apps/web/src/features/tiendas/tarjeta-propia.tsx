'use client';

import type { ProductoDeTienda } from '@paselibre/contracts';
import { useEffect, useRef, type CSSProperties } from 'react';

import { textoEstado } from '@/features/catalogo/textos';
import { TarjetaProducto } from '@/shared/ui/tarjeta-producto';

import { ESCALON, IconoTachito } from './borrar-publicaciones';

/** Cuánto hay que mantener el dedo sobre una tarjeta para entrar a «Eliminar varias». */
const PRESION_LARGA_MS = 500;

/** Cómo sale una tarjeta: achicándose (una) o volando (varias, una tras otra). */
export interface Salida {
  modo: 'una' | 'varias';
  /** Su turno entre las que salen volando. */
  orden: number;
}

/**
 * Una tarjeta de tu propio perfil (docs/19 §12): la de todo el sitio con el tachito B abajo a la
 * derecha, en la línea del precio. Al tocarlo se hunde, se llena de rojo, se le abre la tapa y
 * sale la cajita «¿Eliminar esta publicación?». En «Eliminar varias» el tachito (o la tarjeta
 * entera) la marca: se llena de rojo con un saltito, la foto se tiñe y dice «Se elimina». En el
 * celular, mantener el dedo sobre la tarjeta entra a «Eliminar varias».
 */
export function TarjetaPropia({
  producto,
  galeria,
  indice,
  varias,
  marcada,
  preguntando,
  salida,
  volviendo,
  alTocarTachito,
  alConfirmar,
  alCancelar,
  alMarcar,
  alPresionLargo,
}: {
  producto: ProductoDeTienda;
  galeria: string | null;
  /** Su lugar en la lista: los tachitos aparecen uno tras otro. */
  indice: number;
  /** «Eliminar varias» está prendido. */
  varias: boolean;
  marcada: boolean;
  /** La cajita «¿Eliminar esta publicación?» está abierta. */
  preguntando: boolean;
  salida: Salida | null;
  /** Volvió con «Deshacer». */
  volviendo: boolean;
  alTocarTachito: () => void;
  alConfirmar: () => void;
  alCancelar: () => void;
  alMarcar: () => void;
  alPresionLargo: () => void;
}) {
  const cajita = useRef<HTMLDivElement>(null);
  const presion = useRef<{ reloj: number; x: number; y: number } | null>(null);
  const tragarClic = useRef(false);

  // La cajita se cierra al tocar afuera o con Escape.
  useEffect(() => {
    if (!preguntando) return;
    const afuera = (evento: PointerEvent) => {
      if (!cajita.current?.parentElement?.contains(evento.target as Node)) alCancelar();
    };
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && alCancelar();
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', conEscape);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      document.removeEventListener('keydown', conEscape);
    };
  }, [preguntando, alCancelar]);

  useEffect(() => () => window.clearTimeout(presion.current?.reloj), []);

  function soltar() {
    if (presion.current) window.clearTimeout(presion.current.reloj);
    presion.current = null;
  }

  const lleno = marcada || preguntando;
  const estiloSalida: CSSProperties | undefined = salida
    ? ({
        animationDelay: salida.modo === 'varias' ? `${salida.orden * ESCALON}ms` : undefined,
        '--pl-giro': salida.orden % 2 ? '6deg' : '-6deg',
      } as CSSProperties)
    : undefined;

  const tachito = (
    <span className="relative flex">
      <button
        type="button"
        aria-label={
          varias
            ? marcada
              ? `Desmarcar ${producto.producto.titulo}`
              : `Marcar ${producto.producto.titulo} para eliminar`
            : `Eliminar ${producto.producto.titulo}`
        }
        aria-pressed={varias ? marcada : undefined}
        aria-expanded={varias ? undefined : preguntando}
        data-visible={varias || preguntando ? '' : undefined}
        data-lleno={lleno ? '' : undefined}
        data-marcado={marcada ? '' : undefined}
        data-abierto={preguntando ? '' : undefined}
        onClick={varias ? alMarcar : alTocarTachito}
        style={varias ? { animationDelay: `${Math.min(indice, 12) * ESCALON}ms` } : undefined}
        // `key` cambia al marcar: así el saltito vuelve a dar cada vez.
        key={varias ? `varias-${marcada ? 'si' : 'no'}` : 'una'}
        className={`pl-tachito ${varias ? (marcada ? 'pl-salto' : 'pl-aparece') : ''}`}
      >
        <IconoTachito />
        {preguntando && <span aria-hidden="true" className="pl-onda" />}
      </button>
      {preguntando && (
        <div
          ref={cajita}
          role="dialog"
          aria-label="¿Eliminar esta publicación?"
          className="pl-cajita absolute bottom-[34px] right-0 z-30 flex w-[170px] flex-col gap-2 rounded-xl bg-white p-2.5 text-[12.5px] text-tinta shadow-[0_10px_26px_rgba(15,20,18,0.22)]"
        >
          <b className="font-bold leading-4">¿Eliminar esta publicación?</b>
          <span className="flex gap-1.5">
            <button
              type="button"
              autoFocus
              onClick={alConfirmar}
              className="pl-hundir flex-1 rounded-full bg-[#B42318] py-[5px] font-bold text-white"
            >
              Sí
            </button>
            <button
              type="button"
              onClick={alCancelar}
              className="flex-1 rounded-full border-[1.5px] border-[#D6DDD9] py-[5px] font-bold"
            >
              No
            </button>
          </span>
        </div>
      )}
    </span>
  );

  return (
    <div
      className={`h-full ${salida ? (salida.modo === 'varias' ? 'pl-volar' : 'pl-salir') : volviendo ? 'pl-volver' : ''}`}
      style={estiloSalida}
      onPointerDown={(evento) => {
        if (evento.pointerType === 'mouse' || varias) return;
        const reloj = window.setTimeout(() => {
          presion.current = null;
          tragarClic.current = true;
          alPresionLargo();
        }, PRESION_LARGA_MS);
        presion.current = { reloj, x: evento.clientX, y: evento.clientY };
      }}
      onPointerMove={(evento) => {
        const inicio = presion.current;
        if (inicio && Math.hypot(evento.clientX - inicio.x, evento.clientY - inicio.y) > 8)
          soltar();
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerLeave={soltar}
      onContextMenu={(evento) => {
        if (tragarClic.current || presion.current) evento.preventDefault();
      }}
      onClickCapture={(evento) => {
        // El clic que sigue a mantener el dedo no abre ni desmarca la tarjeta.
        if (!tragarClic.current) return;
        tragarClic.current = false;
        evento.preventDefault();
        evento.stopPropagation();
      }}
    >
      <TarjetaProducto
        href={`/p/${producto.producto.slug}?oferta=${producto.oferta_id}`}
        titulo={producto.producto.titulo}
        foto={producto.producto.foto}
        categoria={producto.producto.categoria.slug}
        precio={producto.precio}
        socio={producto.precio_socio}
        negociable={producto.negociable}
        variantes={producto.variantes}
        linea={[textoEstado(producto.condicion), galeria].filter(Boolean).join(' · ')}
        className={`pl-tarjeta ${marcada ? '!border-[#E9877E]' : ''}`}
        accion={tachito}
        alTocar={varias ? alMarcar : undefined}
        sobreFoto={
          marcada ? (
            <span
              aria-hidden="true"
              className="pl-tinte absolute inset-0 bg-[rgba(180,35,24,0.11)]"
            />
          ) : null
        }
        enVezDelPrecio={
          marcada ? (
            <span className="pl-asoma text-[11.5px] font-bold text-[#B42318]">Se elimina</span>
          ) : undefined
        }
      />
    </div>
  );
}
