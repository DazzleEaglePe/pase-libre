import { describe, expect, it } from 'vitest';

import { diasATexto, horarioTiendaSchema, leerHorarioEscrito, textoHorario } from './horario';
import {
  calcularReputacion,
  estrellasPonderadas,
  nivelDePuntaje,
  opinionBaja,
  pesoPorAntiguedad,
  puntajeRapidez,
  siguienteInsignia,
  type DatosReputacion,
} from './reputacion';

const AHORA = new Date('2026-11-12T15:00:00Z');
const haceDias = (dias: number) => new Date(AHORA.getTime() - dias * 86_400_000);
const opiniones = (estrellas: number[], dias = 1) =>
  estrellas.map((n) => ({ estrellas: n, creada_en: haceDias(dias) }));
const datos = (cambios: Partial<DatosReputacion>): DatosReputacion => ({
  opiniones: [],
  pases_60: 10,
  responde_en: 10,
  respondidos: 100,
  ahora: AHORA,
  ...cambios,
});

describe('calcularReputacion', () => {
  it('sin nivel hasta tener 5 opiniones, aunque sean todas de 5', () => {
    expect(calcularReputacion(datos({ opiniones: opiniones([5, 5, 5, 5]) }))).toEqual({
      nivel: null,
      puntaje: null,
    });
    expect(
      calcularReputacion(datos({ opiniones: opiniones([5, 5, 5, 5, 5]) })).nivel,
    ).not.toBeNull();
  });

  it('el ejemplo del lienzo (4,8 de 23, 18 pases, ~10 min, 96 %) es «Muy buena»', () => {
    const lista = opiniones([...Array(19).fill(5), 4, 4, 4, 4]);
    const resultado = calcularReputacion(
      datos({ opiniones: lista, pases_60: 18, responde_en: 10, respondidos: 96 }),
    );
    expect(resultado.nivel).toBe('MUY_BUENA');
  });

  it('con muchas opiniones de 5, muchos pases y respuesta rápida llega a «Excelente»', () => {
    const resultado = calcularReputacion(
      datos({ opiniones: opiniones(Array(40).fill(5)), pases_60: 45, responde_en: 5 }),
    );
    expect(resultado.nivel).toBe('EXCELENTE');
  });

  it('un solo 5 no te pone arriba', () => {
    const malas = opiniones([2, 2, 2, 2, 2], 10);
    const antes = calcularReputacion(datos({ opiniones: malas, pases_60: 5 }));
    const despues = calcularReputacion(
      datos({ opiniones: [...malas, ...opiniones([5], 0)], pases_60: 5 }),
    );
    expect(despues.nivel).toBe(antes.nivel);
    expect(despues.nivel).toBe('REGULAR');
  });

  it('un solo 1 no te hunde', () => {
    const buenas = opiniones(Array(10).fill(5), 10);
    const antes = calcularReputacion(datos({ opiniones: buenas }));
    const despues = calcularReputacion(datos({ opiniones: [...buenas, ...opiniones([1], 0)] }));
    expect(antes.nivel).toBe('MUY_BUENA');
    expect(despues.nivel).toBe('MUY_BUENA');
  });

  it('lo reciente pesa más: las malas de hace un año cuentan menos que las de ayer', () => {
    const mejoro = [...opiniones([1, 1, 1], 365), ...opiniones([5, 5, 5], 1)];
    const empeoro = [...opiniones([5, 5, 5], 365), ...opiniones([1, 1, 1], 1)];
    expect(estrellasPonderadas(mejoro, AHORA)).toBeGreaterThan(estrellasPonderadas(empeoro, AHORA));
    const a = calcularReputacion(datos({ opiniones: [...mejoro, ...opiniones([4, 4], 1)] }));
    const b = calcularReputacion(datos({ opiniones: [...empeoro, ...opiniones([4, 4], 1)] }));
    expect(a.puntaje!).toBeGreaterThan(b.puntaje!);
  });

  it('muchas opiniones de 1 y 2 dan «Baja»', () => {
    const resultado = calcularReputacion(
      datos({ opiniones: opiniones([1, 1, 2, 1, 2, 1, 1, 2]), pases_60: 2, responde_en: 200 }),
    );
    expect(resultado.nivel).toBe('BAJA');
  });

  it('los pases cerrados y la rapidez suben o bajan el puntaje', () => {
    const lista = opiniones([5, 4, 5, 4, 5]);
    const lenta = calcularReputacion(
      datos({ opiniones: lista, pases_60: 0, responde_en: 240, respondidos: 40 }),
    );
    const rapida = calcularReputacion(
      datos({ opiniones: lista, pases_60: 30, responde_en: 5, respondidos: 100 }),
    );
    expect(rapida.puntaje!).toBeGreaterThan(lenta.puntaje!);
  });

  it('sin datos de rapidez no castiga: reparte su peso', () => {
    const lista = opiniones(Array(10).fill(5));
    const sinDatos = calcularReputacion(
      datos({ opiniones: lista, responde_en: null, respondidos: null }),
    );
    expect(sinDatos.puntaje).not.toBeNull();
    expect(sinDatos.nivel).toBe('MUY_BUENA');
  });
});

describe('piezas de la reputación', () => {
  it('el peso de una opinión baja a la mitad cada 90 días, sin pasar de 0,2', () => {
    expect(pesoPorAntiguedad(0)).toBe(1);
    expect(pesoPorAntiguedad(90)).toBeCloseTo(0.5);
    expect(pesoPorAntiguedad(2000)).toBe(0.2);
  });

  it('la rapidez: 10 min o menos es 1, 3 horas o más es 0', () => {
    expect(puntajeRapidez(5, null)).toBe(1);
    expect(puntajeRapidez(180, null)).toBe(0);
    expect(puntajeRapidez(null, 80)).toBe(0.8);
    expect(puntajeRapidez(null, null)).toBeNull();
    expect(puntajeRapidez(10, 50)).toBeCloseTo(0.8);
  });

  it('los niveles por puntaje', () => {
    expect(nivelDePuntaje(0.95)).toBe('EXCELENTE');
    expect(nivelDePuntaje(0.8)).toBe('MUY_BUENA');
    expect(nivelDePuntaje(0.65)).toBe('BUENA');
    expect(nivelDePuntaje(0.5)).toBe('REGULAR');
    expect(nivelDePuntaje(0.2)).toBe('BAJA');
  });

  it('una opinión es baja con 2 estrellas o menos', () => {
    expect(opinionBaja(1)).toBe(true);
    expect(opinionBaja(2)).toBe(true);
    expect(opinionBaja(3)).toBe(false);
  });

  it('la siguiente insignia del mes: plata a las 10 ventas y oro a las 20', () => {
    expect(siguienteInsignia(1)).toEqual({ nombre: 'plata', emoji: '🥈', meta: 10, faltan: 9 });
    expect(siguienteInsignia(12)).toMatchObject({ nombre: 'oro', meta: 20, faltan: 8 });
    expect(siguienteInsignia(20)).toBeNull();
  });
});

describe('textoHorario', () => {
  const lunASab = {
    dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'] as const,
    desde: '10:00',
    hasta: '19:00',
  };
  const tramo = (dias: string[], desde: string, hasta: string) => ({
    dias: dias as never,
    desde,
    hasta,
  });

  it('como en el lienzo: lunes a sábado y domingo cerrado', () => {
    const tramos = [tramo([...lunASab.dias], '10:00', '19:00')];
    expect(textoHorario(tramos, 'largo')).toBe('Lunes a sábado, 10:00 a 19:00 · Domingo cerrado');
    expect(textoHorario(tramos, 'corto')).toBe('Lun a sáb 10:00 a 19:00 · Dom cerrado');
    expect(textoHorario(tramos, 'cabecera')).toBe('Lun a sáb · 10:00 a 19:00');
  });

  it('con «+ Otro horario» y sin días cerrados', () => {
    const tramos = [tramo(['dom'], '11:00', '16:00'), tramo([...lunASab.dias], '10:00', '19:00')];
    expect(textoHorario(tramos, 'largo')).toBe(
      'Lunes a sábado, 10:00 a 19:00 · Domingo, 11:00 a 16:00',
    );
    expect(textoHorario(tramos, 'cabecera')).toBe('Lun a sáb 10:00 a 19:00 · Dom 11:00 a 16:00');
  });

  it('días sueltos y varios cerrados', () => {
    expect(diasATexto(['lun', 'mie', 'vie'], 'largo')).toBe('Lunes, miércoles y viernes');
    expect(
      textoHorario([tramo(['lun', 'mar', 'mie', 'jue', 'vie'], '09:00', '18:00')], 'largo'),
    ).toBe('Lunes a viernes, 09:00 a 18:00 · Sábado y domingo cerrados');
  });

  it('no deja un día en dos horarios ni cerrar antes de abrir', () => {
    expect(
      horarioTiendaSchema.safeParse([
        tramo(['lun'], '10:00', '19:00'),
        tramo(['lun'], '11:00', '12:00'),
      ]).success,
    ).toBe(false);
    expect(horarioTiendaSchema.safeParse([tramo(['lun'], '19:00', '10:00')]).success).toBe(false);
    expect(horarioTiendaSchema.safeParse([tramo(['lun', 'sab'], '10:00', '19:00')]).success).toBe(
      true,
    );
  });

  it('lee los horarios escritos a mano de antes', () => {
    const lunASab = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    expect(leerHorarioEscrito('Lunes a sábado, 10:00 a 19:00')).toEqual([
      { dias: lunASab, desde: '10:00', hasta: '19:00' },
    ]);
    expect(leerHorarioEscrito('Lun a sáb, 10 a. m. a 8 p. m.')).toEqual([
      { dias: lunASab, desde: '10:00', hasta: '20:00' },
    ]);
    expect(leerHorarioEscrito('Lun a sáb, de 10:00 a. m. a 8:30 p. m.')).toEqual([
      { dias: lunASab, desde: '10:00', hasta: '20:30' },
    ]);
    expect(leerHorarioEscrito('Todos los días de 9 a 6')).toBeNull();
    expect(leerHorarioEscrito(null)).toBeNull();
  });
});
