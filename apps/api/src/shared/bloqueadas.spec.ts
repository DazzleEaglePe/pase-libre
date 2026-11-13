import { describe, expect, it } from 'vitest';

import {
  accesoAlPerfil,
  calcularQueNoVeo,
  comoLaEncuentra,
  veComoVisitante,
  type QuienMira,
  type TiendaCerrada,
} from './bloqueadas';

const vendedor: QuienMira = { audiencia: 'vendedor', tiendaId: 'mia', usuarioId: 'u1' };
const visitante: QuienMira = { audiencia: 'visitante', tiendaId: null, usuarioId: null };
const equipo: QuienMira = { audiencia: 'equipo', tiendaId: null, usuarioId: 'e1' };
const cerradas: TiendaCerrada[] = [
  { id: 'privada', visibilidad: 'PRIVADO' },
  { id: 'oculta', visibilidad: 'OCULTO' },
];

describe('tiendasQueNoVeo: la regla (doc 20, punto 5)', () => {
  it('un visitante no ve las privadas ni las ocultas', () => {
    expect(calcularQueNoVeo(visitante, [], cerradas, new Set()).sort()).toEqual([
      'oculta',
      'privada',
    ]);
  });

  it('una tienda ve las privadas que sigue, nunca las ocultas, y nunca sus bloqueadas', () => {
    expect(
      calcularQueNoVeo(vendedor, ['bloqueada'], cerradas, new Set(['privada', 'oculta'])).sort(),
    ).toEqual(['bloqueada', 'oculta']);
  });

  it('su propia tienda siempre la ve, aunque sea oculta', () => {
    const propia: TiendaCerrada[] = [{ id: 'mia', visibilidad: 'OCULTO' }];
    expect(calcularQueNoVeo(vendedor, [], propia, new Set())).toEqual([]);
  });

  it('el Equipo ve todo (solo le quedan las que bloqueó)', () => {
    expect(calcularQueNoVeo(equipo, [], cerradas, new Set())).toEqual([]);
  });

  it('el resumen sirve solo si no ve justo lo que un visitante', () => {
    expect(veComoVisitante(['oculta', 'privada'], cerradas)).toBe(true);
    expect(veComoVisitante(['oculta'], cerradas)).toBe(false);
    expect(veComoVisitante(['oculta', 'privada', 'bloqueada'], cerradas)).toBe(false);
    expect(veComoVisitante([], [])).toBe(true);
  });
});

describe('Búsqueda de tiendas', () => {
  const privada = { id: 'p', nombre: 'Dark Alien Planeta', visibilidad: 'PRIVADO' as const };

  it('una privada sale solo con su nombre exacto, sin tildes ni mayúsculas', () => {
    expect(comoLaEncuentra(privada, vendedor, false, 'dark alien planeta')).toBe('privada');
    expect(comoLaEncuentra(privada, vendedor, false, 'DÁRK  Alien Planeta')).toBe('privada');
    expect(comoLaEncuentra(privada, vendedor, false, 'dark alien')).toBeNull();
    expect(comoLaEncuentra(privada, vendedor, false, undefined)).toBeNull();
  });

  it('si la sigues, sale completa', () => {
    expect(comoLaEncuentra(privada, vendedor, true, 'dark')).toBe('completa');
  });

  it('una oculta nunca sale, ni con su nombre exacto; para el Equipo sí', () => {
    const oculta = { ...privada, visibilidad: 'OCULTO' as const };
    expect(comoLaEncuentra(oculta, vendedor, true, 'dark alien planeta')).toBeNull();
    expect(comoLaEncuentra(oculta, equipo, false, 'dark')).toBe('completa');
  });
});

describe('El perfil', () => {
  const privada = { id: 'p', visibilidad: 'PRIVADO' as const };

  it('privado para quien no la sigue, completo para quien la sigue y para el Equipo', () => {
    expect(accesoAlPerfil(privada, vendedor, false)).toBe('privado');
    expect(accesoAlPerfil(privada, vendedor, true)).toBe('completo');
    expect(accesoAlPerfil(privada, equipo, false)).toBe('completo');
  });

  it('oculto para todas las demás', () => {
    expect(accesoAlPerfil({ id: 'p', visibilidad: 'OCULTO' }, vendedor, true)).toBe('oculto');
  });

  it('«Cómo me ven»: la propia se ve como la ve otra tienda', () => {
    const mia = { id: 'mia', visibilidad: 'PRIVADO' as const };
    expect(accesoAlPerfil(mia, vendedor, false)).toBe('completo');
    expect(accesoAlPerfil(mia, vendedor, false, true)).toBe('privado');
    expect(accesoAlPerfil({ id: 'mia', visibilidad: 'PUBLICO' }, vendedor, false, true)).toBe(
      'completo',
    );
  });
});
