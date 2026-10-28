import { describe, expect, it } from 'vitest';

import { visibleDesde } from './no-molestar';

/** Una hora de Lima (UTC−5) del 27/10/2026. */
const enLima = (hora: string) => new Date(`2026-10-27T${hora}:00-05:00`);
const minutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

describe('visibleDesde («No molestar», RF-59)', () => {
  it('sin horario, el aviso se ve al momento', () => {
    const ahora = enLima('23:30');
    expect(visibleDesde(null, null, ahora)).toBe(ahora);
  });

  it('dentro de un horario del mismo día, espera a que termine', () => {
    const ahora = enLima('13:20');
    expect(visibleDesde(minutos('13:00'), minutos('15:00'), ahora)).toEqual(enLima('15:00'));
  });

  it('cruza la medianoche: a las 23:30 espera hasta las 08:00 del día siguiente', () => {
    expect(visibleDesde(minutos('22:00'), minutos('08:00'), enLima('23:30'))).toEqual(
      new Date('2026-10-28T08:00:00-05:00'),
    );
    expect(visibleDesde(minutos('22:00'), minutos('08:00'), enLima('06:15'))).toEqual(
      enLima('08:00'),
    );
  });

  it('fuera del horario, se ve al momento', () => {
    const ahora = enLima('09:00');
    expect(visibleDesde(minutos('22:00'), minutos('08:00'), ahora)).toBe(ahora);
  });
});
