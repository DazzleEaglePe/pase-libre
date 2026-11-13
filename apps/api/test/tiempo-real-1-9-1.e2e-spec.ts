import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { EVENTOS, RUTA_TIEMPO_REAL, type EventoMensajeEquipo } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

function esperar<T>(socket: Socket, evento: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`No llegó ${evento}`)), 2000);
    socket.once(evento, (datos: T) => {
      clearTimeout(reloj);
      resolve(datos);
    });
  });
}

describe('Versión 1.9.1: el tiempo real no falla en silencio (doc 19, A1 y A3)', () => {
  let app: INestApplication;
  let base: string;
  const cookies: Record<string, string> = {};
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());

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

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const usuario of ['tiendaa', 'equipo']) {
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

  it('acepta el origen de la web y rechaza uno ajeno', async () => {
    await expect(conectar(cookies.tiendaa ?? '', 'http://localhost:3000')).resolves.toBeDefined();
    await expect(conectar(cookies.tiendaa ?? '', 'https://otro-sitio.com')).rejects.toThrow();
  });

  it('el chat con el Equipo se mueve en vivo en los dos lados, aun con «No molestar»', async () => {
    // «No molestar» todo el día: calla la campanita, nunca el chat.
    await prisma.usuario.update({
      where: { usuario: 'tiendaa' },
      data: { noMolestarDesde: 0, noMolestarHasta: 1439 },
    });
    const tienda = await prisma.tienda.findFirstOrThrow({
      where: { usuarios: { some: { usuario: 'tiendaa' } } },
    });
    const deLaTienda = await conectar(cookies.tiendaa ?? '');
    const delEquipo = await conectar(cookies.equipo ?? '');

    const llegaALaTienda = esperar<EventoMensajeEquipo>(deLaTienda, EVENTOS.mensajeEquipo);
    await http()
      .post(`/v1/equipo/chats/${tienda.id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', cookies.equipo ?? '')
      .send({ texto: 'Hola, te escribe el Equipo' })
      .expect(201);
    expect(await llegaALaTienda).toEqual({ tienda_id: tienda.id });

    const llegaAlEquipo = esperar<EventoMensajeEquipo>(delEquipo, EVENTOS.mensajeEquipo);
    await http()
      .post('/v1/equipo-chat/mensajes')
      .set(CABECERAS)
      .set('Cookie', cookies.tiendaa ?? '')
      .send({ texto: 'Gracias, ya lo vi' })
      .expect(201);
    expect(await llegaAlEquipo).toEqual({ tienda_id: tienda.id });
  });
});
