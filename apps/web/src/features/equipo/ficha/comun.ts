/** Lo que comparten las pestañas de la ficha de la tienda (N14). */

export const tarjetaFicha =
  'flex flex-col gap-3.5 rounded-[20px] border-[1.5px] border-linea bg-white p-4 sm:p-5';

export const campoFicha =
  'h-12 w-full rounded-xl border-[1.5px] border-linea bg-white px-3.5 text-cuerpo text-tinta';

export const botonVerde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-acento px-5 text-apoyo font-bold text-[#0F1412] disabled:opacity-60';

export const botonBorde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-linea px-5 text-apoyo font-bold';

/** «975 936 495». */
export const whatsappLegible = (numero: string) =>
  numero.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');

export const ruta = (tiendaId: string, resto = '') => `/equipo/panel/tiendas/${tiendaId}${resto}`;

/** Las pestañas, en el orden del lienzo. Van aquí (sin «use client») para que el servidor las lea. */
export const PESTANAS = [
  'datos',
  'imagen',
  'publicaciones',
  'conversaciones',
  'actividad',
  'reportes',
  'acceso',
  'historial',
] as const;
export type Pestana = (typeof PESTANAS)[number];
