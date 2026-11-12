import { describe, expect, it } from 'vitest';

import { portadaDe } from './portada';

describe('portadaDe (docs/17 §5)', () => {
  const delCatalogo = { fotos: [{ ruta: 'catalogo.webp' }] };
  const sinCatalogo = { fotos: [] };
  const deLaTienda = [{ ruta: 'tuya-1.webp' }, { ruta: 'tuya-2.webp' }];

  it('primero la que eligió la tienda', () => {
    expect(
      portadaDe({ portadaRuta: 'tuya-2.webp', fotos: deLaTienda, producto: delCatalogo }),
    ).toBe('tuya-2.webp');
  });

  it('si no eligió, la del catálogo, aunque la tienda tenga fotos', () => {
    expect(portadaDe({ portadaRuta: null, fotos: deLaTienda, producto: delCatalogo })).toBe(
      'catalogo.webp',
    );
  });

  it('si el producto no tiene fotos, la primera de la tienda; sin ninguna, nula', () => {
    expect(portadaDe({ portadaRuta: null, fotos: deLaTienda, producto: sinCatalogo })).toBe(
      'tuya-1.webp',
    );
    expect(portadaDe({ portadaRuta: null, fotos: [], producto: sinCatalogo })).toBeNull();
  });
});
