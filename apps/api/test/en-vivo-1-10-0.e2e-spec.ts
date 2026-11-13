import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import {
  EVENTOS,
  RUTA_TIEMPO_REAL,
  type EnVivoConVendedor,
  type EnVivoPropio,
  type EventoMensajeNuevo,
  type RespuestaAvisos,
  type RespuestaAvisosCuenta,
  type RespuestaEnVivo,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const SLUG_VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';
/** Así guarda las fotos `POST /v1/archivos`; la del catálogo de la prueba se pone a mano. */
const FOTO_CATALOGO = '2026/11/00000000-0000-4000-8000-000000000021.webp';

function fotoJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#F97316' } })
    .jpeg()
    .toBuffer();
}

function esperar<T>(socket: Socket, evento: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`No llegó ${evento}`)), 2000);
    socket.once(evento, (datos: T) => {
      clearTimeout(reloj);
      resolve(datos);
    });
  });
}

describe('Versión 1.10.0: pedir en vivo con fotos y sin precio, y el sonido (doc 19, 21 y 22)', () => {
  let app: INestApplication;
  let base: string;
  const cookies: Record<string, string> = {};
  const sockets: Socket[] = [];
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
    put: (ruta: string, cuerpo: object) =>
      http()
        .put(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
    subir: async () =>
      (
        await http()
          .post('/v1/archivos')
          .set(CABECERAS)
          .set('Cookie', cookies[usuario] ?? '')
          .attach('foto', await fotoJpeg(), { filename: 'caja.jpg', contentType: 'image/jpeg' })
          .expect(201)
      ).body.ruta as string,
  });

  const conectar = (cookie: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(base, {
        path: RUTA_TIEMPO_REAL,
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: { cookie },
      });
      sockets.push(socket);
      socket.once(EVENTOS.listo, () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const avisosEnVivo = async (usuario: string) =>
    ((await como(usuario).get('/v1/avisos').expect(200)).body as RespuestaAvisos).avisos.filter(
      (a) => a.tipo === 'EN_VIVO',
    );

  let ventus: string;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ enVivo: true });
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
    const producto = await prisma.producto.findUniqueOrThrow({ where: { slug: SLUG_VENTUS } });
    ventus = producto.id;
    await prisma.productoFoto.deleteMany({ where: { productoId: ventus } });
    await prisma.productoFoto.create({
      data: { productoId: ventus, ruta: FOTO_CATALOGO, orden: 0 },
    });
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  describe('21 · Busco sin precio y con fotos', () => {
    let busco: EnVivoPropio;

    it('el presupuesto que llegue se ignora: el busco va sin precio', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'Fuente modular 750W blanca',
          categoria: 'fuentes',
          presupuesto: '120',
          mostrar_precio: true,
          duracion: '1h',
        })
        .expect(201);
      expect(respuesta.body).toMatchObject({ precio: null, fotos: [], foto: null });
      const fila = await prisma.enVivo.findUniqueOrThrow({ where: { id: respuesta.body.id } });
      expect(fila.precioCentimos).toBeNull();
    });

    it('del catálogo: la foto del catálogo primero y hasta 2 propias; sale con la primera', async () => {
      const [una, otra] = [await como('tiendab').subir(), await como('tiendab').subir()];
      const respuesta = await como('tiendab')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          producto: ventus,
          fotos: [FOTO_CATALOGO, una, otra],
          duracion: '1h',
        })
        .expect(201);
      busco = respuesta.body as EnVivoPropio;
      expect(busco).toMatchObject({
        fotos: [FOTO_CATALOGO, una, otra],
        foto: FOTO_CATALOGO,
        precio: null,
        producto: { foto: FOTO_CATALOGO },
      });
      // Las subidas quedan usadas: no sirven para otro pedido.
      const usadas = await prisma.archivo.findMany({ where: { ruta: { in: [una, otra] } } });
      expect(usadas.every((archivo) => archivo.usadoEn !== null)).toBe(true);
      await como('tiendab')
        .post('/v1/en-vivo', { tipo: 'BUSCO', producto: ventus, fotos: [una], duracion: '1h' })
        .expect(400);
    });

    it('los demás lo ven con su foto, y el aviso de la campanita también', async () => {
      const cuerpo = (await como('tiendaa').get('/v1/en-vivo?tipo=busco').expect(200))
        .body as Exclude<RespuestaEnVivo, { audiencia: 'visitante' }>;
      const visto = cuerpo.en_vivo.find((item) => item.id === busco.id) as EnVivoConVendedor;
      expect(visto).toMatchObject({ foto: FOTO_CATALOGO, precio: null });
      const visitante = (await http().get('/v1/en-vivo').expect(200)).body as RespuestaEnVivo;
      expect(visitante.en_vivo.find((item) => item.id === busco.id)?.foto).toBe(FOTO_CATALOGO);

      const aviso = (await avisosEnVivo('tiendaa')).find(
        (a) => a.enlace === `/pedidos-en-vivo?id=${busco.id}`,
      );
      expect(aviso).toMatchObject({ foto: FOTO_CATALOGO });
      expect(aviso?.extracto).not.toContain('Paga hasta');
    });

    it('si quita la del catálogo, la primera propia es la que se ve', async () => {
      const propia = await como('tiendac').subir();
      const respuesta = await como('tiendac')
        .post('/v1/en-vivo', { tipo: 'BUSCO', producto: ventus, fotos: [propia], duracion: '1h' })
        .expect(201);
      expect(respuesta.body).toMatchObject({ fotos: [propia], foto: propia });
    });

    it('sin fotos, sale con la del producto', async () => {
      const respuesta = await como('tiendaa')
        .post('/v1/en-vivo', { tipo: 'BUSCO', producto: ventus, duracion: '1h' })
        .expect(201);
      expect(respuesta.body).toMatchObject({ fotos: [], foto: FOTO_CATALOGO });
    });

    it('escrito a mano: con la foto que subió la tienda', async () => {
      await prisma.enVivo.updateMany({
        where: { autor: { usuario: 'tiendac' } },
        data: { estado: 'CERRADO', cerradoEn: new Date() },
      });
      const propia = await como('tiendac').subir();
      const respuesta = await como('tiendac')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'Case blanco con vidrio templado',
          categoria: 'cases',
          fotos: [propia],
          duracion: '1h',
        })
        .expect(201);
      expect(respuesta.body).toMatchObject({ producto: null, fotos: [propia], foto: propia });
    });

    it('hasta 3 fotos, sin repetir, y solo las de tu tienda o las del producto', async () => {
      await prisma.enVivo.updateMany({
        where: { autor: { usuario: 'tiendac' } },
        data: { estado: 'CERRADO', cerradoEn: new Date() },
      });
      const fotos = [
        await como('tiendac').subir(),
        await como('tiendac').subir(),
        await como('tiendac').subir(),
        await como('tiendac').subir(),
      ];
      const cuatro = await como('tiendac')
        .post('/v1/en-vivo', { tipo: 'BUSCO', producto: ventus, fotos, duracion: '1h' })
        .expect(400);
      expect(JSON.stringify(cuatro.body)).toContain('hasta 3 fotos');
      await como('tiendac')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          producto: ventus,
          fotos: [fotos[0], fotos[0]],
          duracion: '1h',
        })
        .expect(400);
      // Una foto de otra tienda no se puede colgar.
      const ajena = await como('tiendaa').subir();
      await como('tiendac')
        .post('/v1/en-vivo', { tipo: 'BUSCO', producto: ventus, fotos: [ajena], duracion: '1h' })
        .expect(400);
      // La del catálogo de otro producto tampoco: en un busco a mano no hay producto.
      await como('tiendac')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'RTX 3070',
          categoria: 'graficas',
          fotos: [FOTO_CATALOGO],
          duracion: '1h',
        })
        .expect(400);
      // Nada quedó a medias: ninguna de las fotos se marcó como usada.
      const libres = await prisma.archivo.findMany({ where: { ruta: { in: fotos } } });
      expect(libres.every((archivo) => archivo.usadoEn === null)).toBe(true);
    });
  });

  describe('22 · El sonido', () => {
    it('viene prendido, se apaga y se guarda; sin el campo, queda como estaba', async () => {
      const inicial = (await como('tiendaa').get('/v1/cuenta/avisos').expect(200))
        .body as RespuestaAvisosCuenta;
      expect(inicial.sonido).toBe(true);

      const apagado = await como('tiendaa')
        .put('/v1/cuenta/avisos', {
          campanita: { MENSAJE: true },
          no_molestar: null,
          sonido: false,
        })
        .expect(200);
      expect(apagado.body.sonido).toBe(false);

      const sinCampo = await como('tiendaa')
        .put('/v1/cuenta/avisos', { campanita: { MENSAJE: true }, no_molestar: null })
        .expect(200);
      expect(sinCampo.body.sonido).toBe(false);
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
      expect(usuario.sonido).toBe(false);

      await como('tiendaa')
        .put('/v1/cuenta/avisos', { campanita: { MENSAJE: true }, no_molestar: null, sonido: 'si' })
        .expect(400);
    });

    it('el mensaje nuevo dice quién escribió, solo a quien lo recibe', async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { producto: { slug: SLUG_VENTUS }, tienda: { nombre: 'Tienda A' }, vigente: true },
      });
      const contacto = await como('tiendab')
        .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      const conversacion = contacto.body.conversacion_id as string;
      const [deA, deB] = [
        await conectar(cookies.tiendaa ?? ''),
        await conectar(cookies.tiendab ?? ''),
      ];
      const llegaA = esperar<EventoMensajeNuevo>(deA, EVENTOS.mensajeNuevo);
      const llegaB = esperar<EventoMensajeNuevo>(deB, EVENTOS.mensajeNuevo);
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: '¿Todavía tienes la 3070?' })
        .expect(201);
      const [aA, aB] = await Promise.all([llegaA, llegaB]);
      expect(aA).toMatchObject({ conversacion_id: conversacion, remitente: 'Tienda B' });
      expect(aA.mensaje.mio).toBe(false);
      expect(aB.mensaje.mio).toBe(true);
      expect(aB.remitente).toBeUndefined();
    });
  });
});
