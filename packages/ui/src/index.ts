/**
 * Tokens de la línea gráfica Hielo (D-52): azul noche para el texto, azul pase para actuar
 * y grises fríos para todo lo demás. Los nombres de uso se mantienen desde la línea del
 * lienzo (D-49, RNF-51); cambiaron los valores. La web los usa como tema de Tailwind y la
 * app del celular podrá leer los mismos.
 */
export const color = {
  tinta: '#0A1633',
  pase: '#2F5BFF',
  'pase-suave': '#EAF0FF',
  acento: '#8FA9FF',
  superficie: '#F2F4F8',
  linea: '#E3E7EF',
  borde: '#C8CFDD',
  'borde-control': '#66728F',
  secundario: '#2E3A5A',
  detalle: '#5A6785',
  ok: '#0B6B4A',
  'ok-fondo': '#DDF4EA',
  aviso: '#8A3F00',
  'aviso-fondo': '#FFF0E3',
  error: '#8A1C12',
  'error-fondo': '#FDECEA',
} as const;

/**
 * Una sola escala. Tamaño, alto de línea y peso de cada nivel. Los nombres no se
 * repiten con los colores para que `text-…` no choque en Tailwind.
 */
export const tipografia = {
  titulo: ['28px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.01em' }],
  seccion: ['20px', { lineHeight: '28px', fontWeight: '600' }],
  tarjeta: ['16px', { lineHeight: '24px', fontWeight: '600' }],
  precio: ['18px', { lineHeight: '24px', fontWeight: '600' }],
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
