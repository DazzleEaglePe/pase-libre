import {
  COLOR,
  SIMBOLO,
  SIMBOLO_PEQUENO,
  TRAZO_SIMBOLO,
  TRAZO_SIMBOLO_PEQUENO,
  palabra,
  texto,
} from './geometria.mjs';

/**
 * Las piezas de la marca como SVG: símbolo, ícono, logos horizontal y vertical, y la
 * vista que se ve al compartir un enlace. Cada una recibe los colores con los que se va a
 * usar; los nombres de las versiones están en `generar.mjs`.
 */

const n = (valor) => String(Math.round(valor * 100) / 100);

export function envolver(ancho, alto, cuerpo, titulo = 'PaseLibre') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(ancho)}" height="${n(alto)}" viewBox="0 0 ${n(ancho)} ${n(alto)}" role="img" aria-labelledby="titulo"><title id="titulo">${titulo}</title>${cuerpo}</svg>\n`;
}

const mover = ({ x = 0, y = 0, escala = 1 }) =>
  x === 0 && y === 0 && escala === 1
    ? ''
    : ` transform="translate(${n(x)} ${n(y)})${escala === 1 ? '' : ` scale(${n(escala)})`}"`;

/** El símbolo, con la flecha vaciada. */
export function simbolo(color, posicion = {}, trazo = TRAZO_SIMBOLO) {
  return `<path${mover(posicion)} fill="${color}" fill-rule="evenodd" d="${trazo}"/>`;
}

export const LADO_ICONO = 64;

/**
 * El ícono: un cuadro con el símbolo en el centro. `esquina` en 0 para los lugares que ya
 * recortan solos (la pantalla de inicio del iPhone).
 */
export const posicionIcono = (escala, pequeno = false) => {
  const medidas = pequeno ? SIMBOLO_PEQUENO : SIMBOLO;
  return {
    x: (LADO_ICONO - medidas.ancho * escala) / 2,
    y: (LADO_ICONO - medidas.alto * escala) / 2,
    escala,
  };
};

export function icono({ fondo, figura, esquina = 16, escala = 0.8, pequeno = false }) {
  const cuadro = `<rect width="${LADO_ICONO}" height="${LADO_ICONO}"${esquina ? ` rx="${esquina}"` : ''} fill="${fondo}"/>`;
  return (
    cuadro +
    simbolo(figura, posicionIcono(escala, pequeno), pequeno ? TRAZO_SIMBOLO_PEQUENO : TRAZO_SIMBOLO)
  );
}

/** Tamaño de la palabra respecto del alto de la marca, igual en todas las versiones. */
export const TAMANO_PALABRA = 40;

/**
 * Logo horizontal: la marca y la palabra a su lado, con el centro de las letras
 * minúsculas a la altura del centro de la marca.
 * `marca` es 'icono' (con el cuadro de color) o 'simbolo' (solo la entrada, que toma el color que se le dé).
 */
export function horizontal({ marca, colores }) {
  const letras = palabra({ tamano: TAMANO_PALABRA });
  const alto = marca === 'icono' ? LADO_ICONO : SIMBOLO.alto;
  const ancho = marca === 'icono' ? LADO_ICONO : SIMBOLO.ancho;
  const separacion = TAMANO_PALABRA * 0.4;
  const base = alto / 2 + letras.alturaX / 2;
  const x = ancho + separacion;
  const cuerpo =
    (marca === 'icono'
      ? icono({ fondo: colores.fondo, figura: colores.figura })
      : simbolo(colores.figura)) +
    `<path transform="translate(${n(x)} ${n(base)})" fill="${colores.palabra}" d="${letras.pase}"/>` +
    `<path transform="translate(${n(x)} ${n(base)})" fill="${colores.palabra}" d="${letras.libre}"/>`;
  return {
    ancho: x + letras.ancho,
    alto,
    cuerpo,
    datos: { palabraX: x, palabraY: base, pase: letras.pase, libre: letras.libre },
  };
}

/** Logo vertical: la marca arriba y la palabra centrada debajo. */
export function vertical({ marca, colores }) {
  const letras = palabra({ tamano: TAMANO_PALABRA });
  const escala = 1.35;
  const anchoMarca = (marca === 'icono' ? LADO_ICONO : SIMBOLO.ancho) * escala;
  const altoMarca = (marca === 'icono' ? LADO_ICONO : SIMBOLO.alto) * escala;
  const separacion = TAMANO_PALABRA * 0.75;
  const ancho = Math.max(anchoMarca, letras.ancho);
  const base = altoMarca + separacion + letras.ascendente;
  const dibujo =
    marca === 'icono'
      ? `<g transform="translate(${n((ancho - anchoMarca) / 2)} 0) scale(${escala})">${icono({ fondo: colores.fondo, figura: colores.figura })}</g>`
      : simbolo(colores.figura, { x: (ancho - anchoMarca) / 2, escala });
  const x = (ancho - letras.ancho) / 2;
  const cuerpo =
    dibujo +
    `<path transform="translate(${n(x)} ${n(base)})" fill="${colores.palabra}" d="${letras.pase}"/>` +
    `<path transform="translate(${n(x)} ${n(base)})" fill="${colores.palabra}" d="${letras.libre}"/>`;
  return { ancho, alto: base + letras.descendente, cuerpo };
}

/** Solo la palabra. */
export function soloPalabra(color) {
  const letras = palabra({ tamano: TAMANO_PALABRA });
  const base = letras.ascendente;
  return {
    ancho: letras.ancho,
    alto: base + letras.descendente,
    cuerpo:
      `<path transform="translate(0 ${n(base)})" fill="${color}" d="${letras.pase}"/>` +
      `<path transform="translate(0 ${n(base)})" fill="${color}" d="${letras.libre}"/>`,
  };
}

export { COLOR, texto };
