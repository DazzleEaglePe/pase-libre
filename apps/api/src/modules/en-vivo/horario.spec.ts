import { describe, expect, it } from 'vitest';

import { cierreDeHoy, estadoEfectivo, inicioDelDiaEnLima, sumarHora, vencimiento } from './horario';

/** Una hora de Lima («2026-10-31T09:00») como instante. */
const lima = (fecha: string) => new Date(`${fecha}:00-05:00`);

describe('Horario de En vivo (RF-73)', () => {
  it('el día empieza a medianoche en Lima, aunque en UTC ya sea otro día', () => {
    expect(inicioDelDiaEnLima(lima('2026-10-31T21:30'))).toEqual(lima('2026-10-31T00:00'));
    expect(inicioDelDiaEnLima(lima('2026-10-31T00:10'))).toEqual(lima('2026-10-31T00:00'));
  });

  it('«hasta el cierre» son las 8:00 p. m. de Lima', () => {
    expect(cierreDeHoy(lima('2026-10-31T10:00'))).toEqual(lima('2026-10-31T20:00'));
    expect(vencimiento('cierre', lima('2026-10-31T15:00'))).toEqual(lima('2026-10-31T20:00'));
  });

  it('nunca pasa de 12 horas, y cerca del cierre no se puede elegir «hasta el cierre»', () => {
    expect(vencimiento('cierre', lima('2026-10-31T06:00'))).toEqual(lima('2026-10-31T18:00'));
    expect(vencimiento('cierre', lima('2026-10-31T19:45'))).toBeNull();
    expect(vencimiento('cierre', lima('2026-10-31T21:00'))).toBeNull();
    expect(vencimiento('3h', lima('2026-10-31T21:00'))).toEqual(lima('2026-11-01T00:00'));
  });

  it('sumar una hora se queda en el tope', () => {
    const creado = lima('2026-10-31T08:00');
    expect(sumarHora(lima('2026-10-31T11:00'), creado)).toEqual(lima('2026-10-31T12:00'));
    expect(sumarHora(lima('2026-10-31T19:30'), creado)).toEqual(lima('2026-10-31T20:00'));
    expect(sumarHora(lima('2026-10-31T20:00'), creado)).toBeNull();
  });

  it('«Venció» sale de la hora, no de la base', () => {
    const ahora = lima('2026-10-31T12:00');
    expect(estadoEfectivo({ estado: 'VIVO', venceEn: lima('2026-10-31T11:59') }, ahora)).toBe(
      'VENCIDO',
    );
    expect(estadoEfectivo({ estado: 'VIVO', venceEn: lima('2026-10-31T12:30') }, ahora)).toBe(
      'VIVO',
    );
    expect(estadoEfectivo({ estado: 'CONSEGUIDO', venceEn: lima('2026-10-31T11:00') }, ahora)).toBe(
      'CONSEGUIDO',
    );
  });
});
