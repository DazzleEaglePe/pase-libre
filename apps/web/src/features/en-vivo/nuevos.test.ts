import type { EnVivoConVendedor, EnVivoPublico } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import { conLosNuevosPrimero, pedidosQueEntran } from './nuevos';

const AHORA = Date.parse('2026-11-13T15:00:00-05:00');
const haceMin = (minutos: number) => new Date(AHORA - minutos * 60_000).toISOString();

function publico(id: string, creadoHaceMin = 0): EnVivoPublico {
  return {
    id,
    tipo: 'BUSCO',
    titulo: `Pedido ${id}`,
    categoria: { slug: 'graficas', nombre: 'Tarjetas de video' },
    producto: null,
    foto: null,
    fotos: [],
    cantidad: 1,
    condicion: null,
    galeria: null,
    vence_en: new Date(AHORA + 3_600_000).toISOString(),
    creado_en: haceMin(creadoHaceMin),
    estado: 'VIVO',
    cerrado_en: null,
  };
}

function conVendedor(id: string, propio: boolean, creadoHaceMin = 0): EnVivoConVendedor {
  return {
    ...publico(id, creadoHaceMin),
    tienda: { nombre: propio ? 'Mi tienda' : 'Otra', stand: null },
    precio: null,
    nota: null,
    propio,
    mio: propio,
    respondiste: false,
    conversacion_id: null,
    respuestas: 0,
  };
}

describe('El pedido en vivo que entra (doc 19, punto 22)', () => {
  it('entran los que no estaban, el más nuevo primero', () => {
    const conocidos = new Set(['a']);
    const lista = [publico('a'), publico('b', 2), publico('c', 1)];
    expect(pedidosQueEntran(conocidos, lista, AHORA)).toEqual(['c', 'b']);
  });

  it('nunca para el que publica: lo de tu tienda entra callado', () => {
    const lista = [conVendedor('mio', true), conVendedor('ajeno', false)];
    expect(pedidosQueEntran(new Set(), lista, AHORA)).toEqual(['ajeno']);
  });

  it('uno viejo que vuelve a la lista no brilla', () => {
    expect(pedidosQueEntran(new Set(), [publico('viejo', 30)], AHORA)).toEqual([]);
  });

  it('los que entraron van adelante (el último primero); el resto, en su orden', () => {
    const lista = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(conLosNuevosPrimero(lista, ['d', 'b']).map((item) => item.id)).toEqual([
      'd',
      'b',
      'a',
      'c',
    ]);
    // Uno que ya se cerró no aparece.
    expect(conLosNuevosPrimero(lista, ['x']).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
