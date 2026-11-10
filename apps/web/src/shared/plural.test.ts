import { describe, expect, it } from 'vitest';

import { conPlural, enPlural } from './plural';

describe('plurales', () => {
  it('usa el singular solo con uno', () => {
    expect(conPlural(1, 'producto', 'productos')).toBe('1 producto');
    expect(conPlural(0, 'producto', 'productos')).toBe('0 productos');
    expect(conPlural(3, 'tienda', 'tiendas')).toBe('3 tiendas');
  });

  it('devuelve solo la palabra cuando la cantidad va aparte', () => {
    expect(enPlural(1, 'galería', 'galerías')).toBe('galería');
    expect(enPlural(2, 'galería', 'galerías')).toBe('galerías');
  });
});
