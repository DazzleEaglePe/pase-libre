/**
 * Genera todos los archivos de la marca de PaseLibre desde `geometria.mjs` y `piezas.mjs`.
 *
 *   cd branding && npm install && npm run generar
 *
 * Escribe en tres lugares:
 *   - branding/logo, branding/png y branding/hoja-de-marca.html
 *   - los íconos y la vista al compartir de la web (apps/web/src/app)
 *   - los trazos del logo para el componente de la web (apps/web/src/shared/ui/marca-trazos.ts)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { FUENTES, TRAZO_SIMBOLO, texto } from './geometria.mjs';
import { hojaDeMarca } from './hoja.mjs';
import { COLOR, envolver, horizontal, icono, simbolo, soloPalabra, vertical } from './piezas.mjs';

const aqui = (ruta) => fileURLToPath(new URL(ruta, import.meta.url));
const guardar = (ruta, contenido) => {
  const destino = aqui(ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
};
const num = (v) => Math.round(v * 100) / 100;

// ── Versiones en SVG ─────────────────────────────────────────────────────────

const sobreClaro = { figura: COLOR.pase, palabra: COLOR.tinta };
const sobreOscuro = { figura: COLOR.acento, palabra: COLOR.blanco };
const unColorTinta = { figura: COLOR.tinta, palabra: COLOR.tinta };
const unColorBlanco = { figura: COLOR.blanco, palabra: COLOR.blanco };

const pieza = (p) => envolver(p.ancho, p.alto, p.cuerpo);

export const SVGS = {
  'simbolo.svg': envolver(64, 44, simbolo(COLOR.pase)),
  'simbolo-tinta.svg': envolver(64, 44, simbolo(COLOR.tinta)),
  'simbolo-blanco.svg': envolver(64, 44, simbolo(COLOR.blanco)),
  'simbolo-acento.svg': envolver(64, 44, simbolo(COLOR.acento)),
  'icono.svg': envolver(64, 64, icono({ fondo: COLOR.pase, figura: COLOR.blanco })),
  'icono-tinta.svg': envolver(64, 64, icono({ fondo: COLOR.tinta, figura: COLOR.acento })),
  'horizontal.svg': pieza(horizontal({ marca: 'simbolo', colores: sobreClaro })),
  'horizontal-oscuro.svg': pieza(horizontal({ marca: 'simbolo', colores: sobreOscuro })),
  'horizontal-tinta.svg': pieza(horizontal({ marca: 'simbolo', colores: unColorTinta })),
  'horizontal-blanco.svg': pieza(horizontal({ marca: 'simbolo', colores: unColorBlanco })),
  'vertical.svg': pieza(vertical({ marca: 'simbolo', colores: sobreClaro })),
  'vertical-oscuro.svg': pieza(vertical({ marca: 'simbolo', colores: sobreOscuro })),
  'vertical-tinta.svg': pieza(vertical({ marca: 'simbolo', colores: unColorTinta })),
  'vertical-blanco.svg': pieza(vertical({ marca: 'simbolo', colores: unColorBlanco })),
  'palabra.svg': pieza(soloPalabra(COLOR.tinta)),
  'palabra-blanco.svg': pieza(soloPalabra(COLOR.blanco)),
  /** Para la pestaña del navegador: muescas más hondas y flecha más gruesa. */
  'favicon.svg': envolver(
    64,
    64,
    icono({ fondo: COLOR.pase, figura: COLOR.blanco, esquina: 14, escala: 0.88, pequeno: true }),
  ),
};

// ── PNG ──────────────────────────────────────────────────────────────────────

const anchoDe = (svg) => Number(/width="([\d.]+)"/.exec(svg)?.[1]);

async function aPng(svg, ancho, { fondo } = {}) {
  let imagen = sharp(Buffer.from(svg), {
    density: Math.min(20000, Math.max(72, Math.round((72 * ancho) / anchoDe(svg)))),
  }).resize({ width: ancho });
  if (fondo) imagen = imagen.flatten({ background: fondo });
  return imagen.png({ compressionLevel: 9 }).toBuffer();
}

/** Un `.ico` con imágenes PNG dentro, que es lo que leen los navegadores de hoy. */
function aIco(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desplazamiento = 6 + 16 * imagenes.length;
  const entradas = imagenes.map(({ lado, png }) => {
    const entrada = Buffer.alloc(16);
    entrada.writeUInt8(lado >= 256 ? 0 : lado, 0);
    entrada.writeUInt8(lado >= 256 ? 0 : lado, 1);
    entrada.writeUInt16LE(1, 4);
    entrada.writeUInt16LE(32, 6);
    entrada.writeUInt32LE(png.length, 8);
    entrada.writeUInt32LE(desplazamiento, 12);
    desplazamiento += png.length;
    return entrada;
  });
  return Buffer.concat([cabecera, ...entradas, ...imagenes.map(({ png }) => png)]);
}

/** La vista que se ve al compartir un enlace (WhatsApp, redes): 1200 × 630. */
function vistaAlCompartir() {
  const ancho = 1200;
  const alto = 630;
  const logo = horizontal({ marca: 'simbolo', colores: sobreOscuro });
  const escala = 700 / logo.ancho;
  const frase = texto('Pases entre tiendas de la Galería Wilson', { peso: 400, tamano: 38 });
  const separacion = 56;
  const bloque = logo.alto * escala + separacion + frase.ascendente;
  const arriba = (alto - bloque) / 2;
  const cuerpo =
    `<rect width="${ancho}" height="${alto}" fill="${COLOR.tinta}"/>` +
    `<g transform="translate(${num((ancho - 700) / 2)} ${num(arriba)}) scale(${num(escala)})">${logo.cuerpo}</g>` +
    `<path transform="translate(${num((ancho - frase.ancho) / 2)} ${num(arriba + logo.alto * escala + separacion + frase.ascendente)})" fill="${COLOR.borde}" d="${frase.d}"/>`;
  return envolver(ancho, alto, cuerpo, 'PaseLibre: pases entre tiendas de la Galería Wilson');
}

// ── Escritura ────────────────────────────────────────────────────────────────

for (const [nombre, svg] of Object.entries(SVGS)) guardar(`logo/${nombre}`, svg);

const svgIcono = SVGS['icono.svg'];
const svgAppleIcono = envolver(
  64,
  64,
  icono({ fondo: COLOR.pase, figura: COLOR.blanco, esquina: 0, escala: 0.66 }),
);
const svgFavicon = SVGS['favicon.svg'];
const svgOg = vistaAlCompartir();

const png = {
  'icono-512.png': await aPng(svgIcono, 512),
  'icono-192.png': await aPng(svgIcono, 192),
  'apple-touch-icon.png': await aPng(svgAppleIcono, 180),
  'horizontal-1200.png': await aPng(SVGS['horizontal.svg'], 1200),
  'horizontal-oscuro-1200.png': await aPng(SVGS['horizontal-oscuro.svg'], 1200),
  'og.png': await aPng(svgOg, 1200),
};
for (const [nombre, datos] of Object.entries(png)) guardar(`png/${nombre}`, datos);

const lados = [16, 32, 48];
const icoImagenes = await Promise.all(
  lados.map(async (lado) => ({
    lado,
    // Hasta 32 px, la variante pequeña; a 48 ya se ve bien la normal.
    png: await aPng(lado <= 32 ? svgFavicon : svgIcono, lado),
  })),
);
guardar('png/favicon.ico', aIco(icoImagenes));

// La web: íconos y vista al compartir, con los nombres que Next reconoce.
guardar('../apps/web/src/app/icon.svg', svgFavicon);
guardar('../apps/web/src/app/favicon.ico', aIco(icoImagenes));
guardar('../apps/web/src/app/apple-icon.png', png['apple-touch-icon.png']);
guardar('../apps/web/src/app/opengraph-image.png', png['og.png']);
guardar(
  '../apps/web/src/app/opengraph-image.alt.txt',
  'PaseLibre: pases entre tiendas de la Galería Wilson',
);

// Los trazos del logo, para pintarlo en el componente de la web con `currentColor`.
const h = horizontal({ marca: 'simbolo', colores: sobreClaro });
guardar(
  '../apps/web/src/shared/ui/marca-trazos.ts',
  `/**
 * Trazos del logo de PaseLibre, generados por \`branding/generar.mjs\`.
 * No se editan a mano: cambia la marca en \`branding/\` y vuelve a generar.
 */
export const LOGO_HORIZONTAL = {
  ancho: ${num(h.ancho)},
  alto: ${num(h.alto)},
  /** La entrada con la flecha vaciada. */
  simbolo: '${TRAZO_SIMBOLO}',
  palabra: {
    x: ${num(h.datos.palabraX)},
    y: ${num(h.datos.palabraY)},
    pase: '${h.datos.pase}',
    libre: '${h.datos.libre}',
  },
} as const;
`,
);

// ── Hoja de marca ────────────────────────────────────────────────────────────

guardar('hoja-de-marca.html', hojaDeMarca({ svgs: SVGS, fuentes: FUENTES }));

console.log(
  `Listo: ${Object.keys(SVGS).length} SVG, ${Object.keys(png).length + 1} PNG, la hoja de marca y los archivos de la web.`,
);
