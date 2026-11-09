import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { COOKIE_SESION } from '../modules/sesion/sesion.types';
import { rastreadorPorIp, rastreadorPorPersona } from './limites';
import { olvidarSesion, recordarSesionValida } from './sesiones-validas';

const pedido = (ip: string, token?: string) => ({
  ip,
  cookies: token ? { [COOKIE_SESION]: token } : {},
});

describe('rastreadorPorPersona', () => {
  it('sin sesión cuenta por IP', () => {
    expect(rastreadorPorPersona(pedido('190.42.10.7'))).toBe('ip:190.42.10.7');
  });

  it('una cookie que la API no validó cuenta por IP: inventarla no da un contador nuevo', () => {
    expect(rastreadorPorPersona(pedido('190.42.10.7', 'inventada-1'))).toBe('ip:190.42.10.7');
    expect(rastreadorPorPersona(pedido('190.42.10.7', 'inventada-2'))).toBe('ip:190.42.10.7');
  });

  it('una sesión válida cuenta por su cookie, sin guardar el token tal cual', () => {
    const token = 'token-de-una-sesion-de-verdad';
    const hash = createHash('sha256').update(token).digest('hex');
    recordarSesionValida(hash);
    const clave = rastreadorPorPersona(pedido('190.42.10.7', token));
    expect(clave).toBe(`sesion:${hash.slice(0, 32)}`);
    expect(clave).not.toContain(token);
    olvidarSesion(hash);
    expect(rastreadorPorPersona(pedido('190.42.10.7', token))).toBe('ip:190.42.10.7');
  });

  it('el límite por IP agrupa una IPv6 por su /64', () => {
    expect(rastreadorPorIp(pedido('2001:db8:1:2::a'))).toBe(
      rastreadorPorIp(pedido('2001:db8:1:2::b')),
    );
  });
});
