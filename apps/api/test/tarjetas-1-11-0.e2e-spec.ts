/**
 * Versión 1.11.0, tarjetas y ficha (doc 20):
 * - A8: la RAM publicada antes de la 1.10.0 tiene `perfil_memoria` nulo. Donde se arma la oferta
 *   (ficha, feed, Wilson, perfil de la tienda, Mis publicaciones) sale el del producto, sin
 *   guardar nada nuevo en la base. Si la oferta lo marcó, manda el suyo.
 * - 23: la ficha trae la portada que eligió la tienda, para ponerla primera entre las miniaturas.
 */
import { rm } from 'node:fs/promises';

import type { INestApplication } from '@nestjs/common';
import type {
  ArchivoSubido,
  OfertaPropia,
  PerfilTienda,
  RespuestaFicha,
  RespuestaPortada,
  RespuestaPublicar,
  RespuestaWilson,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import {
  CABECERAS,
  CARPETA_MEDIA_PRUEBAS,
  cookieDe,
  crearApp,
  usarBaseDePruebas,
  vaciarBase,
} from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const SLUG_RAM = 'prueba-ram-vieja-ddr4-16-gb';
const SLUG_RAM_SIN_PERFIL = 'prueba-ram-sin-perfil-ddr5-32-gb';

function fotoJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#FFFFFF' } })
    .jpeg()
    .toBuffer();
}

describe('Tarjetas 1.11.0: RAM vieja con Intel / EXPO del producto y portada en la ficha (doc 20)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    post: (ruta: string, cuerpo?: object) =>
      http()
        .post(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });

  /** Un producto de Memoria RAM solo para estas pruebas. */
  async function ram(titulo: string, slug: string, perfil: 'XMP' | 'EXPO' | null) {
    const { id } = await prisma.categoria.findUniqueOrThrow({ where: { slug: 'ram' } });
    return prisma.producto.create({
      data: {
        categoriaId: id,
        titulo,
        slug,
        textoBusqueda: titulo.toLowerCase(),
        revisado: true,
        perfilMemoria: perfil,
      },
    });
  }

  async function publicar(usuario: string, productoId: string, extra: object = {}) {
    const respuesta = await como(usuario)
      .post('/v1/ofertas', {
        producto_id: productoId,
        estado_detalle: 'SELLADO',
        stock: 3,
        precio: '120',
        quien_ve_precio: 'TODOS',
        ...extra,
      })
      .expect(201);
    return (respuesta.body as RespuestaPublicar).oferta;
  }

  /** Así quedó lo publicado antes de la 1.10.0: sin «Intel / EXPO» en la oferta. */
  const comoAntesDeLa110 = (ofertaId: string) =>
    prisma.oferta.update({ where: { id: ofertaId }, data: { perfilMemoria: null } });

  let tiendaB = '';
  /** La RAM vieja de Tienda B: el producto dice XMP, la oferta nada. */
  let vieja = '';
  /** La de Tienda C del mismo producto, marcada EXPO: manda la suya. */
  let marcada = '';
  /** Una RAM vieja de un producto que tampoco lo sabe: sigue sin perfil. */
  let sinDato = '';

  beforeAll(async () => {
    await rm(CARPETA_MEDIA_PRUEBAS, { recursive: true, force: true });
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac']) {
      const respuesta = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200);
      cookies[usuario] = cookieDe(respuesta);
    }
    tiendaB = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } })).id;

    const conPerfil = await ram('Prueba Ram Vieja DDR4 16 GB', SLUG_RAM, 'XMP');
    const sinPerfil = await ram('Prueba Ram Sin Perfil DDR5 32 GB', SLUG_RAM_SIN_PERFIL, null);
    vieja = (await publicar('tiendab', conPerfil.id, { perfil_memoria: 'XMP' })).id;
    marcada = (await publicar('tiendac', conPerfil.id, { perfil_memoria: 'EXPO' })).id;
    sinDato = (await publicar('tiendab', sinPerfil.id)).id;
    await comoAntesDeLa110(vieja);
    await comoAntesDeLa110(sinDato);
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  describe('A8 · RAM publicada antes de la 1.10.0', () => {
    it('la ficha muestra el perfil del producto, con sesión y sin ella', async () => {
      const ficha = (await como('tiendaa').get(`/v1/productos/${SLUG_RAM}`).expect(200))
        .body as RespuestaFicha;
      const detalle = (id: string) => ficha.ofertas.find((o) => o.id === id)?.detalle;
      expect(detalle(vieja)?.perfil_memoria).toBe('XMP');
      // La que lo marcó manda: no se pisa con el del producto.
      expect(detalle(marcada)?.perfil_memoria).toBe('EXPO');

      const publica = (await http().get(`/v1/productos/${SLUG_RAM}`).expect(200))
        .body as RespuestaFicha;
      expect(publica.ofertas.find((o) => o.id === vieja)?.detalle.perfil_memoria).toBe('XMP');

      const sinPerfil = (
        await como('tiendaa').get(`/v1/productos/${SLUG_RAM_SIN_PERFIL}`).expect(200)
      ).body as RespuestaFicha;
      expect(sinPerfil.ofertas[0]?.detalle.perfil_memoria).toBeNull();
    });

    it('las tarjetas del feed, de Wilson y del perfil de la tienda llevan la pastilla', async () => {
      const portada = (await como('tiendaa').get('/v1/portada').expect(200))
        .body as RespuestaPortada;
      const enFeed = portada.recien_publicado.find((t) => t.oferta_id === vieja);
      expect(enFeed?.variantes?.perfil_memoria).toBe('XMP');
      const visitante = (await http().get('/v1/portada').expect(200)).body as RespuestaPortada;
      expect(
        visitante.recien_publicado.find((t) => t.oferta_id === vieja)?.variantes?.perfil_memoria,
      ).toBe('XMP');

      const wilson = (await como('tiendaa').get('/v1/wilson?galeria=cyberplaza').expect(200))
        .body as RespuestaWilson;
      expect(wilson.ofertas.find((o) => o.oferta_id === vieja)?.detalle.perfil_memoria).toBe('XMP');

      const perfil = (await como('tiendaa').get(`/v1/tiendas/${tiendaB}`).expect(200))
        .body as PerfilTienda;
      const tarjeta = (id: string) => perfil.productos.find((p) => p.oferta_id === id);
      expect(tarjeta(vieja)?.variantes?.perfil_memoria).toBe('XMP');
      expect(tarjeta(sinDato)?.variantes?.perfil_memoria).toBeNull();
    });

    it('Mis publicaciones y la edición la traen marcada', async () => {
      const una = (await como('tiendab').get(`/v1/ofertas/${vieja}`).expect(200))
        .body as OfertaPropia;
      expect(una.detalle.perfil_memoria).toBe('XMP');
      expect(una.producto.perfil_memoria).toBe('XMP');
    });

    it('no se guarda nada nuevo en la base', async () => {
      const filas = await prisma.oferta.findMany({
        where: { id: { in: [vieja, sinDato, marcada] } },
        select: { id: true, perfilMemoria: true },
      });
      const enLaBase = Object.fromEntries(filas.map((f) => [f.id, f.perfilMemoria]));
      expect(enLaBase).toEqual({ [vieja]: null, [sinDato]: null, [marcada]: 'EXPO' });
    });
  });

  describe('23 · la portada de la tienda llega a la ficha', () => {
    it('con la portada elegida, la ficha la trae; sin elegir, nula', async () => {
      const subir = async () =>
        (
          (
            await http()
              .post('/v1/archivos')
              .set(CABECERAS)
              .set('Cookie', cookies.tiendac ?? '')
              .attach('foto', await fotoJpeg(), {
                filename: 'foto.jpg',
                contentType: 'image/jpeg',
              })
              .expect(201)
          ).body as ArchivoSubido
        ).ruta;
      const fotoA = await subir();
      const fotoB = await subir();
      const producto = await prisma.producto.findUniqueOrThrow({
        where: { slug: SLUG_RAM_SIN_PERFIL },
      });
      const conPortada = await publicar('tiendac', producto.id, {
        fotos: [fotoA, fotoB],
        portada: fotoB,
      });

      const ficha = (await como('tiendaa').get(`/v1/productos/${SLUG_RAM_SIN_PERFIL}`).expect(200))
        .body as RespuestaFicha;
      const oferta = ficha.ofertas.find((o) => o.id === conPortada.id);
      expect(oferta?.portada).toBe(fotoB);
      expect(oferta?.fotos.map((f) => f.ruta)).toEqual([fotoA, fotoB]);
      expect(ficha.ofertas.find((o) => o.id === sinDato)?.portada).toBeNull();

      // El visitante también: sus fotos ya se veían en la ficha pública.
      const publica = (await http().get(`/v1/productos/${SLUG_RAM_SIN_PERFIL}`).expect(200))
        .body as RespuestaFicha;
      expect(publica.ofertas.find((o) => o.id === conPortada.id)?.portada).toBe(fotoB);
    });
  });
});
