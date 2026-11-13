import type { DetalleConversacion } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import { lineaDeOferta } from './conversacion';

const oferta = (cambios: Partial<DetalleConversacion['oferta']>) =>
  ({
    oferta: {
      stock: 2,
      estado: 'ACTIVA',
      separada: false,
      precio: { moneda: 'PEN', centimos: 238_000, monto: '2380.00' },
      precio_visible: true,
      ...cambios,
    },
  }) as Pick<DetalleConversacion, 'oferta'>;

/** En el chat, «Pausada» pasa a «Separada» o «No disponible» (doc 20, punto 16). */
describe('chat: la línea del producto de arriba', () => {
  it('separada para un cliente dice «Separada»', () => {
    expect(lineaDeOferta(oferta({ estado: 'PAUSADA', separada: true }))).toMatch(/· Separada$/);
  });

  it('oculta por otro motivo dice «No disponible»', () => {
    const linea = lineaDeOferta(oferta({ estado: 'PAUSADA' }));
    expect(linea).toMatch(/· No disponible$/);
    expect(linea).not.toContain('Pausada');
  });

  it('activa no dice nada de eso; sin stock dice «Sin stock»', () => {
    expect(lineaDeOferta(oferta({}))).toMatch(/· 2 en stock$/);
    expect(lineaDeOferta(oferta({ stock: 0 }))).toMatch(/· Sin stock$/);
  });
});
