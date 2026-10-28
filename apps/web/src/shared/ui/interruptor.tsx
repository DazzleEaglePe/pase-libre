'use client';

/** El interruptor de Configuración (C_Configuracion): pista gris o negra con su perilla. */
export function Interruptor({
  activo,
  alCambiar,
  etiqueta,
  deshabilitado = false,
}: {
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  /** Nombre para los lectores de pantalla: «Mensajes nuevos en la campanita». */
  etiqueta: string;
  deshabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={deshabilitado}
      onClick={() => alCambiar(!activo)}
      className={`relative h-7 w-[50px] shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        activo ? 'bg-tinta' : 'bg-borde'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-[left] ${
          activo ? 'left-[26px]' : 'left-1'
        }`}
      />
    </button>
  );
}
