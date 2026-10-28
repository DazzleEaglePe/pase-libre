import { describe, expect, it } from 'vitest';

import {
  alternar,
  con,
  hayFiltros,
  hrefBuscar,
  leerFiltros,
  sinFiltros,
  textoConsulta,
} from './consulta';

describe('Filtros de /buscar', () => {
  it('lee la dirección con listas por comas o repetidas y valores sueltos por defecto', () => {
    const filtros = leerFiltros({
      q: ' rtx 3070 ',
      galeria: 'Maxiplaza,cyberplaza',
      marca: ['msi', 'asus'],
      stock: 'true',
      pagina: '3',
    });
    expect(filtros).toMatchObject({
      q: 'rtx 3070',
      galeria: ['maxiplaza', 'cyberplaza'],
      marca: ['msi', 'asus'],
      condicion: [],
      stock: true,
      moneda: 'USD',
      orden: 'recientes',
      pagina: 3,
    });
  });

  it('ignora lo que no entiende: orden raro, moneda rara y páginas fuera de rango', () => {
    const filtros = leerFiltros({ orden: 'al-azar', moneda: 'eur', pagina: '-4' });
    expect(filtros).toMatchObject({ orden: 'recientes', moneda: 'USD', pagina: 1 });
    expect(leerFiltros({ pagina: '99999' }).pagina).toBe(500);
  });

  it('escribe solo lo que no es el valor por defecto', () => {
    expect(hrefBuscar(leerFiltros({}))).toBe('/buscar');
    const filtros = leerFiltros({ q: 'ram', galeria: 'a,b', orden: 'precio_asc', pagina: '2' });
    expect(textoConsulta(filtros)).toBe('q=ram&galeria=a%2Cb&orden=precio_asc&pagina=2');
  });

  it('lleva la moneda solo cuando hay un rango de precio', () => {
    expect(textoConsulta(leerFiltros({ moneda: 'PEN' }))).toBe('');
    expect(textoConsulta(leerFiltros({ precio_max: '300', moneda: 'PEN' }))).toBe(
      'precio_max=300&moneda=PEN',
    );
  });

  it('prende y apaga una opción, y vuelve a la primera página', () => {
    const base = leerFiltros({ q: 'rtx', galeria: 'maxiplaza', pagina: '4' });
    const con2 = alternar(base, 'galeria', 'cyberplaza');
    expect(con2.galeria).toEqual(['maxiplaza', 'cyberplaza']);
    expect(con2.pagina).toBe(1);
    expect(alternar(con2, 'galeria', 'maxiplaza').galeria).toEqual(['cyberplaza']);
  });

  it('limpiar quita los filtros pero deja lo que se buscó', () => {
    const base = leerFiltros({
      q: 'rtx',
      categoria: 'graficas',
      marca: 'msi',
      condicion: 'usado',
      stock: 'true',
      precio_min: '100',
    });
    expect(hayFiltros(base)).toBe(true);
    const limpio = sinFiltros(base);
    expect(hayFiltros(limpio)).toBe(false);
    expect(textoConsulta(limpio)).toBe('q=rtx&categoria=graficas');
    expect(con(limpio, { q: '' }).q).toBe('');
  });
});
