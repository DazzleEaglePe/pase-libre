import { describe, expect, it } from 'vitest';

import { interpretarBusqueda } from './catalogo/interpretar.js';

/** «Escribe como te salga» (BUS_Web, BUS_WebNum: sección 6 del lienzo final). */
describe('interpretarBusqueda', () => {
  it('entiende los números dichos en palabras', () => {
    expect(interpretarBusqueda('gigabyte treinta sesenta')).toMatchObject({
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
      terminos: ['gigabyte'],
      tipos: [],
      perfil: null,
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
      terminos: ['rtx', '3070', 'ventus'],
      tipos: [],
      perfil: null,
    });
    expect(interpretarBusqueda('logitech g502').cambio).toBe(false);
  });
});

/**
 * Doc 20 §11: un solo buscador para todo. Una prueba por fila del tablero P46 (lo que escribe
 * la persona y lo que debe dar). Las mismas 10 filas se prueban contra la API en los 5
 * buscadores (`apps/api/test/un-solo-buscador.e2e-spec.ts`).
 */
describe('Un solo buscador (doc 20 §11, tablero P46)', () => {
  it('«ram gskill» → RAM · G.Skill', () => {
    expect(interpretarBusqueda('ram gskill')).toMatchObject({
      categoria: 'ram',
      terminos: ['g skill'],
      tipos: [],
      perfil: null,
    });
  });

  it('«almacenamiento kingston» → Almacenamiento · Kingston', () => {
    expect(interpretarBusqueda('almacenamiento kingston')).toMatchObject({
      categoria: 'almacenamiento',
      terminos: ['kingston'],
      tipos: [],
    });
  });

  it('«m.2 1tb» → Almacenamiento · M.2 · 1 TB', () => {
    expect(interpretarBusqueda('m.2 1tb')).toMatchObject({
      categoria: 'almacenamiento',
      terminos: ['m 2', '1', 'tb'],
      tipos: ['m 2'],
      cambio: true,
    });
    // Escrito sin punto es lo mismo.
    expect(interpretarBusqueda('m2 1tb').terminos).toEqual(['m 2', '1', 'tb']);
  });

  it('«sata 480» → Almacenamiento · SATA · 480 GB', () => {
    expect(interpretarBusqueda('sata 480')).toMatchObject({
      categoria: 'almacenamiento',
      terminos: ['sata', '480'],
      tipos: ['sata'],
    });
  });

  it('«case deepcool» → Cases · DeepCool', () => {
    expect(interpretarBusqueda('case deepcool')).toMatchObject({
      categoria: 'cases',
      terminos: ['deepcool'],
    });
  });

  it('«mouse pad» → Mouse pads (las de dos palabras van antes que «mouse»)', () => {
    expect(interpretarBusqueda('mouse pad')).toMatchObject({
      categoria: 'mouse-pads',
      terminos: [],
      texto: '',
    });
    expect(interpretarBusqueda('mouse logitech')).toMatchObject({
      categoria: 'mouse',
      terminos: ['logitech'],
    });
  });

  it('«cooler» → Refrigeración (y «cooler master» sigue siendo la marca)', () => {
    expect(interpretarBusqueda('cooler')).toMatchObject({
      categoria: 'refrigeracion',
      terminos: [],
    });
    expect(interpretarBusqueda('cooler master hyper 212')).toMatchObject({
      categoria: null,
      terminos: ['cooler master', 'hyper', '212'],
    });
  });

  it('«ram expo» → RAM con EXPO; «xmp» o «intel» en RAM, las XMP', () => {
    expect(interpretarBusqueda('ram expo')).toMatchObject({
      categoria: 'ram',
      terminos: [],
      perfil: 'EXPO',
      cambio: true,
    });
    expect(interpretarBusqueda('xmp')).toMatchObject({ categoria: 'ram', perfil: 'XMP' });
    expect(interpretarBusqueda('ram intel')).toMatchObject({ categoria: 'ram', perfil: 'XMP' });
    // Sin RAM, «intel» es la marca de los procesadores.
    expect(interpretarBusqueda('procesador intel')).toMatchObject({
      categoria: 'procesadores',
      terminos: ['intel'],
      perfil: null,
    });
  });

  it('«5600xt» → «5600 xt» (ya funcionaba: que no se rompa)', () => {
    expect(interpretarBusqueda('5600xt')).toEqual({
      texto: '5600 xt',
      categoria: null,
      cambio: false,
      terminos: ['5600', 'xt'],
      tipos: [],
      perfil: null,
    });
    expect(interpretarBusqueda('RX 5600XT').texto).toBe('rx 5600 xt');
  });

  it('un nombre largo pegado del Excel: sin relleno, con su categoría y sus tipos', () => {
    const excel = 'SSD Kingston NV3 1TB M.2 2280 NVMe PCIe 4.0 SNV3S/1000G Nuevo Sellado Original';
    expect(interpretarBusqueda(excel)).toMatchObject({
      categoria: 'almacenamiento',
      tipos: ['ssd', 'm 2', 'nvme'],
      terminos: [
        'ssd',
        'kingston',
        'nv',
        '3',
        '1',
        'tb',
        'm 2',
        '2280',
        'nvme',
        'pcie',
        '4',
        '0',
        'snv',
        's',
        '1000',
        'g',
      ],
    });
  });

  it('las marcas escritas de otra forma', () => {
    expect(interpretarBusqueda('G.Skill trident').terminos).toEqual(['g skill', 'trident']);
    expect(interpretarBusqueda('wd blue').terminos).toEqual(['western digital', 'blue']);
    expect(interpretarBusqueda('tforce delta').terminos).toEqual(['teamgroup', 'delta']);
    expect(interpretarBusqueda('cm 212').terminos).toEqual(['cooler master', '212']);
    expect(interpretarBusqueda('tplink archer').terminos).toEqual(['tp link', 'archer']);
  });

  it('«ram», «memoria» y «procesador» eligen su categoría', () => {
    expect(interpretarBusqueda('ram').categoria).toBe('ram');
    expect(interpretarBusqueda('memoria kingston')).toMatchObject({
      categoria: 'ram',
      terminos: ['kingston'],
    });
    expect(interpretarBusqueda('procesador').categoria).toBe('procesadores');
    expect(interpretarBusqueda('ddr5 6000')).toMatchObject({
      categoria: 'ram',
      terminos: ['ddr 5', '6000'],
      tipos: ['ddr 5'],
    });
  });

  it('el relleno se ignora siempre, y solo relleno se busca tal cual', () => {
    expect(interpretarBusqueda('rtx 4060 o 5060 nuevo para pc gamer').terminos).toEqual([
      'rtx',
      '4060',
      '5060',
    ]);
    expect(interpretarBusqueda('gamer')).toMatchObject({ terminos: [], categoria: null });
  });
});
