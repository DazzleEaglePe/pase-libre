import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CABECERAS,
  CLAVE_PRUEBA,
  cookieDe,
  crearApp,
  crearTiendaConDueno,
  usarBaseDePruebas,
  vaciarBase,
} from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

describe('Sesión (RF-02, RF-50, RF-60)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const ingresar = (usuario: string, clave = CLAVE_PRUEBA, extra: object = {}) =>
    http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave, ...extra });

  // Una API nueva por prueba: así el límite de ingresos por IP no se arrastra entre pruebas.
  beforeEach(async () => {
    await vaciarBase(prisma);
    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('frena a la misma IP después de 60 ingresos en 15 minutos', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    for (let intento = 0; intento < 60; intento += 1) {
      await ingresar('nadie', 'otra-clave-1').expect(401);
    }
    await ingresar('tiendaa').expect(429);
  });

  it('ingresa con el usuario y deja una cookie httpOnly y SameSite=Lax', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });

    const respuesta = await ingresar('TiendaA').expect(200);

    expect(respuesta.body).toMatchObject({
      usuario: { usuario: 'tiendaa', rol: 'DUENO', debe_cambiar_clave: false },
      tienda: { nombre: 'Tienda tiendaa', galeria: 'Maxiplaza', stand: '212' },
    });
    const cookie = (respuesta.headers['set-cookie'] as unknown as string[])[0] ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    // Sin «Mantener la sesión», la cookie no tiene fecha: muere al cerrar el navegador.
    expect(cookie).not.toMatch(/Expires=/);
    // El token nunca viaja en el cuerpo.
    expect(JSON.stringify(respuesta.body)).not.toContain(cookieDe(respuesta).split('=')[1]);
  });

  it('ingresa también con el correo, sin importar mayúsculas', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa', correo: 'luis@tiendaa.pe' });
    await ingresar('Luis@TiendaA.pe').expect(200);
  });

  it('«Mantener la sesión» pone una cookie de 30 días', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const respuesta = await ingresar('tiendaa', CLAVE_PRUEBA, { recordar: true }).expect(200);
    expect((respuesta.headers['set-cookie'] as unknown as string[])[0]).toMatch(/Expires=/);
  });

  it('responde lo mismo si el usuario no existe o la clave está mal', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });

    const claveMal = await ingresar('tiendaa', 'otra-clave-1').expect(401);
    const noExiste = await ingresar('nadie', 'otra-clave-1').expect(401);

    expect(claveMal.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(noExiste.body.error).toMatchObject({
      codigo: 'CREDENCIALES_INVALIDAS',
      mensaje: claveMal.body.error.mensaje,
    });
  });

  it('tras 5 intentos fallidos la cuenta espera, aunque luego pongan la clave correcta', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    for (let intento = 0; intento < 5; intento += 1) {
      await ingresar('tiendaa', 'mala-clave-1').expect(401);
    }
    const respuesta = await ingresar('tiendaa').expect(429);
    expect(respuesta.body.error.codigo).toBe('CUENTA_BLOQUEADA_TEMPORALMENTE');
  });

  it('una cuenta suspendida no entra y su sesión abierta deja de valer', async () => {
    const { usuario } = await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const cookie = cookieDe(await ingresar('tiendaa').expect(200));

    await prisma.usuario.update({ where: { id: usuario.id }, data: { estado: 'SUSPENDIDO' } });

    expect((await ingresar('tiendaa').expect(403)).body.error.codigo).toBe('CUENTA_SUSPENDIDA');
    expect((await http().get('/v1/yo').set('Cookie', cookie).expect(401)).body.error.codigo).toBe(
      'SIN_SESION',
    );
  });

  it('sin la cabecera X-PaseLibre no se acepta ningún cambio (CSRF)', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const respuesta = await http()
      .post('/v1/sesion')
      .send({ usuario: 'tiendaa', clave: CLAVE_PRUEBA })
      .expect(403);
    expect(respuesta.body.error.codigo).toBe('FALTA_CABECERA_PASELIBRE');
  });

  it('valida la entrada con mensajes en español', async () => {
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario: '' })
      .expect(400);
    expect(respuesta.body.error).toMatchObject({
      codigo: 'DATOS_INVALIDOS',
      mensaje: 'Escribe tu correo o usuario.',
    });
  });

  it('GET /yo sin sesión responde 401', async () => {
    const respuesta = await http().get('/v1/yo').expect(401);
    expect(respuesta.body.error.codigo).toBe('SIN_SESION');
  });

  describe('primer ingreso con la clave temporal', () => {
    it('solo deja ver /yo y cambiar la clave; después, todo lo demás', async () => {
      await crearTiendaConDueno(prisma, { usuario: 'tiendad', temporal: true });
      const cookie = cookieDe(await ingresar('tiendad').expect(200));

      const yo = await http().get('/v1/yo').set('Cookie', cookie).expect(200);
      expect(yo.body.usuario.debe_cambiar_clave).toBe(true);
      const bloqueado = await http().get('/v1/cuenta').set('Cookie', cookie).expect(403);
      expect(bloqueado.body.error.codigo).toBe('DEBE_CAMBIAR_CLAVE');

      const cambio = await http()
        .post('/v1/sesion/clave')
        .set(CABECERAS)
        .set('Cookie', cookie)
        .send({ clave_nueva: 'mistand212' })
        .expect(200);
      expect(cambio.body.usuario.debe_cambiar_clave).toBe(false);

      const cuenta = await http().get('/v1/cuenta').set('Cookie', cookie).expect(200);
      expect(cuenta.body.tienda).toMatchObject({
        precio_visible_defecto: false,
        moneda_defecto: 'USD',
      });

      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendad' } });
      expect(usuario.primerIngresoEn).not.toBeNull();
      await ingresar('tiendad', 'mistand212').expect(200);
      await ingresar('tiendad').expect(401);
    });

    it('no acepta repetir la clave temporal', async () => {
      await crearTiendaConDueno(prisma, { usuario: 'tiendad', temporal: true });
      const cookie = cookieDe(await ingresar('tiendad').expect(200));
      await http()
        .post('/v1/sesion/clave')
        .set(CABECERAS)
        .set('Cookie', cookie)
        .send({ clave_nueva: CLAVE_PRUEBA })
        .expect(400);
    });
  });

  it('fuera del primer ingreso, cambiar la clave pide la actual y cierra las otras sesiones', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const celular = cookieDe(await ingresar('tiendaa').expect(200));
    const computadora = cookieDe(await ingresar('tiendaa').expect(200));

    const sinActual = await http()
      .post('/v1/sesion/clave')
      .set(CABECERAS)
      .set('Cookie', computadora)
      .send({ clave_nueva: 'nueva-clave-9' })
      .expect(400);
    expect(sinActual.body.error.codigo).toBe('CLAVE_ACTUAL_INCORRECTA');

    await http()
      .post('/v1/sesion/clave')
      .set(CABECERAS)
      .set('Cookie', computadora)
      .send({ clave_actual: CLAVE_PRUEBA, clave_nueva: 'nueva-clave-9' })
      .expect(200);

    await http().get('/v1/yo').set('Cookie', computadora).expect(200);
    await http().get('/v1/yo').set('Cookie', celular).expect(401);
  });

  it('salir revoca la sesión y borra la cookie', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const cookie = cookieDe(await ingresar('tiendaa').expect(200));

    const salida = await http()
      .delete('/v1/sesion')
      .set(CABECERAS)
      .set('Cookie', cookie)
      .expect(204);
    expect((salida.headers['set-cookie'] as unknown as string[])[0]).toMatch(/pl_sesion=;/);
    await http().get('/v1/yo').set('Cookie', cookie).expect(401);
  });

  it('el token se guarda como hash, nunca en claro', async () => {
    await crearTiendaConDueno(prisma, { usuario: 'tiendaa' });
    const token = cookieDe(await ingresar('tiendaa').expect(200)).split('=')[1] as string;
    const sesiones = await prisma.sesion.findMany();
    expect(sesiones).toHaveLength(1);
    expect(sesiones[0]?.tokenHash).toHaveLength(64);
    expect(sesiones[0]?.tokenHash).not.toBe(token);
  });
});

describe('Salud', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responde y usa el sobre de error documentado', async () => {
    await request(app.getHttpServer()).get('/v1/salud').expect(200);
    await request(app.getHttpServer())
      .get('/v1/salud/lista')
      .expect(200, { estado: 'ok', base_de_datos: 'ok' });
    const noExiste = await request(app.getHttpServer()).get('/v1/no-existe').expect(404);
    expect(noExiste.body.error).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(noExiste.body.error.id_solicitud).toBe(noExiste.headers['x-request-id']);
  });
});
