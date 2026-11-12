import { z } from 'zod';

import { DIAS_DE_ATENCION, type DiaDeAtencion } from '../registro/registro.schemas.js';

/**
 * El horario de atención por días (N09_ConfigWebTodo): uno o más tramos, cada uno con sus días y
 * su hora de inicio y fin. «+ Otro horario» suma un tramo (ej. domingo de 11:00 a 16:00).
 */
export interface TramoHorario {
  dias: DiaDeAtencion[];
  /** «10:00», en 24 horas. */
  desde: string;
  hasta: string;
}

export const MAX_TRAMOS_HORARIO = 3;

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Elige una hora válida, como 10:00.');

export const tramoHorarioSchema = z
  .strictObject({
    dias: z
      .array(z.enum(DIAS_DE_ATENCION))
      .min(1, 'Elige al menos un día.')
      .refine((dias) => new Set(dias).size === dias.length, 'Un día no puede repetirse.'),
    desde: hora,
    hasta: hora,
  })
  .refine((tramo) => tramo.desde < tramo.hasta, {
    path: ['hasta'],
    message: 'La hora de cierre es después de la de apertura.',
  });

export const horarioTiendaSchema = z
  .array(tramoHorarioSchema)
  .min(1, 'Elige al menos un día de atención.')
  .max(MAX_TRAMOS_HORARIO, `Puedes poner hasta ${MAX_TRAMOS_HORARIO} horarios.`)
  .refine((tramos) => {
    const dias = tramos.flatMap((tramo) => tramo.dias);
    return new Set(dias).size === dias.length;
  }, 'Un día no puede estar en dos horarios.');

const LARGO: Record<DiaDeAtencion, string> = {
  lun: 'lunes',
  mar: 'martes',
  mie: 'miércoles',
  jue: 'jueves',
  vie: 'viernes',
  sab: 'sábado',
  dom: 'domingo',
};

const CORTO: Record<DiaDeAtencion, string> = {
  lun: 'lun',
  mar: 'mar',
  mie: 'mié',
  jue: 'jue',
  vie: 'vie',
  sab: 'sáb',
  dom: 'dom',
};

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/**
 * «Lunes a sábado», «Lunes, miércoles y viernes», «Sábado y domingo»: tres o más días seguidos se
 * juntan con «a»; los demás van sueltos.
 */
export function diasATexto(dias: readonly DiaDeAtencion[], forma: 'largo' | 'corto'): string {
  const nombres = forma === 'largo' ? LARGO : CORTO;
  const orden = DIAS_DE_ATENCION.filter((dia) => dias.includes(dia));
  const partes: string[] = [];
  let i = 0;
  while (i < orden.length) {
    let j = i;
    while (
      j + 1 < orden.length &&
      DIAS_DE_ATENCION.indexOf(orden[j + 1]!) === DIAS_DE_ATENCION.indexOf(orden[j]!) + 1
    )
      j++;
    if (j - i >= 2) {
      partes.push(`${nombres[orden[i]!]} a ${nombres[orden[j]!]}`);
    } else {
      for (let k = i; k <= j; k++) partes.push(nombres[orden[k]!]);
    }
    i = j + 1;
  }
  const texto =
    partes.length > 1
      ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
      : (partes[0] ?? '');
  return mayuscula(texto);
}

/**
 * El horario escrito para cada lugar:
 * - `largo` (Configuración, «Se verá»): «Lunes a sábado, 10:00 a 19:00 · Domingo cerrado».
 * - `corto` («Sobre la tienda»): «Lun a sáb 10:00 a 19:00 · Dom cerrado».
 * - `cabecera` (perfil): «Lun a sáb · 10:00 a 19:00», sin los días cerrados.
 */
export function textoHorario(
  tramos: readonly TramoHorario[],
  forma: 'largo' | 'corto' | 'cabecera',
): string {
  const ordenados = [...tramos]
    .filter((tramo) => tramo.dias.length > 0)
    .sort(
      (a, b) =>
        Math.min(...a.dias.map((dia) => DIAS_DE_ATENCION.indexOf(dia))) -
        Math.min(...b.dias.map((dia) => DIAS_DE_ATENCION.indexOf(dia))),
    );
  if (ordenados.length === 0) return '';
  const corto = forma !== 'largo';
  if (forma === 'cabecera' && ordenados.length === 1) {
    const [tramo] = ordenados as [TramoHorario];
    return `${diasATexto(tramo.dias, 'corto')} · ${tramo.desde} a ${tramo.hasta}`;
  }
  const partes = ordenados.map(
    (tramo) =>
      `${diasATexto(tramo.dias, corto ? 'corto' : 'largo')}${corto ? ' ' : ', '}${tramo.desde} a ${tramo.hasta}`,
  );
  if (forma !== 'cabecera') {
    const abiertos = new Set(ordenados.flatMap((tramo) => tramo.dias));
    const cerrados = DIAS_DE_ATENCION.filter((dia) => !abiertos.has(dia));
    if (cerrados.length > 0) {
      partes.push(
        `${diasATexto(cerrados, corto ? 'corto' : 'largo')} ${cerrados.length === 1 ? 'cerrado' : 'cerrados'}`,
      );
    }
  }
  return partes.join(' · ');
}

const DIA_ESCRITO =
  'lunes|lun|martes|mar|mi[eé]rcoles|mi[eé]|jueves|jue|viernes|vie|s[aá]bado|s[aá]b|domingo|dom';
const HORA_ESCRITA = String.raw`(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?`;
const HORARIO_ESCRITO = new RegExp(
  String.raw`^\s*(${DIA_ESCRITO})(?:\s+a\s+(${DIA_ESCRITO}))?\s*,?\s*(?:de\s+)?${HORA_ESCRITA}\s+a\s+${HORA_ESCRITA}\s*\.?\s*$`,
  'i',
);

function diaEscrito(texto: string): DiaDeAtencion {
  const clave = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 3);
  return DIAS_DE_ATENCION.find((dia) => dia === clave) ?? 'lun';
}

function horaEscrita(h: string, m: string | undefined, meridiano: string | undefined): string {
  let horas = Number(h);
  const tarde = meridiano?.toLowerCase().startsWith('p');
  if (tarde && horas < 12) horas += 12;
  if (meridiano && !tarde && horas === 12) horas = 0;
  return `${String(horas).padStart(2, '0')}:${m ?? '00'}`;
}

/**
 * Lee un horario escrito a mano («Lunes a sábado, 10:00 a 19:00», «Lun a sáb, de 10 a. m. a
 * 8 p. m.») para llenar los días y las horas la primera vez. Nulo si no lo entiende.
 */
export function leerHorarioEscrito(texto: string | null | undefined): TramoHorario[] | null {
  const partes = texto ? HORARIO_ESCRITO.exec(texto) : null;
  if (!partes) return null;
  const [, primero, ultimo, h1, m1, a1, h2, m2, a2] = partes;
  const desde = DIAS_DE_ATENCION.indexOf(diaEscrito(primero!));
  const hasta = ultimo ? DIAS_DE_ATENCION.indexOf(diaEscrito(ultimo)) : desde;
  if (hasta < desde) return null;
  const tramo = {
    dias: DIAS_DE_ATENCION.slice(desde, hasta + 1),
    desde: horaEscrita(h1!, m1, a1),
    hasta: horaEscrita(h2!, m2, a2),
  };
  const valido = horarioTiendaSchema.safeParse([tramo]);
  return valido.success ? valido.data : null;
}
