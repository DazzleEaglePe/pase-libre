import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';

/**
 * «Mostrar el nombre de mi tienda» apagado (lienzo «Demo · lo aprobado»): las demás tiendas
 * ven «Tienda reservada», sin nombre, stand ni WhatsApp, en la ficha, los resultados, la
 * portada y el chat. La tienda dueña y el equipo la siguen viendo.
 */
describe('Tienda reservada', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let ofertaId = '';

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

  /** Nada de Tienda B: ni su nombre, ni su stand, ni su WhatsApp, ni el nombre de su dueña. */
  function sinRastroDeB(cuerpo: unknown): void {
    const texto = JSON.stringify(cuerpo);
    expect(texto).not.toContain('Tienda B');
    expect(texto).not.toContain('987222101');
    expect(texto).not.toContain('Carla V.');
    expect(texto).not.toMatch(/"stand":"101"/);
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();

    const mias = await http()
      .get('/v1/mis-ofertas?estado=todas')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    ofertaId = mias.body.ofertas.find(
      (o: { producto: { slug: string } }) => o.producto.slug === VENTUS,
    ).id;
    const editada = await http()
      .patch(`/v1/ofertas/${ofertaId}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ tienda_visible: false })
      .expect(200);
    expect(editada.body.tienda_visible).toBe(false);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('en la ficha, otra tienda ve «Tienda reservada» y la galería, sin id ni stand', async () => {
    const ficha = await http()
      .get(`/v1/productos/${VENTUS}`)
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    const oferta = ficha.body.ofertas.find((o: { id: string }) => o.id === ofertaId);
    expect(oferta).toMatchObject({
      tienda: { id: '', nombre: 'Tienda reservada', stand: null },
      tienda_visible: false,
      galeria: 'Cyberplaza',
      precio: { centimos: 24000 },
    });
    sinRastroDeB(ficha.body);
  });

  it('la dueña y el equipo la siguen viendo', async () => {
    for (const usuario of ['tiendab', 'equipo']) {
      const ficha = await http()
        .get(`/v1/productos/${VENTUS}`)
        .set('Cookie', await como(usuario))
        .expect(200);
      const oferta = ficha.body.ofertas.find((o: { id: string }) => o.id === ofertaId);
      expect(oferta.tienda).toMatchObject({ nombre: 'Tienda B', stand: '101' });
    }
  });

  it('en los resultados y en la portada tampoco se ve', async () => {
    const cookie = await como('tiendaa');
    const buscar = await http().get('/v1/buscar?q=ventus').set('Cookie', cookie).expect(200);
    const ventus = buscar.body.productos.find((p: { slug: string }) => p.slug === VENTUS);
    expect(ventus.oferta_destacada).toMatchObject({
      id: ofertaId,
      tienda: { nombre: 'Tienda reservada', stand: null },
      tienda_visible: false,
    });
    sinRastroDeB(buscar.body);

    const portada = await http().get('/v1/portada').set('Cookie', cookie).expect(200);
    const tarjeta = portada.body.recien_publicado.find(
      (t: { oferta_id: string }) => t.oferta_id === ofertaId,
    );
    expect(tarjeta.tienda).toEqual({ nombre: 'Tienda reservada', stand: null });
  });

  it('no da su WhatsApp: se escribe solo por chat', async () => {
    const respuesta = await http()
      .post(`/v1/ofertas/${ofertaId}/contacto`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ canal: 'WHATSAPP' })
      .expect(409);
    sinRastroDeB(respuesta.body);
  });

  it('en el chat quien compra no ve quién vende, ni en la bandeja ni en el aviso', async () => {
    const compradora = await como('tiendaa');
    const vendedora = await como('tiendab');
    const contacto = await http()
      .post(`/v1/ofertas/${ofertaId}/contacto`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .send({ canal: 'CHAT' })
      .expect(200);
    const id = contacto.body.conversacion_id as string;
    await http()
      .post(`/v1/conversaciones/${id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .send({ texto: '¿Sigue disponible?' })
      .expect(201);
    await http()
      .post(`/v1/conversaciones/${id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', vendedora)
      .send({ texto: 'Sí, te la separo.' })
      .expect(201);

    const bandeja = await http().get('/v1/conversaciones').set('Cookie', compradora).expect(200);
    const enLista = bandeja.body.conversaciones.find((c: { id: string }) => c.id === id);
    expect(enLista.otro).toMatchObject({
      nombre: 'Tienda reservada',
      tienda: { id: '', nombre: 'Tienda reservada', galeria: 'Cyberplaza', stand: null },
    });
    sinRastroDeB(bandeja.body);

    const detalle = await http()
      .get(`/v1/conversaciones/${id}`)
      .set('Cookie', compradora)
      .expect(200);
    expect(detalle.body.otro.nombre).toBe('Tienda reservada');
    sinRastroDeB(detalle.body);

    const avisos = await http().get('/v1/avisos').set('Cookie', compradora).expect(200);
    sinRastroDeB(avisos.body);
    expect(JSON.stringify(avisos.body)).toContain('Tienda reservada');

    // Quien vende sí ve a quien le escribe.
    const suya = await http().get(`/v1/conversaciones/${id}`).set('Cookie', vendedora).expect(200);
    expect(suya.body.otro.tienda.nombre).toBe('Tienda A');
  });

  it('el chat no da el id de quien vende ni si está en línea', async () => {
    const compradora = await como('tiendaa');
    const contacto = await http()
      .post(`/v1/ofertas/${ofertaId}/contacto`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .send({ canal: 'CHAT' })
      .expect(200);
    const id = contacto.body.conversacion_id as string;
    // Que la vendedora esté conectada no se nota.
    await como('tiendab');
    const detalle = await http()
      .get(`/v1/conversaciones/${id}`)
      .set('Cookie', compradora)
      .expect(200);
    expect(detalle.body.otro).toMatchObject({ id: '', en_linea: false, ultima_conexion: null });
    const duena = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });
    expect(JSON.stringify(detalle.body)).not.toContain(duena.id);
    const bandeja = await http().get('/v1/conversaciones').set('Cookie', compradora).expect(200);
    expect(JSON.stringify(bandeja.body)).not.toContain(duena.id);
  });

  it('bloquearla desde ese chat no la nombra en «Tiendas bloqueadas», y se puede deshacer', async () => {
    const compradora = await como('tiendaa');
    const contacto = await http()
      .post(`/v1/ofertas/${ofertaId}/contacto`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .send({ canal: 'CHAT' })
      .expect(200);
    await http()
      .post(`/v1/conversaciones/${contacto.body.conversacion_id}/bloqueo`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .expect((r) => expect(r.status).toBeLessThan(300));
    const lista = await http().get('/v1/cuenta/bloqueados').set('Cookie', compradora).expect(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].tienda).toMatchObject({
      nombre: 'Tienda reservada',
      galeria: 'Cyberplaza',
    });
    const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
    expect(lista.body[0].tienda.id).not.toBe(tiendaB.id);
    sinRastroDeB(lista.body);

    await http()
      .delete(`/v1/cuenta/bloqueados/${lista.body[0].tienda.id}`)
      .set(CABECERAS)
      .set('Cookie', compradora)
      .expect(204);
    const despues = await http().get('/v1/cuenta/bloqueados').set('Cookie', compradora).expect(200);
    expect(despues.body).toEqual([]);
  });

  it('volver a mostrarla la deja como antes', async () => {
    await http()
      .patch(`/v1/ofertas/${ofertaId}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ tienda_visible: true })
      .expect(200);
    const ficha = await http()
      .get(`/v1/productos/${VENTUS}`)
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    const oferta = ficha.body.ofertas.find((o: { id: string }) => o.id === ofertaId);
    expect(oferta.tienda).toMatchObject({ nombre: 'Tienda B', stand: '101' });
  });
});
