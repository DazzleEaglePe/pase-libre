'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Ventana del panel: un `<dialog>` nativo, que ya atrapa el foco y se cierra con Escape.
 * `lateral` la abre como panel a la derecha (crear cuenta), si no, centrada (confirmar).
 */
export function Ventana({
  titulo,
  abierta,
  alCerrar,
  lateral = false,
  children,
}: {
  titulo: string;
  abierta: boolean;
  alCerrar: () => void;
  lateral?: boolean;
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
        // Clic en el fondo oscuro: cerrar.
        if (evento.target === ref.current) alCerrar();
      }}
      className={
        lateral
          ? 'm-0 ml-auto h-dvh max-h-dvh w-[520px] max-w-full bg-white p-0 backdrop:bg-tinta/30'
          : 'w-[440px] max-w-[calc(100%-32px)] rounded-[20px] bg-white p-0 backdrop:bg-tinta/30'
      }
    >
      <div className={`flex flex-col gap-4 ${lateral ? 'min-h-full px-5 py-7 sm:px-8' : 'p-6'}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-seccion">{titulo}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={alCerrar}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-superficie text-[20px]"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
