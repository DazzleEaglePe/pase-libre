import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import {
  EVENTOS,
  RUTA_TIEMPO_REAL,
  type ConversacionEnLista,
  type DetalleConversacion,
  type EventoMensajeNuevo,
  type InteresadoOferta,
  type RespuestaContacto,
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
const SLUG_I5 = 'intel-core-i-5-14400-f';

/** Espera el primer evento con ese nombre, o falla a los 2 s. */
function esperar<T>(socket: Socket, evento: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`No llegó ${evento}`)), 2000);
    socket.once(evento, (datos: T) => {
      clearTimeout(reloj);
      resolve(datos);
    });
  });
}

describe('Mensajes, campanita, bloqueo y «Vendido» (RF-39, RF-40, RF-47, RF-55 a RF-57)', () => {
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
    patch: (ruta: string, cuerpo: object) =>
      http()
        .patch(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
    delete: (ruta: string) =>
      http()
        .delete(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? ''),
  });

  /** Socket con la cookie de la persona; resuelve cuando el servidor ya lo unió a sus salas. */
  const conectar = (cookie: string, origen?: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(base, {
        path: RUTA_TIEMPO_REAL,
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: { cookie, ...(origen ? { origin: origen } : {}) },
      });
      sockets.push(socket);
      socket.once(EVENTOS.listo, () => resolve(socket));
      socket.once(EVENTOS.sinSesion, () => reject(new Error('sin sesión')));
      socket.once('connect_error', reject);
    });

  const ofertaDe = async (slug: string, tienda: string) =>
    prisma.oferta.findFirstOrThrow({
      where: { producto: { slug }, tienda: { nombre: tienda }, vigente: true },
    });

  const ingresar = async (usuario: string) =>
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
    await app.listen(0, '127.0.0.1');
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = await ingresar(usuario);
    }
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  let conversacion: string;
  let ventusA: { id: string };

  describe('contactar desde la ficha (RF-21, RF-23)', () => {
    it('sin sesión no se contacta; el equipo no tiene bandeja', async () => {
      ventusA = await ofertaDe(SLUG_VENTUS, 'Tienda A');
      await http()
        .post(`/v1/ofertas/${ventusA.id}/contacto`)
        .set(CABECERAS)
        .send({ canal: 'CHAT' })
        .expect(401);
      await como('equipo').get('/v1/conversaciones').expect(403);
    });

    it('«Enviar mensaje» abre un solo hilo por oferta y persona, con el responsable', async () => {
      const primera = await como('tiendab')
        .post(`/v1/ofertas/${ventusA.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      const segunda = await como('tiendab')
        .post(`/v1/ofertas/${ventusA.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      conversacion = (primera.body as Extract<RespuestaContacto, { canal: 'CHAT' }>)
        .conversacion_id;
      expect(segunda.body.conversacion_id).toBe(conversacion);

      const hilo = await prisma.conversacion.findUniqueOrThrow({
        where: { id: conversacion },
        include: { vendedor: true, comprador: true },
      });
      expect(hilo.vendedor.usuario).toBe('tiendaa');
      expect(hilo.comprador.usuario).toBe('tiendab');
      // Se registra cada clic, nunca el contenido (RF-23).
      expect(await prisma.contacto.count({ where: { ofertaId: ventusA.id } })).toBe(2);
    });

    it('«WhatsApp» devuelve el enlace con el mensaje del lienzo', async () => {
      const respuesta = await como('tiendab')
        .post(`/v1/ofertas/${ventusA.id}/contacto`, { canal: 'WHATSAPP' })
        .expect(200);
      expect(respuesta.body.canal).toBe('WHATSAPP');
      const enlace = new URL(respuesta.body.enlace);
      expect(enlace.origin + enlace.pathname).toBe('https://wa.me/51987111212');
      expect(enlace.searchParams.get('text')).toBe(
        'Vi que tienes MSI GeForce RTX 3070 Ventus 3X OC 8 GB publicado en PaseLibre, ¿a qué precio lo tienes?',
      );
    });

    it('no se contacta a la propia tienda', async () => {
      await como('tiendaa.kevin')
        .post(`/v1/ofertas/${ventusA.id}/contacto`, { canal: 'CHAT' })
        .expect(409);
    });

    it('un hilo sin mensajes no aparece en la bandeja de nadie', async () => {
      const lista = await como('tiendaa').get('/v1/conversaciones').expect(200);
      expect(lista.body.conversaciones).toEqual([]);
    });
  });

  describe('conversar (RF-39, RF-40, RF-55)', () => {
    it('el mensaje llega con la campanita: «Tienes un mensaje sin leer de Tienda B»', async () => {
      const enviado = await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Hola, ¿sigue disponible?' })
        .expect(201);
      expect(enviado.body).toMatchObject({
        tipo: 'TEXTO',
        texto: 'Hola, ¿sigue disponible?',
        mio: true,
      });

      const lista = await como('tiendaa').get('/v1/conversaciones').expect(200);
      expect(lista.body.conteos).toEqual({ todas: 1, no_leidas: 1, archivadas: 0 });
      expect(lista.body.conversaciones[0]).toMatchObject({
        rol: 'vendedor',
        no_leidos: 1,
        otro: {
          nombre: 'Carla V.',
          tienda: { nombre: 'Tienda B', galeria: 'Cyberplaza', stand: '101' },
        },
        oferta: { producto: { slug: SLUG_VENTUS } },
        ultimo_mensaje: { texto: 'Hola, ¿sigue disponible?', mio: false },
      });

      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Te puedo pagar hoy.' })
        .expect(201);
      const avisos = await como('tiendaa').get('/v1/avisos').expect(200);
      expect(avisos.body.sin_leer).toBe(1);
      expect(avisos.body.avisos[0]).toMatchObject({
        titulo: 'Tienes 2 mensajes sin leer de Tienda B',
        extracto: '«Te puedo pagar hoy.»',
        enlace: `/mensajes/${conversacion}`,
        leido: false,
      });
      expect((await como('tiendaa').get('/v1/contadores').expect(200)).body).toEqual({
        mensajes: 1,
        avisos: 1,
      });
    });

    it('bandeja por persona: el asesor de la misma tienda no ve el hilo de su dueño (A-11)', async () => {
      const kevin = await como('tiendaa.kevin').get('/v1/conversaciones').expect(200);
      expect(kevin.body.conversaciones).toEqual([]);
      await como('tiendaa.kevin').get(`/v1/conversaciones/${conversacion}`).expect(404);
      await como('tiendaa.kevin')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Hola' })
        .expect(404);
    });

    it('el detalle trae el producto fijo arriba, con el precio como lo ve cada uno', async () => {
      const vendedor = await como('tiendaa').get(`/v1/conversaciones/${conversacion}`).expect(200);
      expect(vendedor.body as DetalleConversacion).toMatchObject({
        rol: 'vendedor',
        puede_vender: true,
        bloqueaste: false,
        oferta: { stock: 2, precio: { moneda: 'USD', centimos: 25000 }, precio_visible: true },
      });
      const comprador = await como('tiendab').get(`/v1/conversaciones/${conversacion}`).expect(200);
      expect(comprador.body).toMatchObject({ rol: 'comprador', puede_vender: false });
    });

    it('al leer, se apagan los contadores y el otro ve «Visto»', async () => {
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
      expect((await como('tiendaa').get('/v1/contadores')).body).toEqual({
        mensajes: 0,
        avisos: 0,
      });
      const historial = await como('tiendab')
        .get(`/v1/conversaciones/${conversacion}/mensajes`)
        .expect(200);
      expect(historial.body.mensajes.map((m: { texto: string }) => m.texto)).toEqual([
        'Hola, ¿sigue disponible?',
        'Te puedo pagar hoy.',
      ]);
      expect(historial.body.visto_hasta).not.toBeNull();
    });

    it('el historial va por páginas, de lo más nuevo hacia atrás', async () => {
      const ultima = await como('tiendab')
        .get(`/v1/conversaciones/${conversacion}/mensajes?limite=1`)
        .expect(200);
      expect(ultima.body).toMatchObject({
        hay_mas: true,
        mensajes: [{ texto: 'Te puedo pagar hoy.' }],
      });
      const anterior = await como('tiendab')
        .get(
          `/v1/conversaciones/${conversacion}/mensajes?limite=1&antes=${encodeURIComponent(ultima.body.mensajes[0].creado_en)}`,
        )
        .expect(200);
      expect(anterior.body).toMatchObject({
        hay_mas: false,
        mensajes: [{ texto: 'Hola, ¿sigue disponible?' }],
      });
    });

    it('manda fotos subidas por su tienda, no ajenas', async () => {
      const foto = await sharp({
        create: { width: 40, height: 30, channels: 3, background: '#C8F03C' },
      })
        .jpeg()
        .toBuffer();
      const subida = await http()
        .post('/v1/archivos')
        .set(CABECERAS)
        .set('Cookie', cookies.tiendab ?? '')
        .attach('foto', foto, 'caja.jpg')
        .expect(201);
      const ajena = await como('tiendaa')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { foto: subida.body.ruta })
        .expect(400);
      expect(ajena.body.error.mensaje).toBe('Una de las fotos no es válida; súbela de nuevo.');
      const enviada = await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, {
          foto: subida.body.ruta,
          texto: 'Así la quiere mi cliente',
        })
        .expect(201);
      expect(enviada.body).toMatchObject({ tipo: 'FOTO', foto: subida.body.ruta });
    });

    it('no acepta mensajes vacíos', async () => {
      const vacio = await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: '   ' })
        .expect(400);
      expect(vacio.body.error.mensaje).toBe('Escribe un mensaje o elige una foto.');
    });
  });

  describe('tiempo real (docs/05 §6.3)', () => {
    it('cada persona recibe el mensaje al instante, con su «mío»', async () => {
      const luis = await conectar(cookies.tiendaa ?? '');
      const carla = await conectar(cookies.tiendab ?? '');
      const paraLuis = esperar<EventoMensajeNuevo>(luis, EVENTOS.mensajeNuevo);
      const avisoLuis = esperar<{ titulo: string }>(luis, EVENTOS.avisoNuevo);
      const paraCarla = esperar<EventoMensajeNuevo>(carla, EVENTOS.mensajeNuevo);

      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: '¿Me la separas?' })
        .expect(201);
      expect(await paraLuis).toMatchObject({
        conversacion_id: conversacion,
        mensaje: { texto: '¿Me la separas?', mio: false },
      });
      expect((await paraCarla).mensaje.mio).toBe(true);
      expect((await avisoLuis).titulo).toBe('Tienes 2 mensajes sin leer de Tienda B');

      const visto = esperar<{ conversacion_id: string }>(carla, EVENTOS.mensajeVisto);
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
      expect((await visto).conversacion_id).toBe(conversacion);

      const detalle = await como('tiendab').get(`/v1/conversaciones/${conversacion}`).expect(200);
      expect(detalle.body.otro.en_linea).toBe(true);
    });

    it('sin sesión o desde otro sitio, el socket no entra', async () => {
      await expect(conectar('pl_sesion=inventada')).rejects.toThrow('sin sesión');
      await expect(conectar(cookies.tiendab ?? '', 'https://otro-sitio.com')).rejects.toThrow();
    });

    it('al cerrar sesión, los sockets de esa sesión se cortan', async () => {
      const cookie = await ingresar('tiendac');
      const socket = await conectar(cookie);
      const cortado = esperar<string>(socket, 'disconnect');
      await http().delete('/v1/sesion').set(CABECERAS).set('Cookie', cookie).expect(204);
      expect(await cortado).toBe('io server disconnect');
    });
  });

  describe('acciones de la conversación (RF-57)', () => {
    it('silenciada: el chat se actualiza, pero no hay campanita', async () => {
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { silenciada: true })
        .expect(200);
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Avísame' })
        .expect(201);
      expect((await como('tiendaa').get('/v1/contadores')).body).toEqual({
        mensajes: 1,
        avisos: 0,
      });
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { silenciada: false, leida: true })
        .expect(200);
    });

    it('«No molestar»: el aviso aparece al terminar el horario', async () => {
      // Todo el día menos un minuto: siempre dentro del horario.
      await prisma.usuario.update({
        where: { usuario: 'tiendaa' },
        data: { noMolestarDesde: 0, noMolestarHasta: 1439 },
      });
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Te escribo de noche' })
        .expect(201);
      const avisos = await como('tiendaa').get('/v1/avisos').expect(200);
      expect(avisos.body.sin_leer).toBe(0);
      const guardado = await prisma.aviso.findFirstOrThrow({
        where: { conversacionId: conversacion },
      });
      expect(guardado.visibleDesde.getTime()).toBeGreaterThan(Date.now());
      await prisma.usuario.update({
        where: { usuario: 'tiendaa' },
        data: { noMolestarDesde: null, noMolestarHasta: null },
      });
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
    });

    it('archivar y marcar como no leída', async () => {
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { archivada: true })
        .expect(200);
      const archivadas = await como('tiendaa')
        .get('/v1/conversaciones?filtro=archivadas')
        .expect(200);
      expect(archivadas.body.conteos).toMatchObject({ todas: 0, archivadas: 1 });

      const noLeida = await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { archivada: false, leida: false })
        .expect(200);
      expect(noLeida.body).toMatchObject({ archivada: false, no_leida: true });
      const lista = await como('tiendaa').get('/v1/conversaciones?filtro=no_leidas').expect(200);
      expect(lista.body.conversaciones.map((c: ConversacionEnLista) => c.id)).toEqual([
        conversacion,
      ]);
      await como('tiendaa')
        .patch(`/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
    });

    it('busca por tienda o producto', async () => {
      const porTienda = await como('tiendaa').get('/v1/conversaciones?q=tienda b').expect(200);
      expect(porTienda.body.conversaciones).toHaveLength(1);
      const porProducto = await como('tiendaa').get('/v1/conversaciones?q=ventus').expect(200);
      expect(porProducto.body.conversaciones).toHaveLength(1);
      const nada = await como('tiendaa').get('/v1/conversaciones?q=kingston').expect(200);
      expect(nada.body.conversaciones).toHaveLength(0);
    });

    it('bloquear a la tienda: no puede escribir ni volver a contactar, y no se le avisa', async () => {
      await como('tiendaa').post(`/v1/conversaciones/${conversacion}/bloqueo`).expect(204);
      const bloqueado = await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: '¿Hola?' })
        .expect(403);
      expect(bloqueado.body.error).toMatchObject({
        codigo: 'BLOQUEADO',
        mensaje: 'No puedes escribir en esta conversación.',
      });
      const i5 = await ofertaDe(SLUG_I5, 'Tienda A');
      const contacto = await como('tiendab')
        .post(`/v1/ofertas/${i5.id}/contacto`, { canal: 'WHATSAPP' })
        .expect(403);
      expect(contacto.body.error.codigo).toBe('BLOQUEADO');

      const detalle = await como('tiendaa').get(`/v1/conversaciones/${conversacion}`).expect(200);
      expect(detalle.body.bloqueaste).toBe(true);
      await como('tiendaa')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Hola' })
        .expect(409);

      await como('tiendaa').delete(`/v1/conversaciones/${conversacion}/bloqueo`).expect(204);
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Gracias' })
        .expect(201);
    });

    it('denunciar guarda el motivo, nunca los mensajes', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/denuncias', {
          objeto: 'CONVERSACION',
          objeto_id: conversacion,
          motivo: 'Me pidió un adelanto por fuera.',
        })
        .expect(201);
      const denuncia = await prisma.denuncia.findUniqueOrThrow({
        where: { id: respuesta.body.id },
      });
      expect(denuncia).toMatchObject({ objeto: 'CONVERSACION', estado: 'ABIERTA' });
      await como('tiendac')
        .post('/v1/denuncias', {
          objeto: 'CONVERSACION',
          objeto_id: conversacion,
          motivo: 'No es mía',
        })
        .expect(404);
    });

    it('trae las respuestas rápidas de la persona (RF-56)', async () => {
      const respuesta = await como('tiendab').get('/v1/cuenta/respuestas-rapidas').expect(200);
      expect(respuesta.body.map((r: { texto: string }) => r.texto)).toEqual([
        '¿Sigue disponible?',
        'Te lo separo',
        'Paso a recoger',
        'Ya no tengo',
      ]);
    });

    it('frena a quien manda más de 30 mensajes por minuto', async () => {
      const kevin = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa.kevin' } });
      const ajeno = await prisma.conversacion.findUniqueOrThrow({ where: { id: conversacion } });
      await prisma.mensaje.createMany({
        data: Array.from({ length: 30 }, () => ({
          conversacionId: ajeno.id,
          autorId: kevin.id,
          tipo: 'TEXTO' as const,
          texto: 'relleno',
        })),
      });
      const respuesta = await como('tiendaa.kevin')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Uno más' })
        .expect(429);
      expect(respuesta.body.error.codigo).toBe('DEMASIADAS_SOLICITUDES');
      await prisma.mensaje.deleteMany({ where: { autorId: kevin.id } });
    });
  });

  describe('«Vendido» (RF-47)', () => {
    let conversacionC: string;

    it('lista a quienes escribieron por la oferta', async () => {
      const contacto = await como('tiendac')
        .post(`/v1/ofertas/${ventusA.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      conversacionC = contacto.body.conversacion_id;
      await como('tiendac')
        .post(`/v1/conversaciones/${conversacionC}/mensajes`, { texto: '¿Precio por 2?' })
        .expect(201);

      const interesados = await como('tiendaa')
        .get(`/v1/ofertas/${ventusA.id}/interesados`)
        .expect(200);
      expect(interesados.body.map((i: InteresadoOferta) => i.persona.tienda.nombre)).toEqual([
        'Tienda C',
        'Tienda B',
      ]);
      // El asesor no vende por los hilos de su dueño (A-11).
      const kevin = await como('tiendaa.kevin')
        .get(`/v1/ofertas/${ventusA.id}/interesados`)
        .expect(200);
      expect(kevin.body).toEqual([]);
      // Otra tienda no ve quién pregunta.
      await como('tiendab').get(`/v1/ofertas/${ventusA.id}/interesados`).expect(404);
    });

    it('baja 1 de stock, guarda la venta y deja el aviso en el chat', async () => {
      const luis = await conectar(cookies.tiendaa ?? '');
      const stock = esperar<{ oferta_id: string; stock: number }>(luis, EVENTOS.ofertaStock);

      const respuesta = await como('tiendaa')
        .post(`/v1/ofertas/${ventusA.id}/vendido`, { conversacion_id: conversacion })
        .expect(201);
      expect(respuesta.body).toMatchObject({
        stock_antes: 2,
        stock_despues: 1,
        mensaje: {
          tipo: 'SISTEMA',
          texto: '1 unidad vendida a Tienda B · stock 2 → 1',
          mio: false,
        },
      });
      expect(await stock).toEqual({ oferta_id: ventusA.id, stock: 1 });

      const venta = await prisma.venta.findFirstOrThrow({ where: { ofertaId: ventusA.id } });
      expect(venta).toMatchObject({ stockAntes: 2, stockDespues: 1, conversacionId: conversacion });
      // Para el comprador, el aviso del sistema cuenta como no leído; para quien vendió, no.
      expect((await como('tiendab').get('/v1/contadores')).body.mensajes).toBe(1);
      expect((await como('tiendaa').get('/v1/contadores')).body.mensajes).toBe(1); // el de Tienda C
    });

    it('dos «Vendido» a la vez con 1 en stock: uno pasa y el otro avisa', async () => {
      const [a, b] = await Promise.all([
        como('tiendaa').post(`/v1/ofertas/${ventusA.id}/vendido`, {
          conversacion_id: conversacion,
        }),
        como('tiendaa').post(`/v1/ofertas/${ventusA.id}/vendido`, {
          conversacion_id: conversacionC,
        }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const oferta = await prisma.oferta.findUniqueOrThrow({ where: { id: ventusA.id } });
      expect(oferta.stock).toBe(0);
      expect(await prisma.venta.count({ where: { ofertaId: ventusA.id } })).toBe(2);

      const vendida = a.status === 201 ? a : b;
      expect(vendida.body.mensaje.texto).toMatch(/stock 1 → 0 · ahora figura «Sin stock»$/);
      const detalle = await como('tiendaa').get(`/v1/conversaciones/${conversacion}`).expect(200);
      expect(detalle.body.puede_vender).toBe(false);
    });

    it('solo se vende a quien escribió por esa oferta, y solo la tienda dueña', async () => {
      await prisma.oferta.update({ where: { id: ventusA.id }, data: { stock: 3 } });
      const i5 = await ofertaDe(SLUG_I5, 'Tienda A');
      await como('tiendaa')
        .post(`/v1/ofertas/${i5.id}/vendido`, { conversacion_id: conversacion })
        .expect(400);
      await como('tiendab')
        .post(`/v1/ofertas/${ventusA.id}/vendido`, { conversacion_id: conversacion })
        .expect(404);
    });

    it('al suspender una cuenta, su socket se corta', async () => {
      const carla = await conectar(cookies.tiendab ?? '');
      const cortado = esperar<string>(carla, 'disconnect');
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });
      await como('equipo')
        .patch(`/v1/equipo/cuentas/${usuario.id}`, { estado: 'SUSPENDIDA' })
        .expect(200);
      expect(await cortado).toBe('io server disconnect');
    });
  });
});
