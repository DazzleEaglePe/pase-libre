import { describe, expect, it } from 'vitest';

import {
  debePreguntarTrato,
  escribiendoSchema,
  hablaDeCerrarTrato,
  textoParaBuscar,
  type DatosTrato,
} from './mensajes/chat-vivo.js';
import type { TipoMensaje } from './mensajes/mensajes.types.js';

const HORA = 3_600_000;

function mensajes(textos: Array<string | null>, desde = Date.parse('2026-11-13T10:00:00Z')) {
  return textos.map((texto, i) => ({
    tipo: 'TEXTO' as TipoMensaje,
    texto,
    creado_en: new Date(desde + i * 60_000).toISOString(),
  }));
}

const base = (cambios: Partial<DatosTrato> = {}): DatosTrato => ({
  mensajes: mensajes(['Hola', '¿Sigue?', 'Sí', '¿A cuánto me la dejas?', '950', 'Ok']),
  vendido: false,
  hay_stock: true,
  pospuesta_en: null,
  descartada: false,
  ahora: new Date('2026-11-13T11:00:00Z'),
  ...cambios,
});

/** «¿Lograste cerrar el trato?» (doc 19, punto 17): las palabras se buscan sin tildes ni mayúsculas. */
describe('hablaDeCerrarTrato', () => {
  it('encuentra las palabras sin tildes, mayúsculas ni signos', () => {
    expect(textoParaBuscar('¿A CUÁNTO me la dejas?')).toBe('a cuanto me la dejas');
    expect(hablaDeCerrarTrato('¿A CUÁNTO me la dejas?')).toBe(true);
    expect(hablaDeCerrarTrato('Para ti 950, ÚLTIMO')).toBe(true);
    expect(hablaDeCerrarTrato('Ya, sepárala. Paso en 10 y te yapeo')).toBe(true);
    expect(hablaDeCerrarTrato('Te la separo hasta las 5')).toBe(true);
    expect(hablaDeCerrarTrato('Paso a recoger mañana')).toBe(true);
    expect(hablaDeCerrarTrato('Te hago plin')).toBe(true);
    expect(hablaDeCerrarTrato('Ya te transferí')).toBe(true);
    expect(hablaDeCerrarTrato('¡Listo!')).toBe(true);
    expect(hablaDeCerrarTrato('Trato hecho')).toBe(true);
    expect(hablaDeCerrarTrato('¿Cerramos?')).toBe(true);
  });

  it('no se confunde con palabras que solo las contienen', () => {
    expect(hablaDeCerrarTrato('Hola, ¿sigue disponible?')).toBe(false);
    expect(hablaDeCerrarTrato('Está preparado')).toBe(false);
    expect(hablaDeCerrarTrato('Me parece maltrato')).toBe(false);
    expect(hablaDeCerrarTrato(null)).toBe(false);
  });
});

describe('debePreguntarTrato', () => {
  it('sale con 6 mensajes y una palabra', () => {
    expect(debePreguntarTrato(base())).toBe(true);
  });

  it('no sale con menos de 6 mensajes, ni contando los del sistema', () => {
    const cinco = mensajes(['Hola', '¿A cuánto?', '950', 'Ok', 'Va']);
    expect(debePreguntarTrato(base({ mensajes: cinco }))).toBe(false);
    const conSistema = [...cinco, { ...cinco[0]!, tipo: 'SISTEMA' as TipoMensaje }];
    expect(debePreguntarTrato(base({ mensajes: conSistema }))).toBe(false);
  });

  it('no sale sin ninguna palabra', () => {
    const sinPalabras = mensajes(['Hola', '¿Sigue?', 'Sí', 'Ok', 'Gracias', 'Chau']);
    expect(debePreguntarTrato(base({ mensajes: sinPalabras }))).toBe(false);
  });

  it('no sale si ya está vendido, sin stock o con la X', () => {
    expect(debePreguntarTrato(base({ vendido: true }))).toBe(false);
    expect(debePreguntarTrato(base({ hay_stock: false }))).toBe(false);
    expect(debePreguntarTrato(base({ descartada: true }))).toBe(false);
  });

  it('«Todavía no»: vuelve a las 24 h, solo si siguieron hablando', () => {
    const lista = mensajes(['Hola', '¿Sigue?', 'Sí', '¿A cuánto?', '950', 'Ok']);
    const pospuesta = '2026-11-13T10:30:00Z';
    // Antes de las 24 h, nunca.
    expect(
      debePreguntarTrato(
        base({ mensajes: lista, pospuesta_en: pospuesta, ahora: new Date('2026-11-14T10:00:00Z') }),
      ),
    ).toBe(false);
    // A las 24 h, sin mensajes después de «Todavía no», tampoco.
    const despues = new Date(Date.parse(pospuesta) + 25 * HORA);
    expect(
      debePreguntarTrato(base({ mensajes: lista, pospuesta_en: pospuesta, ahora: despues })),
    ).toBe(false);
    // Si siguieron hablando, sí.
    const siguieron = [
      ...lista,
      { tipo: 'TEXTO' as TipoMensaje, texto: '¿Y?', creado_en: '2026-11-14T09:00:00Z' },
    ];
    expect(
      debePreguntarTrato(base({ mensajes: siguieron, pospuesta_en: pospuesta, ahora: despues })),
    ).toBe(true);
  });
});

describe('escribiendoSchema', () => {
  it('acepta un chat entre tiendas o el hilo con el Equipo, y nada más', () => {
    const id = '0b7a4b00-0000-4000-8000-000000000001';
    expect(escribiendoSchema.safeParse({ conversacion_id: id }).success).toBe(true);
    expect(escribiendoSchema.safeParse({ equipo: true }).success).toBe(true);
    expect(escribiendoSchema.safeParse({ equipo: true, tienda_id: id }).success).toBe(true);
    expect(escribiendoSchema.safeParse({ conversacion_id: id, borro: true }).success).toBe(true);
    expect(escribiendoSchema.safeParse({ conversacion_id: id, borro: false }).success).toBe(false);
    expect(escribiendoSchema.safeParse({ conversacion_id: 'x' }).success).toBe(false);
    expect(escribiendoSchema.safeParse({ conversacion_id: id, otro: 1 }).success).toBe(false);
    expect(escribiendoSchema.safeParse(null).success).toBe(false);
  });
});
