import { describe, expect, it } from 'vitest';

import {
  hrefDirectorio,
  leerConsultaDirectorio,
  parametrosDirectorio,
  SIN_FILTROS,
} from './consulta-directorio';

describe('Filtros de la pestaña «Tiendas» (N13)', () => {
  it('lee la dirección y descarta lo que no sirve', () => {
    expect(
      leerConsultaDirectorio({ galeria: ' cyberplaza ', piso: ['2', '3'], orden: 'precio' }),
    ).toEqual({ q: '', galeria: 'cyberplaza', piso: '2', vende: '', orden: 'reputacion' });
    expect(leerConsultaDirectorio({ orden: 'nombre', q: 'x'.repeat(80) }).q).toHaveLength(60);
  });

  it('arma la dirección; al cambiar de galería se olvida el piso', () => {
    const consulta = { ...SIN_FILTROS, galeria: 'cyberplaza', piso: '2' };
    expect(hrefDirectorio(consulta)).toBe(
      '/wilson-en-vivo?pestana=tiendas&galeria=cyberplaza&piso=2',
    );
    expect(hrefDirectorio(consulta, { galeria: 'maxiplaza' })).toBe(
      '/wilson-en-vivo?pestana=tiendas&galeria=maxiplaza',
    );
    expect(hrefDirectorio(SIN_FILTROS)).toBe('/wilson-en-vivo?pestana=tiendas');
    expect(parametrosDirectorio({ ...SIN_FILTROS, orden: 'nombre', q: 'pega' }, 2).toString()).toBe(
      'q=pega&orden=nombre&pagina=2',
    );
  });
});
