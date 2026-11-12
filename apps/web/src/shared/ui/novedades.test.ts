import { describe, expect, it } from 'vitest';

import { mesDe } from './novedades';

describe('mesDe', () => {
  it('pone el mes con nombre y el año', () => {
    expect(mesDe('2026-11-12')).toBe('Noviembre 2026');
    expect(mesDe('2027-01-03')).toBe('Enero 2027');
  });
});
