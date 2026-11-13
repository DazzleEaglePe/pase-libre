import type { INestApplication } from '@nestjs/common';
import type { RespuestaAsesores, RespuestaClaveAsesor, RespuestaYo } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Asesores: hasta 3, con permisos para cada uno (N12, mejoras 43 y 47). */
describe('Asesores y sus permisos (N12)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies: Record<string, string> = {};

  const ingreso = (usuario: string, clave = CLAVE_DEMO) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave, cerrar: 'todas' });

  const como = (cookie: string) => ({
    get: (ruta: string) => http().get(ruta).set('Cookie', cookie),
    send: (metodo: 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) =>
      http()[metodo](ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo),
  });

  let luis: RespuestaClaveAsesor;
  let cookieLuis: string;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ enVivo: true });
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab']) {
      cookies[usuario] = cookieDe(await ingreso(usuario).expect(200));
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('solo el dueño administra asesores', () => {
    it('el dueño ve los suyos con «2 de 3» y el prefijo de su usuario', async () => {
      const respuesta = await como(cookies.tiendaa ?? '')
        .get('/v1/cuenta/asesores')
        .expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      const cuerpo = respuesta.body as RespuestaAsesores;
      expect(cuerpo).toMatchObject({ maximo: 3, prefijo: 'tiendaa' });
      expect(cuerpo.asesores.map((a) => [a.usuario, a.activo])).toEqual([['tiendaa.kevin', true]]);
      expect(JSON.stringify(cuerpo)).not.toMatch(/clave/i);
    });

    it('el asesor no puede ver, agregar ni cambiar asesores aunque tenga todos los permisos', async () => {
      await prisma.usuario.update({
        where: { usuario: 'tiendaa.kevin' },
        data: {
          permisos: [
            'COMPRAR_VENDER',
            'MARCAR_VENDIDO',
            'EN_VIVO',
            'PUBLICAR',
            'DATOS_TIENDA',
            'HISTORIAL',
          ],
        },
      });
      const kevin = como(cookies['tiendaa.kevin'] ?? '');
      await kevin.get('/v1/cuenta/asesores').expect(403);
      await kevin
        .send('post', '/v1/cuenta/asesores', { nombre: 'Otro', sufijo: 'otro' })
        .expect(403);
      const yo = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa.kevin' } });
      await kevin.send('patch', `/v1/cuenta/asesores/${yo.id}`, { activo: false }).expect(403);
    });

    it('sin sesión, 401; el equipo no tiene tienda: 403', async () => {
      await http().get('/v1/cuenta/asesores').expect(401);
      const equipo = cookieDe(await ingreso('equipo').expect(200));
      await como(equipo).get('/v1/cuenta/asesores').expect(403);
    });
  });

  describe('«Añadir asesor»', () => {
    it('crea «tiendaa.luis» con la contraseña visible solo en la respuesta', async () => {
      const respuesta = await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', { nombre: 'Luis Quispe', sufijo: 'Luis' })
        .expect(201);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      luis = respuesta.body as RespuestaClaveAsesor;
      expect(luis.asesor).toMatchObject({
        nombre: 'Luis Quispe',
        usuario: 'tiendaa.luis',
        activo: true,
        permisos: ['COMPRAR_VENDER', 'MARCAR_VENDIDO', 'EN_VIVO'],
      });
      expect(luis.clave).toMatch(/\d/);
      expect(luis.mensaje).toContain(`Contraseña: ${luis.clave}`);
      // En la base queda cifrada; la lista nunca la trae.
      const fila = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa.luis' } });
      expect(fila.claveHash).not.toContain(luis.clave);
      const lista = await como(cookies.tiendaa ?? '')
        .get('/v1/cuenta/asesores')
        .expect(200);
      expect(JSON.stringify(lista.body)).not.toContain(luis.clave);

      const entrada = await ingreso('tiendaa.luis', luis.clave).expect(200);
      expect((entrada.body as RespuestaYo).usuario).toMatchObject({
        rol: 'ASESOR',
        debe_cambiar_clave: false,
        permisos: ['COMPRAR_VENDER', 'MARCAR_VENDIDO', 'EN_VIVO'],
      });
      cookieLuis = cookieDe(entrada);
    });

    it('el dueño puede dictar la contraseña; las fáciles no', async () => {
      await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', {
          nombre: 'Karina',
          sufijo: 'karina',
          clave: '12345678',
        })
        .expect(400);
    });

    it('el asesor no puede cambiar su contraseña: solo el dueño', async () => {
      const respuesta = await como(cookieLuis)
        .send('post', '/v1/sesion/clave', {
          clave_actual: luis.clave,
          clave_nueva: 'mia-nueva-2026',
        })
        .expect(403);
      expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
    });

    it('un usuario repetido no se crea', async () => {
      await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', { nombre: 'Luis Otro', sufijo: 'luis' })
        .expect(409);
    });

    it('hasta 3 asesores', async () => {
      await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', { nombre: 'Karina Rojas', sufijo: 'karina' })
        .expect(201);
      const cuarto = await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', { nombre: 'Pedro', sufijo: 'pedro' })
        .expect(409);
      expect(cuarto.body.error.mensaje).toContain('3 asesores');
    });
  });

  describe('los permisos se cumplen en el servidor', () => {
    it('sin «Publicar», «Historial» ni «Datos de la tienda», la API dice que no', async () => {
      const asesor = como(cookieLuis);
      const sinPermiso = async (peticion: request.Test) => {
        const respuesta = await peticion.expect(403);
        expect(respuesta.body.error.codigo).toBe('SIN_PERMISO');
      };
      await sinPermiso(asesor.send('post', '/v1/ofertas', {}));
      await sinPermiso(asesor.get('/v1/historial'));
      await sinPermiso(asesor.get('/v1/historial/excel'));
      await sinPermiso(asesor.send('put', '/v1/cuenta/portada', { posicion: 30 }));
      await sinPermiso(asesor.send('patch', '/v1/cuenta', { tienda: { horario: 'Lun a sáb' } }));
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda A' } },
      });
      await sinPermiso(asesor.send('patch', `/v1/ofertas/${oferta.id}`, { stock: 3 }));
      await sinPermiso(asesor.send('delete', `/v1/ofertas/${oferta.id}`));
      // Lo suyo sí: su nombre.
      await asesor.send('patch', '/v1/cuenta', { nombre: 'Luis Quispe R.' }).expect(200);
      // El dueño sigue pudiendo todo.
      await como(cookies.tiendaa ?? '')
        .get('/v1/historial')
        .expect(200);
    });

    it('con los permisos que vienen marcados, compra y vende', async () => {
      const deB = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda B' }, estado: 'ACTIVA', tiendaVisible: true },
      });
      await como(cookieLuis)
        .send('post', `/v1/ofertas/${deB.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
    });

    it('«Guardar permisos» cambia lo que puede desde su siguiente pedido', async () => {
      const dueno = como(cookies.tiendaa ?? '');
      const cambiado = await dueno
        .send('patch', `/v1/cuenta/asesores/${luis.asesor.id}`, {
          permisos: ['HISTORIAL', 'COMPRAR_VENDER'],
        })
        .expect(200);
      expect(cambiado.body.permisos).toEqual(['COMPRAR_VENDER', 'HISTORIAL']);
      await como(cookieLuis).get('/v1/historial').expect(200);
      const yo = await como(cookieLuis).get('/v1/yo').expect(200);
      expect(yo.body.usuario.permisos).toEqual(['COMPRAR_VENDER', 'HISTORIAL']);

      // Ya no puede marcar vendido ni publicar en vivo.
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda A' } },
      });
      const vendido = await como(cookieLuis)
        .send('post', `/v1/ofertas/${oferta.id}/vendido`, { unidades: 1 })
        .expect(403);
      expect(vendido.body.error.codigo).toBe('SIN_PERMISO');
      await como(cookieLuis).send('post', '/v1/en-vivo', {}).expect(403);

      await dueno
        .send('patch', `/v1/cuenta/asesores/${luis.asesor.id}`, { permisos: [] })
        .expect(200);
      await como(cookieLuis).get('/v1/historial').expect(403);
      const deB = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda B' }, estado: 'ACTIVA', tiendaVisible: true },
      });
      await como(cookieLuis)
        .send('post', `/v1/ofertas/${deB.id}/contacto`, { canal: 'WHATSAPP' })
        .expect(403);
      // Chatear y responder siempre se puede: su bandeja sigue abierta.
      await como(cookieLuis).get('/v1/conversaciones').expect(200);
    });

    it('otra tienda no toca a tus asesores', async () => {
      await como(cookies.tiendab ?? '')
        .send('patch', `/v1/cuenta/asesores/${luis.asesor.id}`, { activo: false })
        .expect(404);
      await como(cookies.tiendab ?? '')
        .send('post', `/v1/cuenta/asesores/${luis.asesor.id}/clave`, {})
        .expect(404);
      await como(cookies.tiendab ?? '')
        .send('delete', `/v1/cuenta/asesores/${luis.asesor.id}`)
        .expect(404);
    });
  });

  describe('pausar, contraseña nueva y quitar', () => {
    it('«Pausado» cierra sus sesiones y no lo deja entrar', async () => {
      await como(cookies.tiendaa ?? '')
        .send('patch', `/v1/cuenta/asesores/${luis.asesor.id}`, { activo: false })
        .expect(200);
      await como(cookieLuis).get('/v1/yo').expect(401);
      const respuesta = await ingreso('tiendaa.luis', luis.clave).expect(403);
      expect(respuesta.body.error.codigo).toBe('CUENTA_PAUSADA');
      await como(cookies.tiendaa ?? '')
        .send('patch', `/v1/cuenta/asesores/${luis.asesor.id}`, { activo: true })
        .expect(200);
      cookieLuis = cookieDe(await ingreso('tiendaa.luis', luis.clave).expect(200));
    });

    it('«Contraseña» pone una nueva: la vieja deja de servir y se cierran sus sesiones', async () => {
      const nueva = await como(cookies.tiendaa ?? '')
        .send('post', `/v1/cuenta/asesores/${luis.asesor.id}/clave`, { clave: 'luis-Wilson-77' })
        .expect(200);
      expect(nueva.body.clave).toBe('luis-Wilson-77');
      await como(cookieLuis).get('/v1/yo').expect(401);
      await ingreso('tiendaa.luis', luis.clave).expect(401);
      cookieLuis = cookieDe(await ingreso('tiendaa.luis', 'luis-Wilson-77').expect(200));
    });

    it('quitar al asesor pasa sus chats al dueño y ya no entra', async () => {
      const conversacion = await prisma.conversacion.findFirstOrThrow({
        where: { comprador: { usuario: 'tiendaa.luis' } },
      });
      await como(cookies.tiendaa ?? '')
        .send('delete', `/v1/cuenta/asesores/${luis.asesor.id}`)
        .expect(204);
      await como(cookieLuis).get('/v1/yo').expect(401);
      await ingreso('tiendaa.luis', 'luis-Wilson-77').expect(401);
      const movida = await prisma.conversacion.findUniqueOrThrow({
        where: { id: conversacion.id },
        include: { comprador: true },
      });
      expect(movida.comprador?.usuario).toBe('tiendaa');
      const lista = await como(cookies.tiendaa ?? '')
        .get('/v1/cuenta/asesores')
        .expect(200);
      expect((lista.body as RespuestaAsesores).asesores.map((a) => a.usuario)).toEqual([
        'tiendaa.kevin',
        'tiendaa.karina',
      ]);
      // Con uno menos, hay lugar para otro.
      await como(cookies.tiendaa ?? '')
        .send('post', '/v1/cuenta/asesores', { nombre: 'Pedro', sufijo: 'pedro' })
        .expect(201);
    });
  });
});
