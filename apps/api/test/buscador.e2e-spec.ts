import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** El buscador que nunca te deja sin nada (BUS_Web, BUS_WebNum, BUS_WebSug: sección 6). */
describe('Buscador que entiende lo escrito (sección 6)', () => {
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

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('«treinta setenta» se entiende como 3070', async () => {
    const respuesta = await http().get('/v1/buscar?q=rtx%20treinta%20setenta').expect(200);
    expect(respuesta.body.correccion).toMatchObject({
      buscaste: 'rtx treinta setenta',
      mostramos: 'rtx 3070',
    });
    expect(respuesta.body.total_productos).toBeGreaterThan(0);
    for (const producto of respuesta.body.productos as Array<{ titulo: string }>) {
      expect(producto.titulo).toMatch(/3070/);
    }
  });

  it('«40 60» junto es el modelo 4060', async () => {
    const respuesta = await http().get('/v1/buscar?q=rtx%2040%2060').expect(200);
    expect(respuesta.body.correccion?.mostramos).toBe('rtx 4060');
    expect(respuesta.body.productos[0].titulo).toMatch(/4060/);
  });

  it('una palabra de categoría elige la categoría', async () => {
    const respuesta = await http().get('/v1/buscar?q=grafica%20msi').expect(200);
    expect(respuesta.body.correccion).toMatchObject({
      mostramos: 'msi',
      categoria: { slug: 'graficas' },
    });
    for (const producto of respuesta.body.productos as Array<{ categoria: { slug: string } }>) {
      expect(producto.categoria.slug).toBe('graficas');
    }
  });

  it('«tal cual» no cambia nada', async () => {
    const respuesta = await http()
      .get('/v1/buscar?q=rtx%20treinta%20setenta&tal_cual=true')
      .expect(200);
    expect(respuesta.body.correccion).toBeNull();
    expect(respuesta.body.total_productos).toBe(0);
  });

  it('las sugerencias entienden igual y, con sesión, traen el precio', async () => {
    const visitante = await http()
      .get('/v1/buscar/sugerencias?q=msi%20treinta%20setenta')
      .expect(200);
    expect(visitante.body.correccion?.mostramos).toBe('msi 3070');
    expect(JSON.stringify(visitante.body.productos)).not.toContain('precios_desde');

    const conSesion = await http()
      .get('/v1/buscar/sugerencias?q=msi%20treinta%20setenta')
      .set('Cookie', cookie)
      .expect(200);
    expect(conSesion.body.productos.length).toBeGreaterThan(0);
    expect(conSesion.body.productos[0]).toHaveProperty('oferta_destacada');
  });
});
