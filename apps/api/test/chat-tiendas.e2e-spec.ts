import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Chat por tienda, venta cerrada, cómo llegar y el chat oficial (sección 13 del lienzo final). */
describe('Chat por tienda y chat con el equipo (sección 13)', () => {
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

  /** Tienda B le escribe a Tienda A por una de sus publicaciones. */
  async function escribirPor(ofertaId: string): Promise<string> {
    const contacto = await http()
      .post(`/v1/ofertas/${ofertaId}/contacto`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ canal: 'CHAT' })
      .expect(200);
    const id = contacto.body.conversacion_id as string;
    await http()
      .post(`/v1/conversaciones/${id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ texto: 'Hola, ¿sigue disponible?' })
      .expect(201);
    return id;
  }

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

  it('«Hablan de» junta los productos de los que hablas con esa tienda', async () => {
    const ofertas = await prisma.oferta.findMany({
      where: {
        tienda: { nombre: 'Tienda A' },
        estado: 'ACTIVA',
        stock: { gt: 0 },
        tiendaVisible: true,
      },
      take: 2,
      orderBy: { creadaEn: 'asc' },
    });
    const primera = await escribirPor(ofertas[0]?.id ?? '');
    const segunda = await escribirPor(ofertas[1]?.id ?? '');
    const detalle = await http()
      .get(`/v1/conversaciones/${segunda}`)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    const ids = (detalle.body.hablan_de as Array<{ conversacion_id: string }>).map(
      (hilo) => hilo.conversacion_id,
    );
    expect(ids[0]).toBe(segunda);
    expect(ids).toContain(primera);
    expect(detalle.body.sobre_tienda).toMatchObject({ opiniones: expect.any(Number) });
    expect(detalle.body.venta).toBeNull();
  });

  it('con la tienda reservada no se junta ni se dice dónde está', async () => {
    const reservada = await prisma.oferta.findFirstOrThrow({
      where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', stock: { gt: 0 } },
      orderBy: { creadaEn: 'desc' },
    });
    await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: false } });
    const id = await escribirPor(reservada.id);
    const detalle = await http()
      .get(`/v1/conversaciones/${id}`)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(detalle.body.hablan_de).toHaveLength(1);
    expect(detalle.body.sobre_tienda).toBeNull();
    await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: true } });
  });

  it('al marcar «Vendido», quien compró ve la venta y puede calificar una vez', async () => {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: {
        tienda: { nombre: 'Tienda A' },
        estado: 'ACTIVA',
        stock: { gt: 1 },
        tiendaVisible: true,
      },
      orderBy: { creadaEn: 'asc' },
      skip: 2,
    });
    const id = await escribirPor(oferta.id);
    await http()
      .post(`/v1/ofertas/${oferta.id}/vendido`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ conversacion_id: id })
      .expect(201);
    const detalle = await http()
      .get(`/v1/conversaciones/${id}`)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(detalle.body.venta).toMatchObject({ mi_lado: 'comprador', calificaste: false });
    await http()
      .post(`/v1/ventas/${detalle.body.venta.id}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ estrellas: 5, aspectos: ['Buen trato'] })
      .expect(201);
    const despues = await http()
      .get(`/v1/conversaciones/${id}`)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(despues.body.venta.calificaste).toBe(true);
  });

  describe('chat oficial con el equipo', () => {
    it('el equipo escribe primero, con el caso; la tienda lo ve y contesta', async () => {
      const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
      const vacio = await http()
        .get('/v1/equipo-chat')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(vacio.body).toEqual({ mensajes: [], sin_leer: 0 });

      // Solo el equipo usa el lado del equipo.
      await http()
        .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ texto: 'Hola' })
        .expect(403);

      await http()
        .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .send({ texto: 'Hola, Tienda B. Soy del equipo PaseLibre.' })
        .expect(201);
      const contadores = await http()
        .get('/v1/contadores')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(contadores.body.mensajes).toBeGreaterThanOrEqual(1);

      const sinLeer = await http()
        .get('/v1/equipo-chat')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(sinLeer.body.sin_leer).toBe(1);
      expect(sinLeer.body.mensajes[0]).toMatchObject({ de_equipo: true, mio: false });

      const leido = await http()
        .get('/v1/equipo-chat?leer=1')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(leido.body.sin_leer).toBe(0);

      await http()
        .post('/v1/equipo-chat/mensajes')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({ texto: 'Gracias, ya lo corregí.' })
        .expect(201);
      const hilos = await http()
        .get('/v1/equipo/chats')
        .set('Cookie', await como('equipo'))
        .expect(200);
      expect(hilos.body[0]).toMatchObject({
        tienda: { nombre: 'Tienda B' },
        sin_leer: 1,
        ultimo: { texto: 'Gracias, ya lo corregí.', de_equipo: false },
      });
    });

    it('un caso de otra tienda no se puede citar', async () => {
      const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
      const ajena = await prisma.denuncia.create({
        data: {
          denuncianteId: (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendac' } }))
            .id,
          objeto: 'TIENDA',
          objetoId: tiendaB.id,
          tiendaDenunciadaId: (
            await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })
          ).id,
          tipo: 'TRATO',
        },
      });
      await http()
        .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .send({ texto: 'Sobre tu caso', denuncia: ajena.id })
        .expect(400);
    });
  });
});
