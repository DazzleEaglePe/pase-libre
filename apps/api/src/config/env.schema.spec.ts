import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.schema';

const produccion = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/paselibre',
  WEB_URL: 'https://paselibre.pe',
  LOG_LEVEL: 'info',
};

describe('validateEnvironment', () => {
  it('en producción la cookie es segura por defecto', () => {
    expect(validateEnvironment(produccion).SESION_COOKIE_SEGURA).toBe(true);
  });

  it('en producción se niega a arrancar con lo que no debe', () => {
    expect(() => validateEnvironment({ ...produccion, SESION_COOKIE_SEGURA: 'false' })).toThrow(
      /HTTPS/,
    );
    expect(() => validateEnvironment({ ...produccion, LOG_LEVEL: 'debug' })).toThrow(/LOG_LEVEL/);
    // El SMS y SUNAT del registro todavía son simulados.
    expect(() => validateEnvironment({ ...produccion, REGISTRO_PROPIO: 'true' })).toThrow(
      /simulad/,
    );
  });

  it('en local todo eso se permite', () => {
    const local = validateEnvironment({ REGISTRO_PROPIO: 'true', LOG_LEVEL: 'debug' });
    expect(local.REGISTRO_PROPIO).toBe(true);
    expect(local.SESION_COOKIE_SEGURA).toBe(false);
  });

  it('lee la lista de proxies y pone tope al tipo de cambio', () => {
    expect(
      validateEnvironment({ PROXIES_DE_CONFIANZA: 'loopback, 10.0.0.2' }).PROXIES_DE_CONFIANZA,
    ).toEqual(['loopback', '10.0.0.2']);
    expect(() => validateEnvironment({ TIPO_CAMBIO: '0' })).toThrow();
    expect(() => validateEnvironment({ TIPO_CAMBIO: '101' })).toThrow();
    expect(validateEnvironment({ TIPO_CAMBIO: '3.8' }).TIPO_CAMBIO).toBe(3.8);
  });
});
