import { claveNuevaSchema } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import { generarClave, problemaDeClave } from './clave';

describe('contraseña definitiva al crear una cuenta (doc 19, punto 6)', () => {
  it('«Generar una» cumple la regla: 8 caracteres y un número', () => {
    for (let i = 0; i < 50; i += 1) {
      const clave = generarClave();
      expect(clave).toMatch(/^[a-z]{4}\d{2}-[a-z]{3}\d$/);
      expect(claveNuevaSchema.safeParse(clave).success).toBe(true);
    }
  });

  it('no usa letras ni números que se confunden al dictarla', () => {
    expect(generarClave(() => 0)).toBe('aaaa22-aaa2');
    for (let i = 0; i < 50; i += 1) expect(generarClave()).not.toMatch(/[01ilo]/);
  });

  it('avisa lo mismo que la API', () => {
    expect(problemaDeClave('corta1')).toBe('La contraseña debe tener al menos 8 caracteres.');
    expect(problemaDeClave('sinnumeros')).toBe('La contraseña debe tener al menos un número.');
    expect(problemaDeClave('wilson2026')).toBeNull();
  });
});
