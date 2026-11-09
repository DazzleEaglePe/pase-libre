import { TIENDA_RESERVADA } from '@paselibre/contracts';
import { describe, expect, it } from 'vitest';

import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { precioPara, tiendaPara } from './visibilidad';

const DUENA = 'tienda-duena';
const visitante = { audiencia: 'visitante' } as Mirada;
const otraTienda = { audiencia: 'vendedor', tiendaId: 'otra', usuarioId: 'u2' } as Mirada;
const duena = { audiencia: 'vendedor', tiendaId: DUENA, usuarioId: 'u1' } as Mirada;
const equipo = { audiencia: 'equipo', usuarioId: 'u3' } as Mirada;

const oferta = (
  cambios: Partial<{
    precioVisible: boolean;
    tiendaVisible: boolean;
    precioCentimos: bigint | null;
  }> = {},
) => ({
  precioCentimos: 25000n as bigint | null,
  moneda: 'USD' as const,
  precioVisible: true,
  tiendaVisible: true,
  tiendaId: DUENA,
  ...cambios,
});
const tienda = { id: DUENA, nombre: 'Tienda B', stand: '101' };

describe('precioPara («Quién ve qué», docs/05 §5)', () => {
  it('un visitante nunca ve un precio', () => {
    expect(precioPara(oferta(), visitante)).toBeNull();
  });

  it('el precio visible lo ve cualquier tienda con sesión', () => {
    expect(precioPara(oferta(), otraTienda)).toMatchObject({ moneda: 'USD', centimos: 25000 });
  });

  it('el precio oculto («al interno») solo lo ven la dueña y el equipo', () => {
    const oculto = oferta({ precioVisible: false });
    expect(precioPara(oculto, otraTienda)).toBeNull();
    expect(precioPara(oculto, duena)?.centimos).toBe(25000);
    expect(precioPara(oculto, equipo)?.centimos).toBe(25000);
  });

  it('sin precio cargado no inventa uno', () => {
    expect(precioPara(oferta({ precioCentimos: null }), duena)).toBeNull();
  });
});

describe('tiendaPara (tienda reservada)', () => {
  it('visible, la ve cualquiera que la reciba', () => {
    expect(tiendaPara(oferta(), tienda, otraTienda)).toEqual(tienda);
  });

  it('reservada, otra tienda no recibe ni el id ni el stand', () => {
    expect(tiendaPara(oferta({ tiendaVisible: false }), tienda, otraTienda)).toEqual({
      id: '',
      nombre: TIENDA_RESERVADA,
      stand: null,
    });
  });

  it('reservada, la dueña y el equipo la siguen viendo', () => {
    expect(tiendaPara(oferta({ tiendaVisible: false }), tienda, duena)).toEqual(tienda);
    expect(tiendaPara(oferta({ tiendaVisible: false }), tienda, equipo)).toEqual(tienda);
  });
});
