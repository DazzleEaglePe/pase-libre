'use client';

import { IconX } from '@tabler/icons-react';
import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Una hoja: ventana centrada en la computadora que sube desde abajo en el celular (la de
 * «Filtros» del lienzo). Es un `<dialog>` nativo: atrapa el foco, se cierra con Escape y con
 * un clic en lo oscuro. `pie` queda fijo abajo y el cuerpo es lo que se desplaza.
 */
export function Hoja({
  titulo,
  abierta,
  alCerrar,
  pie,
  children,
}: {
  titulo: string;
  abierta: boolean;
  alCerrar: () => void;
  pie?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) dialogo.showModal();
    if (!abierta && dialogo.open) dialogo.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      aria-label={titulo}
      onClose={alCerrar}
      onClick={(evento) => {
        if (evento.target === ref.current) alCerrar();
      }}
      className="m-auto w-[720px] max-w-[calc(100%-32px)] overflow-hidden rounded-3xl bg-white p-0 text-tinta shadow-[0_24px_64px_rgba(15,20,18,0.24)] backdrop:bg-tinta/40 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
    >
      <div className="flex max-h-[min(780px,calc(100dvh-48px))] flex-col max-sm:max-h-[88dvh]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-linea py-3 pl-6 pr-3 sm:pl-7">
          <h2 className="text-seccion">{titulo}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="flex h-11 w-11 items-center justify-center rounded-full text-tinta hover:bg-superficie"
          >
            <IconX size={20} stroke={1.8} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6 sm:px-7">
          {children}
        </div>
        {pie && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-linea px-6 py-3 sm:px-7">
            {pie}
          </div>
        )}
      </div>
    </dialog>
  );
}
