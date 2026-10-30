'use client';

/**
 * Botones en píldora para elegir una sola opción (estado, moneda, «Ver como»), como el
 * lienzo: fondo gris, y la elegida en blanco con borde.
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  alCambiar,
  etiqueta,
  chico = false,
  llenoEnCelular = false,
}: {
  opciones: ReadonlyArray<readonly [T, string]>;
  valor: T;
  alCambiar: (valor: T) => void;
  /** Nombre del grupo para los lectores de pantalla. */
  etiqueta: string;
  chico?: boolean;
  /** En el celular ocupa todo el ancho y reparte las opciones en partes iguales. */
  llenoEnCelular?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiqueta}
      className={`inline-flex self-start rounded-full bg-superficie ${chico ? 'gap-0.5 p-[3px]' : 'gap-1 p-1'} ${
        llenoEnCelular ? 'max-sm:flex max-sm:self-stretch' : ''
      }`}
    >
      {opciones.map(([opcion, texto]) => {
        const elegida = opcion === valor;
        return (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => alCambiar(opcion)}
            className={`rounded-full border ${chico ? 'h-[30px] px-3 text-nota' : 'h-9 px-5 text-apoyo'} ${
              llenoEnCelular ? 'max-sm:flex-1 max-sm:px-2' : ''
            } ${
              elegida ? 'border-borde bg-white font-semibold' : 'border-transparent font-medium'
            }`}
          >
            {texto}
          </button>
        );
      })}
    </div>
  );
}
