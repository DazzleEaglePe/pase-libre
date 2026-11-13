import { describe, expect, it } from 'vitest';

import {
  MAX_BYTES_SUBIDA,
  avisoDePeso,
  faltanUnos,
  lineasDeMotivos,
  peso,
  porcentaje,
} from './subida-catalogo';

const MB = 1024 * 1024;

describe('Subir el ZIP del catálogo (docs/18 §7 y §8)', () => {
  it('avisa antes de subir si pasa de 40 MB', () => {
    expect(avisoDePeso('catalogo.zip', MAX_BYTES_SUBIDA)).toBeNull();
    expect(avisoDePeso('catalogo.zip', 51.2 * MB)).toBe(
      'Este ZIP pesa 52 MB, el máximo es 40 MB. Pártelo en dos.',
    );
    // Apenas pasado: nunca dice «pesa 40 MB».
    expect(avisoDePeso('catalogo.ZIP', MAX_BYTES_SUBIDA + 1)).toBe(
      'Este ZIP pesa 41 MB, el máximo es 40 MB. Pártelo en dos.',
    );
    expect(avisoDePeso('catalogo.xlsx', 45 * MB)).toMatch(/^Este archivo pesa 45 MB/);
  });

  it('muestra el peso y el porcentaje', () => {
    expect(peso(35.7 * MB)).toBe('35,7 MB');
    expect(peso(200 * 1024)).toBe('200 KB');
    expect(porcentaje(62, 100)).toBe(62);
    expect(porcentaje(150, 100)).toBe(100);
    expect(porcentaje(1, 0)).toBe(0);
  });

  it('calcula cuánto falta con lo que va subiendo', () => {
    // Al empezar todavía no se sabe.
    expect(faltanUnos(0, 100, 5000)).toBeNull();
    expect(faltanUnos(10, 100, 500)).toBeNull();
    // 62 de 100 en 33 s: quedan unos 20 s.
    expect(faltanUnos(62, 100, 33_000)).toBe('faltan unos 20 s');
    expect(faltanUnos(10, 100, 10_000)).toBe('faltan unos 2 min');
    expect(faltanUnos(99, 100, 99_000)).toBe('faltan unos 5 s');
    expect(faltanUnos(100, 100, 10_000)).toBeNull();
  });

  it('una línea por motivo, en singular o plural', () => {
    expect(
      lineasDeMotivos({
        sin_foto: 28,
        sin_categoria: 2,
        sin_marca: 0,
        sin_modelo: 0,
        sinonimo_largo: 0,
        repetida: 1,
      }),
    ).toEqual(['28 sin foto', '2 sin categoría', '1 código repetido']);
    expect(
      lineasDeMotivos({
        sin_foto: 0,
        sin_categoria: 0,
        sin_marca: 1,
        sin_modelo: 3,
        sinonimo_largo: 0,
        repetida: 2,
      }),
    ).toEqual(['1 sin marca', '3 sin modelo', '2 códigos repetidos']);
  });
});
