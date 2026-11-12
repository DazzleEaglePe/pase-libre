import { describe, expect, it } from 'vitest';

import { galeriasEnOrden, nivelesPorTercios } from './galerias-en-orden';

describe('nivelesPorTercios (Wilson en vivo, N08)', () => {
  it('como el tablero: los dos con menos «Pocos», los del medio «Varios», los de más «Muchos»', () => {
    // Cyberplaza, Maxiplaza, Galería 3, 4, 5, 6, 7 y 8.
    expect(nivelesPorTercios([214, 96, 0, 41, 152, 12, 0, 63])).toEqual([
      'MUCHOS',
      'VARIOS',
      'SIN',
      'POCOS',
      'MUCHOS',
      'POCOS',
      'SIN',
      'VARIOS',
    ]);
  });

  it('con menos de 20 productos en todo Wilson, todas las que tienen salen en verde suave', () => {
    expect(nivelesPorTercios([12, 0, 5, 1])).toEqual(['POCOS', 'SIN', 'POCOS', 'POCOS']);
    expect(nivelesPorTercios([19])).toEqual(['POCOS']);
  });

  it('desde 20 compara: una sola galería con productos queda en el medio', () => {
    expect(nivelesPorTercios([20, 0])).toEqual(['VARIOS', 'SIN']);
    expect(nivelesPorTercios([5, 30])).toEqual(['POCOS', 'MUCHOS']);
  });

  it('las empatadas quedan juntas', () => {
    expect(nivelesPorTercios([30, 30, 30])).toEqual(['VARIOS', 'VARIOS', 'VARIOS']);
    expect(nivelesPorTercios([10, 10, 40, 40])).toEqual(['POCOS', 'POCOS', 'MUCHOS', 'MUCHOS']);
  });

  it('sin nada publicado, todas «Sin productos»', () => {
    expect(nivelesPorTercios([0, 0])).toEqual(['SIN', 'SIN']);
    expect(nivelesPorTercios([])).toEqual([]);
  });
});

describe('galeriasEnOrden', () => {
  it('sin listado, el orden de la base y después el nombre', () => {
    const lista = galeriasEnOrden([
      { slug: 'b', nombre: 'Beta', orden: 2 },
      { slug: 'c', nombre: 'Cyber', orden: 1 },
      { slug: 'a', nombre: 'Alfa', orden: 2 },
    ]);
    expect(lista.map((g) => g.slug)).toEqual(['c', 'a', 'b']);
  });
});
