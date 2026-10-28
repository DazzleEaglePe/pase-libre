import { describe, expect, it } from 'vitest';

import { buscarSchema } from './catalogo/catalogo.schemas';
import { claveEtiqueta, normalizarTexto, slugDe, tituloDeProducto } from './catalogo/normalizar';
import { centimosDeMonto, formatearPrecio, montoParaCampo, precioDe } from './comun/dinero';
import { crearCuentaSchema, whatsappSchema } from './equipo/equipo.schemas';
import { enviarMensajeSchema, historialSchema } from './mensajes/mensajes.schemas';
import { editarOfertaSchema, publicarSchema } from './ofertas/ofertas.schemas';
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

describe('tituloDeProducto', () => {
  it('une marca y modelo sin repetir la marca', () => {
    expect(tituloDeProducto('Zotac', 'Gaming GeForce RTX 3070 AMP Holo 8 GB')).toBe(
      'Zotac Gaming GeForce RTX 3070 AMP Holo 8 GB',
    );
    expect(tituloDeProducto('zotac', 'Zotac Gaming RTX 3070')).toBe('Zotac Gaming RTX 3070');
    // «MSI» no es el comienzo de «MSIX»: ahí sí se antepone.
    expect(tituloDeProducto('MSI', 'MSIX Pro')).toBe('MSI MSIX Pro');
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

describe('centimosDeMonto', () => {
  it('lee los montos como los escribe un vendedor', () => {
    expect(centimosDeMonto('250')).toBe(25000);
    expect(centimosDeMonto(' 1699.9 ')).toBe(169990);
    expect(centimosDeMonto('1,699.90')).toBe(169990);
    expect(centimosDeMonto('1.699,90')).toBe(169990);
    expect(centimosDeMonto('250,50')).toBe(25050);
    expect(centimosDeMonto('1,699')).toBe(169900);
    expect(centimosDeMonto('1 699')).toBe(169900);
  });

  it('rechaza lo que no es un monto válido', () => {
    expect(centimosDeMonto('')).toBeNull();
    expect(centimosDeMonto('0')).toBeNull();
    expect(centimosDeMonto('-5')).toBeNull();
    expect(centimosDeMonto('US$ 250')).toBeNull();
    expect(centimosDeMonto('2.5e3')).toBeNull();
    expect(centimosDeMonto('99999999999')).toBeNull();
  });

  it('devuelve el monto al campo sin decimales de más', () => {
    expect(montoParaCampo(25000)).toBe('250');
    expect(montoParaCampo(169990)).toBe('1699.90');
  });
});

describe('publicarSchema', () => {
  const igual = {
    producto_id: '6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f',
    condicion: 'USADO',
    stock: 2,
  };

  it('publica uno igual con lo mínimo y deja la visibilidad a la tienda', () => {
    expect(publicarSchema.parse({ ...igual, precio: '250' })).toEqual({
      ...igual,
      precio: 25000,
      descripcion: null,
      fotos: [],
    });
  });

  it('pide un producto del catálogo o uno nuevo, nunca los dos ni ninguno', () => {
    const sinProducto = publicarSchema.safeParse({ condicion: 'NUEVO', stock: 1 });
    expect(sinProducto.error?.issues[0]?.message).toBe(
      'Elige un producto del catálogo o crea uno nuevo para publicar.',
    );
    const ambos = publicarSchema.safeParse({
      ...igual,
      producto_nuevo: { categoria: 'graficas', marca: 'Zotac', modelo: 'RTX 3070 AMP Holo' },
    });
    expect(ambos.success).toBe(false);
  });

  it('no deja mostrar un precio sin monto', () => {
    const resultado = publicarSchema.safeParse({ ...igual, precio_visible: true });
    expect(resultado.error?.issues[0]?.message).toBe('Para mostrar el precio, escribe el monto.');
  });

  it('solo acepta fotos subidas a PaseLibre, sin repetir', () => {
    const ruta = '2026/10/0b6c3d2e-8f7a-4b1c-9d0e-1f2a3b4c5d6e.webp';
    expect(publicarSchema.safeParse({ ...igual, fotos: [ruta] }).success).toBe(true);
    expect(publicarSchema.safeParse({ ...igual, fotos: [ruta, ruta] }).success).toBe(false);
    expect(publicarSchema.safeParse({ ...igual, fotos: ['../../.env'] }).success).toBe(false);
    expect(
      publicarSchema.safeParse({ ...igual, fotos: ['https://otro.sitio/foto.webp'] }).success,
    ).toBe(false);
  });

  it('al editar exige al menos un cambio y permite dejar el stock en 0', () => {
    expect(editarOfertaSchema.safeParse({}).success).toBe(false);
    expect(editarOfertaSchema.parse({ stock: 0 })).toEqual({ stock: 0 });
    expect(editarOfertaSchema.parse({ precio: '' })).toEqual({ precio: null });
  });
});

describe('enviarMensajeSchema', () => {
  const ruta = '2026/10/0b6c3d2e-8f7a-4b1c-9d0e-1f2a3b4c5d6e.webp';

  it('acepta texto, foto o foto con texto, y quita espacios', () => {
    expect(enviarMensajeSchema.parse({ texto: '  ¿Sigue disponible?  ' })).toEqual({
      texto: '¿Sigue disponible?',
      foto: undefined,
    });
    expect(enviarMensajeSchema.parse({ foto: ruta, texto: '' })).toEqual({
      texto: undefined,
      foto: ruta,
    });
  });

  it('no deja mandar un mensaje vacío ni archivos que no son fotos subidas', () => {
    expect(enviarMensajeSchema.safeParse({ texto: '   ' }).error?.issues[0]?.message).toBe(
      'Escribe un mensaje o elige una foto.',
    );
    expect(enviarMensajeSchema.safeParse({ foto: 'contrato.pdf' }).success).toBe(false);
  });

  it('pide el historial por fecha con zona horaria', () => {
    expect(historialSchema.parse({})).toEqual({ limite: 50 });
    expect(historialSchema.safeParse({ antes: '2026-10-27T15:00:00.000Z' }).success).toBe(true);
    expect(historialSchema.safeParse({ antes: 'ayer' }).success).toBe(false);
  });
});
