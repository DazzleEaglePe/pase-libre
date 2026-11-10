import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Panel del equipo: inicio, reportes, tiendas y comunicados (sección 20 del lienzo final). */
describe('Panel del equipo (sección 20)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();

  async function como(usuario: string): Promise<string> {
    const guardada = cookies.get(usuario);
    if (guardada) return guardada;
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    cookies.set(usuario, cookieDe(respuesta));
    return cookieDe(respuesta);
  }

  /** Tienda B reporta a Tienda A por una de sus publicaciones. */
  async function reportar(tipo: 'ESTAFA' | 'TRATO'): Promise<string> {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tienda: { nombre: 'Tienda A' }, estado: 'ACTIVA', tiendaVisible: true },
    });
    const respuesta = await http()
      .post('/v1/denuncias')
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ objeto: 'OFERTA', objeto_id: oferta.id, tipo, motivo: 'Me pidió adelanto por Yape.' })
      .expect(201);
    const denuncia = await prisma.denuncia.findFirstOrThrow({
      where: { codigo: Number(String(respuesta.body.codigo).replace('R-', '')) },
    });
    return denuncia.id;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('solo el equipo entra al panel', async () => {
    await http()
      .get('/v1/equipo/inicio')
      .set('Cookie', await como('tiendaa'))
      .expect(403);
  });

  it('el inicio cuenta lo de hoy y los números del piloto', async () => {
    await reportar('TRATO');
    await reportar('ESTAFA');
    const inicio = await http()
      .get('/v1/equipo/inicio')
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(inicio.body.reportes).toMatchObject({ abiertos: 2, urgentes: 1 });
    expect(inicio.body.reportes.primero.motivo).toBe('Estafa o intento de estafa');
    expect(inicio.body.numeros.tiendas).toBeGreaterThan(0);
    expect(inicio.body.numeros.publicaciones).toBeGreaterThan(0);
  });

  it('la cola pone las estafas primero y abrir un reporte lo pasa a revisión', async () => {
    const cola = await http()
      .get('/v1/equipo/reportes')
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(cola.body[0].urgente).toBe(true);
    const detalle = await http()
      .get(`/v1/equipo/reportes/${cola.body[0].id}`)
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(detalle.body).toMatchObject({
      estado: 'EN_REVISION',
      denunciante: { tienda: 'Tienda B' },
      tienda_reportada: { nombre: 'Tienda A', advertencias: 0 },
    });
    expect(detalle.body.sobre).toMatch(/^Publicación · /);
  });

  it('una advertencia queda en la tienda, le llega al chat oficial y avisa a quien reportó', async () => {
    const cola = await http()
      .get('/v1/equipo/reportes')
      .set('Cookie', await como('equipo'))
      .expect(200);
    const trato = cola.body.find((r: { urgente: boolean }) => !r.urgente);
    await http()
      .post(`/v1/equipo/reportes/${trato.id}/decision`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({ accion: 'ADVERTIR' })
      .expect(200);
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    expect(await prisma.advertencia.count({ where: { tiendaId: tiendaA.id } })).toBe(1);
    const chat = await http()
      .get('/v1/equipo-chat')
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(chat.body.mensajes.at(-1)).toMatchObject({
      de_equipo: true,
      caso: { estado: 'Resuelto' },
    });
    const avisos = await http()
      .get('/v1/avisos')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(avisos.body.avisos.some((a: { tipo: string }) => a.tipo === 'REPORTE')).toBe(true);
    // Ya resuelto, no se decide otra vez.
    await http()
      .post(`/v1/equipo/reportes/${trato.id}/decision`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({ accion: 'NADA' })
      .expect(409);
    const inicio = await http()
      .get('/v1/equipo/inicio')
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(inicio.body.actividad[0].accion).toMatch(/^le dio una advertencia a Tienda A/);
  });

  it('suspender oculta sus publicaciones y reactivar las devuelve', async () => {
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    const antes = await http().get('/v1/buscar?q=').expect(200);
    await http()
      .post(`/v1/equipo/panel/tiendas/${tiendaA.id}/suspension`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({ suspender: true, motivo: 'estafa comprobada' })
      .expect(204);
    const durante = await http().get('/v1/buscar?q=').expect(200);
    expect(durante.body.total_ofertas).toBeLessThan(antes.body.total_ofertas);
    const lista = await http()
      .get('/v1/equipo/panel/tiendas?filtro=suspendidas')
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(lista.body.map((t: { nombre: string }) => t.nombre)).toEqual(['Tienda A']);
    await http()
      .post(`/v1/equipo/panel/tiendas/${tiendaA.id}/suspension`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({ suspender: false })
      .expect(204);
    const detalle = await http()
      .get(`/v1/equipo/panel/tiendas/${tiendaA.id}`)
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(detalle.body).toMatchObject({ suspendida: false, advertencias: 1 });
    expect(detalle.body.historial[0].tipo).toBeDefined();
  });

  it('un comunicado llega a la campanita de las tiendas de una galería', async () => {
    const tiendaB = await prisma.tienda.findFirstOrThrow({
      where: { nombre: 'Tienda B' },
      include: { galeria: true },
    });
    const enviado = await http()
      .post('/v1/equipo/comunicados')
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({
        galeria: tiendaB.galeria?.slug,
        titulo: 'Corte de luz el sábado',
        texto: 'La galería cierra a las 6.',
      })
      .expect(201);
    expect(enviado.body.enviados).toBeGreaterThan(0);
    expect(enviado.body.para).toBe(tiendaB.galeria?.nombre);
    const avisos = await http()
      .get('/v1/avisos')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(
      avisos.body.avisos.some((a: { titulo: string }) => a.titulo === 'Corte de luz el sábado'),
    ).toBe(true);
    const lista = await http()
      .get('/v1/equipo/comunicados')
      .set('Cookie', await como('equipo'))
      .expect(200);
    expect(lista.body[0].titulo).toBe('Corte de luz el sábado');
  });
});
