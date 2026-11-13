import { describe, expect, it } from 'vitest';

import {
  CAMBIO_DE_TITULO_MS,
  ESPERA_ENTRE_SONIDOS_MS,
  chatALaVista,
  enNoMolestar,
  puedeSonar,
  tituloDeLaPestana,
  type EstadoDelSonido,
} from './que-no-se-pierda';

/** Una hora de Lima (UTC−5) como `Date`. */
const enLima = (hora: string) => new Date(`2026-11-13T${hora}:00-05:00`);

describe('Que no se pierda nada (doc 19, punto 22)', () => {
  describe('cuándo suena', () => {
    const base: EstadoDelSonido = {
      activo: true,
      noMolestar: null,
      desbloqueado: true,
      ultimo: 0,
    };
    const ahora = enLima('15:00').getTime();

    it('suena prendido, desbloqueado y sin otro sonido reciente', () => {
      expect(puedeSonar(base, ahora)).toBe(true);
    });

    it('no suena con «Sonido» apagado', () => {
      expect(puedeSonar({ ...base, activo: false }, ahora)).toBe(false);
    });

    it('no suena antes del primer clic en la página', () => {
      expect(puedeSonar({ ...base, desbloqueado: false }, ahora)).toBe(false);
    });

    it('como mucho uno cada 3 s, aunque lleguen varios', () => {
      expect(ESPERA_ENTRE_SONIDOS_MS).toBe(3_000);
      expect(puedeSonar({ ...base, ultimo: ahora - 1_000 }, ahora)).toBe(false);
      expect(puedeSonar({ ...base, ultimo: ahora - 2_999 }, ahora)).toBe(false);
      expect(puedeSonar({ ...base, ultimo: ahora - 3_000 }, ahora)).toBe(true);
    });

    it('no suena en «No molestar», que puede cruzar la medianoche', () => {
      const noche = { desde: '21:00', hasta: '08:00' };
      expect(puedeSonar({ ...base, noMolestar: noche }, enLima('23:30').getTime())).toBe(false);
      expect(puedeSonar({ ...base, noMolestar: noche }, enLima('07:59').getTime())).toBe(false);
      expect(puedeSonar({ ...base, noMolestar: noche }, enLima('08:00').getTime())).toBe(true);
      expect(puedeSonar({ ...base, noMolestar: noche }, enLima('15:00').getTime())).toBe(true);
    });

    it('«No molestar» de día y sin horario', () => {
      const siesta = { desde: '13:00', hasta: '14:30' };
      expect(enNoMolestar(siesta, enLima('13:00'))).toBe(true);
      expect(enNoMolestar(siesta, enLima('14:29'))).toBe(true);
      expect(enNoMolestar(siesta, enLima('14:30'))).toBe(false);
      expect(enNoMolestar(siesta, enLima('12:59'))).toBe(false);
      expect(enNoMolestar(null, enLima('03:00'))).toBe(false);
    });

    it('no suena ni salta con ese chat abierto y a la vista', () => {
      expect(chatALaVista('/mensajes/abc', true, 'abc')).toBe(true);
      expect(chatALaVista('/mensajes/abc/', true, 'abc')).toBe(true);
      // Con la pestaña escondida, sí: no lo estás mirando.
      expect(chatALaVista('/mensajes/abc', false, 'abc')).toBe(false);
      // Otro chat abierto, la bandeja u otra página: sí.
      expect(chatALaVista('/mensajes/otro', true, 'abc')).toBe(false);
      expect(chatALaVista('/mensajes', true, 'abc')).toBe(false);
      expect(chatALaVista('/', true, 'abc')).toBe(false);
    });
  });

  describe('el título de la pestaña escondida', () => {
    it('se alterna cada 1,5 s entre «(N) Mensajes» y «💬 {tienda} te escribió»', () => {
      expect(CAMBIO_DE_TITULO_MS).toBe(1_500);
      const titulos = [0, 1, 2, 3].map((paso) => tituloDeLaPestana(paso, 2, 'Pegasus5000'));
      expect(titulos).toEqual([
        '(2) Mensajes · PaseLibre',
        '💬 Pegasus5000 te escribió',
        '(2) Mensajes · PaseLibre',
        '💬 Pegasus5000 te escribió',
      ]);
    });

    it('cuenta al menos 1 mientras llegan los contadores, y sin nombre no inventa uno', () => {
      expect(tituloDeLaPestana(0, 0, null)).toBe('(1) Mensajes · PaseLibre');
      expect(tituloDeLaPestana(1, 3, null)).toBe('💬 Tienes un mensaje nuevo');
    });
  });
});
