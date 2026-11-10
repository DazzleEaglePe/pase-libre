import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

describe('Perfil de otra tienda, seguir y opiniones (sección 15 del lienzo final)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let tiendaA: string;
  let tiendaB: string;
  let tiendaC: string;

  async function como(usuario: string): Promise<string> {
    const guardada = cookies.get(usuario);
    if (guardada) return guardada;
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    const cookie = cookieDe(respuesta);
    cookies.set(usuario, cookie);
    return cookie;
  }

  /** Una venta de una publicación de A a la tienda B, como la marca el chat. */
  async function ventaDeAaB(opciones: { reservada?: boolean } = {}): Promise<string> {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', stock: { gt: 1 } },
      orderBy: { creadaEn: 'asc' },
    });
    if (opciones.reservada) {
      await prisma.oferta.update({ where: { id: oferta.id }, data: { tiendaVisible: false } });
    }
    const dueno = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    const comprador = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });
    const venta = await prisma.venta.create({
      data: {
        ofertaId: oferta.id,
        compradorId: comprador.id,
        tiendaCompradoraId: tiendaB,
        stockAntes: oferta.stock,
        stockDespues: oferta.stock - 1,
        registradaPorId: dueno.id,
      },
    });
    return venta.id;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    const id = async (nombre: string) =>
      (await prisma.tienda.findFirstOrThrow({ where: { nombre } })).id;
    tiendaA = await id('Tienda A');
    tiendaB = await id('Tienda B');
    tiendaC = await id('Tienda C');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('un visitante no ve perfiles de tiendas', async () => {
    await http().get(`/v1/tiendas/${tiendaA}`).expect(401);
    await http().get(`/v1/tiendas/${tiendaA}/opiniones`).expect(401);
  });

  it('el perfil muestra lo que la tienda publica con su nombre, nunca lo reservado', async () => {
    const reservada = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', stock: { gt: 0 } },
      orderBy: { creadaEn: 'desc' },
    });
    await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: false } });

    const perfil = await http()
      .get(`/v1/tiendas/${tiendaA}`)
      .set('Cookie', await como('tiendab'))
      .expect(200);

    expect(perfil.body).toMatchObject({
      nombre: 'Tienda A',
      iniciales: 'A',
      propia: false,
      puede_seguir: true,
      siguiendo: null,
      explicar_seguir: true,
      seguidores: 0,
      reputacion: { promedio: null, opiniones: 0, ventas: 0 },
    });
    const ids = (perfil.body.productos as Array<{ oferta_id: string }>).map((p) => p.oferta_id);
    expect(ids).not.toContain(reservada.id);
    expect(perfil.body.total_productos).toBe(ids.length);
    // Lo que está al interno sale sin precio para las demás tiendas.
    const alInterno = await prisma.oferta.findMany({
      where: { tiendaId: tiendaA, precioVisible: false, id: { in: ids } },
      select: { id: true },
    });
    for (const { id } of alInterno) {
      const producto = (
        perfil.body.productos as Array<{ oferta_id: string; precio: unknown }>
      ).find((p) => p.oferta_id === id);
      expect(producto?.precio).toBeNull();
    }
    await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: true } });
  });

  it('seguir, cambiar los avisos y dejar de seguir', async () => {
    const cookie = await como('tiendab');
    const seguir = await http()
      .post(`/v1/tiendas/${tiendaA}/seguir`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({})
      .expect(200);
    expect(seguir.body).toEqual({ siguiendo: { avisos: 'IMPORTANTE' }, seguidores: 1 });

    // «¿Quieres seguir a…?» sale solo la primera vez.
    const perfil = await http().get(`/v1/tiendas/${tiendaC}`).set('Cookie', cookie).expect(200);
    expect(perfil.body.explicar_seguir).toBe(false);

    await http()
      .patch(`/v1/tiendas/${tiendaA}/seguir`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({ avisos: 'TODO' })
      .expect(200);
    const seguidas = await http().get('/v1/tiendas/seguidas').set('Cookie', cookie).expect(200);
    expect(seguidas.body).toHaveLength(1);
    expect(seguidas.body[0]).toMatchObject({ id: tiendaA, nombre: 'Tienda A', avisos: 'TODO' });

    const dejar = await http()
      .delete(`/v1/tiendas/${tiendaA}/seguir`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .expect(200);
    expect(dejar.body).toEqual({ siguiendo: null, seguidores: 0 });
    await http()
      .patch(`/v1/tiendas/${tiendaA}/seguir`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({ avisos: 'TODO' })
      .expect(404);
  });

  it('no se sigue a sí misma y el equipo no sigue tiendas', async () => {
    await http()
      .post(`/v1/tiendas/${tiendaB}/seguir`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({})
      .expect(409);
    await http()
      .post(`/v1/tiendas/${tiendaB}/seguir`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({})
      .expect(403);
  });

  it('solo opinan quien compró y quien vendió, una vez cada uno', async () => {
    const ventaId = await ventaDeAaB();

    // Una tienda que no estuvo en la venta: para ella no existe.
    await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendac'))
      .send({ estrellas: 5 })
      .expect(404);

    // Lo que se marca tiene que ser de la lista del lado que opina.
    await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ estrellas: 5, aspectos: ['Pagó sin problema'] })
      .expect(400);

    const opinion = await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({
        estrellas: 5,
        aspectos: ['Precio como se publicó', 'Producto como se describió'],
        texto: '  Todo conforme.  ',
      })
      .expect(201);
    expect(opinion.body).toMatchObject({
      autor: { nombre: 'Tienda B', iniciales: 'B' },
      estrellas: 5,
      texto: 'Todo conforme.',
      respuesta: null,
    });
    expect(typeof opinion.body.producto).toBe('string');

    await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ estrellas: 4 })
      .expect(409);

    // Quien vendió también opina de quien compró, con su propia lista.
    await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ estrellas: 4, aspectos: ['Pagó sin problema'] })
      .expect(201);

    const deA = await http()
      .get(`/v1/tiendas/${tiendaA}/opiniones`)
      .set('Cookie', await como('tiendac'))
      .expect(200);
    expect(deA.body.reputacion).toEqual({ promedio: 5, opiniones: 1, ventas: 1 });
    expect(deA.body.distribucion[0]).toEqual({ estrellas: 5, cantidad: 1 });
    expect(deA.body.aspectos).toEqual([
      { aspecto: 'Respeta el precio acordado', porcentaje: 100 },
      { aspecto: 'El producto es como lo describe', porcentaje: 100 },
      { aspecto: 'Responde rápido', porcentaje: 0 },
    ]);
    expect(deA.body.puede_responder).toBe(false);

    const deB = await http()
      .get(`/v1/tiendas/${tiendaB}/opiniones`)
      .set('Cookie', await como('tiendac'))
      .expect(200);
    expect(deB.body.reputacion.opiniones).toBe(1);
    expect(deB.body.opiniones[0].aspectos).toEqual(['Pagó sin problema']);
  });

  it('la tienda opinada responde una sola vez; las demás no pueden', async () => {
    const [opinion] = (
      await http()
        .get(`/v1/tiendas/${tiendaA}/opiniones`)
        .set('Cookie', await como('tiendaa'))
        .expect(200)
    ).body.opiniones as Array<{ id: string }>;
    if (!opinion) throw new Error('Falta la opinión de la prueba anterior');

    await http()
      .post(`/v1/opiniones/${opinion.id}/respuesta`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ texto: 'No es mía' })
      .expect(404);
    await http()
      .post(`/v1/opiniones/${opinion.id}/respuesta`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ texto: 'Gracias por la compra.' })
      .expect(204);
    await http()
      .post(`/v1/opiniones/${opinion.id}/respuesta`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ texto: 'Otra vez' })
      .expect(409);

    const conRespuesta = await http()
      .get(`/v1/tiendas/${tiendaA}/opiniones?filtro=con_respuesta`)
      .set('Cookie', await como('tiendac'))
      .expect(200);
    expect(conRespuesta.body.opiniones).toHaveLength(1);
    expect(conRespuesta.body.opiniones[0].respuesta).toBe('Gracias por la compra.');
    const bajas = await http()
      .get(`/v1/tiendas/${tiendaA}/opiniones?filtro=bajas`)
      .set('Cookie', await como('tiendac'))
      .expect(200);
    expect(bajas.body.opiniones).toHaveLength(0);
  });

  it('la opinión de una venta reservada no dice qué producto fue', async () => {
    const ventaId = await ventaDeAaB({ reservada: true });
    const opinion = await http()
      .post(`/v1/ventas/${ventaId}/opinion`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ estrellas: 3 })
      .expect(201);
    expect(opinion.body.producto).toBeNull();
  });

  it('bloquear a una tienda la saca de la búsqueda, la portada, la ficha y su perfil', async () => {
    const cookie = await como('tiendac');
    const deA = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', tiendaVisible: true, stock: { gt: 0 } },
      include: { producto: true },
    });
    const ofertasDe = (cuerpo: { productos: Array<{ ofertas?: unknown }> }) =>
      JSON.stringify(cuerpo);

    await http()
      .post(`/v1/tiendas/${tiendaA}/bloqueo`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .expect(204);

    const busqueda = await http()
      .get(`/v1/buscar?q=${encodeURIComponent(deA.producto.titulo)}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(ofertasDe(busqueda.body)).not.toContain('Tienda A');
    const portada = await http().get('/v1/portada').set('Cookie', cookie).expect(200);
    expect(JSON.stringify(portada.body.recien_publicado)).not.toContain('Tienda A');
    const ficha = await http()
      .get(`/v1/productos/${deA.producto.slug}`)
      .set('Cookie', cookie)
      .expect(200);
    expect((ficha.body.ofertas as Array<{ id: string }>).map((o) => o.id)).not.toContain(deA.id);
    const perfil = await http().get(`/v1/tiendas/${tiendaA}`).set('Cookie', cookie).expect(200);
    expect(perfil.body).toMatchObject({ bloqueada: true, productos: [] });

    // Las demás tiendas la siguen viendo.
    const otra = await http()
      .get(`/v1/productos/${deA.producto.slug}`)
      .set('Cookie', await como('tiendae'))
      .expect(200);
    expect((otra.body.ofertas as Array<{ id: string }>).map((o) => o.id)).toContain(deA.id);

    await http()
      .delete(`/v1/cuenta/bloqueados/${tiendaA}`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .expect(204);
    const despues = await http()
      .get(`/v1/productos/${deA.producto.slug}`)
      .set('Cookie', cookie)
      .expect(200);
    expect((despues.body.ofertas as Array<{ id: string }>).map((o) => o.id)).toContain(deA.id);
  });

  it('reportar una publicación reservada no dice de quién era, ni en «Mis reportes»', async () => {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA' },
      orderBy: { creadaEn: 'desc' },
    });
    await prisma.oferta.update({ where: { id: oferta.id }, data: { tiendaVisible: false } });
    const cookie = await como('tiendae');
    const reporte = await http()
      .post('/v1/denuncias')
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({ objeto: 'OFERTA', objeto_id: oferta.id, tipo: 'DESCRITO', bloquear: true })
      .expect(201);
    expect(reporte.body.bloqueada).toBe(true);

    const mios = await http().get('/v1/cuenta/reportes').set('Cookie', cookie).expect(200);
    expect(mios.body[0]).toMatchObject({ tienda: 'Tienda reservada', tipo: 'DESCRITO' });
    const bloqueadas = await http().get('/v1/cuenta/bloqueados').set('Cookie', cookie).expect(200);
    expect(JSON.stringify(bloqueadas.body)).not.toContain('Tienda A');

    // La propia tienda no se reporta.
    await http()
      .post('/v1/denuncias')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ objeto: 'OFERTA', objeto_id: oferta.id, tipo: 'ESTAFA' })
      .expect(409);
    await prisma.oferta.update({ where: { id: oferta.id }, data: { tiendaVisible: true } });
  });
});
