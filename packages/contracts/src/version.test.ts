import { describe, expect, it } from 'vitest';

import { NOVEDADES, VERSION, versionCorta } from './version.js';

describe('versión de PaseLibre', () => {
  it('VERSION es la primera de NOVEDADES', () => {
    expect(NOVEDADES[0]?.version).toBe(VERSION);
  });

  it('las versiones van de la más nueva a la más antigua y no se repiten', () => {
    const numeros = NOVEDADES.map((n) => n.version.split('.').map(Number));
    for (const [i, actual] of numeros.entries()) {
      expect(actual).toHaveLength(3);
      const anterior = numeros[i + 1];
      if (!anterior) continue;
      const comparar = actual.findIndex((parte, j) => parte !== anterior[j]);
      expect(comparar).toBeGreaterThanOrEqual(0);
      expect(actual[comparar]!).toBeGreaterThan(anterior[comparar]!);
    }
  });

  it('la versión que corre tiene novedades para las tiendas y detalle para el Equipo', () => {
    expect(NOVEDADES[0]?.publico.length).toBeGreaterThan(0);
    expect(NOVEDADES[0]?.equipo).not.toBeNull();
  });

  it('en el pie salen solo los dos primeros números', () => {
    expect(versionCorta('1.9.0')).toBe('1.9');
    expect(versionCorta('2.0.0')).toBe('2.0');
  });
});
