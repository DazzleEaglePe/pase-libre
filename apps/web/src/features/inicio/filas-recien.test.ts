import { RECIEN_INICIO } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import {
  flechasDeLaFila,
  hayMasQueElInicio,
  piezasDeLaFila,
  posicionAnterior,
  posicionMaxima,
  posicionParaVer,
  posicionSiguiente,
  repartirEnFilas,
} from './filas-recien';

const numeros = (cuantos: number) => Array.from({ length: cuantos }, (_, n) => n + 1);

describe('repartirEnFilas (docs/18 §5)', () => {
  it('reparte por turnos: la 1, 5, 9… en la fila 1; la 2, 6, 10… en la 2', () => {
    const filas = repartirEnFilas(numeros(24));
    expect(filas).toHaveLength(4);
    expect(filas[0]).toEqual([1, 5, 9, 13, 17, 21]);
    expect(filas[1]).toEqual([2, 6, 10, 14, 18, 22]);
    expect(filas[3]).toEqual([4, 8, 12, 16, 20, 24]);
  });

  it('cada fila guarda hasta 18: de 80 entran las primeras 72', () => {
    const filas = repartirEnFilas(numeros(80));
    expect(filas.map((fila) => fila.length)).toEqual([18, 18, 18, 18]);
    expect(filas[0]?.at(-1)).toBe(69);
    expect(filas[3]?.at(-1)).toBe(72);
    expect(filas.flat()).not.toContain(73);
  });

  it('con pocas, las filas sin nada no salen y las demás quedan disparejas', () => {
    expect(repartirEnFilas(numeros(2))).toEqual([[1], [2]]);
    expect(repartirEnFilas(numeros(14)).map((fila) => fila.length)).toEqual([4, 4, 3, 3]);
    expect(repartirEnFilas([])).toEqual([]);
  });
});

describe('el final de cada fila', () => {
  it('una fila llena con más que las 72 del inicio termina en «Ver todas»', () => {
    const piezas = piezasDeLaFila(numeros(18), RECIEN_INICIO + 1);
    expect(piezas).toHaveLength(19);
    expect(piezas.at(-1)).toEqual({ tipo: 'ver-todas' });
    expect(piezas[0]).toEqual({ tipo: 'tarjeta', tarjeta: 1 });
  });

  it('con 72 justas, o con una fila que no llegó a 18, no hay «Ver todas»', () => {
    expect(piezasDeLaFila(numeros(18), RECIEN_INICIO)).toHaveLength(18);
    expect(piezasDeLaFila(numeros(17), 500).every((p) => p.tipo === 'tarjeta')).toBe(true);
  });

  it('el botón de abajo sale solo con más de 72', () => {
    expect(hayMasQueElInicio(72)).toBe(false);
    expect(hayMasQueElInicio(73)).toBe(true);
  });
});

describe('la flecha de cada fila', () => {
  it('con 6 o menos no hay flechas', () => {
    expect(flechasDeLaFila(0, 6)).toEqual({ anterior: false, siguiente: false });
    expect(flechasDeLaFila(0, 3)).toEqual({ anterior: false, siguiente: false });
    expect(posicionMaxima(4)).toBe(0);
  });

  it('con 18 corre de a 6: 2 clics y la flecha de la derecha desaparece en la última', () => {
    expect(flechasDeLaFila(0, 18)).toEqual({ anterior: false, siguiente: true });
    const uno = posicionSiguiente(0, 18);
    expect(uno).toBe(6);
    expect(flechasDeLaFila(uno, 18)).toEqual({ anterior: true, siguiente: true });
    const dos = posicionSiguiente(uno, 18);
    expect(dos).toBe(12);
    expect(flechasDeLaFila(dos, 18)).toEqual({ anterior: true, siguiente: false });
  });

  it('si quedan menos de 6, se corre lo justo para dejar la última pegada al borde', () => {
    expect(posicionSiguiente(0, 9)).toBe(3);
    expect(flechasDeLaFila(3, 9)).toEqual({ anterior: true, siguiente: false });
    // 18 y «Ver todas»: el tercer clic corre una sola, hasta la tarjeta del final.
    expect(posicionSiguiente(12, 19)).toBe(13);
    expect(flechasDeLaFila(13, 19).siguiente).toBe(false);
  });

  it('la flecha de volver retrocede 6 sin pasar del principio', () => {
    expect(posicionAnterior(12)).toBe(6);
    expect(posicionAnterior(3)).toBe(0);
    expect(posicionAnterior(0)).toBe(0);
  });

  it('con el teclado, la fila se corre lo justo para mostrar la tarjeta enfocada', () => {
    expect(posicionParaVer(0, 3, 18)).toBe(0);
    expect(posicionParaVer(0, 6, 18)).toBe(1);
    expect(posicionParaVer(6, 2, 18)).toBe(2);
    expect(posicionParaVer(0, 17, 18)).toBe(12);
  });
});
