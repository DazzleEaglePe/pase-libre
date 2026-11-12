import { describe, expect, it } from 'vitest';

import {
  lugarDeTienda,
  partirCoincidencia,
  reputacionParaLeer,
  textoPiso,
  textoReputacion,
} from './tiendas';

describe('Tiendas en el directorio y el buscador (N13)', () => {
  it('«4,9 ★ · 31 opiniones», corta «4,9 ★» y «Nueva»', () => {
    const conHistoria = { estrellas: 4.9, opiniones: 31, nueva: false };
    expect(textoReputacion(conHistoria)).toBe('4,9 ★ · 31 opiniones');
    expect(textoReputacion(conHistoria, true)).toBe('4,9 ★');
    expect(textoReputacion({ estrellas: 5, opiniones: 1, nueva: false })).toBe('5,0 ★ · 1 opinión');
    expect(textoReputacion({ estrellas: null, opiniones: 0, nueva: true })).toBe('Nueva');
    expect(reputacionParaLeer(conHistoria)).toBe('4,9 de 5 estrellas, 31 opiniones');
  });

  it('el lugar y el piso', () => {
    expect(lugarDeTienda({ galeria: 'Cyberplaza', stand: '3A-110' }, true)).toBe(
      'Cyberplaza · Stand 3A-110',
    );
    expect(lugarDeTienda({ galeria: 'Cyberplaza', stand: '3A-110' })).toBe('Cyberplaza · 3A-110');
    expect(lugarDeTienda({ galeria: null, stand: null })).toBe('Independiente');
    expect(textoPiso('2')).toBe('Piso 2');
    expect(textoPiso('Sótano')).toBe('Sótano');
  });

  it('resalta lo escrito sin importar tildes ni mayúsculas', () => {
    expect(partirCoincidencia('Pegasus5000', 'pega')).toEqual(['', 'Pega', 'sus5000']);
    expect(partirCoincidencia('Compu Peña', 'pena')).toEqual(['Compu ', 'Peña', '']);
    expect(partirCoincidencia('Tienda B', 'ÍENDA')).toEqual(['T', 'ienda', ' B']);
    expect(partirCoincidencia('Tienda B', 'otra')).toBeNull();
    expect(partirCoincidencia('Tienda B', '  ')).toBeNull();
  });
});
