import type { MensajeChat } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import {
  enlaceWhatsapp,
  estadoDeCheck,
  extractoDeMensaje,
  minutosQueQuedan,
  numeroConPrefijo,
  textoActivo,
} from './estado-chat';

const mensaje = (cambios: Partial<MensajeChat>): MensajeChat => ({
  id: 'm1',
  tipo: 'TEXTO',
  texto: 'Hola',
  foto: null,
  mio: true,
  creado_en: '2026-11-12T17:00:00.000Z',
  editado: false,
  eliminado: false,
  cambiable_hasta: null,
  autor: null,
  responde_a: null,
  pedido: null,
  whatsapp: null,
  ...cambios,
});

describe('checks como WhatsApp (N01)', () => {
  const m = { creado_en: '2026-11-12T17:00:00.000Z' };

  it('un check si no le llegó, dos grises si le llegó, verdes si lo leyó', () => {
    expect(estadoDeCheck(m, null, null)).toBe('enviado');
    expect(estadoDeCheck(m, '2026-11-12T16:59:00.000Z', null)).toBe('enviado');
    expect(estadoDeCheck(m, '2026-11-12T17:00:00.000Z', null)).toBe('recibido');
    expect(estadoDeCheck(m, '2026-11-12T17:01:00.000Z', '2026-11-12T17:02:00.000Z')).toBe('leido');
  });

  it('con el «Visto» apagado (sin visto) se queda en dos grises', () => {
    expect(estadoDeCheck(m, '2026-11-12T18:00:00.000Z', null)).toBe('recibido');
  });
});

describe('«Activo ahora» que pasa solo a «Activo hace…» (N01)', () => {
  const ahora = new Date('2026-11-12T17:30:00.000Z');

  it('en línea es «Activo ahora»', () => {
    expect(textoActivo(true, null, ahora)).toBe('Activo ahora');
  });

  it('desconectada cuenta desde la última vez, nunca «hace 0 min»', () => {
    expect(textoActivo(false, '2026-11-12T17:29:50.000Z', ahora)).toBe('Activo hace 1 min');
    expect(textoActivo(false, '2026-11-12T17:25:00.000Z', ahora)).toBe('Activo hace 5 min');
    expect(textoActivo(false, '2026-11-12T14:30:00.000Z', ahora)).toBe('Activo hace 3 h');
    expect(textoActivo(false, '2026-11-10T15:00:00.000Z', ahora)).toBe('Activo hace 2 días');
    expect(textoActivo(false, null, ahora)).toBe('');
  });
});

describe('editar y WhatsApp (N01)', () => {
  it('cuenta los minutos que quedan para editar', () => {
    const ahora = new Date('2026-11-12T17:04:30.000Z');
    expect(minutosQueQuedan('2026-11-12T17:15:00.000Z', ahora)).toBe(11);
    expect(minutosQueQuedan('2026-11-12T17:00:00.000Z', ahora)).toBe(0);
    expect(minutosQueQuedan(null, ahora)).toBe(0);
  });

  it('muestra el número con +51 y arma el enlace de WhatsApp', () => {
    expect(numeroConPrefijo('987654321')).toBe('+51 987 654 321');
    expect(enlaceWhatsapp('987654321')).toBe('https://wa.me/51987654321');
  });
});

describe('el último mensaje en la lista', () => {
  it('dice qué pasó sin mostrar lo que se eliminó', () => {
    expect(extractoDeMensaje(mensaje({ eliminado: true, texto: null }))).toBe(
      'Eliminaste este mensaje',
    );
    expect(extractoDeMensaje(mensaje({ eliminado: true, texto: null, mio: false }))).toBe(
      'Se eliminó este mensaje',
    );
    expect(extractoDeMensaje(mensaje({ tipo: 'PEDIDO_WHATSAPP', texto: null, mio: false }))).toBe(
      'Te pidió tu WhatsApp',
    );
    expect(extractoDeMensaje(mensaje({ tipo: 'WHATSAPP', texto: null }))).toBe(
      'Compartiste tu WhatsApp',
    );
    expect(extractoDeMensaje(mensaje({ texto: 'Te lo separo' }))).toBe('Tú: Te lo separo');
  });
});
