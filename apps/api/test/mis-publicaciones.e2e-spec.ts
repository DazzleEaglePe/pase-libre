import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

interface Fila {
  id: string;
  stock: number;
  vistas_semana: number;
  razon_pausa: string | null;
  producto: { slug: string };
}

/** Mis publicaciones (MP_Web, sección 12 del lienzo final). */
describe('Mis publicaciones (sección 12)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();

  async function como(usuario: string): Promise<string> {
    const guardada = cookies.get(usuario);
    if (guardada) return guardada;
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    cookies.set(usuario, cookieDe(respuesta));
    return cookieDe(respuesta);
  }

  const misOfertas = async (estado: string) =>
    (
      await http()
        .get(`/v1/mis-ofertas?estado=${estado}`)
        .set('Cookie', await como('tiendaa'))
        .expect(200)
    ).body as { conteos: Record<string, number>; vistas_semana: number; ofertas: Fila[] };

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

  it('«Activas» incluye las que se quedaron sin stock', async () => {
    const [primera] = (await misOfertas('activas')).ofertas;
    await http()
      .patch(`/v1/ofertas/${primera?.id}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ stock: 0 })
      .expect(200);
    const datos = await misOfertas('vigentes');
    expect(datos.conteos.vigentes).toBe(datos.conteos.activas + datos.conteos.sin_stock);
    expect(datos.ofertas.some((oferta) => oferta.id === primera?.id && oferta.stock === 0)).toBe(
      true,
    );
  });

  it('pausar con su razón y reactivar la borra', async () => {
    const [oferta] = (await misOfertas('vigentes')).ofertas;
    const pausada = await http()
      .patch(`/v1/ofertas/${oferta?.id}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ estado: 'PAUSADA', razon_pausa: 'La separé para un cliente' })
      .expect(200);
    expect(pausada.body).toMatchObject({
      estado: 'PAUSADA',
      razon_pausa: 'La separé para un cliente',
    });
    const enPausadas = await misOfertas('pausadas');
    expect(enPausadas.ofertas.find((otra) => otra.id === oferta?.id)?.razon_pausa).toBe(
      'La separé para un cliente',
    );

    const activa = await http()
      .patch(`/v1/ofertas/${oferta?.id}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ estado: 'ACTIVA' })
      .expect(200);
    expect(activa.body.razon_pausa).toBeNull();
    const fila = await prisma.oferta.findUniqueOrThrow({ where: { id: oferta?.id } });
    expect(fila.razonPausa).toBeNull();
  });

  it('cuenta una vista por tienda y día al abrir la ficha; las propias no', async () => {
    const datos = await misOfertas('vigentes');
    const oferta = datos.ofertas.find((otra) => otra.stock > 0);
    const ficha = `/v1/productos/${oferta?.producto.slug}`;
    await http()
      .get(ficha)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    await http()
      .get(ficha)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    await http()
      .get(ficha)
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    await http().get(ficha).expect(200);

    const despues = await misOfertas('vigentes');
    expect(despues.ofertas.find((otra) => otra.id === oferta?.id)?.vistas_semana).toBe(1);
    expect(despues.vistas_semana).toBe(datos.vistas_semana + 1);
  });
});
