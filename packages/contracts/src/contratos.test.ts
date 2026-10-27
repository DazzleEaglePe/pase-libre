import { describe, expect, it } from 'vitest';

import { claveEtiqueta, normalizarTexto, slugDe } from './catalogo/normalizar';
import { cambiarClaveSchema, ingresarSchema } from './sesion/sesion.schemas';

describe('normalizarTexto', () => {
  it('da lo mismo para las formas en que se escribe un modelo', () => {
    expect(normalizarTexto('RTX3070')).toBe('rtx 3070');
    expect(normalizarTexto('rtx 3070')).toBe('rtx 3070');
    expect(normalizarTexto('RTX-3070')).toBe('rtx 3070');
  });

  it('quita tildes y signos y separa letras de números', () => {
    expect(normalizarTexto('Intel Core i5-14400F')).toBe('intel core i 5 14400 f');
    expect(normalizarTexto('Periféricos  y   más')).toBe('perifericos y mas');
    expect(normalizarTexto('LG UltraGear 27" 180 Hz')).toBe('lg ultragear 27 180 hz');
  });

  it('arma claves de etiqueta y slugs con la misma regla', () => {
    expect(claveEtiqueta('DDR5')).toBe(claveEtiqueta('ddr 5'));
    expect(slugDe('MSI GeForce RTX 3070 Ventus 3X OC 8 GB')).toBe(
      'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb',
    );
  });
});

describe('ingresarSchema', () => {
  it('acepta usuario o correo sin distinguir mayúsculas', () => {
    expect(ingresarSchema.parse({ usuario: '  TiendaA ', clave: 'x' })).toEqual({
      usuario: 'tiendaa',
      clave: 'x',
      recordar: false,
    });
  });

  it('rechaza campos que no son del contrato', () => {
    expect(ingresarSchema.safeParse({ usuario: 'a', clave: 'b', rol: 'EQUIPO' }).success).toBe(
      false,
    );
  });
});

describe('cambiarClaveSchema', () => {
  it('exige 8 caracteres y un número', () => {
    expect(cambiarClaveSchema.safeParse({ clave_nueva: 'corta1' }).success).toBe(false);
    expect(cambiarClaveSchema.safeParse({ clave_nueva: 'sinnumeros' }).success).toBe(false);
    expect(cambiarClaveSchema.safeParse({ clave_nueva: 'galeria2026' }).success).toBe(true);
  });
});
