import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import {
  AL_SERVIDOR,
  EVENTOS,
  RUTA_TIEMPO_REAL,
  type DetalleConversacion,
  type EventoEscribiendo,
  type EventoVistoEquipo,
  type MensajeChatEquipo,
  type RespuestaChatEquipo,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { ESCRIBIENDO_MINIMO_MS } from '../src/modules/tiempo-real/tiempo-real.gateway';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Espera el primer evento con ese nombre que cumpla la condición, o falla a los 2 s. */
function esperar<T>(socket: Socket, evento: string, condicion: (datos: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(() => {
      socket.off(evento, oir);
      reject(new Error(`No llegó ${evento}`));
    }, 2000);
    function oir(datos: T) {
      if (!condicion(datos)) return;
      clearTimeout(reloj);
      socket.off(evento, oir);
      resolve(datos);
    }
    socket.on(evento, oir);
  });
}

/** Junta lo que llega de un evento mientras dura la prueba. */
function juntar<T>(socket: Socket, evento: string): T[] {
  const lista: T[] = [];
  socket.on(evento, (datos: T) => lista.push(datos));
  return lista;
}

const pausa = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Versión 1.10.0, chat (doc 19, puntos 16 a 19): avisos del chat con el Equipo agrupados por
 * hilo, «¿Lograste cerrar el trato?», ✓ / ✓✓ en el chat con el Equipo y «Escribiendo…».
 */
describe('Versión 1.10.0: avisos agrupados, trato, ✓✓ con el Equipo y «Escribiendo…»', () => {
  let app: INestApplication;
  let base: string;
  const cookies: Record<string, string> = {};
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  let tiendaB: { id: string; nombre: string };

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

  const conectar = (usuario: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(base, {
        path: RUTA_TIEMPO_REAL,
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: { cookie: cookies[usuario] ?? '' },
      });
      sockets.push(socket);
      socket.once(EVENTOS.listo, () => resolve(socket));
      socket.once('connect_error', reject);
    });

  const desconectar = async (socket: Socket) => {
    socket.disconnect();
    await pausa(80);
  };

  /** `usuario` le escribe a Tienda A por una de sus publicaciones con stock. */
  async function hiloCon(usuario: string, indice: number) {
    const ofertas = await prisma.oferta.findMany({
      where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', stock: { gt: 1 } },
      orderBy: { creadaEn: 'asc' },
    });
    const oferta = ofertas[indice];
    if (!oferta) throw new Error('Faltan ofertas de Tienda A en la semilla.');
    const contacto = await como(usuario)
      .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
      .expect(200);
    return { id: contacto.body.conversacion_id as string, oferta };
  }

  const escribir = (usuario: string, id: string, texto: string) =>
    como(usuario).post(`/v1/conversaciones/${id}/mensajes`, { texto }).expect(201);
  const detalle = async (usuario: string, id: string) =>
    (await como(usuario).get(`/v1/conversaciones/${id}`).expect(200)).body as DetalleConversacion;
  const chatDelEquipo = async () =>
    (await como('equipo').get(`/v1/equipo/chats/${tiendaB.id}`).expect(200))
      .body as RespuestaChatEquipo;
  const chatDeLaTienda = async (leer = false) =>
    (
      await como('tiendab')
        .get(`/v1/equipo-chat${leer ? '?leer=1' : ''}`)
        .expect(200)
    ).body as RespuestaChatEquipo;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
    tiendaB = await prisma.tienda.findFirstOrThrow({
      where: { nombre: 'Tienda B' },
      select: { id: true, nombre: true },
    });
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  describe('16 · avisos del chat con el Equipo, uno por hilo', () => {
    it('la tienda recibe una sola fila que se actualiza: «te escribió N mensajes · Último»', async () => {
      for (const texto of ['Hola', '¿Ya viste tu reporte?', 'hola']) {
        await como('equipo').post(`/v1/equipo/chats/${tiendaB.id}/mensajes`, { texto }).expect(201);
      }
      const avisos = await prisma.aviso.findMany({
        where: { usuario: { usuario: 'tiendab' }, enlace: '/mensajes/equipo' },
      });
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({
        titulo: 'El equipo PaseLibre te escribió 3 mensajes',
        extracto: 'Último: "hola"',
        enlace: '/mensajes/equipo',
        leidoEn: null,
      });

      // En la campanita sale una sola vez, arriba.
      const campanita = await como('tiendab').get('/v1/avisos').expect(200);
      expect(
        campanita.body.avisos.filter((a: { enlace: string }) => a.enlace === '/mensajes/equipo'),
      ).toHaveLength(1);

      // Al abrir el chat queda leída; el siguiente mensaje la vuelve a subir sin leer.
      await chatDeLaTienda(true);
      const leido = await prisma.aviso.findUniqueOrThrow({ where: { id: avisos[0]!.id } });
      expect(leido.leidoEn).not.toBeNull();
      await como('equipo')
        .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`, { texto: 'Avísame' })
        .expect(201);
      const otraVez = await prisma.aviso.findUniqueOrThrow({ where: { id: avisos[0]!.id } });
      expect(otraVez).toMatchObject({
        titulo: 'El equipo PaseLibre te escribió',
        extracto: 'Avísame',
        leidoEn: null,
      });
      expect(otraVez.actualizadoEn.getTime()).toBeGreaterThan(leido.actualizadoEn.getTime());
    });

    it('el Equipo recibe «{tienda} escribió al equipo · N mensajes», una fila por hilo', async () => {
      for (const texto of ['Ya lo vi', 'Gracias', 'Una duda más']) {
        await como('tiendab').post('/v1/equipo-chat/mensajes', { texto }).expect(201);
      }
      const avisos = await prisma.aviso.findMany({
        where: { usuario: { usuario: 'equipo' }, enlace: `/equipo/chats?tienda=${tiendaB.id}` },
      });
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatchObject({
        titulo: 'Tienda B escribió al equipo · 3 mensajes',
        extracto: 'Último: "Una duda más"',
        leidoEn: null,
      });
      await chatDelEquipo();
      const leido = await prisma.aviso.findUniqueOrThrow({ where: { id: avisos[0]!.id } });
      expect(leido.leidoEn).not.toBeNull();
    });
  });

  describe('18 · ✓ / ✓✓ en el chat con el Equipo', () => {
    it('del lado del Equipo: ✓ sin conexión, ✓✓ gris al conectarse, ✓✓ verde al leer', async () => {
      const delEquipo = await conectar('equipo');
      const enviado = (
        await como('equipo')
          .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`, { texto: 'Listo, aprobado' })
          .expect(201)
      ).body as MensajeChatEquipo;
      expect(enviado).toMatchObject({ mio: true, estado: 'enviado' });

      // La tienda abre PaseLibre: le llegó.
      const llego = esperar<EventoVistoEquipo>(delEquipo, EVENTOS.vistoEquipo);
      const deLaTienda = await conectar('tiendab');
      expect(await llego).toEqual({ tienda_id: tiendaB.id });
      let chat = await chatDelEquipo();
      expect(chat.mensajes.at(-1)).toMatchObject({ id: enviado.id, estado: 'recibido' });
      expect(chat.visto_hasta).not.toBeNull(); // lo de antes ya lo había leído

      // Con la tienda conectada, lo nuevo sale directo con ✓✓ gris.
      const otro = (
        await como('equipo')
          .post(`/v1/equipo/chats/${tiendaB.id}/mensajes`, { texto: '¿Ya te salió en el perfil?' })
          .expect(201)
      ).body as MensajeChatEquipo;
      expect(otro.estado).toBe('recibido');

      // La tienda lo abre: ✓✓ verde y «Visto por Tienda B a las…».
      const visto = esperar<EventoVistoEquipo>(delEquipo, EVENTOS.vistoEquipo);
      await chatDeLaTienda(true);
      await visto;
      chat = await chatDelEquipo();
      expect(chat.mensajes.at(-1)).toMatchObject({ id: otro.id, estado: 'visto' });
      expect(Date.parse(chat.visto_hasta ?? '')).toBeGreaterThanOrEqual(Date.parse(otro.creado_en));
      // Los de la tienda nunca llevan estado del lado del Equipo.
      expect(chat.mensajes.filter((m) => !m.de_equipo).every((m) => !m.estado)).toBe(true);

      // Con el «Visto» apagado en la tienda, se queda en dos grises.
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: false } });
      chat = await chatDelEquipo();
      expect(chat.mensajes.at(-1)).toMatchObject({ id: otro.id, estado: 'recibido' });
      expect(chat.visto_hasta).toBeNull();
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: true } });
      await desconectar(deLaTienda);
      await desconectar(delEquipo);
    });

    it('del lado de la tienda: «lo leyó» es que alguien del Equipo lo abrió', async () => {
      const deLaTienda = await conectar('tiendab');
      const enviado = (
        await como('tiendab').post('/v1/equipo-chat/mensajes', { texto: 'Sí, ya está' }).expect(201)
      ).body as MensajeChatEquipo;
      expect(enviado).toMatchObject({ mio: true, estado: 'enviado' });

      const llego = esperar<EventoVistoEquipo>(deLaTienda, EVENTOS.vistoEquipo);
      const delEquipo = await conectar('equipo');
      await llego;
      let chat = await chatDeLaTienda();
      expect(chat.mensajes.find((m) => m.id === enviado.id)?.estado).toBe('recibido');

      const leyo = esperar<EventoVistoEquipo>(deLaTienda, EVENTOS.vistoEquipo);
      await chatDelEquipo();
      await leyo;
      chat = await chatDeLaTienda();
      expect(chat.mensajes.find((m) => m.id === enviado.id)?.estado).toBe('visto');
      // Lo del Equipo no lleva estado del lado de la tienda.
      expect(chat.mensajes.filter((m) => m.de_equipo).every((m) => !m.estado)).toBe(true);

      // Con el «Visto» apagado, la tienda tampoco ve el del Equipo.
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: false } });
      chat = await chatDeLaTienda();
      expect(chat.mensajes.find((m) => m.id === enviado.id)?.estado).toBe('recibido');
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: true } });
      await desconectar(deLaTienda);
      await desconectar(delEquipo);
    });
  });

  describe('17 · «¿Lograste cerrar el trato?»', () => {
    it('sale con 6 mensajes y una palabra; solo para quien vende', async () => {
      const { id } = await hiloCon('tiendab', 0);
      await escribir('tiendab', id, 'Hola, ¿sigue disponible?');
      await escribir('tiendaa', id, 'Sí, hay');
      await escribir('tiendab', id, '¿A CUÁNTO me la dejas?');
      await escribir('tiendaa', id, 'Para ti 950');
      await escribir('tiendab', id, 'Ok');
      expect((await detalle('tiendaa', id)).trato).toEqual({
        pospuesta_en: null,
        descartada: false,
        preguntar: false,
      });
      await escribir('tiendaa', id, 'Te espero');
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(true);
      // Quien compra nunca la ve ni la puede responder.
      expect((await detalle('tiendab', id)).trato).toBeNull();
      await como('tiendab')
        .post(`/v1/conversaciones/${id}/trato`, { respuesta: 'NO_PREGUNTAR' })
        .expect(403);
      await como('tiendac')
        .post(`/v1/conversaciones/${id}/trato`, { respuesta: 'NO_PREGUNTAR' })
        .expect(404);
      await como('tiendaa')
        .post(`/v1/conversaciones/${id}/trato`, { respuesta: 'QUIZAS' })
        .expect(400);

      // «Todavía no»: se esconde; a las 24 h vuelve solo si siguieron hablando.
      const pospuesta = await como('tiendaa')
        .post(`/v1/conversaciones/${id}/trato`, { respuesta: 'TODAVIA_NO' })
        .expect(200);
      expect(pospuesta.body).toMatchObject({ descartada: false });
      expect(pospuesta.body.pospuesta_en).not.toBeNull();
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(false);
      await prisma.conversacion.update({
        where: { id },
        data: { tratoPospuestoEn: new Date(Date.now() - 25 * 3_600_000) },
      });
      await prisma.mensaje.updateMany({
        where: { conversacionId: id },
        data: { creadoEn: new Date(Date.now() - 26 * 3_600_000) },
      });
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(false);
      await escribir('tiendab', id, '¿Entonces?');
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(true);

      // La X: nunca más en este chat, aunque sigan hablando.
      await como('tiendaa')
        .post(`/v1/conversaciones/${id}/trato`, { respuesta: 'NO_PREGUNTAR' })
        .expect(200);
      await escribir('tiendab', id, 'Paso a recoger');
      expect((await detalle('tiendaa', id)).trato).toMatchObject({
        descartada: true,
        preguntar: false,
      });
    });

    it('no sale sin las palabras, ni ya vendido', async () => {
      const { id, oferta } = await hiloCon('tiendac', 1);
      for (const [quien, texto] of [
        ['tiendac', 'Hola'],
        ['tiendaa', 'Hola, dime'],
        ['tiendac', '¿Es nueva?'],
        ['tiendaa', 'Sí, sellada'],
        ['tiendac', 'Ok'],
        ['tiendaa', 'Cualquier cosa me escribes'],
      ] as const) {
        await escribir(quien, id, texto);
      }
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(false);
      await escribir('tiendac', id, 'Ya te yapeo');
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(true);
      await como('tiendaa')
        .post(`/v1/ofertas/${oferta.id}/vendido`, { conversacion_id: id })
        .expect(201);
      expect((await detalle('tiendaa', id)).trato?.preguntar).toBe(false);
    });
  });

  describe('19 · «Escribiendo…»', () => {
    it('llega solo a la otra persona de la conversación', async () => {
      const { id } = await hiloCon('tiendab', 2);
      await escribir('tiendab', id, 'Hola');
      const deA = await conectar('tiendaa');
      const deB = await conectar('tiendab');
      const deC = await conectar('tiendac');
      const aB = juntar<EventoEscribiendo>(deB, EVENTOS.escribiendo);
      const aC = juntar<EventoEscribiendo>(deC, EVENTOS.escribiendo);

      const llega = esperar<EventoEscribiendo>(deA, EVENTOS.escribiendo);
      deB.emit(AL_SERVIDOR.escribiendo, { conversacion_id: id });
      expect(await llega).toEqual({ conversacion_id: id });

      // Quien no está en la conversación no puede avisar nada; y basura se ignora.
      const aA = juntar<EventoEscribiendo>(deA, EVENTOS.escribiendo);
      deC.emit(AL_SERVIDOR.escribiendo, { conversacion_id: id });
      deC.emit(AL_SERVIDOR.escribiendo, { conversacion_id: 'nada' });
      await pausa(300);
      expect(aA).toHaveLength(0);
      expect(aB).toHaveLength(0);
      expect(aC).toHaveLength(0);

      // Más seguido de lo que manda el navegador, se ignora.
      deB.emit(AL_SERVIDOR.escribiendo, { conversacion_id: id });
      await pausa(300);
      expect(aA).toHaveLength(0);

      // «Borró todo» se avisa al instante (justo después de un «escribiendo»).
      const borro = esperar<EventoEscribiendo>(deA, EVENTOS.escribiendo);
      deB.emit(AL_SERVIDOR.escribiendo, { conversacion_id: id, borro: true });
      expect(await borro).toEqual({ conversacion_id: id, borro: true });
      aA.length = 0;

      // Con el «Visto» apagado, tampoco se dice que está escribiendo.
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: false } });
      await pausa(ESCRIBIENDO_MINIMO_MS);
      deB.emit(AL_SERVIDOR.escribiendo, { conversacion_id: id });
      await pausa(300);
      expect(aA).toHaveLength(0);
      await prisma.usuario.update({ where: { usuario: 'tiendab' }, data: { mostrarVisto: true } });
      for (const socket of [deA, deB, deC]) await desconectar(socket);
    });

    it('en el chat con el Equipo, por hilo y en los dos sentidos', async () => {
      const deLaTienda = await conectar('tiendab');
      const delEquipo = await conectar('equipo');
      const deOtraTienda = await conectar('tiendac');
      const aOtra = juntar<EventoEscribiendo>(deOtraTienda, EVENTOS.escribiendo);

      const alEquipo = esperar<EventoEscribiendo>(delEquipo, EVENTOS.escribiendo);
      deLaTienda.emit(AL_SERVIDOR.escribiendo, { equipo: true });
      expect(await alEquipo).toEqual({ equipo: true, tienda_id: tiendaB.id });

      const aLaTienda = esperar<EventoEscribiendo>(deLaTienda, EVENTOS.escribiendo);
      delEquipo.emit(AL_SERVIDOR.escribiendo, { equipo: true, tienda_id: tiendaB.id });
      expect(await aLaTienda).toEqual({ equipo: true, tienda_id: tiendaB.id });

      // Una tienda no puede hacerse pasar por otra.
      await pausa(ESCRIBIENDO_MINIMO_MS);
      const aEquipo = juntar<EventoEscribiendo>(delEquipo, EVENTOS.escribiendo);
      deOtraTienda.emit(AL_SERVIDOR.escribiendo, { equipo: true, tienda_id: tiendaB.id });
      await pausa(300);
      expect(aEquipo).toHaveLength(0);
      expect(aOtra).toHaveLength(0);
      for (const socket of [deLaTienda, delEquipo, deOtraTienda]) await desconectar(socket);
    });
  });
});
