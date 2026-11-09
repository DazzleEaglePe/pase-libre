import { describe, expect, it } from 'vitest';

import { posicionDeLaFila, type MedidasFila } from './carrusel-medidas';

/** El inicio en computadora: 17 piezas de 292 px con 16 px de hueco, 4 por página. */
const COMPUTADORA: MedidasFila = {
  anchoTotal: 17 * 292 + 16 * 16 + 8,
  anchoVisible: 1216 + 8,
  desplazado: 0,
  hueco: 16,
  relleno: 8,
};

describe('posicionDeLaFila', () => {
  it('cuenta 5 páginas para 17 piezas de a 4 (la tarjeta final tiene la suya) y arranca en la primera', () => {
    const posicion = posicionDeLaFila(COMPUTADORA);
    expect(posicion.paginas).toBe(5);
    expect(posicion.pagina).toBe(0);
    expect(posicion.alInicio).toBe(true);
    expect(posicion.alFinal).toBe(false);
    expect(posicion.paso).toBe(1232);
  });

  it('avanza una página por vez y la última es la del final', () => {
    expect(posicionDeLaFila({ ...COMPUTADORA, desplazado: 1232 }).pagina).toBe(1);
    expect(posicionDeLaFila({ ...COMPUTADORA, desplazado: 2464 }).pagina).toBe(2);
    expect(posicionDeLaFila({ ...COMPUTADORA, desplazado: 3696 }).pagina).toBe(3);
    const final = posicionDeLaFila({ ...COMPUTADORA, desplazado: 4004 });
    expect(final.alFinal).toBe(true);
    expect(final.pagina).toBe(4);
    expect(final.avance).toBe(1);
  });

  it('con todo a la vista no hay nada que deslizar', () => {
    const posicion = posicionDeLaFila({ ...COMPUTADORA, anchoTotal: 1224 });
    expect(posicion.paginas).toBe(1);
    expect(posicion.alInicio).toBe(true);
    expect(posicion.alFinal).toBe(true);
    expect(posicion.maximo).toBe(0);
  });

  it('tolera el medio píxel que sobra por los decimales', () => {
    const posicion = posicionDeLaFila({ ...COMPUTADORA, anchoTotal: 1224.4 });
    expect(posicion.paginas).toBe(1);
  });

  it('en el celular hay muchas páginas, para que la fila use la barra en vez de puntos', () => {
    const celular = posicionDeLaFila({
      anchoTotal: 17 * 247 + 16 * 12 + 8,
      anchoVisible: 343 + 8,
      desplazado: 0,
      hueco: 12,
      relleno: 8,
    });
    expect(celular.paginas).toBeGreaterThan(7);
    expect(celular.visible).toBeLessThan(0.1);
  });

  it('no se sale de rango si se pasa del final', () => {
    const posicion = posicionDeLaFila({ ...COMPUTADORA, desplazado: 99999 });
    expect(posicion.pagina).toBe(posicion.paginas - 1);
    expect(posicion.avance).toBe(1);
  });
});
