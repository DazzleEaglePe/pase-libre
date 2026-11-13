import type { INestApplication } from '@nestjs/common';
import type { Contadores, RespuestaAvisos } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * Versión 1.11.0 (doc 20, A1): el número de la campanita ya no vuelve solo. «Llegó» es
 * `llegadoEn` (se creó o trajo otro mensaje), no `actualizadoEn`, que lo mueve cualquier cambio.
 * Y en «Ayudar como la tienda» el Equipo no puede marcar los avisos de la tienda.
 */
describe('Campanita: el número no vuelve solo (doc 20, A1)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    send: (metodo: 'post' | 'patch' | 'delete', ruta: string, cuerpo: object = {}) => {
      const peticion = http();
      return peticion[metodo](ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo);
    },
  });
  const usuarioDe = (usuario: string) => prisma.usuario.findUniqueOrThrow({ where: { usuario } });
  const contadores = async (usuario: string) =>
    (await como(usuario).get('/v1/contadores').expect(200)).body as Contadores;
  const avisos = async (usuario: string) =>
    (await como(usuario).get('/v1/avisos').expect(200)).body as RespuestaAvisos;

  /** Tienda B le escribe a Tienda A por una de sus ofertas: el chat y su primer mensaje. */
  async function chatDeBconA(texto: string): Promise<{ conversacion: string; mensaje: string }> {
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
    });
    const contacto = await como('tiendab')
      .send('post', `/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
      .expect(200);
    const conversacion = contacto.body.conversacion_id as string;
    const enviado = await como('tiendab')
      .send('post', `/v1/conversaciones/${conversacion}/mensajes`, { texto })
      .expect(201);
    return { conversacion, mensaje: enviado.body.id as string };
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac', 'equipo']) {
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
    await app.close();
    await prisma.$disconnect();
  });

  it('editar o borrar un mensaje de un chat con aviso sin leer no sube el número', async () => {
    const usuarioA = await usuarioDe('tiendaa');
    await prisma.aviso.deleteMany({ where: { usuarioId: usuarioA.id } });
    const { conversacion, mensaje } = await chatDeBconA('Hola, ¿tienes la RTX 5060?');
    expect((await contadores('tiendaa')).avisos).toBe(1);

    // Abre la campanita: 0. El aviso sigue sin leer (su puntito).
    await como('tiendaa').send('post', '/v1/avisos/vistos').expect(200);
    expect((await contadores('tiendaa')).avisos).toBe(0);
    const aviso = await prisma.aviso.findFirstOrThrow({
      where: { usuarioId: usuarioA.id, conversacionId: conversacion },
    });
    expect(aviso.leidoEn).toBeNull();
    await esperar(5);

    // Tienda B edita el mensaje: el aviso cambia su texto, pero no «llega» de nuevo.
    await como('tiendab')
      .send('patch', `/v1/conversaciones/${conversacion}/mensajes/${mensaje}`, {
        texto: 'Hola, ¿tienes la RTX 5060 Ti?',
      })
      .expect(200);
    const editado = await prisma.aviso.findUniqueOrThrow({ where: { id: aviso.id } });
    expect(editado.extracto).toContain('RTX 5060 Ti');
    expect(editado.actualizadoEn.getTime()).toBeGreaterThan(aviso.actualizadoEn.getTime());
    expect(editado.llegadoEn).toEqual(aviso.llegadoEn);
    expect((await contadores('tiendaa')).avisos).toBe(0);

    // Borrarlo para todos, tampoco.
    await esperar(5);
    await http()
      .delete(`/v1/conversaciones/${conversacion}/mensajes/${mensaje}?para=todos`)
      .set(CABECERAS)
      .set('Cookie', cookies.tiendab ?? '')
      .expect(200);
    expect((await prisma.aviso.findUniqueOrThrow({ where: { id: aviso.id } })).extracto).toBe(
      'Se eliminó este mensaje.',
    );
    expect((await contadores('tiendaa')).avisos).toBe(0);
  });

  it('un mensaje nuevo en ese chat sí lo sube', async () => {
    const usuarioA = await usuarioDe('tiendaa');
    const aviso = await prisma.aviso.findFirstOrThrow({
      where: { usuarioId: usuarioA.id, conversacionId: { not: null } },
    });
    expect((await contadores('tiendaa')).avisos).toBe(0);
    await como('tiendab')
      .send('post', `/v1/conversaciones/${aviso.conversacionId}/mensajes`, {
        texto: 'Te la compro hoy.',
      })
      .expect(201);
    expect((await contadores('tiendaa')).avisos).toBe(1);
    const nuevo = await prisma.aviso.findUniqueOrThrow({ where: { id: aviso.id } });
    expect(nuevo.llegadoEn.getTime()).toBeGreaterThan(aviso.llegadoEn.getTime());
  });

  it('la lista va por cuándo llegó: un aviso editado no salta arriba', async () => {
    const usuarioC = await usuarioDe('tiendac');
    await prisma.aviso.deleteMany({ where: { usuarioId: usuarioC.id } });
    const viejo = await prisma.aviso.create({
      data: {
        usuarioId: usuarioC.id,
        tipo: 'SISTEMA',
        titulo: 'Llegó primero',
        llegadoEn: new Date(Date.now() - 60_000),
      },
    });
    await prisma.aviso.create({
      data: { usuarioId: usuarioC.id, tipo: 'SISTEMA', titulo: 'Llegó después' },
    });
    // Un cambio cualquiera mueve `actualizadoEn` (@updatedAt), no `llegadoEn`.
    await prisma.aviso.update({ where: { id: viejo.id }, data: { extracto: 'Cambió el texto' } });

    const lista = await avisos('tiendac');
    expect(lista.avisos.map((a) => a.titulo)).toEqual(['Llegó después', 'Llegó primero']);
    // La hora que se muestra es la de llegada.
    expect(lista.avisos[1]?.actualizado_en).toBe(viejo.llegadoEn.toISOString());
  });

  it('un aviso con «No molestar» cuenta recién cuando se hace visible', async () => {
    const usuarioC = await usuarioDe('tiendac');
    await como('tiendac').send('post', '/v1/avisos/vistos').expect(200);
    expect((await contadores('tiendac')).avisos).toBe(0);

    const callado = await prisma.aviso.create({
      data: {
        usuarioId: usuarioC.id,
        tipo: 'SISTEMA',
        titulo: 'Llegó de noche',
        visibleDesde: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    expect((await contadores('tiendac')).avisos).toBe(0);
    // Termina «No molestar»: ahora sí llegó, aunque se haya creado antes.
    await prisma.aviso.update({ where: { id: callado.id }, data: { visibleDesde: new Date() } });
    expect((await contadores('tiendac')).avisos).toBe(1);
  });

  describe('en modo soporte la campanita solo se mira', () => {
    it('vistos y leídos siguen en 403 MODO_SOPORTE (a propósito) y nada cambia para la dueña', async () => {
      const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
      await como('equipo')
        .send('post', `/v1/equipo/panel/tiendas/${tiendaA.id}/soporte`)
        .expect(200);
      const antes = await usuarioDe('tiendaa');
      const sinLeer = await prisma.aviso.count({
        where: { usuarioId: antes.id, leidoEn: null },
      });
      expect(sinLeer).toBeGreaterThan(0);
      // Mirar sí.
      const lista = await avisos('equipo');
      expect(lista.sin_leer).toBe(sinLeer);
      await como('equipo').get('/v1/contadores').expect(200);
      // Marcar, no.
      for (const ruta of ['/v1/avisos/vistos', '/v1/avisos/leidos']) {
        const respuesta = await como('equipo').send('post', ruta).expect(403);
        expect(respuesta.body.error.codigo).toBe('MODO_SOPORTE');
      }
      await como('equipo')
        .send('post', '/v1/avisos/leidos', { ids: [lista.avisos[0]!.id] })
        .expect(403);

      const despues = await usuarioDe('tiendaa');
      expect(despues.avisosVistosEn).toEqual(antes.avisosVistosEn);
      expect(await prisma.aviso.count({ where: { usuarioId: antes.id, leidoEn: null } })).toBe(
        sinLeer,
      );
      await como('equipo').send('post', '/v1/soporte/salir').expect(200);
    });
  });
});
