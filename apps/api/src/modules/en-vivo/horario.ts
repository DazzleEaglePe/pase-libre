import {
  HORA_CIERRE_EN_VIVO,
  MAX_HORAS_EN_VIVO,
  type DuracionEnVivo,
  type EstadoEnVivo,
} from '@paselibre/contracts';

const HORA = 60 * 60_000;
/** Lima no cambia de hora en el año: siempre UTC−5. */
const DESFASE_LIMA = -5 * HORA;

/** La medianoche de hoy en Lima, como instante. */
export function inicioDelDiaEnLima(ahora: Date): Date {
  const lima = new Date(ahora.getTime() + DESFASE_LIMA);
  lima.setUTCHours(0, 0, 0, 0);
  return new Date(lima.getTime() - DESFASE_LIMA);
}

/** «Hasta el cierre de hoy»: las 8:00 p. m. de hoy en Lima. */
export function cierreDeHoy(ahora: Date): Date {
  return new Date(inicioDelDiaEnLima(ahora).getTime() + HORA_CIERRE_EN_VIVO * HORA);
}

/** El tope: nunca más de 12 horas desde que se publicó (CHECK `en_vivo_duracion`). */
export function topeDeVencimiento(creadoEn: Date): Date {
  return new Date(creadoEn.getTime() + MAX_HORAS_EN_VIVO * HORA);
}

/**
 * Cuándo vence lo que se publica ahora. Nulo si eligió «hasta el cierre» y faltan menos de
 * 30 minutos para el cierre (o ya pasó): no tendría sentido publicarlo.
 */
export function vencimiento(duracion: DuracionEnVivo, ahora: Date): Date | null {
  const tope = topeDeVencimiento(ahora);
  if (duracion === '1h') return new Date(ahora.getTime() + HORA);
  if (duracion === '3h') return new Date(ahora.getTime() + 3 * HORA);
  const cierre = cierreDeHoy(ahora);
  if (cierre.getTime() - ahora.getTime() < 30 * 60_000) return null;
  return cierre < tope ? cierre : tope;
}

/** Sumar una hora, sin pasar del tope. Nulo si ya está en el tope. */
export function sumarHora(venceEn: Date, creadoEn: Date): Date | null {
  const tope = topeDeVencimiento(creadoEn);
  if (venceEn >= tope) return null;
  const nueva = new Date(venceEn.getTime() + HORA);
  return nueva < tope ? nueva : tope;
}

/** «Venció» no se guarda: es VIVO con la hora ya pasada. */
export function estadoEfectivo(
  fila: { estado: Exclude<EstadoEnVivo, 'VENCIDO'>; venceEn: Date },
  ahora: Date,
): EstadoEnVivo {
  return fila.estado === 'VIVO' && fila.venceEn <= ahora ? 'VENCIDO' : fila.estado;
}
