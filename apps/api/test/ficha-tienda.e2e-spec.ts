import type { INestApplication } from '@nestjs/common';
import type {
  ActividadDeTienda,
  CambioDelEquipo,
  FichaTienda,
  LecturaDeChat,
  RespuestaChatsDeTienda,
  RespuestaClaveTienda,
  RespuestaCuentas,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** La ficha completa de una tienda en el panel del equipo (N14, mejoras 39, 41, 42 y 49). */
describe('Ficha de la tienda en el panel del equipo (N14)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies: Record<string, string> = {};
  let tiendaA: string;
  let base: string;

  const ingreso = (usuario: string, clave = CLAVE_DEMO) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave, cerrar: 'todas' });

  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    send: (metodo: 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) => {
      const peticion = http();
      return peticion[metodo](ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo);
    },
  });

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = cookieDe(await ingreso(usuario).expect(200));
    }
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
    base = `/v1/equipo/panel/tiendas/${tiendaA}`;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('solo el equipo la abre: ni el dueño, ni el asesor, ni sin sesión', async () => {
    await http().get(`${base}/ficha`).expect(401);
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab']) {
      await como(usuario).get(`${base}/ficha`).expect(403);
      await como(usuario).get(`${base}/conversaciones`).expect(403);
      await como(usuario).send('post', `${base}/clave`, { tipo: 'TEMPORAL' }).expect(403);
      await como(usuario).send('post', `${base}/soporte`).expect(403);
    }
  });

  it('la cabecera trae lo del lienzo y nunca la contraseña', async () => {
    await prisma.advertencia.create({
      data: {
        tiendaId: tiendaA,
        autorId: (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'equipo' } })).id,
        motivo: 'Precio distinto al publicado',
      },
    });
    const respuesta = await como('equipo').get(`${base}/ficha`).expect(200);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    const ficha = respuesta.body as FichaTienda;
    expect(ficha).toMatchObject({
      nombre: 'Tienda A',
      suspendida: false,
      advertencias: 1,
      galeria: 'Maxiplaza',
      usuario: 'tiendaa',
      whatsapp: '987111212',
      asesores: 1,
      limite_dispositivos: 2,
    });
    expect(ficha.sesiones).toHaveLength(1);
    expect(JSON.stringify(ficha)).not.toMatch(/clave|hash|pase-demo/i);
  });

  it('error 40: la columna WhatsApp de Cuentas lee el número de la tienda', async () => {
    await prisma.usuario.update({ where: { usuario: 'tiendaa' }, data: { whatsapp: null } });
    const respuesta = await como('equipo').get('/v1/equipo/cuentas?q=tiendaa').expect(200);
    const cuenta = (respuesta.body as RespuestaCuentas).cuentas.find(
      (c) => c.usuario === 'tiendaa',
    );
    expect(cuenta?.whatsapp).toBeNull();
    expect(cuenta?.tienda.whatsapp).toBe('987111212');
  });

  it('«Datos»: el equipo edita y la tienda recibe un aviso', async () => {
    const respuesta = await como('equipo')
      .send('patch', `${base}/datos`, { piso: '2', stand: '2B 105', horario: 'Lun a sáb 10–20' })
      .expect(200);
    expect((respuesta.body as FichaTienda).datos).toMatchObject({
      piso: '2',
      stand: '2B 105',
      horario: 'Lun a sáb 10–20',
    });
    const aviso = await prisma.aviso.findFirstOrThrow({
      where: { usuario: { usuario: 'tiendaa' }, tipo: 'SEGURIDAD' },
      orderBy: { creadoEn: 'desc' },
    });
    expect(aviso.titulo).toBe(
      'El Equipo PaseLibre actualizó el piso, el stand y el horario de tu tienda',
    );
    expect(aviso.extracto).toContain('Si no lo pediste, escríbenos');
    await como('equipo').send('patch', `${base}/datos`, { galeria: 'no-existe' }).expect(400);
    await como('equipo').send('patch', `${base}/datos`, {}).expect(400);
  });

  describe('Conversaciones: solo lectura, anotado en silencio', () => {
    let conversacion: string;

    beforeAll(async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', tiendaVisible: true },
      });
      const contacto = await como('tiendab')
        .send('post', `/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      conversacion = contacto.body.conversacion_id as string;
      await como('tiendab')
        .send('post', `/v1/conversaciones/${conversacion}/mensajes`, {
          texto: 'brindame tu whatsapp por favor',
        })
        .expect(201);
      await como('tiendaa')
        .send('post', `/v1/conversaciones/${conversacion}/mensajes`, {
          texto: 'Buenas, claro: la tengo a 3,886',
        })
        .expect(201);
    });

    it('«Últimos 10 chats» con la otra tienda y el último mensaje', async () => {
      const respuesta = await como('equipo').get(`${base}/conversaciones`).expect(200);
      const cuerpo = respuesta.body as RespuestaChatsDeTienda;
      expect(cuerpo.total).toBe(1);
      expect(cuerpo.chats[0]).toMatchObject({
        id: conversacion,
        con: 'Tienda B',
        ultimo: 'Buenas, claro: la tengo a 3,886',
      });
    });

    it('al abrirlo queda anotado quién y cuándo; a la tienda no le llega nada', async () => {
      const antes = await prisma.aviso.count({ where: { usuario: { tiendaId: tiendaA } } });
      const respuesta = await como('equipo')
        .get(`${base}/conversaciones/${conversacion}`)
        .expect(200);
      const chat = respuesta.body as LecturaDeChat;
      expect(chat.con).toBe('Tienda B');
      expect(chat.mensajes.map((m) => [m.texto, m.de_la_tienda])).toEqual([
        ['brindame tu whatsapp por favor', false],
        ['Buenas, claro: la tengo a 3,886', true],
      ]);
      expect(await prisma.aviso.count({ where: { usuario: { tiendaId: tiendaA } } })).toBe(antes);
      expect(
        await prisma.auditoria.count({
          where: { accion: 'leer_chat', objetoId: conversacion },
        }),
      ).toBe(1);
      const historial = await como('equipo').get(`${base}/historial`).expect(200);
      const equipo = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'equipo' } });
      expect((historial.body as CambioDelEquipo[])[0]?.texto).toBe(
        `${equipo.nombre.split(' ')[0]} abrió el chat con Tienda B`,
      );
    });

    it('un chat que no es de esa tienda no se abre por su ficha', async () => {
      const tiendaC = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda C' } })).id;
      await como('equipo')
        .get(`/v1/equipo/panel/tiendas/${tiendaC}/conversaciones/${conversacion}`)
        .expect(404);
    });
  });

  it('«Actividad»: búsquedas y vistas por categoría, sin leer chats', async () => {
    await prisma.busqueda.create({
      data: {
        texto: 'tarjeta de video gigabyte',
        resultados: 3,
        usuarioId: (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } })).id,
      },
    });
    const respuesta = await como('equipo').get(`${base}/actividad`).expect(200);
    const actividad = respuesta.body as ActividadDeTienda;
    expect(actividad.dias).toBe(30);
    expect(actividad.categorias[0]).toMatchObject({ busquedas: 1 });
    expect(JSON.stringify(actividad)).not.toContain('whatsapp');
  });

  it('«Reportes y advertencias» cuenta advertencias, no reportes', async () => {
    const respuesta = await como('equipo').get(`${base}/reportes`).expect(200);
    expect(respuesta.body.advertencias).toHaveLength(1);
    expect(respuesta.body.advertencias[0]).toMatchObject({
      motivo: 'Precio distinto al publicado',
      caso: null,
    });
  });

  it('«Publicaciones»: pausar una avisa a la tienda', async () => {
    const lista = await como('equipo').get(`${base}/publicaciones`).expect(200);
    const primera = lista.body[0] as { id: string; titulo: string };
    const pausada = await como('equipo')
      .send('post', `${base}/publicaciones/${primera.id}/estado`, { estado: 'PAUSADA' })
      .expect(200);
    expect(pausada.body.find((p: { id: string }) => p.id === primera.id).estado).toBe('PAUSADA');
    const deOtra = await prisma.oferta.findFirstOrThrow({
      where: { tienda: { nombre: 'Tienda B' } },
    });
    await como('equipo')
      .send('post', `${base}/publicaciones/${deOtra.id}/estado`, { estado: 'PAUSADA' })
      .expect(404);
  });

  describe('Acceso', () => {
    it('contraseña temporal: cierra sus sesiones, le avisa y pide cambiarla al entrar', async () => {
      const respuesta = await como('equipo')
        .send('post', `${base}/clave`, { tipo: 'TEMPORAL' })
        .expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      const cuerpo = respuesta.body as RespuestaClaveTienda;
      expect(cuerpo.clave_temporal).toMatch(/^pase-/);
      expect(cuerpo.cerradas).toBeGreaterThan(0);
      await como('tiendaa').get('/v1/yo').expect(401);
      await ingreso('tiendaa').expect(401);
      const entrada = await ingreso('tiendaa', cuerpo.clave_temporal ?? '').expect(200);
      expect(entrada.body.usuario.debe_cambiar_clave).toBe(true);
      const aviso = await prisma.aviso.findFirstOrThrow({
        where: {
          usuario: { usuario: 'tiendaa' },
          titulo: 'El Equipo PaseLibre cambió tu contraseña',
        },
      });
      expect(aviso.extracto).toBe('Si no lo pediste, escríbenos.');
      // Nada de la contraseña queda en los registros.
      const registros = await prisma.registroEquipo.findMany({ where: { tiendaId: tiendaA } });
      expect(JSON.stringify(registros)).not.toContain(cuerpo.clave_temporal ?? '');
    });

    it('contraseña definitiva: la que dicta el dueño, sin pedir cambiarla', async () => {
      const respuesta = await como('equipo')
        .send('post', `${base}/clave`, { tipo: 'DEFINITIVA', clave: 'Planeta2026' })
        .expect(200);
      expect(respuesta.body.clave_temporal).toBeNull();
      const entrada = await ingreso('tiendaa', 'Planeta2026').expect(200);
      expect(entrada.body.usuario.debe_cambiar_clave).toBe(false);
      cookies.tiendaa = cookieDe(entrada);
      await como('equipo')
        .send('post', `${base}/clave`, { tipo: 'DEFINITIVA', clave: 'corta' })
        .expect(400);
    });

    it('cerrar una sesión o todas desde el panel', async () => {
      const ficha = (await como('equipo').get(`${base}/ficha`).expect(200)).body as FichaTienda;
      const [sesion] = ficha.sesiones;
      const despues = await como('equipo')
        .send('delete', `${base}/sesiones/${sesion?.id}`)
        .expect(200);
      expect((despues.body as FichaTienda).sesiones).toHaveLength(0);
      await como('tiendaa').get('/v1/yo').expect(401);
      // Una sesión de otra cuenta no se cierra por esta ficha.
      const deB = await prisma.sesion.findFirstOrThrow({
        where: { usuario: { usuario: 'tiendab' }, revocadaEn: null },
      });
      await como('equipo').send('delete', `${base}/sesiones/${deB.id}`).expect(404);
      await como('tiendab').get('/v1/yo').expect(200);
      await como('equipo').send('post', `${base}/sesiones/cerrar-todas`).expect(200);
    });
  });
});
