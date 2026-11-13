import type { Foto } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import { fotosDeFicha } from './fotos-ficha';

const foto = (ruta: string): Foto => ({ ruta, ancho: 1200, alto: 1200 });
const rutas = (fotos: Array<{ ruta: string }>) => fotos.map((f) => f.ruta);

const CATALOGO = foto('catalogo/ak820.webp');
const TIENDA_1 = foto('2026/11/tienda-1.webp');
const TIENDA_2 = foto('2026/11/tienda-2.webp');
const TIENDA_3 = foto('2026/11/tienda-3.webp');

describe('Las miniaturas de la ficha (doc 20 · punto 23)', () => {
  it('la primera es la portada que eligió la tienda, aunque no sea la del catálogo', () => {
    const fotos = fotosDeFicha([CATALOGO], {
      fotos: [TIENDA_1, TIENDA_2, TIENDA_3],
      portada: TIENDA_2.ruta,
    });
    expect(rutas(fotos)).toEqual([TIENDA_2.ruta, CATALOGO.ruta, TIENDA_1.ruta, TIENDA_3.ruta]);
    expect(fotos.map((f) => f.origen)).toEqual(['tienda', 'catalogo', 'tienda', 'tienda']);
  });

  it('sin portada elegida, va primero la del catálogo y después las de la tienda', () => {
    const fotos = fotosDeFicha([CATALOGO], { fotos: [TIENDA_1, TIENDA_2], portada: null });
    expect(rutas(fotos)).toEqual([CATALOGO.ruta, TIENDA_1.ruta, TIENDA_2.ruta]);
  });

  it('sin foto del catálogo, la primera de la tienda', () => {
    const fotos = fotosDeFicha([], { fotos: [TIENDA_1, TIENDA_2], portada: null });
    expect(rutas(fotos)).toEqual([TIENDA_1.ruta, TIENDA_2.ruta]);
  });

  it('una sola foto (solo la del catálogo): una sola, sin miniaturas que mostrar', () => {
    expect(rutas(fotosDeFicha([CATALOGO], { fotos: [], portada: null }))).toEqual([CATALOGO.ruta]);
  });

  it('sin oferta, las del catálogo en su orden', () => {
    const otra = foto('catalogo/ak820-lado.webp');
    expect(rutas(fotosDeFicha([CATALOGO, otra], null))).toEqual([CATALOGO.ruta, otra.ruta]);
  });

  it('no repite una foto que está en el catálogo y en la tienda', () => {
    const fotos = fotosDeFicha([CATALOGO], {
      fotos: [TIENDA_1, CATALOGO],
      portada: TIENDA_1.ruta,
    });
    expect(rutas(fotos)).toEqual([TIENDA_1.ruta, CATALOGO.ruta]);
  });

  it('una portada que ya no está entre las fotos no se inventa', () => {
    const fotos = fotosDeFicha([CATALOGO], { fotos: [TIENDA_1], portada: 'otra/ruta.webp' });
    expect(rutas(fotos)).toEqual([CATALOGO.ruta, TIENDA_1.ruta]);
  });
});
