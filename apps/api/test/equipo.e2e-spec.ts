import type { INestApplication } from '@nestjs/common';
import type { CuentaEquipo, RespuestaAcceso } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const TIENDA_NUEVA = {
  tipo: 'DUENO',
  nombre: 'Rosa M.',
  usuario: 'tiendaf',
  tienda: { nombre: 'Tienda F', galeria: 'cyberplaza', stand: '118', whatsapp: '987 654 321' },
};

describe('Panel del equipo (RF-35, RF-49, RF-50)', () => {
  let app: INestApplication;
  let equipo: string;
  const http = () => request(app.getHttpServer());

  const ingresar = (usuario: string, clave: string) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave });

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

  const comoEquipo = {
    get: (ruta: string) => http().get(ruta).set('Cookie', equipo),
    post: (ruta: string, cuerpo?: object) =>
      http().post(ruta).set(CABECERAS).set('Cookie', equipo).send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      http().patch(ruta).set(CABECERAS).set('Cookie', equipo).send(cuerpo),
  };

  it('solo entra el equipo', async () => {
    await http().get('/v1/equipo/cuentas').expect(401);
    const vendedor = cookieDe(await ingresar('tiendaa', CLAVE_DEMO).expect(200));
    const respuesta = await http().get('/v1/equipo/cuentas').set('Cookie', vendedor).expect(403);
    expect(respuesta.body.error.codigo).toBe('PROHIBIDO');
  });

  it('lista las cuentas del piloto con su estado, sin las del equipo', async () => {
    const respuesta = await comoEquipo.get('/v1/equipo/cuentas').expect(200);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    const usuarios = respuesta.body.cuentas.map((c: CuentaEquipo) => c.usuario);
    expect(usuarios).not.toContain('equipo');
    expect(respuesta.body.resumen).toEqual({
      total: 7,
      activas: 5,
      sin_primer_ingreso: 2,
      suspendidas: 0,
    });

    const pendientes = await comoEquipo
      .get('/v1/equipo/cuentas?estado=sin_primer_ingreso')
      .expect(200);
    expect(pendientes.body.cuentas.map((c: CuentaEquipo) => c.usuario).sort()).toEqual([
      'jorge.r',
      'tiendad',
    ]);

    const busqueda = await comoEquipo.get('/v1/equipo/cuentas?q=kevin').expect(200);
    expect(busqueda.body.cuentas).toHaveLength(1);
    expect(busqueda.body.cuentas[0]).toMatchObject({ usuario: 'tiendaa.kevin', rol: 'ASESOR' });

    const independientes = await comoEquipo
      .get('/v1/equipo/cuentas?galeria=independientes')
      .expect(200);
    expect(independientes.body.cuentas.map((c: CuentaEquipo) => c.usuario)).toEqual(['jorge.r']);
  });

  describe('crear cuenta', () => {
    let creada: RespuestaAcceso;

    it('crea la tienda y su dueño con una clave temporal y el mensaje para WhatsApp', async () => {
      const respuesta = await comoEquipo.post('/v1/equipo/cuentas', TIENDA_NUEVA).expect(201);
      creada = respuesta.body as RespuestaAcceso;
      expect(creada.cuenta).toMatchObject({
        usuario: 'tiendaf',
        rol: 'DUENO',
        estado: 'SIN_PRIMER_INGRESO',
        whatsapp: '987654321',
        tienda: { nombre: 'Tienda F', galeria: 'Cyberplaza', stand: '118', tipo: 'TIENDA' },
      });
      expect(creada.clave_temporal).toMatch(/^pase-[a-z]{3}\d-[a-z]{2}\d$/);
      expect(creada.mensaje).toContain('Usuario: tiendaf');
      expect(creada.mensaje).toContain(`Contraseña temporal: ${creada.clave_temporal}`);
      expect(creada.mensaje).toContain('/ingresar');
      expect(creada.enlace_whatsapp).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
      expect(respuesta.headers['cache-control']).toBe('no-store');
    });

    it('la auditoría registra quién la creó, nunca la clave', async () => {
      const registro = await prisma.auditoria.findFirstOrThrow({
        where: { accion: 'crear_cuenta' },
      });
      expect(registro.actorId).not.toBeNull();
      expect(JSON.stringify(registro.datos)).not.toContain(creada.clave_temporal);
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaf' } });
      expect(usuario.claveHash).not.toContain(creada.clave_temporal);
    });

    it('la cuenta nueva entra con la clave temporal y debe cambiarla', async () => {
      const respuesta = await ingresar('tiendaf', creada.clave_temporal).expect(200);
      expect(respuesta.body.usuario.debe_cambiar_clave).toBe(true);
    });

    it('si el usuario ya existe, sugiere uno libre', async () => {
      const respuesta = await comoEquipo.post('/v1/equipo/cuentas', TIENDA_NUEVA).expect(409);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'CONFLICTO',
        detalles: { sugerencia: 'tiendaf2' },
      });
    });

    it('suma un asesor a una tienda que ya existe', async () => {
      const tienda = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda F' } });
      const respuesta = await comoEquipo
        .post('/v1/equipo/cuentas', {
          tipo: 'ASESOR',
          nombre: 'Kevin P.',
          usuario: 'tiendaf.kevin',
          tienda_id: tienda.id,
        })
        .expect(201);
      expect(respuesta.body.cuenta).toMatchObject({
        rol: 'ASESOR',
        whatsapp: null,
        tienda: { id: tienda.id },
      });
      expect(respuesta.body.enlace_whatsapp).toBeNull();
    });

    it('un independiente puede no tener galería; un dueño de tienda no', async () => {
      await comoEquipo
        .post('/v1/equipo/cuentas', {
          tipo: 'INDEPENDIENTE',
          nombre: 'Lucía Q.',
          usuario: 'lucia.q',
          tienda: { nombre: 'Lucía Q.', galeria: null, whatsapp: '912345678' },
        })
        .expect(201);
      const sinGaleria = await comoEquipo
        .post('/v1/equipo/cuentas', {
          ...TIENDA_NUEVA,
          usuario: 'tiendag',
          tienda: { ...TIENDA_NUEVA.tienda, galeria: null },
        })
        .expect(400);
      expect(sinGaleria.body.error.mensaje).toBe('Una tienda de galería necesita su galería.');
    });

    it('rechaza un WhatsApp que no es un celular de Perú', async () => {
      const respuesta = await comoEquipo
        .post('/v1/equipo/cuentas', {
          ...TIENDA_NUEVA,
          usuario: 'tiendah',
          tienda: { ...TIENDA_NUEVA.tienda, whatsapp: '12345' },
        })
        .expect(400);
      expect(respuesta.body.error.mensaje).toBe(
        'Escribe un celular de 9 dígitos que empiece con 9.',
      );
    });
  });

  it('una clave temporal nueva cierra sus sesiones y anula la anterior', async () => {
    const vendedor = cookieDe(await ingresar('tiendab', CLAVE_DEMO).expect(200));
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });

    const respuesta = await comoEquipo
      .post(`/v1/equipo/cuentas/${usuario.id}/clave-temporal`)
      .expect(200);
    expect(respuesta.body.cuenta).toMatchObject({
      estado: 'ACTIVA',
      clave_temporal_pendiente: true,
    });
    expect(respuesta.body.mensaje).toContain('contraseña temporal nueva');

    await http().get('/v1/yo').set('Cookie', vendedor).expect(401);
    await ingresar('tiendab', CLAVE_DEMO).expect(401);
    const nueva = await ingresar('tiendab', respuesta.body.clave_temporal).expect(200);
    expect(nueva.body.usuario.debe_cambiar_clave).toBe(true);
  });

  it('suspender corta el acceso al instante y reactivar lo devuelve', async () => {
    const vendedor = cookieDe(await ingresar('tiendac', CLAVE_DEMO).expect(200));
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendac' } });

    const suspendida = await comoEquipo
      .patch(`/v1/equipo/cuentas/${usuario.id}`, { estado: 'SUSPENDIDA' })
      .expect(200);
    expect(suspendida.body.estado).toBe('SUSPENDIDA');
    await http().get('/v1/yo').set('Cookie', vendedor).expect(401);
    await ingresar('tiendac', CLAVE_DEMO).expect(403);

    const conClave = await comoEquipo
      .post(`/v1/equipo/cuentas/${usuario.id}/clave-temporal`)
      .expect(409);
    expect(conClave.body.error.mensaje).toMatch(/Reactívala/);

    await comoEquipo.patch(`/v1/equipo/cuentas/${usuario.id}`, { estado: 'ACTIVA' }).expect(200);
    await ingresar('tiendac', CLAVE_DEMO).expect(200);

    const acciones = await prisma.auditoria.findMany({
      where: { objetoId: usuario.id },
      orderBy: { creadaEn: 'asc' },
    });
    // El intento rechazado de clave temporal no queda registrado.
    expect(acciones.map((a) => a.accion)).toEqual(['suspender', 'reactivar']);
  });

  it('no toca cuentas del equipo ni identificadores inventados', async () => {
    const delEquipo = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'equipo' } });
    await comoEquipo
      .patch(`/v1/equipo/cuentas/${delEquipo.id}`, { estado: 'SUSPENDIDA' })
      .expect(404);
    await comoEquipo.post('/v1/equipo/cuentas/no-es-un-id/clave-temporal').expect(400);
  });

  it('lista las tiendas activas para elegir la del asesor', async () => {
    const respuesta = await comoEquipo.get('/v1/equipo/tiendas').expect(200);
    expect(respuesta.body.map((t: { nombre: string }) => t.nombre)).toContain('Tienda F');
  });
});
