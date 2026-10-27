import { describe, expect, it } from 'vitest';

import { buscarSchema } from './catalogo/catalogo.schemas';
import { claveEtiqueta, normalizarTexto, slugDe } from './catalogo/normalizar';
import { formatearPrecio, precioDe } from './comun/dinero';
import { crearCuentaSchema, whatsappSchema } from './equipo/equipo.schemas';
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

describe('buscarSchema', () => {
  it('acepta listas repetidas o separadas por comas y pone valores por defecto', () => {
    expect(
      buscarSchema.parse({
        q: ' rtx 3370 ',
        galeria: ['Maxiplaza', 'cyberplaza'],
        condicion: 'usado,nuevo',
      }),
    ).toEqual({
      q: 'rtx 3370',
      galeria: ['maxiplaza', 'cyberplaza'],
      marca: [],
      condicion: ['usado', 'nuevo'],
      stock: false,
      moneda: 'USD',
      orden: 'recientes',
      pagina: 1,
    });
  });

  it('convierte los números y el «solo con stock» de la URL', () => {
    const consulta = buscarSchema.parse({ stock: 'true', precio_max: '300', pagina: '2' });
    expect(consulta).toMatchObject({ stock: true, precio_max: 300, pagina: 2 });
  });

  it('rechaza valores fuera de la lista', () => {
    expect(buscarSchema.safeParse({ condicion: 'roto' }).success).toBe(false);
    expect(buscarSchema.safeParse({ orden: 'azar' }).success).toBe(false);
  });
});

describe('precios', () => {
  it('se arman desde céntimos y se escriben como en el lienzo', () => {
    expect(precioDe(25000, 'USD')).toEqual({ moneda: 'USD', centimos: 25000, monto: '250.00' });
    expect(formatearPrecio(precioDe(25000, 'USD'))).toBe('US$ 250');
    expect(formatearPrecio(precioDe(169999, 'PEN'))).toBe('S/ 1,699.99');
  });
});

describe('crearCuentaSchema', () => {
  const dueno = {
    tipo: 'DUENO',
    nombre: 'Rosa M.',
    usuario: ' TiendaF ',
    tienda: {
      nombre: 'Tienda F',
      galeria: 'cyberplaza',
      stand: '118',
      whatsapp: '+51 987 654 321',
    },
  };

  it('normaliza el usuario y el WhatsApp', () => {
    const cuenta = crearCuentaSchema.parse(dueno);
    expect(cuenta.usuario).toBe('tiendaf');
    expect(cuenta.tienda?.whatsapp).toBe('987654321');
  });

  it('pide galería al dueño de tienda, pero no al independiente', () => {
    const sinGaleria = { ...dueno, tienda: { ...dueno.tienda, galeria: null } };
    expect(crearCuentaSchema.safeParse(sinGaleria).success).toBe(false);
    expect(crearCuentaSchema.safeParse({ ...sinGaleria, tipo: 'INDEPENDIENTE' }).success).toBe(
      true,
    );
  });

  it('el asesor se suma a una tienda existente', () => {
    const asesor = { tipo: 'ASESOR', nombre: 'Kevin S.', usuario: 'tiendaf.kevin' };
    expect(crearCuentaSchema.safeParse(asesor).success).toBe(false);
    expect(
      crearCuentaSchema.safeParse({ ...asesor, tienda_id: '7b0f3c62-8d2a-4c1b-9e7f-1a2b3c4d5e6f' })
        .success,
    ).toBe(true);
  });

  it('rechaza celulares que no son de Perú', () => {
    expect(whatsappSchema.safeParse('12345').success).toBe(false);
    expect(whatsappSchema.safeParse('51987654321').data).toBe('987654321');
  });
});
