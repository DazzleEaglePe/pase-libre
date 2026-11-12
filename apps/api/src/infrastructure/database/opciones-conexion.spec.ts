import { describe, expect, it } from 'vitest';

import { conOpcionesDeLaApi } from './opciones-conexion';

const opciones = (url: string) => new URL(conOpcionesDeLaApi(url)).searchParams.get('options');

describe('conOpcionesDeLaApi', () => {
  it('agrega el tiempo máximo y apaga el JIT, sin tocar lo demás', () => {
    const url =
      'postgresql://pl:cl%40ve@postgres:5432/paselibre?connection_limit=15&pool_timeout=20';
    const resultado = new URL(conOpcionesDeLaApi(url));
    expect(resultado.searchParams.get('options')).toBe('-c statement_timeout=8000 -c jit=off');
    expect(resultado.searchParams.get('connection_limit')).toBe('15');
    expect(resultado.searchParams.get('pool_timeout')).toBe('20');
    expect(resultado.password).toBe('cl%40ve');
    expect(resultado.pathname).toBe('/paselibre');
  });

  it('respeta lo que ya trae la dirección', () => {
    expect(opciones('postgresql://a@b/c?options=-c%20statement_timeout%3D2000')).toBe(
      '-c statement_timeout=2000 -c jit=off',
    );
    expect(opciones('postgresql://a@b/c?options=-c%20jit%3Don')).toBe(
      '-c jit=on -c statement_timeout=8000',
    );
    const completa = 'postgresql://a@b/c?options=-c%20jit%3Doff%20-c%20statement_timeout%3D1';
    expect(conOpcionesDeLaApi(completa)).toBe(completa);
  });

  it('deja igual lo que no es una dirección', () => {
    expect(conOpcionesDeLaApi('')).toBe('');
  });
});
