import { describe, expect, it } from 'vitest';

import { mezclarSinRepetir } from './inicio.service';

const de = (...tiendas: string[]) => tiendas.map((tiendaId, n) => ({ id: `o${n}`, tiendaId }));
const tiendas = (lista: Array<{ tiendaId: string }>) => lista.map((o) => o.tiendaId).join('');

/** «Mezclado por tienda: nunca salen dos seguidos de la misma» (N15). */
describe('mezclarSinRepetir', () => {
  it('deja el orden como está si ya no hay dos seguidas', () => {
    expect(tiendas(mezclarSinRepetir(de('A', 'B', 'A', 'C')))).toBe('ABAC');
  });

  it('adelanta la primera de otra tienda, sin perder ninguna', () => {
    const mezcla = mezclarSinRepetir(de('A', 'A', 'A', 'B', 'C', 'B'));
    expect(tiendas(mezcla)).toBe('ABACAB');
    expect(new Set(mezcla.map((o) => o.id)).size).toBe(6);
  });

  it('solo repite al final, cuando ya no quedan de otras', () => {
    expect(tiendas(mezclarSinRepetir(de('A', 'A', 'A', 'B')))).toBe('ABAA');
    expect(mezclarSinRepetir([])).toEqual([]);
  });
});
