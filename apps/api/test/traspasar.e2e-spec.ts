import type { INestApplication } from '@nestjs/common';
import type { ConversacionEnLista, CuentaEquipo, RespuestaTraspaso } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

describe('Traspasar publicaciones y conversaciones (RF-71, A-11)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const ids: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    post: (ruta: string, cuerpo?: object) =>
      http()
        .post(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });

  /** Abre el hilo por una oferta y escribe el primer mensaje. */
  const escribir = async (usuario: string, ofertaId: string, texto: string) => {
    const contacto = await como(usuario)
      .post(`/v1/ofertas/${ofertaId}/contacto`, { canal: 'CHAT' })
      .expect(200);
    await como(usuario)
      .post(`/v1/conversaciones/${contacto.body.conversacion_id}/mensajes`, { texto })
      .expect(201);
    return contacto.body.conversacion_id as string;
  };

  const ofertaDe = (tienda: string, titulo: string) =>
    prisma.oferta.findFirstOrThrow({
      where: {
        tienda: { nombre: tienda },
        producto: { titulo: { startsWith: titulo } },
        vigente: true,
      },
    });

  let hiloDeVenta: string;
  let hiloDeCompra: string;
  let hiloQueChoca: string;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendae', 'equipo']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
      ids[usuario] = (await prisma.usuario.findUniqueOrThrow({ where: { usuario } })).id;
    }

    // Tienda E le pregunta a Luis por su Kingston: Luis es el vendedor.
    hiloDeVenta = await escribir(
      'tiendae',
      (await ofertaDe('Tienda A', 'Kingston')).id,
      '¿Tienes 2?',
    );
    // Luis pregunta por el monitor de Tienda E: ahí es comprador.
    hiloDeCompra = await escribir('tiendaa', (await ofertaDe('Tienda E', 'LG')).id, '¿Precio?');
    // Por la RTX de Tienda E preguntaron los dos: el hilo de Luis no puede pasar a Kevin.
    const rtx = await ofertaDe('Tienda E', 'MSI GeForce RTX 3070');
    hiloQueChoca = await escribir('tiendaa', rtx.id, '¿Sigue la 3070?');
    await escribir('tiendaa.kevin', rtx.id, 'Hola, ¿la 3070?');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('el panel muestra lo que cada cuenta tiene a su nombre', async () => {
    const lista = await como('equipo').get('/v1/equipo/cuentas?q=tiendaa').expect(200);
    const luis = lista.body.cuentas.find((c: CuentaEquipo) => c.usuario === 'tiendaa');
    expect(luis.a_cargo).toEqual({ publicaciones: 6, conversaciones: 3 });

    const deLaTienda = await como('equipo')
      .get(`/v1/equipo/cuentas?tienda=${luis.tienda.id}`)
      .expect(200);
    expect(deLaTienda.body.cuentas.map((c: CuentaEquipo) => c.usuario).sort()).toEqual([
      'tiendaa',
      'tiendaa.kevin',
    ]);
  });

  it('no traspasa a otra tienda, a una cuenta suspendida ni a sí misma', async () => {
    const otraTienda = await como('equipo')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids.tiendae })
      .expect(400);
    expect(otraTienda.body.error.mensaje).toBe(
      'Solo se puede traspasar a otra cuenta de la misma tienda.',
    );
    await como('equipo')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids.tiendaa })
      .expect(400);
    await como('equipo')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids.equipo })
      .expect(404);

    await prisma.usuario.update({
      where: { id: ids['tiendaa.kevin'] },
      data: { estado: 'SUSPENDIDO' },
    });
    const suspendida = await como('equipo')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids['tiendaa.kevin'] })
      .expect(409);
    expect(suspendida.body.error.mensaje).toBe(
      'Esa cuenta está suspendida. Reactívala o elige otra.',
    );
    await prisma.usuario.update({
      where: { id: ids['tiendaa.kevin'] },
      data: { estado: 'ACTIVO' },
    });
  });

  it('solo el equipo traspasa', async () => {
    await como('tiendaa')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids['tiendaa.kevin'] })
      .expect(403);
  });

  it('pasa publicaciones, hilos, lecturas y avisos; el hilo que choca se queda', async () => {
    const respuesta = await como('equipo')
      .post(`/v1/equipo/cuentas/${ids.tiendaa}/traspasar`, { a_usuario_id: ids['tiendaa.kevin'] })
      .expect(200);
    const traspaso = respuesta.body as RespuestaTraspaso;
    expect(traspaso).toMatchObject({
      publicaciones: 6,
      conversaciones: 2,
      omitidas: 1,
      desde: { usuario: 'tiendaa', a_cargo: { publicaciones: 0, conversaciones: 1 } },
      hacia: { usuario: 'tiendaa.kevin', a_cargo: { publicaciones: 6, conversaciones: 3 } },
    });

    const kevin = await como('tiendaa.kevin').get('/v1/conversaciones').expect(200);
    const suyos = kevin.body.conversaciones.map((c: ConversacionEnLista) => c.id);
    expect(suyos).toEqual(expect.arrayContaining([hiloDeVenta, hiloDeCompra]));
    // El aviso de Tienda E también pasó: Kevin lo ve en su campanita.
    const avisos = await como('tiendaa.kevin').get('/v1/avisos').expect(200);
    expect(avisos.body.avisos.map((a: { enlace: string }) => a.enlace)).toContain(
      `/mensajes/${hiloDeVenta}`,
    );

    const luis = await como('tiendaa').get('/v1/conversaciones').expect(200);
    expect(luis.body.conversaciones.map((c: ConversacionEnLista) => c.id)).toEqual([hiloQueChoca]);
    await como('tiendaa').get(`/v1/conversaciones/${hiloDeVenta}`).expect(404);

    const registro = await prisma.auditoria.findFirstOrThrow({ where: { accion: 'traspasar' } });
    expect(registro.datos).toMatchObject({
      a: ids['tiendaa.kevin'],
      publicaciones: 6,
      omitidas: 1,
    });
  });

  it('los mensajes nuevos y los contactos nuevos le llegan a quien recibió', async () => {
    await como('tiendae')
      .post(`/v1/conversaciones/${hiloDeVenta}/mensajes`, { texto: '¿Me respondes?' })
      .expect(201);
    const conversacion = await prisma.conversacion.findUniqueOrThrow({
      where: { id: hiloDeVenta },
    });
    expect(conversacion.vendedorId).toBe(ids['tiendaa.kevin']);

    const i5 = await ofertaDe('Tienda A', 'Intel Core i5');
    const nuevo = await escribir('tiendae', i5.id, 'Hola');
    const hilo = await prisma.conversacion.findUniqueOrThrow({ where: { id: nuevo } });
    expect(hilo.vendedorId).toBe(ids['tiendaa.kevin']);
  });
});
