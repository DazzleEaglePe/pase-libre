import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GRACIA_DESCONEXION_MS, TiempoRealService } from './tiempo-real.service';

describe('presencia por tienda (N01)', () => {
  let servicio: TiempoRealService;
  let cambios: Array<[string, boolean]>;

  beforeEach(() => {
    vi.useFakeTimers();
    servicio = new TiempoRealService();
    cambios = [];
    servicio.alCambiarPresencia((tienda, enLinea) => cambios.push([tienda, enLinea]));
  });

  afterEach(() => {
    servicio.onModuleDestroy();
    vi.useRealTimers();
  });

  it('la tienda está en línea si alguna de sus personas lo está', () => {
    servicio.conecto('luis', 'tienda-a');
    servicio.conecto('kevin', 'tienda-a');
    expect(servicio.tiendaEnLinea('tienda-a')).toBe(true);
    expect(cambios).toEqual([['tienda-a', true]]);

    servicio.desconecto('luis');
    vi.advanceTimersByTime(GRACIA_DESCONEXION_MS + 1);
    expect(servicio.tiendaEnLinea('tienda-a')).toBe(true);
    expect(cambios).toHaveLength(1);

    servicio.desconecto('kevin');
    vi.advanceTimersByTime(GRACIA_DESCONEXION_MS + 1);
    expect(servicio.tiendaEnLinea('tienda-a')).toBe(false);
    expect(cambios).toEqual([
      ['tienda-a', true],
      ['tienda-a', false],
    ]);
  });

  it('al recargar (vuelve antes de 30 s) no se marca desconectada', () => {
    servicio.conecto('luis', 'tienda-a');
    servicio.desconecto('luis');
    expect(servicio.enLinea('luis')).toBe(true);
    expect(servicio.tieneSocket('luis')).toBe(false);
    vi.advanceTimersByTime(GRACIA_DESCONEXION_MS - 1_000);
    servicio.conecto('luis', 'tienda-a');
    vi.advanceTimersByTime(GRACIA_DESCONEXION_MS * 2);
    expect(servicio.tiendaEnLinea('tienda-a')).toBe(true);
    expect(cambios).toEqual([['tienda-a', true]]);
  });

  it('con dos pestañas, cerrar una no cuenta como irse', () => {
    servicio.conecto('luis', 'tienda-a');
    servicio.conecto('luis', 'tienda-a');
    servicio.desconecto('luis');
    vi.advanceTimersByTime(GRACIA_DESCONEXION_MS * 2);
    expect(servicio.tieneSocket('luis')).toBe(true);
    expect(servicio.tiendaEnLinea('tienda-a')).toBe(true);
  });

  it('el Equipo (sin tienda) no tiene presencia de tienda', () => {
    servicio.conecto('equipo');
    expect(cambios).toEqual([]);
    expect(servicio.enLinea('equipo')).toBe(true);
  });
});
