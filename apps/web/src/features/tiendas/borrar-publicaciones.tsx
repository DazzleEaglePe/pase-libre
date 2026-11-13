'use client';

import { CABECERA_PASELIBRE, type RespuestaEliminarOfertas } from '@paselibre/contracts';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { conPlural } from '@/shared/plural';

/** Cuánto dura «Deshacer» (docs/19 §12): el borrado se manda recién al terminar. */
export const SEGUNDOS_DESHACER = 8;
/** Lo que dura cada movimiento: la tarjeta que se achica, la que sale volando. */
export const DURACION_SALIDA = 250;
/** Entre una y otra de las que salen volando, y entre los tachitos que aparecen. */
export const ESCALON = 60;

/** «Reducir movimiento»: sin animaciones, solo aparece y desaparece. */
export function sinMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** Una vibración cortita en el celular al marcar y al eliminar. */
export function vibrar(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10);
  }
}

/**
 * El ícono Tabler `trash` con la tapa aparte, para que se abra (gira −22°) al tocar el tachito.
 * Va en `currentColor`.
 */
export function IconoTachito({ tamano = 14, grosor = 2.1 }: { tamano?: number; grosor?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="overflow-visible"
    >
      <g className="pl-tapa">
        <path d="M4 7h16" />
        <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      </g>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" />
    </svg>
  );
}

/** Manda el borrado. Al cerrar la página, con `keepalive` para que llegue igual. */
function mandarBorrado(ids: string[], alCerrar: boolean): Promise<RespuestaEliminarOfertas> {
  if (alCerrar) {
    void fetch('/v1/ofertas/eliminar', {
      method: 'POST',
      keepalive: true,
      credentials: 'same-origin',
      headers: { [CABECERA_PASELIBRE]: '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => undefined);
    return Promise.resolve({ eliminadas: ids.length });
  }
  return llamarApi<RespuestaEliminarOfertas>('/ofertas/eliminar', {
    metodo: 'POST',
    cuerpo: { ids },
  });
}

/**
 * «Eliminaste 1 publicación · Deshacer» (docs/19 §12): el borrado se manda recién a los 8 s. Si
 * en ese rato se borra otra, la anterior se manda en ese momento. Si se cierra la página (o se
 * sale del perfil) antes, se manda igual con `keepalive`. Si la API no puede, `alFallar` las
 * devuelve a la lista.
 */
export function useBorradoConDeshacer(alFallar: (ids: string[], mensaje: string) => void) {
  const [pendiente, setPendiente] = useState<{ ids: string[]; desde: number } | null>(null);
  const actual = useRef<{ ids: string[]; reloj: number } | null>(null);
  const fallar = useRef(alFallar);
  fallar.current = alFallar;

  const enviar = useCallback((ids: string[], alCerrar = false) => {
    mandarBorrado(ids, alCerrar).catch((error: unknown) =>
      fallar.current(
        ids,
        error instanceof ErrorApi ? error.message : 'No pudimos eliminar. Vuelve a intentarlo.',
      ),
    );
  }, []);

  /** Lo que estaba esperando se manda ya (o al cerrar, con `keepalive`). */
  const mandarYa = useCallback(
    (alCerrar = false) => {
      const espera = actual.current;
      if (!espera) return;
      window.clearTimeout(espera.reloj);
      actual.current = null;
      enviar(espera.ids, alCerrar);
    },
    [enviar],
  );

  const programar = useCallback(
    (ids: string[]) => {
      mandarYa();
      const reloj = window.setTimeout(() => {
        actual.current = null;
        setPendiente(null);
        enviar(ids);
      }, SEGUNDOS_DESHACER * 1000);
      actual.current = { ids, reloj };
      setPendiente({ ids, desde: Date.now() });
    },
    [enviar, mandarYa],
  );

  /** «Deshacer»: no se manda nada y devuelve cuáles eran. */
  const deshacer = useCallback((): string[] => {
    const espera = actual.current;
    if (!espera) return [];
    window.clearTimeout(espera.reloj);
    actual.current = null;
    setPendiente(null);
    return espera.ids;
  }, []);

  useEffect(() => {
    const alSalir = () => mandarYa(true);
    window.addEventListener('pagehide', alSalir);
    return () => {
      window.removeEventListener('pagehide', alSalir);
      // Se sale del perfil sin cerrar la página: también se manda.
      alSalir();
    };
  }, [mandarYa]);

  return { pendiente, programar, deshacer };
}

/**
 * Las de al lado se corren a llenar el hueco (o a abrirlo, con «Deshacer»): antes de cambiar la
 * lista se llama a `medir`; al dibujarse la nueva, cada tarjeta parte de donde estaba (FLIP).
 */
export function useAcomodar(contenedor: RefObject<HTMLElement | null>, clave: string) {
  const antes = useRef(new Map<string, DOMRect>());

  const medir = useCallback(() => {
    const medidas = new Map<string, DOMRect>();
    contenedor.current?.querySelectorAll<HTMLElement>('[data-acomodar]').forEach((elemento) => {
      medidas.set(elemento.dataset.acomodar ?? '', elemento.getBoundingClientRect());
    });
    antes.current = medidas;
  }, [contenedor]);

  useLayoutEffect(() => {
    const medidas = antes.current;
    antes.current = new Map();
    if (medidas.size === 0 || sinMovimiento()) return;
    contenedor.current?.querySelectorAll<HTMLElement>('[data-acomodar]').forEach((elemento) => {
      const previa = medidas.get(elemento.dataset.acomodar ?? '');
      if (!previa || typeof elemento.animate !== 'function') return;
      const ahora = elemento.getBoundingClientRect();
      const dx = previa.left - ahora.left;
      const dy = previa.top - ahora.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      elemento.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: DURACION_SALIDA,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    });
  }, [clave, contenedor]);

  return medir;
}

/** «Eliminaste 1 publicación · Deshacer», con la barrita que se acaba en 8 s. */
export function AvisoDeshacer({
  cuantas,
  desde,
  alDeshacer,
  sobreLaBarra = false,
}: {
  cuantas: number;
  /** Cambia con cada borrado: la barrita vuelve a empezar. */
  desde: number;
  alDeshacer: () => void;
  /** Con «Eliminar varias» abierto va más arriba, para no tapar la barra negra. */
  sobreLaBarra?: boolean;
}) {
  return (
    <div
      key={desde}
      role="status"
      className={`pl-aviso fixed inset-x-4 z-50 mx-auto w-auto max-w-[300px] overflow-hidden rounded-[14px] bg-[#0F1412] text-[13px] text-white shadow-[0_10px_24px_rgba(15,20,18,0.3)] ${
        sobreLaBarra ? 'bottom-[150px] md:bottom-[88px]' : 'bottom-24 md:bottom-8'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        <IconoTachito tamano={15} grosor={2} />
        <span className="flex-1">
          Eliminaste {conPlural(cuantas, 'publicación', 'publicaciones')}
        </span>
        <button
          type="button"
          onClick={alDeshacer}
          className="-my-1 rounded-full px-1.5 py-1 font-bold text-[#22D37A]"
        >
          Deshacer
        </button>
      </div>
      <div aria-hidden="true" className="h-[3px] bg-white/15">
        <div className="pl-barrita h-[3px] bg-[#22D37A]" />
      </div>
    </div>
  );
}

/** «(N) seleccionadas · Cancelar · 🗑 Eliminar N»: la barra negra fija de «Eliminar varias». */
export function BarraSeleccion({
  cuantas,
  alCancelar,
  alEliminar,
}: {
  cuantas: number;
  alCancelar: () => void;
  alEliminar: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Eliminar varias"
      className="pl-sube fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[520px] items-center gap-2.5 rounded-full bg-[#0F1412] py-1.5 pl-4 pr-1.5 text-[13px] text-white shadow-[0_10px_24px_rgba(15,20,18,0.25)] md:bottom-8"
    >
      <b className="flex items-center gap-1.5 font-bold" aria-live="polite">
        <span
          key={cuantas}
          className="pl-brinco inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-white px-1.5 text-[12px] font-extrabold text-[#0F1412]"
        >
          {cuantas}
        </span>
        {cuantas === 1 ? 'seleccionada' : 'seleccionadas'}
      </b>
      <button
        type="button"
        onClick={alCancelar}
        className="ml-auto rounded-full px-2 py-1.5 text-[12.5px] text-[#B5C0BA] hover:text-white"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled={cuantas === 0}
        onClick={alEliminar}
        className="flex items-center gap-1.5 rounded-full bg-[#B42318] px-3.5 py-2 font-extrabold text-white disabled:opacity-50"
      >
        <IconoTachito tamano={15} grosor={2.2} />
        Eliminar {cuantas}
      </button>
    </div>
  );
}

/**
 * «¿Eliminar N publicaciones?»: el ícono, qué pasa y, si solo no hay stock, la sugerencia de
 * dejarlas «No disponible» (doc 20, punto 16).
 */
export function ConfirmarVarias({
  cuantas,
  trabajando,
  alEliminar,
  alPausar,
  alCancelar,
}: {
  cuantas: number;
  trabajando: boolean;
  alEliminar: () => void;
  alPausar: () => void;
  alCancelar: () => void;
}) {
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    boton.current?.focus();
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && alCancelar();
    document.addEventListener('keydown', conEscape);
    return () => document.removeEventListener('keydown', conEscape);
  }, [alCancelar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,20,18,0.35)] px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-varias"
        className="pl-ventana flex w-full max-w-[400px] flex-col gap-[9px] rounded-[18px] border-[1.5px] border-[#E3E8E5] bg-white p-5 text-[13.5px] leading-normal shadow-[0_14px_40px_rgba(15,20,18,0.12)]"
      >
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-[#FDECEA] text-[#B42318]">
          <IconoTachito tamano={22} grosor={2} />
        </span>
        <b id="confirmar-varias" className="text-[18px] font-bold">
          ¿Eliminar {conPlural(cuantas, 'publicación', 'publicaciones')}?
        </b>
        <span className="text-[#59645e]">
          Dejan de verse en el feed, tu perfil y las búsquedas. En los chats queda «Publicación
          eliminada». Si solo no tienes stock, mejor «
          <button
            type="button"
            disabled={trabajando}
            onClick={alPausar}
            className="font-bold text-[#0F1412] underline"
          >
            No disponible
          </button>
          ».
        </span>
        <div className="mt-1 flex gap-2.5">
          <button
            ref={boton}
            type="button"
            disabled={trabajando}
            onClick={alEliminar}
            className="rounded-full bg-[#B42318] px-[18px] py-[9px] font-bold text-white disabled:opacity-60"
          >
            Sí, eliminar
          </button>
          <button
            type="button"
            onClick={alCancelar}
            className="rounded-full border-[1.5px] border-[#D6DDD9] px-[18px] py-[9px] font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
