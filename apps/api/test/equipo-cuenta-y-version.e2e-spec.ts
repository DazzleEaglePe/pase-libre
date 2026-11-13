import type { INestApplication } from '@nestjs/common';
import {
  VERSION,
  type CuentaEquipo,
  type RespuestaAcceso,
  type SesionAbierta,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** doc 19, puntos 6, 7 y 8: crear cuenta sin WhatsApp, «Mi cuenta» del Equipo y la versión vista. */
describe('Panel del Equipo 1.10.0: crear cuenta, Mi cuenta y versión', () => {
  let app: INestApplication;
  let equipo: string;
  const http = () => request(app.getHttpServer());

  const ingresar = (usuario: string, clave: string) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave });

  const como = (cookie: string) => ({
    get: (ruta: string) => http().get(ruta).set('Cookie', cookie),
    post: (ruta: string, cuerpo?: object) =>
      http().post(ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      http().patch(ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo),
    delete: (ruta: string) => http().delete(ruta).set(CABECERAS).set('Cookie', cookie),
  });

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    equipo = cookieDe(await ingresar('equipo', CLAVE_DEMO).expect(200));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('crear cuenta (punto 6)', () => {
    it('sin WhatsApp ni persona a cargo: la cuenta lleva el nombre de la tienda', async () => {
      const respuesta = await como(equipo)
        .post('/v1/equipo/cuentas', {
          tipo: 'DUENO',
          usuario: 'tecnowilson',
          tienda: { nombre: 'Tecno Wilson', galeria: 'cyberplaza', stand: '' },
        })
        .expect(201);
      const creada = respuesta.body as RespuestaAcceso;
      expect(creada.cuenta).toMatchObject({
        usuario: 'tecnowilson',
        nombre: 'Tecno Wilson',
        whatsapp: null,
        estado: 'SIN_PRIMER_INGRESO',
        tienda: { nombre: 'Tecno Wilson', whatsapp: null },
      });
      expect(creada.definitiva).toBe(false);
      expect(creada.enlace_whatsapp).toBeNull();
      expect(creada.mensaje).toContain(`Contraseña temporal: ${creada.clave_temporal}`);

      // Cuentas y la ficha de la tienda no se rompen sin WhatsApp.
      const lista = await como(equipo).get('/v1/equipo/cuentas?q=tecnowilson').expect(200);
      expect((lista.body.cuentas as CuentaEquipo[])[0]?.tienda.whatsapp).toBeNull();
      const ficha = await como(equipo)
        .get(`/v1/equipo/panel/tiendas/${creada.cuenta.tienda.id}/ficha`)
        .expect(200);
      expect(ficha.body).toMatchObject({ whatsapp: null, datos: { whatsapp: null } });
      await como(equipo).get(`/v1/equipo/panel/tiendas/${creada.cuenta.tienda.id}`).expect(200);

      // La tienda entra, ve su Configuración sin WhatsApp y lo completa ella misma.
      const tienda = cookieDe(await ingresar('tecnowilson', creada.clave_temporal).expect(200));
      await como(tienda).post('/v1/sesion/clave', { clave_nueva: 'tecno2026wilson' }).expect(200);
      const cuenta = await como(tienda).get('/v1/cuenta').expect(200);
      expect(cuenta.body.tienda.whatsapp).toBeNull();
      const resumen = await como(tienda).get('/v1/cuenta/resumen').expect(200);
      expect(resumen.body).toBeTruthy();
      const completa = await como(tienda)
        .patch('/v1/cuenta', { tienda: { whatsapp: '987 654 000' } })
        .expect(200);
      expect(completa.body.tienda.whatsapp).toBe('987654000');
    });

    it('con contraseña definitiva entra directo, sin «Crea tu contraseña», y ve la bienvenida', async () => {
      const respuesta = await como(equipo)
        .post('/v1/equipo/cuentas', {
          tipo: 'DUENO',
          nombre: 'Pedro A.',
          usuario: 'pegasus',
          tienda: { nombre: 'Pegasus', galeria: 'cyberplaza', whatsapp: '975 936 495' },
          clave: { tipo: 'DEFINITIVA', clave: 'pegaso2026' },
        })
        .expect(201);
      const creada = respuesta.body as RespuestaAcceso;
      expect(creada.definitiva).toBe(true);
      expect(creada.clave_temporal).toBe('pegaso2026');
      expect(creada.mensaje).toContain('Contraseña: pegaso2026');
      expect(creada.mensaje).not.toContain('temporal');
      expect(creada.enlace_whatsapp).toMatch(/^https:\/\/wa\.me\/51975936495\?text=/);
      expect(creada.cuenta).toMatchObject({
        estado: 'SIN_PRIMER_INGRESO',
        clave_temporal_pendiente: false,
      });

      const registro = await prisma.auditoria.findFirstOrThrow({
        where: { accion: 'crear_cuenta', objetoId: creada.cuenta.id },
      });
      expect(JSON.stringify(registro.datos)).not.toContain('pegaso2026');

      const ingreso = await ingresar('pegasus', 'pegaso2026').expect(200);
      expect(ingreso.body.usuario).toMatchObject({
        debe_cambiar_clave: false,
        ver_bienvenida: true,
      });
      const despues = await como(equipo).get('/v1/equipo/cuentas?q=pegasus').expect(200);
      expect((despues.body.cuentas as CuentaEquipo[])[0]?.estado).toBe('ACTIVA');
    });

    it('la definitiva sigue las reglas: 8 caracteres, un número y que no sea fácil', async () => {
      const base = {
        tipo: 'DUENO',
        usuario: 'otra.tienda',
        tienda: { nombre: 'Otra tienda', galeria: 'cyberplaza' },
      };
      const sinNumero = await como(equipo)
        .post('/v1/equipo/cuentas', { ...base, clave: { tipo: 'DEFINITIVA', clave: 'sinnumeros' } })
        .expect(400);
      expect(sinNumero.body.error.mensaje).toBe('La contraseña debe tener al menos un número.');
      const facil = await como(equipo)
        .post('/v1/equipo/cuentas', { ...base, clave: { tipo: 'DEFINITIVA', clave: 'paselibre1' } })
        .expect(400);
      expect(facil.body.error.mensaje).toBe('Esa contraseña es muy fácil de adivinar. Elige otra.');
      expect(await prisma.usuario.count({ where: { usuario: 'otra.tienda' } })).toBe(0);
    });

    it('el asesor sí necesita su nombre', async () => {
      const tienda = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Pegasus' } });
      const respuesta = await como(equipo)
        .post('/v1/equipo/cuentas', { tipo: 'ASESOR', usuario: 'pegasus.x', tienda_id: tienda.id })
        .expect(400);
      expect(respuesta.body.error.mensaje).toBe('Escribe el nombre del asesor.');
    });

    it('sin WhatsApp, el botón de WhatsApp de una publicación manda al chat', async () => {
      const vendedor = await prisma.usuario.findUniqueOrThrow({
        where: { usuario: 'tiendab' },
        select: { id: true, tiendaId: true },
      });
      await prisma.tienda.update({
        where: { id: vendedor.tiendaId ?? '' },
        data: { whatsapp: null },
      });
      await prisma.usuario.update({ where: { id: vendedor.id }, data: { whatsapp: null } });
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { responsableId: vendedor.id, estado: 'ACTIVA', tiendaVisible: true },
      });
      const comprador = cookieDe(await ingresar('tiendac', CLAVE_DEMO).expect(200));
      const respuesta = await como(comprador)
        .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'WHATSAPP' })
        .expect(409);
      expect(respuesta.body.error.mensaje).toBe(
        'Esta tienda todavía no tiene WhatsApp. Escríbele por el chat.',
      );
      await como(comprador)
        .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
    });
  });

  describe('Mi cuenta del Equipo (punto 7)', () => {
    it('solo para el Equipo', async () => {
      const tienda = cookieDe(await ingresar('tiendaa', CLAVE_DEMO).expect(200));
      await como(tienda).get('/v1/equipo/mi-cuenta').expect(403);
      await como(tienda).patch('/v1/equipo/mi-cuenta', { nombre: 'Otro' }).expect(403);
      await http().get('/v1/equipo/mi-cuenta').expect(401);
    });

    it('muestra y cambia nombre, usuario y correo', async () => {
      const antes = await como(equipo).get('/v1/equipo/mi-cuenta').expect(200);
      expect(antes.headers['cache-control']).toBe('no-store');
      expect(antes.body).toEqual({ nombre: 'Dazz', usuario: 'equipo', correo: null });

      const despues = await como(equipo)
        .patch('/v1/equipo/mi-cuenta', {
          nombre: 'Fabrizio',
          usuario: 'Fabrizio',
          correo: 'fabrizio@paselibre.shop',
        })
        .expect(200);
      expect(despues.body).toEqual({
        nombre: 'Fabrizio',
        usuario: 'fabrizio',
        correo: 'fabrizio@paselibre.shop',
      });
      await ingresar('fabrizio', CLAVE_DEMO).expect(200);

      const sinCorreo = await como(equipo)
        .patch('/v1/equipo/mi-cuenta', { correo: '' })
        .expect(200);
      expect(sinCorreo.body.correo).toBeNull();
    });

    it('el usuario y el correo no se repiten', async () => {
      const usuario = await como(equipo)
        .patch('/v1/equipo/mi-cuenta', { usuario: 'tiendaa' })
        .expect(409);
      expect(usuario.body.error.mensaje).toBe('Ese usuario ya lo usa otra cuenta.');
      const correo = await como(equipo)
        .patch('/v1/equipo/mi-cuenta', { correo: 'luis@tiendaa.pe' })
        .expect(409);
      expect(correo.body.error.mensaje).toBe('Ese correo ya lo usa otra cuenta.');
      await como(equipo).patch('/v1/equipo/mi-cuenta', {}).expect(400);
    });

    it('ve sus sesiones abiertas y cierra otra', async () => {
      const otra = cookieDe(await ingresar('fabrizio', CLAVE_DEMO).expect(200));
      const respuesta = await como(equipo).get('/v1/cuenta/sesiones').expect(200);
      const sesiones = respuesta.body.sesiones as SesionAbierta[];
      expect(sesiones.length).toBeGreaterThanOrEqual(2);
      expect(sesiones[0]?.actual).toBe(true);
      expect(respuesta.body.limite).toBeNull();

      await como(otra).get('/v1/yo').expect(200);
      const ajena = sesiones.filter((s) => !s.actual);
      for (const sesion of ajena) {
        await como(equipo).delete(`/v1/cuenta/sesiones/${sesion.id}`).expect(204);
      }
      await como(otra).get('/v1/yo').expect(401);
      await como(equipo).get('/v1/yo').expect(200);
    });

    it('cambiar la contraseña pide la actual y cierra las otras sesiones', async () => {
      const otra = cookieDe(await ingresar('fabrizio', CLAVE_DEMO).expect(200));
      const mal = await como(equipo)
        .post('/v1/sesion/clave', { clave_actual: 'no-es-esta', clave_nueva: 'equipo2026nueva' })
        .expect(400);
      expect(mal.body.error.codigo).toBe('CLAVE_ACTUAL_INCORRECTA');

      await como(equipo)
        .post('/v1/sesion/clave', { clave_actual: CLAVE_DEMO, clave_nueva: 'equipo2026nueva' })
        .expect(200);
      await como(otra).get('/v1/yo').expect(401);
      await como(equipo).get('/v1/equipo/mi-cuenta').expect(200);
      await ingresar('fabrizio', CLAVE_DEMO).expect(401);
      await ingresar('fabrizio', 'equipo2026nueva').expect(200);
    });
  });

  describe('versión vista (punto 8)', () => {
    it('sin abrir Versiones no hay versión vista; al abrirla queda la que corre', async () => {
      const antes = await como(equipo).get('/v1/yo').expect(200);
      expect(antes.body.usuario.version_vista).toBeNull();

      const vista = await como(equipo).post('/v1/equipo/versiones/vista').expect(200);
      expect(vista.body).toEqual({ version_vista: VERSION });
      const despues = await como(equipo).get('/v1/yo').expect(200);
      expect(despues.body.usuario.version_vista).toBe(VERSION);

      const tienda = cookieDe(await ingresar('tiendaa', CLAVE_DEMO).expect(200));
      await como(tienda).post('/v1/equipo/versiones/vista').expect(403);
    });
  });
});
