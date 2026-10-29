/**
 * Cómo se contacta al equipo de PaseLibre: lo muestran el pie y la ayuda.
 *
 * - El WhatsApp sale de `NEXT_PUBLIC_WHATSAPP_EQUIPO` (se fija al construir la imagen).
 * - El correo, el horario y las redes se escriben aquí cuando el equipo los tenga
 *   (docs/CHECKLIST.md §5).
 *
 * Lo que falta no se muestra en producción. En local se ve su marcador entre corchetes,
 * para revisar el diseño completo.
 */

const DATOS_EQUIPO = {
  correo: null as string | null,
  /** Por ejemplo «Lunes a sábado, de 10:00 a 19:00». */
  horario: null as string | null,
  redes: {
    facebook: null as string | null,
    instagram: null as string | null,
    tiktok: null as string | null,
  },
};

const enLocal = process.env.NODE_ENV !== 'production';
const numero = process.env.NEXT_PUBLIC_WHATSAPP_EQUIPO?.replace(/\D/g, '') || null;

export interface DatoContacto {
  texto: string;
  href: string | null;
  /** Es el marcador de un dato que todavía no existe (solo en local). */
  falta: boolean;
}

function dato(
  valor: string | null,
  texto: (valor: string) => string,
  href: (valor: string) => string | null,
  marcador: string,
): DatoContacto | null {
  if (valor) return { texto: texto(valor), href: href(valor), falta: false };
  return enLocal ? { texto: marcador, href: null, falta: true } : null;
}

/** «51987654321» → «+51 987 654 321». */
function numeroLegible(digitos: string): string {
  if (digitos.length === 11 && digitos.startsWith('51')) {
    return `+51 ${digitos.slice(2, 5)} ${digitos.slice(5, 8)} ${digitos.slice(8)}`;
  }
  return `+${digitos}`;
}

export const CONTACTO = {
  whatsapp: dato(numero, numeroLegible, (n) => `https://wa.me/${n}`, '[WhatsApp de PaseLibre]'),
  correo: dato(
    DATOS_EQUIPO.correo,
    (c) => c,
    (c) => `mailto:${c}`,
    '[correo de PaseLibre]',
  ),
  horario: dato(
    DATOS_EQUIPO.horario,
    (h) => h,
    () => null,
    '[horario de atención]',
  ),
};

export type Red = 'facebook' | 'instagram' | 'tiktok';

export const REDES: Array<{ red: Red; nombre: string; url: string | null }> = (
  [
    { red: 'facebook', nombre: 'Facebook', url: DATOS_EQUIPO.redes.facebook },
    { red: 'instagram', nombre: 'Instagram', url: DATOS_EQUIPO.redes.instagram },
    { red: 'tiktok', nombre: 'TikTok', url: DATOS_EQUIPO.redes.tiktok },
  ] as const
).filter((red) => red.url !== null || enLocal);
