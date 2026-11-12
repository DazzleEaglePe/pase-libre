import { describe, expect, it } from 'vitest';

import { buscarSchema } from './catalogo/catalogo.schemas';
import { claveEtiqueta, normalizarTexto, slugDe, tituloDeProducto } from './catalogo/normalizar';
import { centimosDeMonto, formatearPrecio, montoParaCampo, precioDe } from './comun/dinero';
import { crearCuentaSchema, whatsappSchema } from './equipo/equipo.schemas';
import { enviarMensajeSchema, historialSchema } from './mensajes/mensajes.schemas';
import { conNombreDeTienda } from './mensajes/mensajes.types';
import { editarOfertaSchema, PORTADA_AJENA, publicarSchema } from './ofertas/ofertas.schemas';
import { portadaDeOferta } from './ofertas/ofertas.types';
import {
  crearSolicitudSchema,
  horarioATexto,
  rucSchema,
  rucValido,
} from './registro/registro.schemas';
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
      tal_cual: false,
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
    expect(centimosDeMonto('1.699.900')).toBe(169990000);
    expect(centimosDeMonto('1,699,900.50')).toBe(169990050);
  });

  it('no adivina cuando los separadores se contradicen (antes leía 100 veces más)', () => {
    expect(centimosDeMonto('1.699.90')).toBeNull();
    expect(centimosDeMonto('1,699,90')).toBeNull();
    expect(centimosDeMonto('12,34,567')).toBeNull();
    expect(centimosDeMonto('1.69.900,50')).toBeNull();
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

describe('portada de la publicación (docs/17 §5)', () => {
  const igual = {
    producto_id: '6f1c2b8e-1d2a-4c3b-9e4f-5a6b7c8d9e0f',
    condicion: 'USADO',
    stock: 2,
  };
  const tuya = '2026/11/0b6c3d2e-8f7a-4b1c-9d0e-1f2a3b4c5d6e.webp';
  const otra = '2026/11/1c7d4e3f-9a8b-4c2d-8e1f-2a3b4c5d6e7f.webp';

  it('al publicar es una de tus fotos, nula (la del catálogo) o no llega', () => {
    expect(publicarSchema.parse({ ...igual, fotos: [tuya], portada: tuya }).portada).toBe(tuya);
    expect(publicarSchema.parse({ ...igual, fotos: [tuya], portada: null }).portada).toBeNull();
    expect(publicarSchema.parse({ ...igual, fotos: [tuya] })).not.toHaveProperty('portada');
  });

  it('al publicar no acepta otra foto ni algo que no es una foto', () => {
    for (const portada of [otra, '../../.env', '']) {
      const resultado = publicarSchema.safeParse({ ...igual, fotos: [tuya], portada });
      expect(resultado.error?.issues).toContainEqual(
        expect.objectContaining({ path: ['portada'], message: PORTADA_AJENA }),
      );
    }
    // Sin fotos propias no hay qué elegir.
    expect(publicarSchema.safeParse({ ...igual, portada: tuya }).success).toBe(false);
  });

  it('al editar la elige entre las fotos que llegan; si no llegan, la revisa la API', () => {
    expect(editarOfertaSchema.parse({ portada: null })).toEqual({ portada: null });
    expect(editarOfertaSchema.parse({ portada: tuya })).toEqual({ portada: tuya });
    expect(editarOfertaSchema.parse({ fotos: [otra, tuya], portada: tuya })).toEqual({
      fotos: [otra, tuya],
      portada: tuya,
    });
    const quitada = editarOfertaSchema.safeParse({ fotos: [otra], portada: tuya });
    expect(quitada.error?.issues[0]).toMatchObject({ path: ['portada'], message: PORTADA_AJENA });
  });

  it('la que se ve: la elegida, la del catálogo o la primera de la tienda', () => {
    const fotos = [{ ruta: otra, ancho: 1, alto: 1 }];
    expect(portadaDeOferta({ portada: tuya, fotos, producto: { foto: 'catalogo.webp' } })).toBe(
      tuya,
    );
    expect(portadaDeOferta({ portada: null, fotos, producto: { foto: 'catalogo.webp' } })).toBe(
      'catalogo.webp',
    );
    expect(portadaDeOferta({ portada: null, fotos, producto: { foto: null } })).toBe(otra);
    expect(portadaDeOferta({ portada: null, fotos: [], producto: { foto: null } })).toBeNull();
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

describe('RUC', () => {
  it('acepta los de SUNAT y descarta errores de tipeo con el dígito de control', () => {
    expect(rucValido('20512345671')).toBe(true);
    expect(rucValido('20512345678')).toBe(false);
    expect(rucValido('10456789126')).toBe(rucValido('10456789126'));
    // Debe empezar con 10, 15, 16, 17 o 20, y tener 11 dígitos.
    expect(rucValido('30512345671')).toBe(false);
    expect(rucValido('2051234567')).toBe(false);
  });

  it('el esquema da el mensaje en español', () => {
    expect(rucSchema.safeParse('1234').success).toBe(false);
    expect(rucSchema.parse(' 20512345671 ')).toBe('20512345671');
  });
});

describe('horarioATexto', () => {
  const h = (dias: string[], desde: string, hasta: string) =>
    horarioATexto({ dias: dias as never, desde, hasta });

  it('junta los días seguidos con «a» y pone a. m. y p. m.', () => {
    expect(h(['lun', 'mar', 'mie', 'jue', 'vie', 'sab'], '10:00', '20:00')).toBe(
      'Lun a sáb, de 10:00 a. m. a 8:00 p. m.',
    );
    expect(h(['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'], '09:30', '18:00')).toBe(
      'Lun a dom, de 9:30 a. m. a 6:00 p. m.',
    );
  });

  it('separa los días sueltos y las parejas', () => {
    expect(h(['lun', 'mie', 'vie'], '10:00', '13:00')).toBe(
      'Lun, Mié, Vie, de 10:00 a. m. a 1:00 p. m.',
    );
    expect(h(['sab', 'dom'], '12:00', '14:00')).toBe('Sáb y dom, de 12:00 p. m. a 2:00 p. m.');
    // Sin importar el orden en que se marcaron.
    expect(h(['vie', 'lun', 'mar'], '10:00', '20:00')).toBe(
      'Lun y mar, Vie, de 10:00 a. m. a 8:00 p. m.',
    );
  });
});

describe('crearSolicitudSchema', () => {
  /** Lo común a todas las formas de acreditar la tienda. */
  const comun = {
    token_celular: 'a'.repeat(43),
    nombre_comercial: 'Tienda Nueva',
    categorias: ['Gráficas'],
    galeria: 'cyberplaza',
    galeria_otra: null,
    piso: null,
    stand: '118',
    referencia: null,
    horario: { dias: ['lun'], desde: '10:00', hasta: '20:00' },
    encargado: 'Rosa Mendoza',
    clave: 'una-clave-larga-1',
    acepta_terminos: true,
  };
  const conDni = { ...comun, metodo: 'SIN_RUC_DNI', dni: '45678912' };
  const ok = (datos: object) => crearSolicitudSchema.safeParse(datos).success;

  it('pide lo que corresponde a cada forma de acreditar la tienda', () => {
    expect(ok(conDni)).toBe(true);
    expect(ok({ ...conDni, dni: '123' })).toBe(false);
    expect(ok({ ...comun, metodo: 'RUC' })).toBe(false);
    expect(ok({ ...comun, metodo: 'RUC', ruc: '20512345671' })).toBe(true);
    expect(
      ok({ ...comun, metodo: 'SIN_RUC_RECOMENDACION', recomienda_tienda: 'Computer Shock' }),
    ).toBe(true);
    expect(ok({ ...comun, metodo: 'SIN_RUC_CREDENCIAL' })).toBe(true);
    // Un dato de otra forma de acreditar no se cuela.
    expect(ok({ ...comun, metodo: 'SIN_RUC_CREDENCIAL', dni: '45678912' })).toBe(false);
  });

  it('una galería de la lista o el nombre de otra, nunca las dos ni ninguna', () => {
    expect(ok({ ...conDni, galeria: null })).toBe(false);
    expect(ok({ ...conDni, galeria: null, galeria_otra: 'Galería Nueva' })).toBe(true);
    expect(ok({ ...conDni, galeria_otra: 'Otra' })).toBe(false);
  });

  it('cierra después de abrir y exige los términos y una categoría', () => {
    expect(ok({ ...conDni, horario: { dias: ['lun'], desde: '20:00', hasta: '10:00' } })).toBe(
      false,
    );
    expect(ok({ ...conDni, acepta_terminos: false })).toBe(false);
    expect(ok({ ...conDni, categorias: [] })).toBe(false);
  });
});

describe('conNombreDeTienda (respuestas rápidas, N11)', () => {
  it('pone el nombre de la otra tienda donde va la ficha', () => {
    expect(conNombreDeTienda('Hola, {tienda}, ¿qué tal? 👋', 'Pegasus5000')).toBe(
      'Hola, Pegasus5000, ¿qué tal? 👋',
    );
    expect(conNombreDeTienda('Te lo separo', 'Pegasus5000')).toBe('Te lo separo');
  });

  it('sin nombre (tienda reservada) quita la ficha y su coma', () => {
    expect(conNombreDeTienda('Hola, {tienda}, ¿qué tal? 👋', null)).toBe('Hola, ¿qué tal? 👋');
    expect(conNombreDeTienda('Gracias, {tienda}.', null)).toBe('Gracias.');
    expect(conNombreDeTienda('En breve te confirmo, {tienda}', null)).toBe('En breve te confirmo');
  });

  it('«Responder» viaja con el id del mensaje citado', () => {
    const id = '0b6c3d2e-8f7a-4b1c-9d0e-1f2a3b4c5d6e';
    expect(enviarMensajeSchema.parse({ texto: 'Sí', responde_a: id })).toEqual({
      texto: 'Sí',
      foto: undefined,
      responde_a: id,
    });
  });
});
