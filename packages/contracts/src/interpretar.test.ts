import { describe, expect, it } from 'vitest';

import { interpretarBusqueda } from './catalogo/interpretar.js';

/** «Escribe como te salga» (BUS_Web, BUS_WebNum: sección 6 del lienzo final). */
describe('interpretarBusqueda', () => {
  it('entiende los números dichos en palabras', () => {
    expect(interpretarBusqueda('gigabyte treinta sesenta')).toEqual({
      texto: 'gigabyte 3060',
      categoria: null,
      cambio: true,
    });
    expect(interpretarBusqueda('dos mil').texto).toBe('2000');
    expect(interpretarBusqueda('ddr cuatro treinta y dos').texto).toBe('ddr 4 32');
  });

  it('junta un modelo partido en dos', () => {
    expect(interpretarBusqueda('rtx 40 70').texto).toBe('rtx 4070');
    expect(interpretarBusqueda('rtx 50 60 ti').texto).toBe('rtx 5060 ti');
    // Un número suelto se queda como está.
    expect(interpretarBusqueda('kingston 16 gb').texto).toBe('kingston 16 gb');
  });

  it('la categoría nombrada se elige y sale del texto', () => {
    expect(interpretarBusqueda('grafica gigabyte')).toEqual({
      texto: 'gigabyte',
      categoria: 'graficas',
      cambio: true,
    });
    expect(interpretarBusqueda('tarjeta de video msi')).toMatchObject({
      texto: 'msi',
      categoria: 'graficas',
    });
    expect(interpretarBusqueda('placa madre b550')).toMatchObject({
      texto: 'b 550',
      categoria: 'placas',
    });
    expect(interpretarBusqueda('Tarjetas de video')).toMatchObject({
      texto: '',
      categoria: 'graficas',
    });
  });

  it('lo que ya está bien no cambia', () => {
    expect(interpretarBusqueda('RTX 3070 Ventus')).toEqual({
      texto: 'rtx 3070 ventus',
      categoria: null,
      cambio: false,
    });
    expect(interpretarBusqueda('un mouse').cambio).toBe(false);
  });
});
