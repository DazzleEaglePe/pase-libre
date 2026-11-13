import { describe, expect, it } from 'vitest';

import { origenesPermitidos } from './adaptador-tiempo-real';

describe('origenesPermitidos', () => {
  it('acepta la raíz y su par con www', () => {
    expect(origenesPermitidos('https://paselibre.shop')).toEqual([
      'https://paselibre.shop',
      'https://www.paselibre.shop',
    ]);
  });

  it('si WEB_URL ya trae www, suma la raíz', () => {
    expect(origenesPermitidos('https://www.paselibre.shop/')).toEqual([
      'https://www.paselibre.shop',
      'https://paselibre.shop',
    ]);
  });

  it('en local no inventa un www', () => {
    expect(origenesPermitidos('http://localhost:3000')).toEqual(['http://localhost:3000']);
    expect(origenesPermitidos('http://127.0.0.1:3040')).toEqual(['http://127.0.0.1:3040']);
  });

  it('suma los extra y descarta los mal escritos', () => {
    expect(
      origenesPermitidos('https://paselibre.shop', ['https://staging.paselibre.shop/', 'nada']),
    ).toEqual([
      'https://paselibre.shop',
      'https://www.paselibre.shop',
      'https://staging.paselibre.shop',
    ]);
  });
});
