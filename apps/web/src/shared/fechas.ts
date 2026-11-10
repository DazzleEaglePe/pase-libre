const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/** Días de calendario en Lima entre una fecha y ahora: ayer a las 23:59 ya es «Ayer». */
function diasDesde(iso: string, ahora = new Date()): number {
  const dia = (fecha: Date) => Date.parse(DIA_LIMA.format(fecha));
  return Math.max(0, Math.round((dia(ahora) - dia(new Date(iso))) / 86_400_000));
}

/** «Hoy», «Ayer» o «Hace 9 días», como la columna «Actualizado» del lienzo. */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const dias = diasDesde(iso, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}

const HORA_LIMA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DIA_SEMANA = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'long' });
const DIA_MES = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'long',
});
const DIA_CORTO = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: '2-digit',
});

/** «10:42» */
export function hora(iso: string): string {
  return HORA_LIMA.format(new Date(iso));
}

/** Para la lista de Mensajes: «10:42» si es de hoy, «Ayer», o «27/10». */
export function horaCorta(iso: string, ahora = new Date()): string {
  const dias = diasDesde(iso, ahora);
  if (dias === 0) return hora(iso);
  if (dias === 1) return 'Ayer';
  return DIA_CORTO.format(new Date(iso));
}

/** Separador del chat: «Hoy», «Ayer» o «lunes 26 de octubre». */
export function diaDelChat(iso: string, ahora = new Date()): string {
  const dias = diasDesde(iso, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `${DIA_SEMANA.format(new Date(iso))} ${DIA_MES.format(new Date(iso))}`;
}

/** «Hace 5 min», «Hace 2 h», «Ayer» o «Hace 3 días», para la campanita y «Activo hace…». */
export function haceRato(iso: string, ahora = new Date()): string {
  const minutos = Math.max(0, Math.round((ahora.getTime() - Date.parse(iso)) / 60_000));
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  if (minutos < 24 * 60) return `Hace ${Math.round(minutos / 60)} h`;
  return haceCuanto(iso, ahora);
}

const MES_CORTO = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'short',
});

/** «5 nov», sin el punto de la abreviatura. */
export function diaCorto(iso: string): string {
  return MES_CORTO.format(new Date(iso)).replace('.', '').replace(' de ', ' ');
}

/** «Sábado 7 nov», el separador por día del historial (HI_A2_Web). */
export function diaConSemana(iso: string): string {
  const semana = DIA_SEMANA.format(new Date(iso));
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${diaCorto(iso)}`;
}

/** «Hoy, 10:42», «Ayer, 17:10» o «5 nov» (los vendidos de MP_Web). */
export function cuandoFue(iso: string, ahora = new Date()): string {
  const dias = diasDesde(iso, ahora);
  if (dias === 0) return `Hoy, ${hora(iso)}`;
  if (dias === 1) return `Ayer, ${hora(iso)}`;
  return diaCorto(iso);
}
