import type { INestApplication } from '@nestjs/common';
import type { RespuestaInicio } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** El interceptor de soporte anota y avisa después de responder. */
const esperarAnotacion = () => new Promise((listo) => setTimeout(listo, 150));

/**
 * Versión 1.11.0 (doc 20): publicar en modo soporte (A2), «Cómo llegar» y «Sobre la tienda»
 * opcionales (A4) y el sinónimo largo al importar el catálogo (A7).
 */
describe('Arreglos de la 1.11.0 (doc 20: A2, A4 y A7)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    send: (metodo: 'post' | 'patch' | 'delete', ruta: string, cuerpo?: object) => {
      const peticion = http();
      return peticion[metodo](ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo);
    },
  });
  let tiendaA: string;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'equipo']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('A2 · en modo soporte se publica y se edita por la tienda', () => {
    let publicada: string;

    beforeAll(async () => {
      await como('equipo').send('post', `/v1/equipo/panel/tiendas/${tiendaA}/soporte`).expect(200);
    });

    afterAll(async () => {
      await como('equipo').send('post', '/v1/soporte/salir').expect(200);
    });

    it('publica a nombre de la tienda: queda anotado y la tienda recibe el aviso', async () => {
      const producto = await prisma.producto.findFirstOrThrow({
        where: { fusionadoEnId: null, ofertas: { none: { tiendaId: tiendaA } } },
      });
      const respuesta = await como('equipo')
        .send('post', '/v1/ofertas', {
          producto_id: producto.id,
          estado_detalle: 'SELLADO',
          stock: 2,
          moneda: 'PEN',
          precio: '320',
          quien_ve_precio: 'TODOS',
        })
        .expect(201);
      publicada = respuesta.body.oferta.id as string;
      const oferta = await prisma.oferta.findUniqueOrThrow({ where: { id: publicada } });
      expect(oferta.tiendaId).toBe(tiendaA);

      await esperarAnotacion();
      await prisma.registroEquipo.findFirstOrThrow({
        where: { tiendaId: tiendaA, accion: 'en modo soporte, publicó por tu tienda' },
      });
      await prisma.aviso.findFirstOrThrow({
        where: {
          usuario: { usuario: 'tiendaa' },
          titulo: 'El Equipo PaseLibre publicó por tu tienda',
        },
      });
    });

    it('edita una publicación y confirma que siguen igual', async () => {
      await como('equipo').send('patch', `/v1/ofertas/${publicada}`, { stock: 5 }).expect(200);
      expect((await prisma.oferta.findUniqueOrThrow({ where: { id: publicada } })).stock).toBe(5);
      await como('equipo')
        .send('post', '/v1/ofertas/confirmar', { ids: [publicada] })
        .expect(200);
      await esperarAnotacion();
      await prisma.aviso.findFirstOrThrow({
        where: {
          usuario: { usuario: 'tiendaa' },
          titulo: 'El Equipo PaseLibre editó una de tus publicaciones',
        },
      });
    });

    it('borrar sigue cerrado, con el texto nuevo del error', async () => {
      const respuesta = await como('equipo').send('delete', `/v1/ofertas/${publicada}`).expect(403);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'MODO_SOPORTE',
        mensaje:
          'En modo soporte puedes acomodar el perfil y publicar por la tienda, pero no chatear ni cerrar ventas.',
      });
      await como('equipo')
        .send('post', '/v1/ofertas/eliminar', { ids: [publicada] })
        .expect(403);
      expect((await prisma.oferta.findUniqueOrThrow({ where: { id: publicada } })).estado).not.toBe(
        'ELIMINADA',
      );
    });
  });

  describe('A4 · «Completa tu perfil» no pide «Sobre la tienda»', () => {
    it('con portada y horario está listo, aunque no tenga descripción', async () => {
      await prisma.tienda.update({
        where: { id: tiendaA },
        data: {
          horario: 'Lun a sáb 10:00–20:00',
          portadaRuta: 'portadas/prueba.webp',
          descripcion: null,
        },
      });
      const inicio = (await como('tiendaa').get('/v1/inicio').expect(200)).body as RespuestaInicio;
      expect(inicio.pasos?.perfil).toBe(true);

      await prisma.tienda.update({ where: { id: tiendaA }, data: { portadaRuta: null } });
      const sinPortada = (await como('tiendaa').get('/v1/inicio').expect(200))
        .body as RespuestaInicio;
      expect(sinPortada.pasos?.perfil).toBe(false);
    });
  });

  describe('A7 · importar un sinónimo largo', () => {
    it('esa fila dice SINONIMO_LARGO y no se crea; el resto sigue (antes: error 500)', async () => {
      const largo = 'kingston fury beast negra ddr5 seis mil mhz para gamers';
      expect(largo.length).toBeGreaterThan(40);
      const csv = [
        'categoria,marca,modelo,sinonimos',
        'cases,Corsair,Caja Corta PL,"caja corta;corsair pl"',
        `ram,Kingston,Fury Larga PL,"fury;${largo}"`,
      ].join('\n');
      const revision = await http()
        .post('/v1/equipo/catalogo/importar')
        .set(CABECERAS)
        .set('Cookie', cookies.equipo ?? '')
        .attach('archivo', Buffer.from(csv), { filename: 'sinonimos.csv' })
        .expect(201);
      expect(revision.body).toMatchObject({
        crear: 1,
        motivos: { sinonimo_largo: 1, sin_foto: 0, repetida: 0 },
      });
      expect(revision.body.incompletas).toEqual([
        expect.objectContaining({
          producto: 'Kingston Fury Larga PL',
          motivo: 'SINONIMO_LARGO',
          texto: `Un sinónimo pasa de 40 letras: «${largo.slice(0, 40)}…». Sepáralos con coma.`,
        }),
      ]);

      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(CABECERAS)
        .set('Cookie', cookies.equipo ?? '')
        .expect(201, { creados: 1, actualizados: 0 });
      expect(
        await prisma.producto.count({ where: { titulo: { contains: 'Fury Larga PL' } } }),
      ).toBe(0);
      await prisma.producto.findFirstOrThrow({ where: { titulo: { contains: 'Caja Corta PL' } } });
    });
  });
});
