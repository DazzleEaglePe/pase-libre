import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * «Recién publicado» del visitante en la portada: 30 s en memoria por galería (docs/16 §4.4),
 * como la búsqueda. Con sesión se calcula siempre. En las pruebas la memoria está apagada
 * (NODE_ENV=test): aquí se enciende a propósito.
 */
describe('Memoria de la portada', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  let cookie = '';

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario: 'tiendab', clave: CLAVE_DEMO })
      .expect(200);
    cookie = cookieDe(respuesta);
  });

  beforeEach(() => vi.stubEnv('NODE_ENV', 'development'));
  afterEach(() => vi.unstubAllEnvs());

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('el visitante recibe lo guardado; con sesión se calcula siempre', async () => {
    const antes = (await http().get('/v1/portada').expect(200)).body;
    expect(antes.audiencia).toBe('visitante');
    expect(antes.recien_publicado.length).toBeGreaterThan(0);
    const primera: string = antes.recien_publicado[0].oferta_id;

    await prisma.oferta.update({ where: { id: primera }, data: { estado: 'PAUSADA' } });
    try {
      // Con sesión ya no sale la pausada, y nunca recibe la versión guardada del visitante.
      const tienda = (await http().get('/v1/portada').set('Cookie', cookie).expect(200)).body;
      expect(tienda.audiencia).toBe('vendedor');
      expect(tienda.recien_publicado.map((o: { oferta_id: string }) => o.oferta_id)).not.toContain(
        primera,
      );

      // El visitante sigue con lo guardado, y lo guardado no trae precios ni tiendas.
      const despues = (await http().get('/v1/portada').expect(200)).body;
      expect(despues.recien_publicado).toEqual(antes.recien_publicado);
      expect(JSON.stringify(despues.recien_publicado)).not.toMatch(
        /"precio|"tienda|"stand|"whatsapp/,
      );
    } finally {
      await prisma.oferta.update({ where: { id: primera }, data: { estado: 'ACTIVA' } });
    }
  });

  it('cada galería se guarda aparte: elegir una no devuelve lo de todas', async () => {
    const todas = (await http().get('/v1/portada').expect(200)).body;
    const maxiplaza = (await http().get('/v1/portada?galeria=maxiplaza').expect(200)).body;
    expect(maxiplaza.recien_publicado.length).toBeGreaterThan(0);
    for (const oferta of maxiplaza.recien_publicado) expect(oferta.galeria).toBe('Maxiplaza');
    expect(maxiplaza.recien_publicado).not.toEqual(todas.recien_publicado);
  });
});
