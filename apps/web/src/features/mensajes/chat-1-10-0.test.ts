import type { DetalleConversacion, MensajeChat } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import { checkDeEquipo, claseDe } from './entradas';
import { mostrarTarjetaTrato } from './tarjeta-trato';

function mensaje(texto: string, minuto: number): MensajeChat {
  return {
    id: `m${minuto}`,
    tipo: 'TEXTO',
    texto,
    foto: null,
    mio: minuto % 2 === 0,
    creado_en: new Date(Date.UTC(2026, 10, 13, 10, minuto)).toISOString(),
    editado: false,
    eliminado: false,
    cambiable_hasta: null,
    autor: null,
    responde_a: null,
    pedido: null,
    whatsapp: null,
  };
}

const charla = ['Hola', '¿Sigue?', 'Sí', '¿A cuánto?', '950', 'Ok'].map(mensaje);

function detalle(cambios: Partial<DetalleConversacion> = {}): DetalleConversacion {
  return {
    rol: 'vendedor',
    venta: null,
    puede_vender: true,
    trato: { pospuesta_en: null, descartada: false, preguntar: false },
    ...cambios,
  } as DetalleConversacion;
}

/** «¿Lograste cerrar el trato?» en la pantalla (doc 19, punto 17). */
describe('mostrarTarjetaTrato', () => {
  it('sale con lo que llegó en vivo, aunque el servidor todavía no lo supiera', () => {
    expect(mostrarTarjetaTrato(detalle(), charla.slice(0, 5))).toBe(false);
    expect(mostrarTarjetaTrato(detalle(), charla)).toBe(true);
  });

  it('el «preguntar» del servidor vale aunque la pantalla tenga pocos mensajes cargados', () => {
    const trato = { pospuesta_en: null, descartada: false, preguntar: true };
    expect(mostrarTarjetaTrato(detalle({ trato }), [])).toBe(true);
  });

  it('nunca para quien compra, ya vendido, sin stock o con la X', () => {
    expect(mostrarTarjetaTrato(detalle({ rol: 'comprador', trato: null }), charla)).toBe(false);
    const venta = { id: 'v' } as DetalleConversacion['venta'];
    expect(mostrarTarjetaTrato(detalle({ venta }), charla)).toBe(false);
    expect(mostrarTarjetaTrato(detalle({ puede_vender: false }), charla)).toBe(false);
    const trato = { pospuesta_en: null, descartada: true, preguntar: true };
    expect(mostrarTarjetaTrato(detalle({ trato }), charla)).toBe(false);
  });

  it('después de «Todavía no» se esconde 24 h', () => {
    const trato = {
      pospuesta_en: new Date(Date.UTC(2026, 10, 13, 10, 30)).toISOString(),
      descartada: false,
      preguntar: false,
    };
    const ahora = new Date(Date.UTC(2026, 10, 13, 12));
    expect(mostrarTarjetaTrato(detalle({ trato }), charla, ahora)).toBe(false);
  });
});

describe('checks del chat con el Equipo (doc 19, punto 18)', () => {
  it('solo en tus mensajes, con el nombre de los otros chats', () => {
    expect(checkDeEquipo({ mio: true, estado: 'visto' })).toBe('leido');
    expect(checkDeEquipo({ mio: true, estado: 'recibido' })).toBe('recibido');
    expect(checkDeEquipo({ mio: true, estado: 'enviado' })).toBe('enviado');
    expect(checkDeEquipo({ mio: false, estado: 'visto' })).toBeNull();
    expect(checkDeEquipo({ mio: true })).toBeNull();
  });

  it('la clase de cada entrada', () => {
    expect(claseDe('llega')).toBe('chat-llega');
    expect(claseDe('sale')).toBe('chat-sale');
    expect(claseDe(null)).toBe('');
  });
});
