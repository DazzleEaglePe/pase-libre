import { readFileSync } from 'node:fs';

import opentype from 'opentype.js';

/**
 * La geometría de la marca de PaseLibre: el símbolo de la entrada con muesca y la línea
 * gráfica Hielo (D-52).
 *
 * El símbolo es una entrada, el «pase»: un rectángulo de esquinas redondeadas con una
 * muesca semicircular en cada lado y, vaciada en el centro, una flecha que apunta hacia
 * adelante. Todo es una sola figura: la flecha es un hueco, así que el símbolo funciona en
 * cualquier color y sobre cualquier fondo.
 *
 * Aquí solo hay números y trazos. Los archivos salen de `generar.mjs`.
 */

export const COLOR = {
  tinta: '#0A1633',
  pase: '#2F5BFF',
  acento: '#8FA9FF',
  blanco: '#FFFFFF',
  borde: '#C8CFDD',
};

/** Redondea para que los trazos pesen poco. */
const n = (valor) => String(Math.round(valor * 100) / 100);

// ── Símbolo ──────────────────────────────────────────────────────────────────

export const SIMBOLO = { ancho: 64, alto: 44, esquina: 10, muesca: 6.5 };

export function trazoEntrada({ ancho: w, alto: h, esquina: r, muesca: m }) {
  return [
    `M${n(r)} 0H${n(w - r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(r)}`,
    `V${n(h / 2 - m)}a${n(m)} ${n(m)} 0 0 0 0 ${n(m * 2)}`,
    `V${n(h - r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(r)}`,
    `H${n(r)}a${n(r)} ${n(r)} 0 0 1 ${n(-r)} ${n(-r)}`,
    `V${n(h / 2 + m)}a${n(m)} ${n(m)} 0 0 0 0 ${n(-m * 2)}`,
    `V${n(r)}a${n(r)} ${n(r)} 0 0 1 ${n(r)} ${n(-r)}Z`,
  ].join('');
}

/**
 * Un polígono con las esquinas redondeadas. `radios` es un número o uno por vértice; el
 * redondeo nunca pasa de la mitad del lado más corto.
 */
export function poligonoRedondeado(puntos, radios) {
  const cuantos = puntos.length;
  const radioDe = (i) => (Array.isArray(radios) ? radios[i] : radios);
  const partes = [];
  for (let i = 0; i < cuantos; i += 1) {
    const anterior = puntos[(i + cuantos - 1) % cuantos];
    const actual = puntos[i];
    const siguiente = puntos[(i + 1) % cuantos];
    const hacia = (destino) => {
      const dx = destino[0] - actual[0];
      const dy = destino[1] - actual[1];
      const largo = Math.hypot(dx, dy);
      return { x: dx / largo, y: dy / largo, largo };
    };
    const a = hacia(anterior);
    const b = hacia(siguiente);
    const angulo = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y)));
    const corte = Math.min(radioDe(i) / Math.tan(angulo / 2), a.largo / 2, b.largo / 2);
    const radio = corte * Math.tan(angulo / 2);
    const desde = [actual[0] + a.x * corte, actual[1] + a.y * corte];
    const hasta = [actual[0] + b.x * corte, actual[1] + b.y * corte];
    const giro =
      (actual[0] - anterior[0]) * (siguiente[1] - actual[1]) -
      (actual[1] - anterior[1]) * (siguiente[0] - actual[0]);
    partes.push(
      `${i === 0 ? 'M' : 'L'}${n(desde[0])} ${n(desde[1])}A${n(radio)} ${n(radio)} 0 0 ${giro > 0 ? 1 : 0} ${n(hasta[0])} ${n(hasta[1])}`,
    );
  }
  return `${partes.join('')}Z`;
}

/** La flecha: una barra con una punta en ángulo recto, de un solo grosor. */
export function trazoFlecha({ cx, cy, grosor, brazo, barra, terminales = 1.2 }) {
  const t = grosor / 2;
  const s = Math.SQRT1_2;
  const raiz2 = Math.SQRT2;
  const anchoTotal = barra + t * raiz2;
  const bx = cx - anchoTotal / 2;
  const mx = bx + barra;
  const sx = mx - brazo;

  const finSuperior = {
    dentro: [sx - t * s, cy - brazo + t * s],
    fuera: [sx + t * s, cy - brazo - t * s],
  };
  const finInferior = {
    dentro: [sx - t * s, cy + brazo - t * s],
    fuera: [sx + t * s, cy + brazo + t * s],
  };
  const encuentroSuperior = [finSuperior.dentro[0] + (cy - t - finSuperior.dentro[1]), cy - t];
  const encuentroInferior = [finInferior.dentro[0] + (finInferior.dentro[1] - (cy + t)), cy + t];

  const puntos = [
    [bx, cy - t],
    encuentroSuperior,
    finSuperior.dentro,
    finSuperior.fuera,
    [mx + t * raiz2, cy],
    finInferior.fuera,
    finInferior.dentro,
    encuentroInferior,
    [bx, cy + t],
  ];
  // Extremo de la barra: media circunferencia. Puntas y cruces: un redondeo suave.
  const radios = [t, 1, terminales, terminales, 2, terminales, terminales, 1, t];
  return poligonoRedondeado(puntos, radios);
}

/**
 * Una punta sola, sin barra: dos brazos en ángulo recto con los extremos redondos.
 * Queda centrada en `cx` según lo que mide de verdad.
 */
export function trazoPunta({ cx, cy, grosor, brazo }) {
  const t = grosor / 2;
  const s = Math.SQRT1_2;
  const bruto = [
    [-t * s, -brazo + t * s],
    [t * s, -brazo - t * s],
    [t * Math.SQRT2 + brazo, 0],
    [t * s, brazo + t * s],
    [-t * s, brazo - t * s],
    [brazo - t * Math.SQRT2, 0],
  ];
  const xs = bruto.map((p) => p[0]);
  const desplazamiento = cx - (Math.min(...xs) + Math.max(...xs)) / 2;
  const puntos = bruto.map(([x, y]) => [x + desplazamiento, y + cy]);
  return poligonoRedondeado(puntos, [t, t, 2.4, t, t, 0.9]);
}

/** Un punto redondo como trazo cerrado. */
export const trazoPunto = (cx, cy, radio) =>
  `M${n(cx - radio)} ${n(cy)}a${n(radio)} ${n(radio)} 0 1 0 ${n(radio * 2)} 0a${n(radio)} ${n(radio)} 0 1 0 ${n(-radio * 2)} 0Z`;

export const FLECHA = { grosor: 5.4, brazo: 9.5, barra: 25 };

/**
 * Variante para tamaños chicos (pestaña del navegador, 16 a 32 px): muescas más hondas y
 * flecha más gruesa y corta. A ese tamaño los detalles finos se vuelven manchas.
 */
export const SIMBOLO_PEQUENO = { ancho: 64, alto: 46, esquina: 10, muesca: 8 };
export const FLECHA_PEQUENA = { grosor: 7.4, brazo: 10, barra: 19 };

/** El símbolo completo: la entrada y, con `evenodd`, la flecha vaciada. */
const trazoSimbolo = (simbolo, flecha) =>
  trazoEntrada(simbolo) + trazoFlecha({ cx: simbolo.ancho / 2, cy: simbolo.alto / 2, ...flecha });

export const TRAZO_SIMBOLO = trazoSimbolo(SIMBOLO, FLECHA);
export const TRAZO_SIMBOLO_PEQUENO = trazoSimbolo(SIMBOLO_PEQUENO, FLECHA_PEQUENA);

// ── Palabra ──────────────────────────────────────────────────────────────────

/** Una fuente de Fontsource (`@fontsource/<familia>`), lista para sacarle los contornos. */
export const cargarFuente = (familia, peso) => {
  const archivo = readFileSync(
    new URL(
      `./node_modules/@fontsource/${familia}/files/${familia}-latin-${peso}-normal.woff`,
      import.meta.url,
    ),
  );
  return opentype.parse(
    archivo.buffer.slice(archivo.byteOffset, archivo.byteOffset + archivo.byteLength),
  );
};

export const FUENTES = { 400: cargarFuente('figtree', 400), 600: cargarFuente('figtree', 600) };

/**
 * Los comandos de un contorno como trazo SVG, movidos `dx` a la derecha. Se escribe a mano
 * porque `toPathData` de la librería devuelve NaN en algunas curvas (le pasa con DM Sans y Geist).
 */
const aTrazo = (comandos, dx) =>
  comandos
    .map((c) => {
      const punto = (x, y) => `${n(x + dx)} ${n(y)}`;
      if (c.type === 'M' || c.type === 'L') return `${c.type}${punto(c.x, c.y)}`;
      if (c.type === 'Q') return `Q${punto(c.x1, c.y1)} ${punto(c.x, c.y)}`;
      if (c.type === 'C') return `C${punto(c.x1, c.y1)} ${punto(c.x2, c.y2)} ${punto(c.x, c.y)}`;
      return 'Z';
    })
    .join('');

/**
 * Texto en contornos, con la línea base en y = 0. Las letras se colocan una a una porque
 * la maquetación de la librería falla con la tabla de sustituciones de algunas fuentes. Devuelve
 * el trazo, lo que mide y dónde queda la x. Usa Figtree, salvo que se le pase otra `fuente`.
 */
export function texto(
  cadena,
  { peso, tamano, seguimiento = -0.03, desde = 0, fuente = FUENTES[peso] },
) {
  const escala = tamano / fuente.unitsPerEm;
  let x = desde;
  let anterior = null;
  const trazos = [];
  for (const letra of cadena) {
    const glifo = fuente.charToGlyph(letra);
    if (anterior) x += (fuente.getKerningValue(anterior, glifo) || 0) * escala;
    trazos.push(aTrazo(glifo.getPath(0, 0, tamano).commands, x));
    x += glifo.advanceWidth * escala + seguimiento * tamano;
    anterior = glifo;
  }
  return {
    d: trazos.join(''),
    ancho: x - desde - seguimiento * tamano,
    alturaX: fuente.tables.os2.sxHeight * escala,
    ascendente: fuente.tables.os2.sCapHeight * escala,
    descendente: -fuente.descender * escala,
  };
}

/** «pase» en seminegrita y «libre» en normal, pegadas. */
export function palabra({ tamano, seguimiento = -0.03 }) {
  const pase = texto('pase', { peso: 600, tamano, seguimiento });
  const desde = pase.ancho + seguimiento * tamano;
  const libre = texto('libre', { peso: 400, tamano, seguimiento, desde });
  return {
    pase: pase.d,
    libre: libre.d,
    ancho: desde + libre.ancho,
    alturaX: pase.alturaX,
    ascendente: pase.ascendente,
    descendente: pase.descendente,
  };
}
