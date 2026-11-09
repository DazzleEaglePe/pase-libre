import { describe, expect, it } from 'vitest';

import { claveDeIp } from './ip';

describe('claveDeIp', () => {
  it('una IPv4 es ella misma, también escrita como IPv6', () => {
    expect(claveDeIp('190.42.10.7')).toBe('190.42.10.7');
    expect(claveDeIp('::ffff:190.42.10.7')).toBe('190.42.10.7');
  });

  it('una IPv6 cuenta por su /64: estrenar direcciones del mismo bloque no da más pedidos', () => {
    const a = claveDeIp('2001:db8:abcd:12:1111:2222:3333:4444');
    const b = claveDeIp('2001:db8:abcd:12:9999::1');
    expect(a).toBe('2001:db8:abcd:12::/64');
    expect(b).toBe(a);
    expect(claveDeIp('2001:db8:abcd:13::1')).not.toBe(a);
  });

  it('expande las formas cortas y quita la zona', () => {
    expect(claveDeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(claveDeIp('::1')).toBe('0:0:0:0::/64');
    expect(claveDeIp('fe80::1%en0')).toBe('fe80:0:0:0::/64');
    expect(claveDeIp('2001:0db8:0000:0042::1')).toBe('2001:db8:0:42::/64');
  });

  it('sin IP no revienta', () => {
    expect(claveDeIp(undefined)).toBe('desconocida');
    expect(claveDeIp('')).toBe('desconocida');
  });
});
