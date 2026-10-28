import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Lanza `cantidad` peticiones y devuelve sus códigos. */
async function codigos(cantidad: number, peticion: () => request.Test): Promise<number[]> {
  const resultados: number[] = [];
  for (let i = 0; i < cantidad; i += 1) resultados.push((await peticion()).status);
  return resultados;
}

describe('Límites de peticiones (RNF-19, docs/05 §9)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('varias tiendas detrás del mismo wifi de la galería no se frenan entre sí', async () => {
    // 2 × 100 = 200 peticiones desde la misma IP en menos de un minuto: con el límite
    // anterior de 120 por IP, la segunda tienda se quedaba sin servicio.
    for (const usuario of ['tiendaa', 'tiendab']) {
      const resultado = await codigos(100, () =>
        http()
          .get('/v1/yo')
          .set('Cookie', cookies[usuario] ?? ''),
      );
      expect(resultado.every((codigo) => codigo === 200)).toBe(true);
    }
  });

  it('una sola persona tiene su propio límite por minuto', async () => {
    // tiendaa ya hizo 100: le quedan 20 de 120.
    const resultado = await codigos(21, () =>
      http()
        .get('/v1/yo')
        .set('Cookie', cookies.tiendaa ?? ''),
    );
    expect(resultado.slice(0, 20).every((codigo) => codigo === 200)).toBe(true);
    expect(resultado[20]).toBe(429);
    // Las demás siguen sin problema.
    await http()
      .get('/v1/yo')
      .set('Cookie', cookies.tiendac ?? '')
      .expect(200);
  });

  it('el enlace de WhatsApp no se puede pedir en masa', async () => {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA' },
    });
    const resultado = await codigos(31, () =>
      http()
        .post(`/v1/ofertas/${oferta.id}/contacto`)
        .set(CABECERAS)
        .set('Cookie', cookies.tiendac ?? '')
        .send({ canal: 'WHATSAPP' }),
    );
    expect(resultado.slice(0, 30).every((codigo) => codigo === 200)).toBe(true);
    expect(resultado[30]).toBe(429);
  });
});
