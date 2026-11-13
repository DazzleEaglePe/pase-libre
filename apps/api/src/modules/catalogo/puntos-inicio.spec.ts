import { describe, expect, it } from 'vitest';

import {
  chapitaDe,
  compararPorPuntos,
  diaDeLaSemanaEnLima,
  ordenarConTope,
  puntosDe,
  puntosDeNovedad,
  puntosDeResenas,
  topePorFila,
  type DatosDePuntos,
} from './puntos-inicio';

const AHORA = new Date('2026-11-14T15:00:00Z');
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * 60_000);

const base: DatosDePuntos = {
  creadaEn: hace(5 * 24 * 60),
  actualizadaEn: hace(60),
  masBarato: false,
  muyBuscado: false,
  bajo: false,
  resenas: 0,
  respondeRapido: false,
  diaFundadora: false,
  destacada: null,
  reportesAbiertos: 0,
};

/** El orden del Inicio por puntos (doc 20, punto 4b). */
describe('puntos del Inicio', () => {
  it('la novedad suma 40, 25, 15 o 5 según cuánto hace que se publicó', () => {
    expect(puntosDeNovedad(hace(20), AHORA)).toBe(40);
    expect(puntosDeNovedad(hace(21), AHORA)).toBe(25);
    expect(puntosDeNovedad(hace(6 * 60), AHORA)).toBe(25);
    expect(puntosDeNovedad(hace(24 * 60), AHORA)).toBe(15);
    expect(puntosDeNovedad(hace(3 * 24 * 60), AHORA)).toBe(5);
    expect(puntosDeNovedad(hace(3 * 24 * 60 + 1), AHORA)).toBe(0);
  });

  it('suma cada cosa de la tabla y resta reportes y lo viejo', () => {
    expect(puntosDe(base, AHORA)).toBe(0);
    expect(puntosDe({ ...base, masBarato: true }, AHORA)).toBe(15);
    expect(puntosDe({ ...base, muyBuscado: true }, AHORA)).toBe(10);
    expect(puntosDe({ ...base, bajo: true }, AHORA)).toBe(8);
    expect(puntosDe({ ...base, resenas: 7 }, AHORA)).toBe(7);
    expect(puntosDe({ ...base, respondeRapido: true }, AHORA)).toBe(5);
    expect(puntosDe({ ...base, diaFundadora: true }, AHORA)).toBe(25);
    expect(puntosDe({ ...base, destacada: 'SUAVE' }, AHORA)).toBe(20);
    expect(puntosDe({ ...base, destacada: 'MEDIA' }, AHORA)).toBe(40);
    expect(puntosDe({ ...base, destacada: 'FUERTE' }, AHORA)).toBe(70);
    expect(puntosDe({ ...base, reportesAbiertos: 2 }, AHORA)).toBe(-30);
    expect(puntosDe({ ...base, actualizadaEn: hace(15 * 24 * 60) }, AHORA)).toBe(-10);
  });

  it('las reseñas van de 0 a 10, y sin opiniones no suman', () => {
    expect(puntosDeResenas(0, 3.5)).toBe(0);
    expect(puntosDeResenas(30, 5)).toBe(10);
    expect(puntosDeResenas(30, 1)).toBe(0);
    expect(puntosDeResenas(3, 4)).toBe(8);
  });

  it('empates: lo más nuevo primero y después el id', () => {
    const a = { id: 'a', puntos: 10, creadaEn: hace(10) };
    const b = { id: 'b', puntos: 10, creadaEn: hace(5) };
    const c = { id: 'c', puntos: 10, creadaEn: hace(5) };
    const d = { id: 'd', puntos: 12, creadaEn: hace(60) };
    expect([a, c, b, d].sort(compararPorPuntos).map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});

/** Las chapitas (doc 20, punto 22): una sola, en su orden de prioridad. */
describe('chapitaDe', () => {
  it('Recién publicado gana a todo, pero solo hasta los 20 minutos', () => {
    const todo = { ...base, masBarato: true, muyBuscado: true, bajo: true };
    expect(chapitaDe({ ...todo, creadaEn: hace(20) }, AHORA)).toBe('RECIEN');
    expect(chapitaDe({ ...todo, creadaEn: hace(21) }, AHORA)).toBe('MAS_BARATO');
  });

  it('después Más barato, Muy buscado y Bajó de precio', () => {
    expect(chapitaDe({ ...base, muyBuscado: true, bajo: true }, AHORA)).toBe('MUY_BUSCADO');
    expect(chapitaDe({ ...base, bajo: true }, AHORA)).toBe('BAJO');
    expect(chapitaDe(base, AHORA)).toBeNull();
  });
});

const de = (...tiendas: string[]) => tiendas.map((tiendaId, n) => ({ id: `o${n}`, tiendaId }));
const filas = (lista: Array<{ tiendaId: string }>, porFila = 5) => {
  const resultado: string[] = [];
  for (let i = 0; i < lista.length; i += porFila) {
    resultado.push(
      lista
        .slice(i, i + porFila)
        .map((o) => o.tiendaId)
        .join(''),
    );
  }
  return resultado;
};

/** El tope por tienda en cada fila (doc 20, punto 4b). */
describe('ordenarConTope', () => {
  it('el tope depende de cuántas tiendas publican: 3, 2 o 1', () => {
    expect(topePorFila(1)).toBe(3);
    expect(topePorFila(4)).toBe(3);
    expect(topePorFila(5)).toBe(2);
    expect(topePorFila(7)).toBe(2);
    expect(topePorFila(14)).toBe(2);
    expect(topePorFila(15)).toBe(1);
  });

  it('lo que pasa el tope se salta y queda primero para la fila siguiente', () => {
    // Con 7 tiendas el tope es 2: la tercera D espera a la fila 2 y la abre.
    const orden = ordenarConTope(de('D', 'D', 'D', 'A', 'B', 'C', 'E', 'F', 'G', 'D'), 5);
    expect(filas(orden)).toEqual(['DADBC', 'DEFGD']);
  });

  it('nunca deja huecos: si no quedan de otras tiendas, completa con lo que hay', () => {
    const orden = ordenarConTope(de('D', 'D', 'D', 'D', 'A'), 5, 2);
    expect(orden).toHaveLength(5);
    expect(filas(orden)).toEqual(['DADDD']);
  });

  it('una tienda con 14 y otras 6 con varias: ninguna fila con más de 2 de ella', () => {
    const otras = ['A', 'B', 'C', 'E', 'F', 'G'].flatMap((t) => [t, t, t, t]);
    const orden = ordenarConTope(de(...Array(14).fill('D'), ...otras), 5);
    expect(orden).toHaveLength(14 + 24);
    for (const fila of filas(orden)) {
      expect([...fila].filter((t) => t === 'D').length).toBeLessThanOrEqual(2);
    }
    expect(new Set(orden.map((o) => o.id)).size).toBe(38);
  });

  it('dentro de la fila no quedan dos de la misma juntas', () => {
    const orden = ordenarConTope(de('A', 'A', 'B', 'C', 'E'), 5, 2);
    expect(filas(orden)).toEqual(['ABACE']);
  });
});

describe('diaDeLaSemanaEnLima', () => {
  it('usa la hora de Lima: el sábado a las 11 p. m. de Lima ya es domingo en UTC', () => {
    expect(diaDeLaSemanaEnLima(new Date('2026-11-16T15:00:00Z'))).toBe(1);
    expect(diaDeLaSemanaEnLima(new Date('2026-11-15T04:00:00Z'))).toBe(6);
    expect(diaDeLaSemanaEnLima(new Date('2026-11-15T15:00:00Z'))).toBe(7);
  });
});
