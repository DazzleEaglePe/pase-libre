/**
 * La tienda elige la foto de portada de su publicación (docs/17 §5).
 *
 * Portada = la que eligió la tienda (una de sus fotos) ?? la primera del producto ?? la primera
 * de la tienda. Sale así en el feed, los resultados con sesión, el perfil, Wilson, el chat y en
 * vivo. El visitante también la ve: las fotos de la tienda ya le llegaban en la ficha pública
 * (`ofertas[].fotos`), y ninguna foto dice el precio, la tienda, el stand ni el WhatsApp.
 */
import { rm } from 'node:fs/promises';

import type { INestApplication } from '@nestjs/common';
import {
  PORTADA_AJENA,
  type ArchivoSubido,
  type DetalleConversacion,
  type EnVivoPropio,
  type OfertaPropia,
  type PerfilTienda,
  type RespuestaBuscar,
  type RespuestaContacto,
  type RespuestaConversaciones,
  type RespuestaEnVivo,
  type RespuestaFicha,
  type RespuestaMisOfertas,
  type RespuestaPortada,
  type RespuestaPublicar,
  type RespuestaWilson,
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

const SLUG_GIGABYTE = 'gigabyte-geforce-rtx-3070-gaming-oc-8-gb';
/** Sin fotos en el catálogo: la portada de siempre es la primera de la tienda. */
const SLUG_TRIO = 'msi-geforce-rtx-3070-gaming-z-trio-8-gb-lhr';
/** La foto del catálogo del Gigabyte (no es de ninguna tienda). */
const FOTO_CATALOGO = '2026/11/00000000-0000-4000-8000-0000000000c1.webp';

/** Los resultados con sesión: cada tarjeta con su oferta destacada. */
type ConPrecio = Exclude<RespuestaBuscar, { audiencia: 'visitante' }>;

function fotoJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#E8F5EE' } })
    .jpeg()
    .toBuffer();
}

describe('La tienda elige la foto de portada (docs/17 §5)', () => {
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
    patch: (ruta: string, cuerpo: object) =>
      http()
        .patch(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });

  const subir = async (usuario: string): Promise<string> =>
    (
      (
        await http()
          .post('/v1/archivos')
          .set(CABECERAS)
          .set('Cookie', cookies[usuario] ?? '')
          .attach('foto', await fotoJpeg(), { filename: 'foto.jpg', contentType: 'image/jpeg' })
          .expect(201)
      ).body as ArchivoSubido
    ).ruta;

  const idDe = async (slug: string) =>
    (await prisma.producto.findUniqueOrThrow({ where: { slug } })).id;

  /** La foto con la que sale la oferta en «Recién publicado» (sin `usuario`, como visitante). */
  const enElFeed = async (ofertaId: string, usuario?: string) => {
    const respuesta = usuario
      ? await como(usuario).get('/v1/portada').expect(200)
      : await http().get('/v1/portada').expect(200);
    const cuerpo = respuesta.body as RespuestaPortada;
    const tarjeta = cuerpo.recien_publicado.find((t) => t.oferta_id === ofertaId);
    expect(tarjeta, 'la oferta sale en «Recién publicado»').toBeDefined();
    return { foto: tarjeta?.producto.foto, cuerpo };
  };

  let fotoA: string;
  let fotoB: string;
  /** La oferta de Tienda B del Gigabyte, con dos fotos suyas. */
  let deB: OfertaPropia;
  let tiendaB: string;

  beforeAll(async () => {
    await rm(CARPETA_MEDIA_PRUEBAS, { recursive: true, force: true });
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    await prisma.productoFoto.create({
      data: { productoId: await idDe(SLUG_GIGABYTE), ruta: FOTO_CATALOGO, orden: 0 },
    });
    tiendaB = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } })).id;
    app = await crearApp({ enVivo: true });
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac']) {
      const respuesta = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200);
      cookies[usuario] = cookieDe(respuesta);
    }
    fotoA = await subir('tiendab');
    fotoB = await subir('tiendab');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('al publicar', () => {
    const base = async () => ({
      producto_id: await idDe(SLUG_GIGABYTE),
      estado_detalle: 'USADO',
      stock: 2,
      moneda: 'USD',
      precio: '200',
      quien_ve_precio: 'TODOS',
    });

    it('no acepta una portada que no es una de sus fotos', async () => {
      // La del catálogo no se elige así: elegirla es mandar nulo.
      const delCatalogo = await como('tiendab')
        .post('/v1/ofertas', { ...(await base()), fotos: [fotoA], portada: FOTO_CATALOGO })
        .expect(400);
      expect(delCatalogo.body.error).toMatchObject({
        codigo: 'DATOS_INVALIDOS',
        mensaje: PORTADA_AJENA,
      });
      expect(delCatalogo.body.error.detalles.campos).toContainEqual({
        campo: 'portada',
        mensaje: PORTADA_AJENA,
      });

      const deOtraTienda = await subir('tiendac');
      const ajena = await como('tiendab')
        .post('/v1/ofertas', { ...(await base()), fotos: [fotoA], portada: deOtraTienda })
        .expect(400);
      expect(ajena.body.error.mensaje).toBe(PORTADA_AJENA);

      const inventada = await como('tiendab')
        .post('/v1/ofertas', { ...(await base()), fotos: [fotoA], portada: '../../.env' })
        .expect(400);
      expect(inventada.body.error.mensaje).toBe(PORTADA_AJENA);

      // Nada quedó a medias: ni la oferta ni la foto marcada como usada.
      expect(
        await prisma.oferta.count({
          where: { producto: { slug: SLUG_GIGABYTE }, tiendaId: tiendaB },
        }),
      ).toBe(0);
      expect(await prisma.archivo.count({ where: { ruta: fotoA, usadoEn: { not: null } } })).toBe(
        0,
      );
    });

    it('guarda la portada elegida y Mis publicaciones la devuelve', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/ofertas', { ...(await base()), fotos: [fotoA, fotoB], portada: fotoB })
        .expect(201);
      deB = (respuesta.body as RespuestaPublicar).oferta;
      expect(deB).toMatchObject({
        portada: fotoB,
        fotos: [{ ruta: fotoA }, { ruta: fotoB }],
        producto: { foto: FOTO_CATALOGO },
      });

      const lista = await como('tiendab').get('/v1/mis-ofertas?estado=todas').expect(200);
      const propia = (lista.body as RespuestaMisOfertas).ofertas.find((o) => o.id === deB.id);
      expect(propia?.portada).toBe(fotoB);
      const una = await como('tiendab').get(`/v1/ofertas/${deB.id}`).expect(200);
      expect((una.body as OfertaPropia).portada).toBe(fotoB);
    });

    it('sin elegir, la portada es la del catálogo; sin catálogo, la primera de la tienda', async () => {
      const otraFoto = await subir('tiendab');
      const respuesta = await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_TRIO),
          estado_detalle: 'SELLADO',
          stock: 1,
          fotos: [otraFoto],
          portada: null,
        })
        .expect(201);
      const trio = (respuesta.body as RespuestaPublicar).oferta;
      expect(trio).toMatchObject({ portada: null, producto: { foto: null } });
      // Antes salía el dibujo de la categoría aunque la tienda tuviera fotos.
      expect((await enElFeed(trio.id, 'tiendac')).foto).toBe(otraFoto);
    });
  });

  describe('dónde se ve', () => {
    it('en el feed con sesión; las que no eligieron siguen con la del catálogo', async () => {
      const { foto, cuerpo } = await enElFeed(deB.id, 'tiendac');
      expect(foto).toBe(fotoB);
      // La de Tienda C del mismo producto no eligió.
      const deC = cuerpo.recien_publicado.find(
        (t) => t.producto.slug === SLUG_GIGABYTE && t.oferta_id !== deB.id,
      );
      expect(deC?.producto.foto).toBe(FOTO_CATALOGO);
    });

    it('en los resultados con sesión, con la oferta que la tarjeta pone al frente', async () => {
      const respuesta = await como('tiendaa').get('/v1/buscar?q=gigabyte 3070').expect(200);
      const cuerpo = respuesta.body as ConPrecio;
      const tarjeta = cuerpo.productos.find((p) => p.slug === SLUG_GIGABYTE);
      // La de B (US$ 200) es más barata que la de C (US$ 270).
      expect(tarjeta?.oferta_destacada.id).toBe(deB.id);
      expect(tarjeta?.foto).toBe(fotoB);

      // Sin filtros de la oferta la búsqueda sale de `producto_resumen`; con uno, de las ofertas.
      const conFiltro = await como('tiendaa')
        .get('/v1/buscar?q=gigabyte 3070&condicion=USADO')
        .expect(200);
      const filtrada = (conFiltro.body as ConPrecio).productos.find(
        (p) => p.slug === SLUG_GIGABYTE,
      );
      expect(filtrada?.oferta_destacada.id).toBe(deB.id);
      expect(filtrada?.foto).toBe(fotoB);

      // Para Tienda B la tarjeta pone al frente la de C: sale la del catálogo.
      const paraB = await como('tiendab').get('/v1/buscar?q=gigabyte 3070').expect(200);
      const suya = (paraB.body as ConPrecio).productos.find((p) => p.slug === SLUG_GIGABYTE);
      expect(suya?.oferta_destacada.id).not.toBe(deB.id);
      expect(suya?.foto).toBe(FOTO_CATALOGO);
    });

    it('en el perfil de la tienda y en Wilson', async () => {
      const perfil = (await como('tiendac').get(`/v1/tiendas/${tiendaB}`).expect(200))
        .body as PerfilTienda;
      expect(perfil.productos.find((p) => p.oferta_id === deB.id)?.producto.foto).toBe(fotoB);

      const wilson = (await como('tiendaa').get('/v1/wilson?galeria=cyberplaza').expect(200))
        .body as RespuestaWilson;
      expect(wilson.ofertas.find((o) => o.oferta_id === deB.id)?.producto.foto).toBe(fotoB);
    });

    it('en el chat: la lista, el producto de arriba y «Hablan de»', async () => {
      const contacto = (
        await como('tiendac').post(`/v1/ofertas/${deB.id}/contacto`, { canal: 'CHAT' }).expect(200)
      ).body as Extract<RespuestaContacto, { canal: 'CHAT' }>;
      await como('tiendac')
        .post(`/v1/conversaciones/${contacto.conversacion_id}/mensajes`, { texto: '¿Sigue?' })
        .expect(201);

      const lista = (await como('tiendab').get('/v1/conversaciones').expect(200))
        .body as RespuestaConversaciones;
      const hilo = lista.conversaciones.find((c) => c.id === contacto.conversacion_id);
      expect(hilo?.oferta.producto.foto).toBe(fotoB);

      const detalle = (
        await como('tiendac').get(`/v1/conversaciones/${contacto.conversacion_id}`).expect(200)
      ).body as DetalleConversacion;
      expect(detalle.oferta.producto.foto).toBe(fotoB);
      expect(detalle.hablan_de[0]?.foto).toBe(fotoB);
    });

    it('en una oferta flash en vivo, también para el visitante', async () => {
      const flash = (
        await como('tiendab')
          .post('/v1/en-vivo', {
            tipo: 'FLASH',
            oferta: deB.id,
            precio: '190',
            duracion: '3h',
            cantidad: 1,
          })
          .expect(201)
      ).body as EnVivoPropio;
      expect(flash.producto?.foto).toBe(fotoB);

      const conSesion = (await como('tiendaa').get('/v1/en-vivo?tipo=flash').expect(200))
        .body as RespuestaEnVivo;
      expect(conSesion.en_vivo.find((e) => e.id === flash.id)?.producto?.foto).toBe(fotoB);
      const visitante = (await http().get('/v1/en-vivo').expect(200)).body as RespuestaEnVivo;
      expect(visitante.audiencia).toBe('visitante');
      expect(visitante.en_vivo.find((e) => e.id === flash.id)?.producto?.foto).toBe(fotoB);
    });
  });

  describe('el visitante', () => {
    it('ya recibía las fotos de la tienda en la ficha pública', async () => {
      const ficha = (await http().get(`/v1/productos/${SLUG_GIGABYTE}`).expect(200))
        .body as RespuestaFicha;
      expect(ficha.audiencia).toBe('visitante');
      expect(ficha.ofertas.find((o) => o.id === deB.id)?.fotos.map((f) => f.ruta)).toEqual([
        fotoA,
        fotoB,
      ]);
    });

    it('ve la portada en el feed y en Wilson, sin precio, tienda, stand ni WhatsApp', async () => {
      const { foto, cuerpo } = await enElFeed(deB.id);
      expect(foto).toBe(fotoB);
      expect(cuerpo.audiencia).toBe('visitante');
      const tarjetas = JSON.stringify(cuerpo.recien_publicado);
      for (const prohibido of ['"precio', '"tienda', '"stand', '"whatsapp', 'Tienda B']) {
        expect(tarjetas).not.toContain(prohibido);
      }

      const wilson = (await http().get('/v1/wilson?galeria=cyberplaza').expect(200))
        .body as RespuestaWilson;
      expect(wilson.audiencia).toBe('visitante');
      expect(wilson.ofertas.find((o) => o.oferta_id === deB.id)?.producto.foto).toBe(fotoB);
    });

    it('en los resultados ve la del producto: la tarjeta no pone ninguna oferta al frente', async () => {
      const buscar = (await http().get('/v1/buscar?q=gigabyte 3070').expect(200))
        .body as RespuestaBuscar;
      expect(buscar.audiencia).toBe('visitante');
      expect(buscar.productos.find((p) => p.slug === SLUG_GIGABYTE)?.foto).toBe(FOTO_CATALOGO);
    });
  });

  describe('al editar', () => {
    const editar = (cuerpo: object) => como('tiendab').patch(`/v1/ofertas/${deB.id}`, cuerpo);

    it('cambia la portada a otra foto suya o vuelve a la del catálogo', async () => {
      const otra = await editar({ portada: fotoA }).expect(200);
      expect((otra.body as OfertaPropia).portada).toBe(fotoA);
      expect((await enElFeed(deB.id, 'tiendac')).foto).toBe(fotoA);

      const catalogo = await editar({ portada: null }).expect(200);
      expect((catalogo.body as OfertaPropia).portada).toBeNull();
      expect((await enElFeed(deB.id, 'tiendac')).foto).toBe(FOTO_CATALOGO);
    });

    it('no acepta una portada que no queda entre sus fotos', async () => {
      // Con las fotos de siempre: la del catálogo no es suya.
      const delCatalogo = await editar({ portada: FOTO_CATALOGO }).expect(400);
      expect(delCatalogo.body.error).toMatchObject({
        codigo: 'DATOS_INVALIDOS',
        mensaje: PORTADA_AJENA,
      });
      // En el mismo pedido quita la foto que elige.
      const quitada = await editar({ fotos: [fotoA], portada: fotoB }).expect(400);
      expect(quitada.body.error.mensaje).toBe(PORTADA_AJENA);
      // Nada cambió.
      const una = (await como('tiendab').get(`/v1/ofertas/${deB.id}`).expect(200))
        .body as OfertaPropia;
      expect(una).toMatchObject({ portada: null, fotos: [{ ruta: fotoA }, { ruta: fotoB }] });
    });

    it('ordenar las fotos no cambia la portada; quitar la que era portada la vuelve a nula', async () => {
      await editar({ portada: fotoB }).expect(200);
      const ordenadas = await editar({ fotos: [fotoB, fotoA] }).expect(200);
      expect((ordenadas.body as OfertaPropia).portada).toBe(fotoB);

      const sinLaPortada = await editar({ fotos: [fotoA] }).expect(200);
      expect(sinLaPortada.body as OfertaPropia).toMatchObject({
        portada: null,
        fotos: [{ ruta: fotoA }],
      });
      expect((await enElFeed(deB.id, 'tiendac')).foto).toBe(FOTO_CATALOGO);
    });

    it('elige una foto que sube en el mismo pedido', async () => {
      const nueva = await subir('tiendab');
      const respuesta = await editar({ fotos: [fotoA, nueva], portada: nueva }).expect(200);
      expect((respuesta.body as OfertaPropia).portada).toBe(nueva);
      expect((await enElFeed(deB.id, 'tiendac')).foto).toBe(nueva);
    });

    it('otra tienda no puede tocar la portada', async () => {
      await como('tiendac').patch(`/v1/ofertas/${deB.id}`, { portada: null }).expect(404);
    });
  });
});
