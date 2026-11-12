import type { INestApplication } from '@nestjs/common';
import type { DetallesLimiteDispositivos, RespuestaSesiones } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

/** Máximo 2 dispositivos para la cuenta principal (N10, mejora 32). */
describe('Límite de dispositivos de la cuenta principal (N10)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const ingreso = (usuario: string, agente: string, extra: object = {}, clave = CLAVE_DEMO) =>
    http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .set('User-Agent', agente)
      .send({ usuario, clave, ...extra });

  const entrar = async (usuario: string, agente: string) =>
    cookieDe(await ingreso(usuario, agente).expect(200));

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
  });

  beforeEach(async () => {
    await prisma.sesion.deleteMany({});
    await prisma.aviso.deleteMany({ where: { tipo: 'SEGURIDAD' } });
    await prisma.tienda.updateMany({ data: { limiteDispositivos: 2 } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('desde un tercer dispositivo pide elegir cuál cerrar, sin abrir sesión', async () => {
    await entrar('tiendaa', WINDOWS);
    await entrar('tiendaa', ANDROID);
    const respuesta = await ingreso('tiendaa', MAC).expect(409);
    expect(respuesta.body.error.codigo).toBe('LIMITE_DISPOSITIVOS');
    expect(respuesta.headers['set-cookie']).toBeUndefined();
    const detalles = respuesta.body.error.detalles as DetallesLimiteDispositivos;
    expect(detalles.limite).toBe(2);
    expect(detalles.sesiones.map((s) => [s.dispositivo, s.lugar])).toEqual([
      ['Chrome en Android', 'Lima'],
      ['Chrome en Windows', 'Lima'],
    ]);
    const tiendaa = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    expect(await prisma.sesion.count({ where: { usuarioId: tiendaa.id } })).toBe(2);
  });

  it('con la contraseña mal no muestra la lista: un extraño no ve tus equipos', async () => {
    await entrar('tiendaa', WINDOWS);
    await entrar('tiendaa', ANDROID);
    const respuesta = await ingreso('tiendaa', MAC, {}, 'otra-clave-1').expect(401);
    expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(respuesta.body.error.detalles).toBeUndefined();
    expect(JSON.stringify(respuesta.body)).not.toContain('Android');
    // Tampoco sirve mandar qué cerrar sin la contraseña.
    const sesiones = await prisma.sesion.findMany({ select: { id: true } });
    await ingreso('tiendaa', MAC, { cerrar: sesiones.map((s) => s.id) }, 'otra-clave-1').expect(
      401,
    );
    expect(await prisma.sesion.count({ where: { revocadaEn: null } })).toBe(2);
  });

  it('«Cerrar la seleccionada y entrar» cierra esa, entra y le avisa', async () => {
    const windows = await entrar('tiendaa', WINDOWS);
    const android = await entrar('tiendaa', ANDROID);
    const lista = (await ingreso('tiendaa', MAC).expect(409)).body.error
      .detalles as DetallesLimiteDispositivos;
    const deAndroid = lista.sesiones.find((s) => s.dispositivo === 'Chrome en Android');
    const nueva = await ingreso('tiendaa', MAC, { cerrar: [deAndroid?.id] }).expect(200);
    await http().get('/v1/yo').set('Cookie', cookieDe(nueva)).expect(200);
    await http().get('/v1/yo').set('Cookie', android).expect(401);
    await http().get('/v1/yo').set('Cookie', windows).expect(200);

    const aviso = await prisma.aviso.findFirstOrThrow({
      where: { usuario: { usuario: 'tiendaa' }, tipo: 'SEGURIDAD' },
    });
    expect(aviso.titulo).toBe('Se cerró tu sesión en Chrome en Android');
    expect(aviso.extracto).toBe(
      'Entraste desde Safari en Mac. Si no fuiste tú, cambia tu contraseña.',
    );
  });

  it('«Cerrar todas y entrar» deja solo la nueva', async () => {
    const windows = await entrar('tiendaa', WINDOWS);
    const android = await entrar('tiendaa', ANDROID);
    const nueva = await ingreso('tiendaa', MAC, { cerrar: 'todas' }).expect(200);
    await http().get('/v1/yo').set('Cookie', windows).expect(401);
    await http().get('/v1/yo').set('Cookie', android).expect(401);
    const sesiones = await http().get('/v1/cuenta/sesiones').set('Cookie', cookieDe(nueva));
    expect((sesiones.body as RespuestaSesiones).sesiones).toHaveLength(1);
  });

  it('no deja cerrar sesiones de otra cuenta para hacer lugar', async () => {
    const deB = await entrar('tiendab', WINDOWS);
    await entrar('tiendaa', WINDOWS);
    await entrar('tiendaa', ANDROID);
    const sesionDeB = await prisma.sesion.findFirstOrThrow({
      where: { usuario: { usuario: 'tiendab' } },
    });
    await ingreso('tiendaa', MAC, { cerrar: [sesionDeB.id] }).expect(409);
    await http().get('/v1/yo').set('Cookie', deB).expect(200);
  });

  it('una sesión vencida no cuenta', async () => {
    await entrar('tiendaa', WINDOWS);
    await entrar('tiendaa', ANDROID);
    await prisma.sesion.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } });
    await ingreso('tiendaa', MAC).expect(200);
  });

  it('el asesor no tiene límite por ahora', async () => {
    for (const agente of [WINDOWS, ANDROID, MAC, WINDOWS]) {
      await entrar('tiendaa.kevin', agente);
    }
    const kevin = await entrar('tiendaa.kevin', MAC);
    const sesiones = await http().get('/v1/cuenta/sesiones').set('Cookie', kevin).expect(200);
    expect((sesiones.body as RespuestaSesiones).limite).toBeNull();
    expect((sesiones.body as RespuestaSesiones).sesiones).toHaveLength(5);
  });

  it('«Sesiones abiertas · N de 2» en Configuración › Seguridad', async () => {
    await entrar('tiendaa', WINDOWS);
    const actual = await entrar('tiendaa', ANDROID);
    const respuesta = await http().get('/v1/cuenta/sesiones').set('Cookie', actual).expect(200);
    const cuerpo = respuesta.body as RespuestaSesiones;
    expect(cuerpo.limite).toBe(2);
    expect(cuerpo.sesiones.map((s) => [s.dispositivo, s.lugar, s.actual])).toEqual([
      ['Chrome en Android', 'Lima', true],
      ['Chrome en Windows', 'Lima', false],
    ]);
  });

  it('el equipo puede subirle el límite a una tienda; nadie más', async () => {
    const tienda = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    const dueno = await entrar('tiendaa', WINDOWS);
    await http()
      .put(`/v1/equipo/panel/tiendas/${tienda.id}/limite`)
      .set(CABECERAS)
      .set('Cookie', dueno)
      .send({ limite: 5 })
      .expect(403);
    const equipo = await entrar('equipo', MAC);
    await http()
      .put(`/v1/equipo/panel/tiendas/${tienda.id}/limite`)
      .set(CABECERAS)
      .set('Cookie', equipo)
      .send({ limite: 11 })
      .expect(400);
    const ficha = await http()
      .put(`/v1/equipo/panel/tiendas/${tienda.id}/limite`)
      .set(CABECERAS)
      .set('Cookie', equipo)
      .send({ limite: 3 })
      .expect(200);
    expect(ficha.body.limite_dispositivos).toBe(3);
    await entrar('tiendaa', ANDROID);
    await entrar('tiendaa', MAC);
    await ingreso('tiendaa', WINDOWS).expect(409);
    const aviso = await prisma.aviso.findFirstOrThrow({
      where: { usuario: { usuario: 'tiendaa' }, tipo: 'SEGURIDAD' },
    });
    expect(aviso.titulo).toBe('Tu cuenta principal ahora puede estar abierta en 3 dispositivos');
  });
});
