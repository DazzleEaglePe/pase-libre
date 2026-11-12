import { FICHA_TIENDA } from '@paselibre/contracts';
import { Fragment } from 'react';

/** La ficha verde «Nombre de la tienda» dentro de una respuesta rápida (N11). */
export function FichaTienda({ chica = false }: { chica?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-pase-medio align-middle font-bold text-marca ${
        chica ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-nota'
      }`}
    >
      Nombre de la tienda
    </span>
  );
}

/** «Hola, {tienda}, ¿qué tal?» con la ficha donde va el nombre, en el mismo renglón del texto. */
export function TextoConFicha({ texto, chica = false }: { texto: string; chica?: boolean }) {
  const partes = texto.split(FICHA_TIENDA);
  return (
    <>
      {partes.map((parte, indice) => (
        <Fragment key={indice}>
          {indice > 0 && <FichaTienda chica={chica} />}
          {parte}
        </Fragment>
      ))}
    </>
  );
}

/** Para leer en voz alta: «Hola, Nombre de la tienda, ¿qué tal?». */
export function textoParaLeer(texto: string): string {
  return texto.split(FICHA_TIENDA).join('Nombre de la tienda');
}
