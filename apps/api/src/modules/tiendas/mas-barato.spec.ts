import { describe, expect, it } from 'vitest';

import { masBaratasDeLaGaleria, type OfertaParaComparar } from './mas-barato';

const oferta = (
  id: string,
  precio: number | null,
  extra: Partial<OfertaParaComparar> = {},
): OfertaParaComparar => ({
  id,
  productoId: 'ram',
  galeriaId: 'cyberplaza',
  precioCentimos: precio,
  moneda: 'USD',
  ...extra,
});

describe('«Más barato de la galería» (doc 20, punto 20)', () => {
  it('es la de menor precio del mismo producto en su galería', () => {
    const baratas = masBaratasDeLaGaleria(
      [oferta('a', 10_000), oferta('b', 9_000), oferta('c', 9_500)],
      3.8,
    );
    expect([...baratas]).toEqual(['b']);
  });

  it('necesita al menos 2 ofertas para comparar', () => {
    expect(masBaratasDeLaGaleria([oferta('sola', 5_000)], 3.8).size).toBe(0);
    // La otra está al interno: no se puede comparar.
    expect(masBaratasDeLaGaleria([oferta('a', 5_000), oferta('b', null)], 3.8).size).toBe(0);
  });

  it('compara solo dentro de la galería y del producto', () => {
    const baratas = masBaratasDeLaGaleria(
      [
        oferta('a', 10_000),
        oferta('b', 12_000),
        // Más barata, pero en otra galería: no le quita el título a «a».
        oferta('otra-galeria', 1_000, { galeriaId: 'compuplaza' }),
        // Otro producto.
        oferta('otro-producto', 500, { productoId: 'ssd' }),
      ],
      3.8,
    );
    expect([...baratas]).toEqual(['a']);
  });

  it('pasa los soles a dólares y los empates cuentan para las dos', () => {
    const baratas = masBaratasDeLaGaleria(
      [
        oferta('dolares', 10_000),
        oferta('soles', 38_000, { moneda: 'PEN' }),
        oferta('cara', 11_000),
      ],
      3.8,
    );
    expect([...baratas].sort()).toEqual(['dolares', 'soles']);
  });

  it('las independientes no tienen galería', () => {
    expect(
      masBaratasDeLaGaleria(
        [oferta('a', 100, { galeriaId: null }), oferta('b', 200, { galeriaId: null })],
        3.8,
      ).size,
    ).toBe(0);
  });
});
