import { describe, expect, it } from 'vitest';

import { buscarSchema } from './catalogo/catalogo.schemas';
import { ajusteLogoSchema, logoTiendaSchema, portadaTiendaSchema } from './cuenta/cuenta.schemas';
import {
  editarOfertaSchema,
  eliminarOfertasSchema,
  MAX_ELIMINAR,
  publicarSchema,
} from './ofertas/ofertas.schemas';
import {
  pastillasDeVariantes,
  preguntasDeCategoria,
  textoEmpaque,
  textoPerfilMemoria,
  variantesDeCategoria,
} from './ofertas/ofertas.types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('«Eliminar varias» (docs/19 §12)', () => {
  it('acepta de 1 a 50 ids y quita los repetidos', () => {
    expect(eliminarOfertasSchema.parse({ ids: [id(1), id(2), id(1)] }).ids).toEqual([id(1), id(2)]);
    const cincuenta = Array.from({ length: MAX_ELIMINAR }, (_, i) => id(i));
    expect(eliminarOfertasSchema.safeParse({ ids: cincuenta }).success).toBe(true);
    expect(eliminarOfertasSchema.safeParse({ ids: [...cincuenta, id(99)] }).success).toBe(false);
    expect(eliminarOfertasSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(eliminarOfertasSchema.safeParse({ ids: ['uno'] }).success).toBe(false);
    expect(eliminarOfertasSchema.safeParse({ ids: [id(1)], todas: true }).success).toBe(false);
  });
});

describe('Para qué procesador es y el empaque (docs/19 §13)', () => {
  it('publicar y editar aceptan el perfil, el empaque y OC, o nulo para quitarlos', () => {
    const publicada = publicarSchema.parse({
      producto_id: id(1),
      estado_detalle: 'SELLADO',
      stock: 1,
      perfil_memoria: 'EXPO',
      empaque: 'OEM',
      oc: null,
    });
    expect(publicada).toMatchObject({ perfil_memoria: 'EXPO', empaque: 'OEM', oc: null });
    expect(editarOfertaSchema.parse({ perfil_memoria: null })).toEqual({ perfil_memoria: null });
    expect(editarOfertaSchema.safeParse({ perfil_memoria: 'DDR5' }).success).toBe(false);
    expect(editarOfertaSchema.safeParse({ empaque: 'BOX' }).success).toBe(false);
  });

  it('cada categoría pregunta lo suyo y lo demás queda nulo', () => {
    expect(preguntasDeCategoria('ram')).toEqual({
      procesador: true,
      oc: false,
      empaque: 'CAJA_OEM',
    });
    expect(preguntasDeCategoria('graficas')).toMatchObject({ oc: true, empaque: 'CAJA_OEM' });
    expect(preguntasDeCategoria('almacenamiento')).toMatchObject({ empaque: 'CAJA_OEM' });
    expect(preguntasDeCategoria('procesadores')).toMatchObject({ empaque: 'BOX_TRAY' });
    expect(preguntasDeCategoria('monitores')).toEqual({
      procesador: false,
      oc: false,
      empaque: null,
    });
    const todo = { perfil_memoria: 'XMP', empaque: 'CAJA', oc: true } as const;
    expect(variantesDeCategoria('ram', todo)).toEqual({
      perfil_memoria: 'XMP',
      empaque: 'CAJA',
      oc: null,
    });
    expect(variantesDeCategoria('graficas', todo)).toEqual({
      perfil_memoria: null,
      empaque: 'CAJA',
      oc: true,
    });
    expect(variantesDeCategoria(null, todo)).toEqual({
      perfil_memoria: null,
      empaque: null,
      oc: null,
    });
  });

  it('las pastillas del título: azul, naranja, gris y OC en negrita', () => {
    expect(pastillasDeVariantes({ perfil_memoria: 'XMP', empaque: 'CAJA', oc: null })).toEqual([
      { texto: 'Intel XMP', tono: 'intel' },
    ]);
    expect(pastillasDeVariantes({ perfil_memoria: 'AMBOS', empaque: 'OEM', oc: null })).toEqual([
      { texto: 'Intel XMP', tono: 'intel' },
      { texto: 'EXPO Ryzen', tono: 'ryzen' },
      { texto: 'OEM sin caja', tono: 'oem' },
    ]);
    expect(pastillasDeVariantes({ oc: true }, 'ASUS RTX 5060 Dual 8GB')).toEqual([
      { texto: 'OC', tono: 'negrita' },
    ]);
    // Si el título ya dice OC, no se repite.
    expect(pastillasDeVariantes({ oc: true }, 'MSI RTX 3070 Ventus 3X OC')).toEqual([]);
    expect(pastillasDeVariantes({ oc: false, perfil_memoria: null })).toEqual([]);
    expect(pastillasDeVariantes(null)).toEqual([]);
  });

  it('«Perfil de memoria» y «Empaque» en Características', () => {
    expect(textoPerfilMemoria('XMP', 'Kingston FURY Beast 8GB DDR4 3200')).toBe(
      'Intel XMP 2.0 · para placas Intel',
    );
    expect(textoPerfilMemoria('XMP', 'Kingston Fury Beast DDR5 32 GB')).toBe(
      'Intel XMP 3.0 · para placas Intel',
    );
    expect(textoPerfilMemoria('EXPO')).toBe('AMD EXPO · para placas AMD Ryzen');
    expect(textoEmpaque('CAJA', 'ram')).toBe('Con caja');
    expect(textoEmpaque('OEM', 'almacenamiento')).toBe('OEM · sin caja');
    expect(textoEmpaque('CAJA', 'procesadores')).toBe('Box (con caja)');
    expect(textoEmpaque('OEM', 'procesadores')).toBe('Tray (OEM)');
  });

  it('«Para Intel» y «Para Ryzen» en la búsqueda', () => {
    expect(buscarSchema.parse({ perfil: 'intel' }).perfil).toBe('intel');
    expect(buscarSchema.parse({}).perfil).toBeUndefined();
    expect(buscarSchema.safeParse({ perfil: 'amd' }).success).toBe(false);
  });
});

describe('«Ajustar logo» y la portada (docs/19 §20)', () => {
  const ajuste = { x: 0.5, y: 0.5, zoom: 1, rotacion: 0, fondo: '#FFFFFF' };

  it('el ajuste va con su original o solo, y el color en minúsculas', () => {
    expect(ajusteLogoSchema.parse(ajuste).fondo).toBe('#ffffff');
    expect(ajusteLogoSchema.parse({ ...ajuste, fondo: 'transparente' }).fondo).toBe('transparente');
    expect(logoTiendaSchema.safeParse({ ajuste }).success).toBe(true);
    expect(
      logoTiendaSchema.safeParse({
        ruta: '2026/11/0a1b2c3d-0000-4000-8000-000000000001.webp',
        ajuste,
      }).success,
    ).toBe(true);
    for (const raro of [
      { ...ajuste, rotacion: 45 },
      { ...ajuste, zoom: 4.5 },
      { ...ajuste, zoom: 0 },
      { ...ajuste, x: -2 },
      { ...ajuste, fondo: 'red' },
    ]) {
      expect(ajusteLogoSchema.safeParse(raro).success).toBe(false);
    }
    // «Que entre entero» aleja por debajo de 1×.
    expect(ajusteLogoSchema.safeParse({ ...ajuste, zoom: 0.45 }).success).toBe(true);
  });

  it('la portada se acomoda con zoom de 1× a 4× y a lo ancho', () => {
    expect(portadaTiendaSchema.parse({ zoom: 2.5, x: 10 })).toEqual({ zoom: 2.5, x: 10 });
    expect(portadaTiendaSchema.safeParse({ zoom: 0.9 }).success).toBe(false);
    expect(portadaTiendaSchema.safeParse({ zoom: 4.1 }).success).toBe(false);
    expect(portadaTiendaSchema.safeParse({ x: 100.5 }).success).toBe(false);
    expect(portadaTiendaSchema.safeParse({}).success).toBe(false);
  });
});
