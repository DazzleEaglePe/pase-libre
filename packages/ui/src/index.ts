/**
 * Tokens de la línea gráfica verde esmeralda del lienzo «Versión final» (D-54, que reemplaza a
 * Hielo, D-52): tinta casi negra para el texto, verde para actuar y grises con un toque
 * verde para todo lo demás. Los nombres de uso se mantienen desde la línea del lienzo
 * (D-49, RNF-51); cambiaron los valores y se sumaron `marca`, `pase-texto`, `pase-medio`
 * y `contador`. La web los usa como tema de Tailwind y la app del celular podrá leer los mismos.
 */
export const color = {
  /** Texto, fondos oscuros (la banda de categorías) y avatares. */
  tinta: '#0F1412',
  /** La barra de arriba y el pie: el verde profundo de la marca. */
  marca: '#006B47',
  /** Actuar: el botón principal y el símbolo sobre fondo claro. */
  pase: '#00875A',
  /** Fondo de lo elegido o resaltado. */
  'pase-suave': '#EBFAF1',
  /** Insignias y fondos de «verificado»; sobre `marca` también sirve de texto de apoyo. */
  'pase-medio': '#D5F5E3',
  /** Enlaces y texto de acción sobre blanco o sobre `pase-suave` (el `pase` solo no llega a 4,5 : 1 ahí). */
  'pase-texto': '#007A51',
  /** El símbolo y los subrayados **sobre fondo oscuro**. Nunca como texto sobre blanco. */
  acento: '#22D37A',
  /** Contadores e insignias de aviso (campanita, mensajes, pedidos en vivo). Texto en `tinta`. */
  contador: '#F97316',
  /** El punto que late en «En vivo»: siempre decorativo, nunca como texto. */
  vivo: '#EF4444',
  superficie: '#F6F8F7',
  linea: '#E2E7E4',
  borde: '#C6CEC9',
  'borde-control': '#6B7872',
  secundario: '#2E3833',
  detalle: '#59645E',
  ok: '#006B47',
  'ok-fondo': '#D5F5E3',
  aviso: '#9A3412',
  'aviso-fondo': '#FFF0E3',
  error: '#B42318',
  'error-fondo': '#FDECEA',
} as const;

/**
 * Una sola escala. Tamaño, alto de línea y peso de cada nivel. Títulos, secciones y precios
 * en 700, como en el lienzo «Versión final»: con todo en 600 las páginas se leían planas. Los nombres no se
 * repiten con los colores para que `text-…` no choque en Tailwind.
 */
export const tipografia = {
  titulo: ['28px', { lineHeight: '36px', fontWeight: '700', letterSpacing: '-0.01em' }],
  seccion: ['20px', { lineHeight: '28px', fontWeight: '700' }],
  tarjeta: ['16px', { lineHeight: '24px', fontWeight: '600' }],
  precio: ['18px', { lineHeight: '24px', fontWeight: '700' }],
  cuerpo: ['15px', { lineHeight: '22px' }],
  apoyo: ['14px', { lineHeight: '20px' }],
  nota: ['13px', { lineHeight: '18px' }],
  etiqueta: ['12px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.06em' }],
} as const;

/** Botones de 44 px como mínimo (RNF-07); 48 en formularios y 40 en listas. */
export const alto = {
  control: '48px',
  boton: '44px',
  'boton-lista': '40px',
} as const;
