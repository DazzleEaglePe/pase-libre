/**
 * Tokens de la línea final del lienzo (D-49, RNF-51): página «Mapa de pantallas,
 * rutas y escala». La web los usa como tema de Tailwind; la app del celular podrá
 * leer los mismos valores.
 */
export const color = {
  tinta: '#14161A',
  lima: '#C8F03C',
  'lima-suave': '#F1F6E2',
  superficie: '#F3F4F0',
  linea: '#E1E3DC',
  borde: '#C9CDC3',
  'borde-control': '#6F746B',
  secundario: '#3E423B',
  detalle: '#5A5F57',
  ok: '#2E4A00',
  'ok-fondo': '#E9F7C4',
  aviso: '#6B4500',
  'aviso-fondo': '#FFF4D6',
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
