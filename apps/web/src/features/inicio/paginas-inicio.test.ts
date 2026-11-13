import { describe, expect, it } from 'vitest';

import { botonesDePaginas, desdeDe, paginaDe, paginasEnCelular } from './paginas-inicio';

const texto = (actual: number, total: number) =>
  botonesDePaginas(actual, total)
    .map((boton) => (boton.tipo === 'puntos' ? '…' : String(boton.numero)))
    .join(' ');

/** `‹ 1 2 3 … 7 Siguiente ›` (doc 20, punto 4). */
describe('botonesDePaginas', () => {
  it('en la primera de 7: 1 2 3 … 7', () => {
    expect(texto(1, 7)).toBe('1 2 3 … 7');
  });

  it('en el medio, la actual con sus vecinas y los dos extremos', () => {
    expect(texto(4, 7)).toBe('1 2 3 4 5 6 7');
    expect(texto(5, 10)).toBe('1 … 4 5 6 … 10');
  });

  it('al final, las 3 últimas', () => {
    expect(texto(7, 7)).toBe('1 … 5 6 7');
  });

  it('si falta una sola página entre dos, va el número y no los «…»', () => {
    expect(texto(3, 7)).toBe('1 2 3 4 … 7');
  });

  it('pocas páginas: todas, y sin páginas, nada', () => {
    expect(texto(1, 2)).toBe('1 2');
    expect(texto(1, 1)).toBe('1');
    expect(texto(1, 0)).toBe('');
  });
});

describe('páginas de la computadora y del celular', () => {
  it('de a 20 en la computadora y de a 10 en el celular', () => {
    expect(paginaDe(0, false)).toBe(1);
    expect(paginaDe(30, false)).toBe(2);
    expect(paginaDe(30, true)).toBe(4);
    expect(desdeDe(3, false)).toBe(40);
    expect(desdeDe(3, true)).toBe(20);
  });

  it('en el celular hay el doble de páginas, sin una vacía al final', () => {
    expect(paginasEnCelular(130)).toBe(13);
    expect(paginasEnCelular(50)).toBe(5);
    expect(paginasEnCelular(41)).toBe(5);
  });
});
