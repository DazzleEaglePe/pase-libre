import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';

/**
 * La memoria corta de la búsqueda (docs/16 §4.4): lo que ve un visitante se guarda 30 s por
 * consulta normalizada; lo que ve alguien con sesión nunca se guarda ni sale de ahí. En las
 * pruebas la memoria está apagada (NODE_ENV=test): aquí se enciende a propósito.
 */
describe('Memoria de la búsqueda', () => {
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

  it('el visitante recibe lo guardado; con sesión se calcula siempre y con precios', async () => {
    const antes = (await http().get('/v1/buscar?q=rtx%203070').expect(200)).body;
    expect(antes.audiencia).toBe('visitante');

    const ventus = await prisma.producto.findUniqueOrThrow({ where: { slug: VENTUS } });
    const activas = await prisma.oferta.findMany({
      where: { productoId: ventus.id, estado: 'ACTIVA' },
      select: { id: true },
    });
    await prisma.oferta.updateMany({
      where: { id: { in: activas.map((o) => o.id) } },
      data: { estado: 'PAUSADA' },
    });
    try {
      // Con sesión ya no sale la Ventus, y nunca recibe la versión guardada del visitante.
      const tienda = (await http().get('/v1/buscar?q=rtx%203070').set('Cookie', cookie).expect(200))
        .body;
      expect(tienda.audiencia).toBe('vendedor');
      expect(tienda.total_productos).toBe(antes.total_productos - 1);
      expect(tienda.productos[0]).toHaveProperty('oferta_destacada');

      // El visitante sigue con lo guardado, y lo guardado no trae precios ni tiendas.
      const despues = (await http().get('/v1/buscar?q=rtx%203070').expect(200)).body;
      expect(despues).toEqual(antes);
      expect(JSON.stringify(despues)).not.toMatch(/oferta_destacada|precios_desde|Tienda [A-Z]/);
    } finally {
      await prisma.oferta.updateMany({
        where: { id: { in: activas.map((o) => o.id) } },
        data: { estado: 'ACTIVA' },
      });
    }
  });

  it('«Buscaste» repite lo que escribió cada uno y cada búsqueda queda registrada', async () => {
    const minuscula = (await http().get('/v1/buscar?q=rtx%203370').expect(200)).body;
    const mayuscula = (await http().get('/v1/buscar?q=RTX%20%203370').expect(200)).body;
    expect(minuscula.correccion).toEqual({ buscaste: 'rtx 3370', mostramos: 'rtx 3070' });
    expect(mayuscula.correccion).toEqual({ buscaste: 'RTX  3370', mostramos: 'rtx 3070' });
    expect(mayuscula.productos).toEqual(minuscula.productos);
    const registradas = await prisma.busqueda.findMany({
      where: { texto: { in: ['rtx 3370', 'RTX  3370'] } },
      select: { texto: true, textoCorregido: true, resultados: true },
    });
    expect(registradas).toHaveLength(2);
    for (const fila of registradas) {
      expect(fila).toMatchObject({ textoCorregido: 'rtx 3070', resultados: 5 });
    }
  });

  it('las sugerencias guardadas del visitante no llegan a quien tiene sesión', async () => {
    const visitante = (await http().get('/v1/buscar/sugerencias?q=rtx%2030').expect(200)).body;
    expect(JSON.stringify(visitante)).not.toContain('precios_desde');
    const tienda = (
      await http().get('/v1/buscar/sugerencias?q=rtx%2030').set('Cookie', cookie).expect(200)
    ).body;
    for (const producto of tienda.productos) {
      expect(producto.ofertas.precios_desde).toEqual(expect.any(Array));
      expect(producto).toHaveProperty('oferta_destacada');
    }
    const otraVez = (await http().get('/v1/buscar/sugerencias?q=RTX%2030').expect(200)).body;
    expect(otraVez.productos).toEqual(visitante.productos);
    expect(JSON.stringify(otraVez)).not.toContain('precios_desde');
  });
});
