'use client';

/** El − n + del lienzo para el stock. `chico` es la variante de 36 px de las listas. */
export function Contador({
  valor,
  minimo = 0,
  maximo = 9999,
  alCambiar,
  nombre,
  chico = false,
  deshabilitado = false,
}: {
  valor: number;
  minimo?: number;
  maximo?: number;
  alCambiar: (valor: number) => void;
  /** Para los lectores de pantalla: «Quitar una unidad de {nombre}». */
  nombre?: string;
  chico?: boolean;
  deshabilitado?: boolean;
}) {
  const boton = chico ? 'h-[34px] w-9 text-[18px]' : 'h-[42px] w-11 text-[20px]';
  const de = nombre ? ` de ${nombre}` : '';
  return (
    <span
      role="group"
      aria-label={nombre ? `Stock de ${nombre}` : 'Cantidad disponible'}
      className={`inline-flex items-center rounded-full border border-borde ${chico ? 'h-9' : 'h-11'}`}
    >
      <button
        type="button"
        aria-label={`Quitar una unidad${de}`}
        disabled={deshabilitado || valor <= minimo}
        onClick={() => alCambiar(valor - 1)}
        className={`${boton} rounded-l-full disabled:text-borde`}
      >
        −
      </button>
      <span
        aria-live="polite"
        className={`text-center font-semibold ${chico ? 'min-w-7 text-cuerpo' : 'min-w-9 text-tarjeta'}`}
      >
        {valor}
      </span>
      <button
        type="button"
        aria-label={`Agregar una unidad${de}`}
        disabled={deshabilitado || valor >= maximo}
        onClick={() => alCambiar(valor + 1)}
        className={`${boton} rounded-r-full disabled:text-borde`}
      >
        +
      </button>
    </span>
  );
}
