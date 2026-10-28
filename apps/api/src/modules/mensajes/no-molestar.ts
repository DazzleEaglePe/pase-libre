/** Lima no cambia de hora en el año: siempre UTC−5. */
const DESFASE_LIMA_MIN = -5 * 60;
const MINUTOS_DIA = 24 * 60;

/**
 * Desde cuándo se ve un aviso según «No molestar» (RF-59). `desde` y `hasta` son minutos
 * desde la medianoche, hora de Lima; el horario puede cruzar la medianoche (22:00 a 08:00).
 * Fuera del horario, el aviso se ve ya; dentro, cuando el horario termina.
 */
export function visibleDesde(desde: number | null, hasta: number | null, ahora: Date): Date {
  if (desde === null || hasta === null || desde === hasta) return ahora;

  const minutoUtc = ahora.getUTCHours() * 60 + ahora.getUTCMinutes();
  const minuto = (minutoUtc + DESFASE_LIMA_MIN + MINUTOS_DIA) % MINUTOS_DIA;
  const dentro =
    desde < hasta ? minuto >= desde && minuto < hasta : minuto >= desde || minuto < hasta;
  if (!dentro) return ahora;

  const faltan = (hasta - minuto + MINUTOS_DIA) % MINUTOS_DIA;
  const inicioDelMinuto =
    ahora.getTime() - ahora.getUTCSeconds() * 1000 - ahora.getUTCMilliseconds();
  return new Date(inicioDelMinuto + faltan * 60_000);
}
