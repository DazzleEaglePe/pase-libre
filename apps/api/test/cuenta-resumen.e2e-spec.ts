import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** «Tu cuenta» y tu perfil (D_Cuenta, P_WebCuentaD2: sección 14 del lienzo final). */
describe('Resumen de la cuenta (sección 14)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const entrar = async (usuario: string) =>
    cookieDe(
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200),
    );

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('cuenta cómo vende la tienda y tapa su WhatsApp', async () => {
    const cookie = await entrar('tiendaa');
    const respuesta = await http().get('/v1/cuenta/resumen').set('Cookie', cookie).expect(200);
    expect(respuesta.body).toMatchObject({
      por_registro: false,
      ventas_60: expect.any(Number),
      opiniones: expect.any(Number),
      chats_abiertos: expect.any(Number),
    });
    expect(respuesta.body.vende.length).toBeGreaterThan(0);
    expect(respuesta.body.whatsapp).toMatch(/^\+51 \d•• ••• \d{3}$/);
  });

  it('las cuentas del equipo no tienen resumen de tienda', async () => {
    const cookie = await entrar('equipo');
    await http().get('/v1/cuenta/resumen').set('Cookie', cookie).expect(403);
  });
});
