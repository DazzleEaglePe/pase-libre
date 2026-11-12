import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import {
  EVENTOS,
  RUTA_TIEMPO_REAL,
  type DetalleConversacion,
  type EventoMensajeCambio,
  type EventoMensajeNuevo,
  type EventoMensajeRecibido,
  type EventoPresencia,
  type MensajeChat,
  type RespuestaMensajes,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { TiempoRealService } from '../src/modules/tiempo-real/tiempo-real.service';
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
 * Chat de las correcciones 11/11 (N01, N02, N11, N12): en línea, checks, editar y eliminar,
 * pedir y compartir el WhatsApp, «Vendido» con «Deshacer» y quién escribió cada mensaje.
 */
describe('Chat: en línea, checks, editar, WhatsApp y «Deshacer» (N01, N02, N12)', () => {
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

  /** `usuario` le escribe a Tienda A por una de sus publicaciones visibles. */
  async function hiloCon(usuario: string, indice: number, texto = 'Hola, ¿sigue disponible?') {
    const ofertas = await prisma.oferta.findMany({
      where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', stock: { gt: 1 } },
      orderBy: { creadaEn: 'asc' },
    });
    const oferta = ofertas[indice];
    if (!oferta) throw new Error('Faltan ofertas de Tienda A en la semilla.');
    const contacto = await como(usuario)
      .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
      .expect(200);
    const id = contacto.body.conversacion_id as string;
    const primero = await como(usuario)
      .post(`/v1/conversaciones/${id}/mensajes`, { texto })
      .expect(201);
    return { id, oferta, primero: primero.body as MensajeChat };
  }

  const historial = async (usuario: string, id: string) =>
    (await como(usuario).get(`/v1/conversaciones/${id}/mensajes`).expect(200))
      .body as RespuestaMensajes;
  const detalle = async (usuario: string, id: string) =>
    (await como(usuario).get(`/v1/conversaciones/${id}`).expect(200)).body as DetalleConversacion;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    app.get(TiempoRealService).graciaMs = 250;
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'tiendae']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  let hilo: { id: string; oferta: { id: string; tiendaId: string }; primero: MensajeChat };

  describe('en línea (N01)', () => {
    it('el puntito verde sale con la tienda conectada y se apaga 30 s después de irse', async () => {
      hilo = await hiloCon('tiendab', 0);
      const deB = await conectar('tiendab');

      const llega = esperar<EventoPresencia>(deB, EVENTOS.presencia, (e) => e.en_linea);
      const deA = await conectar('tiendaa');
      const evento = await llega;
      expect(evento).toMatchObject({ tienda_id: hilo.oferta.tiendaId, en_linea: true });

      const lista = await como('tiendab').get('/v1/conversaciones').expect(200);
      expect(lista.body.conversaciones[0].otro.en_linea).toBe(true);
      expect((await detalle('tiendab', hilo.id)).otro.en_linea).toBe(true);

      // Kevin, de la misma tienda, entra y sale: Tienda A sigue en línea, sin otro aviso.
      const avisos = juntar<EventoPresencia>(deB, EVENTOS.presencia);
      const deKevin = await conectar('tiendaa.kevin');
      await desconectar(deKevin);

      // Se va Luis: por la gracia, todavía está en línea (recargó la página).
      await desconectar(deA);
      expect((await detalle('tiendab', hilo.id)).otro.en_linea).toBe(true);

      const seFue = await esperar<EventoPresencia>(deB, EVENTOS.presencia, (e) => !e.en_linea);
      expect(seFue.tienda_id).toBe(hilo.oferta.tiendaId);
      expect(seFue.ultima_conexion).not.toBeNull();
      expect(avisos.filter((a) => a.en_linea)).toHaveLength(0);
      const despues = await detalle('tiendab', hilo.id);
      expect(despues.otro).toMatchObject({ en_linea: false });
      expect(despues.otro.ultima_conexion).not.toBeNull();
      await desconectar(deB);
    });

    it('si recarga dentro de los 30 s no se marca desconectada', async () => {
      const deB = await conectar('tiendab');
      const deA = await conectar('tiendaa');
      const avisos = juntar<EventoPresencia>(deB, EVENTOS.presencia);
      await desconectar(deA);
      const otraVez = await conectar('tiendaa');
      await pausa(400);
      expect(avisos.filter((a) => !a.en_linea)).toHaveLength(0);
      await desconectar(otraVez);
      await desconectar(deB);
      await pausa(300);
    });

    it('a quien le escribe por una publicación reservada no le llega su presencia', async () => {
      const reservada = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', id: { not: hilo.oferta.id } },
      });
      await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: false } });
      const contacto = await como('tiendae')
        .post(`/v1/ofertas/${reservada.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      await como('tiendae')
        .post(`/v1/conversaciones/${contacto.body.conversacion_id}/mensajes`, { texto: 'Hola' })
        .expect(201);

      const deE = await conectar('tiendae');
      const deB = await conectar('tiendab');
      const aE = juntar<EventoPresencia>(deE, EVENTOS.presencia);
      const llegaAB = esperar<EventoPresencia>(deB, EVENTOS.presencia, (e) => e.en_linea);
      const deA = await conectar('tiendaa');
      await llegaAB;
      await pausa(150);
      expect(aE).toHaveLength(0);

      const lista = await como('tiendae').get('/v1/conversaciones').expect(200);
      expect(lista.body.conversaciones[0].otro).toMatchObject({ id: '', en_linea: false });
      const delHilo = await detalle('tiendae', contacto.body.conversacion_id);
      expect(delHilo.otro).toMatchObject({ en_linea: false, ultima_conexion: null });
      await desconectar(deA);
      await desconectar(deB);
      await desconectar(deE);
      await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: true } });
      await pausa(300);
    });
  });

  describe('checks: enviado, le llegó, lo leyó (N01)', () => {
    it('sin el otro conectado es un check; al conectarse, le llegó', async () => {
      const deB = await conectar('tiendab');
      const enviado = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: '¿Lo tienes en caja?' })
        .expect(201);
      const antes = await historial('tiendab', hilo.id);
      expect(antes.recibido_hasta === null || antes.recibido_hasta < enviado.body.creado_en).toBe(
        true,
      );

      const llega = esperar<EventoMensajeRecibido>(deB, EVENTOS.mensajeRecibido);
      const deA = await conectar('tiendaa');
      const recibido = await llega;
      expect(recibido.conversacion_id).toBe(hilo.id);
      expect(recibido.recibido_hasta >= enviado.body.creado_en).toBe(true);
      const despues = await historial('tiendab', hilo.id);
      expect(despues.recibido_hasta! >= enviado.body.creado_en).toBe(true);
      expect(despues.visto_hasta).toBeNull();

      // Con el otro conectado, le llega al momento.
      const alMomento = esperar<EventoMensajeRecibido>(deB, EVENTOS.mensajeRecibido);
      const otro = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: '¿Y la boleta?' })
        .expect(201);
      expect((await alMomento).recibido_hasta).toBe(otro.body.creado_en);

      // Lo leyó: dos checks verdes.
      const visto = esperar<{ visto_hasta: string }>(deB, EVENTOS.mensajeVisto);
      await como('tiendaa').patch(`/v1/conversaciones/${hilo.id}`, { leida: true }).expect(200);
      expect((await visto).visto_hasta >= otro.body.creado_en).toBe(true);
      await desconectar(deA);
      await desconectar(deB);
    });

    it('con el «Visto» apagado sus checks quedan en dos grises', async () => {
      await como('tiendaa').patch('/v1/cuenta', { mostrar_visto: false }).expect(200);
      const enviado = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: '¿Me avisas?' })
        .expect(201);
      await como('tiendaa').patch(`/v1/conversaciones/${hilo.id}`, { leida: true }).expect(200);
      const visto = await historial('tiendab', hilo.id);
      expect(visto.visto_hasta).toBeNull();
      expect(visto.recibido_hasta! >= enviado.body.creado_en).toBe(true);
      await como('tiendaa').patch('/v1/cuenta', { mostrar_visto: true }).expect(200);
    });
  });

  describe('quién escribió cada mensaje (N12)', () => {
    it('los mensajes de una tienda con asesores dicen quién los escribió', async () => {
      await como('tiendaa')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'Sí, te la separo' })
        .expect(201);
      const deB = await historial('tiendab', hilo.id);
      const deLuis = deB.mensajes.find((m) => m.texto === 'Sí, te la separo');
      expect(deLuis).toMatchObject({ mio: false, autor: 'Luis' });
      // Tienda B no tiene asesores: sus mensajes no llevan nombre.
      const deA = await historial('tiendaa', hilo.id);
      expect(deA.mensajes.filter((m) => !m.mio && m.tipo === 'TEXTO').every((m) => !m.autor)).toBe(
        true,
      );
      expect(deA.mensajes.find((m) => m.texto === 'Sí, te la separo')?.autor).toBeNull();
    });
  });

  describe('editar y eliminar dentro de 15 minutos (N01)', () => {
    let mio: MensajeChat;

    it('editar: «editado», el otro lo ve al momento y lo de antes queda para el Equipo', async () => {
      mio = (
        await como('tiendab')
          .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'La quiero a 3,800' })
          .expect(201)
      ).body;
      expect(mio.cambiable_hasta).not.toBeNull();
      const deA = await conectar('tiendaa');
      const cambio = esperar<EventoMensajeCambio>(deA, EVENTOS.mensajeCambio);
      const editado = await como('tiendab')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}`, { texto: 'La quiero a 3,850' })
        .expect(200);
      expect(editado.body).toMatchObject({ texto: 'La quiero a 3,850', editado: true });
      expect((await cambio).mensaje).toMatchObject({ texto: 'La quiero a 3,850', editado: true });
      const versiones = await prisma.mensajeVersion.findMany({ where: { mensajeId: mio.id } });
      expect(versiones).toMatchObject([{ cambio: 'EDITADO', texto: 'La quiero a 3,800' }]);
      await desconectar(deA);
    });

    it('solo quien lo escribió lo cambia; nadie de afuera lo toca', async () => {
      await como('tiendaa')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}`, { texto: 'Otro' })
        .expect(403);
      await como('tiendaa')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}?para=todos`)
        .expect(403);
      await como('tiendac')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}`, { texto: 'Otro' })
        .expect(404);
      await como('tiendac')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}?para=mi`)
        .expect(404);
    });

    it('después de 15 minutos ya no se edita ni se elimina para todos', async () => {
      const viejo = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'Mensaje viejo' })
        .expect(201);
      await prisma.mensaje.update({
        where: { id: viejo.body.id },
        data: { creadoEn: new Date(Date.now() - 16 * 60_000) },
      });
      await como('tiendab')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${viejo.body.id}`, { texto: 'Nuevo' })
        .expect(409);
      await como('tiendab')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${viejo.body.id}?para=todos`)
        .expect(409);
      const lista = await historial('tiendab', hilo.id);
      expect(lista.mensajes.find((m) => m.id === viejo.body.id)?.cambiable_hasta).toBeNull();
    });

    it('eliminar para todos: «Eliminaste este mensaje» y lo de antes queda para el Equipo', async () => {
      const borrado = await como('tiendab')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}?para=todos`)
        .expect(200);
      expect(borrado.body.mensaje).toMatchObject({ eliminado: true, texto: null, editado: false });
      const deA = await historial('tiendaa', hilo.id);
      expect(deA.mensajes.find((m) => m.id === mio.id)).toMatchObject({
        eliminado: true,
        texto: null,
        mio: false,
      });
      const versiones = await prisma.mensajeVersion.findMany({
        where: { mensajeId: mio.id },
        orderBy: { creadaEn: 'asc' },
      });
      expect(versiones.map((v) => [v.cambio, v.texto])).toEqual([
        ['EDITADO', 'La quiero a 3,800'],
        ['ELIMINADO', 'La quiero a 3,850'],
      ]);
      await como('tiendab')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${mio.id}`, { texto: 'Vuelvo' })
        .expect(409);
    });

    it('eliminar para mí: deja de verlo solo quien lo pide', async () => {
      const deA = (
        await como('tiendaa')
          .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'Te escribo luego' })
          .expect(201)
      ).body as MensajeChat;
      const respuesta = await como('tiendab')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${deA.id}?para=mi`)
        .expect(200);
      expect(respuesta.body.mensaje).toBeNull();
      expect((await historial('tiendab', hilo.id)).mensajes.some((m) => m.id === deA.id)).toBe(
        false,
      );
      expect(
        (await historial('tiendaa', hilo.id)).mensajes.find((m) => m.id === deA.id),
      ).toMatchObject({ texto: 'Te escribo luego', eliminado: false });
      // Ya no se ve: no se puede responder ni volver a eliminar.
      await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'Ok', responde_a: deA.id })
        .expect(409);
      await como('tiendab')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${deA.id}?para=mi`)
        .expect(404);
      await como('tiendab')
        .delete(`/v1/conversaciones/${hilo.id}/mensajes/${deA.id}?para=nadie`)
        .expect(400);
    });

    it('«Responder» cita un mensaje del mismo hilo', async () => {
      const citado = (await historial('tiendab', hilo.id)).mensajes.find(
        (m) => m.texto === 'Sí, te la separo',
      );
      const respuesta = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, {
          texto: 'Gracias',
          responde_a: citado?.id,
        })
        .expect(201);
      expect(respuesta.body.responde_a).toMatchObject({
        id: citado?.id,
        texto: 'Sí, te la separo',
        mio: false,
      });
      // Un mensaje de otro hilo no se cita.
      const ajeno = await hiloCon('tiendac', 1);
      await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/mensajes`, {
          texto: 'Hola',
          responde_a: ajeno.primero.id,
        })
        .expect(409);
    });
  });

  describe('pedir y compartir el WhatsApp (N01)', () => {
    let pedido: MensajeChat;

    it('pedir: al otro le llega la tarjeta, sin ningún número', async () => {
      const deA = await conectar('tiendaa');
      const llega = esperar<EventoMensajeNuevo>(
        deA,
        EVENTOS.mensajeNuevo,
        (e) => e.mensaje.tipo === 'PEDIDO_WHATSAPP',
      );
      pedido = (
        await como('tiendab').post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido`).expect(200)
      ).body;
      expect(pedido).toMatchObject({ tipo: 'PEDIDO_WHATSAPP', pedido: 'PENDIENTE', mio: true });
      expect((await llega).mensaje).toMatchObject({
        pedido: 'PENDIENTE',
        mio: false,
        whatsapp: null,
      });
      // Dos toques no mandan dos tarjetas.
      const otra = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido`)
        .expect(200);
      expect(otra.body.id).toBe(pedido.id);
      expect((await detalle('tiendab', hilo.id)).whatsapp).toEqual({
        suyo: null,
        pedido_pendiente: true,
        puedes_pedir: true,
        puedes_compartir: true,
      });
      const aviso = await prisma.aviso.findFirstOrThrow({
        where: { conversacionId: hilo.id, usuario: { usuario: 'tiendaa' } },
      });
      expect(aviso.extracto).toBe('Te pidió tu WhatsApp.');
      await desconectar(deA);
    });

    it('nadie más responde el pedido: ni quien lo pidió ni otra tienda', async () => {
      const ruta = `/v1/conversaciones/${hilo.id}/whatsapp/pedido/${pedido.id}`;
      await como('tiendab').post(ruta, { aceptar: true }).expect(404);
      await como('tiendac').post(ruta, { aceptar: true }).expect(404);
      await como('tiendac').post(`/v1/conversaciones/${hilo.id}/whatsapp`).expect(404);
      await como('tiendac').post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido`).expect(404);
    });

    it('al aceptar le llega el número de la tienda, guardado en el chat', async () => {
      const deB = await conectar('tiendab');
      const llega = esperar<EventoMensajeNuevo>(
        deB,
        EVENTOS.mensajeNuevo,
        (e) => e.mensaje.tipo === 'WHATSAPP',
      );
      const respuesta = await como('tiendaa')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido/${pedido.id}`, { aceptar: true })
        .expect(200);
      const tiendaA = await prisma.tienda.findUniqueOrThrow({
        where: { id: hilo.oferta.tiendaId },
      });
      expect(respuesta.body.pedido).toMatchObject({ pedido: 'ACEPTADO' });
      expect(respuesta.body.compartido).toMatchObject({
        tipo: 'WHATSAPP',
        whatsapp: tiendaA.whatsapp,
        mio: true,
      });
      expect((await llega).mensaje).toMatchObject({ whatsapp: tiendaA.whatsapp, mio: false });
      expect((await detalle('tiendab', hilo.id)).whatsapp).toMatchObject({
        suyo: tiendaA.whatsapp,
        pedido_pendiente: false,
        puedes_pedir: false,
      });
      await como('tiendaa')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido/${pedido.id}`, { aceptar: false })
        .expect(409);
      // Ya lo tiene: no se vuelve a pedir.
      await como('tiendab').post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido`).expect(409);
      await desconectar(deB);
    });

    it('«Ahora no» cierra el pedido sin compartir nada', async () => {
      const deA = await como('tiendaa')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido`)
        .expect(200);
      const respuesta = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp/pedido/${deA.body.id}`, { aceptar: false })
        .expect(200);
      expect(respuesta.body).toMatchObject({ pedido: { pedido: 'RECHAZADO' }, compartido: null });
      const deB = await prisma.mensaje.count({
        where: { conversacionId: hilo.id, tipo: 'WHATSAPP', autor: { usuario: 'tiendab' } },
      });
      expect(deB).toBe(0);
      expect((await detalle('tiendaa', hilo.id)).whatsapp.suyo).toBeNull();
    });

    it('«Compartir mi WhatsApp» desde ⋯, sin que te lo pidan, una sola vez', async () => {
      const compartido = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp`)
        .expect(200);
      expect(compartido.body).toMatchObject({ tipo: 'WHATSAPP', mio: true });
      const otraVez = await como('tiendab')
        .post(`/v1/conversaciones/${hilo.id}/whatsapp`)
        .expect(200);
      expect(otraVez.body.id).toBe(compartido.body.id);
      expect((await detalle('tiendaa', hilo.id)).whatsapp.suyo).toBe(compartido.body.whatsapp);
    });

    it('con una tienda reservada: no se le pide ni ella comparte el suyo', async () => {
      const reservada = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', id: { not: hilo.oferta.id } },
      });
      await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: false } });
      const contacto = await como('tiendac')
        .post(`/v1/ofertas/${reservada.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      const id = contacto.body.conversacion_id as string;
      await como('tiendac')
        .post(`/v1/conversaciones/${id}/mensajes`, { texto: 'Hola' })
        .expect(201);

      await como('tiendac').post(`/v1/conversaciones/${id}/whatsapp/pedido`).expect(409);
      await como('tiendaa').post(`/v1/conversaciones/${id}/whatsapp`).expect(409);
      expect((await detalle('tiendac', id)).whatsapp).toMatchObject({ puedes_pedir: false });
      expect((await detalle('tiendaa', id)).whatsapp).toMatchObject({ puedes_compartir: false });

      // La reservada sí puede pedirle el suyo a quien le escribe; aceptar no la delata.
      const pedidoDeA = await como('tiendaa')
        .post(`/v1/conversaciones/${id}/whatsapp/pedido`)
        .expect(200);
      const delComprador = await historial('tiendac', id);
      const tarjeta = delComprador.mensajes.find((m) => m.id === pedidoDeA.body.id);
      expect(tarjeta).toMatchObject({ pedido: 'PENDIENTE', autor: null, whatsapp: null });
      await como('tiendac')
        .post(`/v1/conversaciones/${id}/whatsapp/pedido/${pedidoDeA.body.id}`, { aceptar: true })
        .expect(200);
      await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: true } });
    });
  });

  describe('«Vendido» con «Deshacer» (N02)', () => {
    it('quien vende puede deshacerlo; vuelve el stock y lo de antes se puede cambiar otra vez', async () => {
      const antes = await prisma.oferta.findUniqueOrThrow({ where: { id: hilo.oferta.id } });
      const reciente = (
        await como('tiendab')
          .post(`/v1/conversaciones/${hilo.id}/mensajes`, { texto: 'Listo, paso a las 5' })
          .expect(201)
      ).body as MensajeChat;
      await como('tiendaa')
        .post(`/v1/ofertas/${hilo.oferta.id}/vendido`, { conversacion_id: hilo.id })
        .expect(201);

      // Lo de una venta cerrada no se cambia.
      await como('tiendab')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${reciente.id}`, { texto: 'A las 6' })
        .expect(409);
      expect(
        (await historial('tiendab', hilo.id)).mensajes.find((m) => m.id === reciente.id)
          ?.cambiable_hasta,
      ).toBeNull();

      const delVendedor = await detalle('tiendaa', hilo.id);
      const delComprador = await detalle('tiendab', hilo.id);
      expect(delVendedor.venta).toMatchObject({ mi_lado: 'vendedor', puede_deshacer: true });
      expect(delComprador.venta).toMatchObject({ mi_lado: 'comprador', puede_deshacer: false });
      const ventaId = delVendedor.venta!.id;

      // Ni quien compró ni otra tienda la deshacen.
      await como('tiendab').post(`/v1/ventas/${ventaId}/deshacer`).expect(404);
      await como('tiendac').post(`/v1/ventas/${ventaId}/deshacer`).expect(404);

      const deshecha = await como('tiendaa').post(`/v1/ventas/${ventaId}/deshacer`).expect(200);
      expect(deshecha.body).toMatchObject({
        stock_antes: antes.stock - 1,
        stock_despues: antes.stock,
        mensaje: {
          tipo: 'SISTEMA',
          texto: `Se deshizo la venta · stock ${antes.stock - 1} → ${antes.stock}`,
        },
      });
      expect(await prisma.venta.count({ where: { id: ventaId } })).toBe(0);
      expect(
        await prisma.auditoria.count({ where: { accion: 'VENTA_DESHECHA', objetoId: ventaId } }),
      ).toBe(1);
      expect((await detalle('tiendaa', hilo.id)).venta).toBeNull();
      await como('tiendab')
        .patch(`/v1/conversaciones/${hilo.id}/mensajes/${reciente.id}`, { texto: 'A las 6' })
        .expect(200);
    });

    it('si quien compró ya calificó, la venta no se deshace', async () => {
      await como('tiendaa')
        .post(`/v1/ofertas/${hilo.oferta.id}/vendido`, { conversacion_id: hilo.id })
        .expect(201);
      const venta = (await detalle('tiendab', hilo.id)).venta!;
      await como('tiendab')
        .post(`/v1/ventas/${venta.id}/opinion`, { estrellas: 5, aspectos: [] })
        .expect((r) => expect([200, 201]).toContain(r.status));
      expect((await detalle('tiendaa', hilo.id)).venta?.puede_deshacer).toBe(false);
      await como('tiendaa').post(`/v1/ventas/${venta.id}/deshacer`).expect(409);
    });
  });
});
