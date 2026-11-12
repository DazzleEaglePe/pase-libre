import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoriaPorClave, recordarPor } from './memoria';

describe('recordarPor', () => {
  // En las pruebas no guarda nada (cada e2e espera ver al instante lo que crea): aquí sí.
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
  afterEach(() => vi.unstubAllEnvs());

  it('pide una vez por ventana, y los pedidos simultáneos comparten la consulta', async () => {
    const cargar = vi.fn(async () => 42);
    const leer = recordarPor(60_000, cargar);
    const [a, b] = await Promise.all([leer(), leer()]);
    expect([a, b, await leer()]).toEqual([42, 42, 42]);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('vuelve a pedir cuando vence', async () => {
    vi.useFakeTimers();
    const cargar = vi.fn(async () => Date.now());
    const leer = recordarPor(1_000, cargar);
    await leer();
    vi.advanceTimersByTime(1_500);
    await leer();
    expect(cargar).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('si falla no guarda el error', async () => {
    let veces = 0;
    const leer = recordarPor(60_000, async () => {
      veces += 1;
      if (veces === 1) throw new Error('la base no respondió');
      return 'bien';
    });
    await expect(leer()).rejects.toThrow('la base no respondió');
    await expect(leer()).resolves.toBe('bien');
  });

  it('en las pruebas no guarda', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    const cargar = vi.fn(async () => 1);
    const leer = recordarPor(60_000, cargar);
    await leer();
    await leer();
    expect(cargar).toHaveBeenCalledTimes(2);
  });
});

describe('MemoriaPorClave', () => {
  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
  afterEach(() => vi.unstubAllEnvs());

  it('distingue «no está» de «está y es nulo»', () => {
    const memoria = new MemoriaPorClave<number | null>(60_000);
    expect(memoria.tiene('a')).toBe(false);
    memoria.guardar('a', null);
    expect(memoria.tiene('a')).toBe(true);
    expect(memoria.leer('a')).toBeNull();
  });

  it('no crece sin fin', () => {
    const memoria = new MemoriaPorClave<number>(60_000, 3);
    for (let i = 0; i < 10; i++) memoria.guardar(`t${i}`, i);
    expect(memoria.leer('t9')).toBe(9);
    expect(memoria.tiene('t0')).toBe(false);
  });

  it('al llenarse saca la más antigua, no todas', () => {
    const memoria = new MemoriaPorClave<number>(60_000, 3);
    for (let i = 0; i < 4; i++) memoria.guardar(`t${i}`, i);
    expect([0, 1, 2, 3].map((i) => memoria.tiene(`t${i}`))).toEqual([false, true, true, true]);
  });

  it('con «recordar», los pedidos a la vez de una clave comparten la consulta', async () => {
    const memoria = new MemoriaPorClave<number>(60_000);
    const cargar = vi.fn(async () => 7);
    const [a, b] = await Promise.all([
      memoria.recordar('a', cargar),
      memoria.recordar('a', cargar),
    ]);
    expect([a, b, await memoria.recordar('a', cargar)]).toEqual([7, 7, 7]);
    expect(cargar).toHaveBeenCalledTimes(1);
    await memoria.recordar('b', cargar);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('con «recordar», un error no se guarda', async () => {
    const memoria = new MemoriaPorClave<string>(60_000);
    let veces = 0;
    const cargar = async () => {
      veces += 1;
      if (veces === 1) throw new Error('la base no respondió');
      return 'bien';
    };
    await expect(memoria.recordar('a', cargar)).rejects.toThrow('la base no respondió');
    await expect(memoria.recordar('a', cargar)).resolves.toBe('bien');
  });
});
