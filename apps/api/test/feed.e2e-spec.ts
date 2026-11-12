import type { INestApplication } from '@nestjs/common';
import type {
  OfertaPropia,
  RespuestaInicio,
  RespuestaRecienInicio,
  RespuestaRecienLlegados,
  TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * El feed de las correcciones 11/11 (N15, N16, N06, N07): «Recién publicado» de a 24 mezclado
 * por tienda, la burbujita del precio, «Negociable» al publicar, la X del banner de invitar,
 * «Recién llegados +N nuevo» y los avisos que se leen al abrir su chat.
 */
describe('Feed de la tienda (N15, N16, N06, N07)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    post: (ruta: string, cuerpo: object = {}) =>
      http()
        .post(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
    patch: (ruta: string, cuerpo: object) =>
      http()
        .patch(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });
  const tienda = (nombre: string) => prisma.tienda.findFirstOrThrow({ where: { nombre } });

  /** Todo «Recién publicado», página por página, como lo trae la flechita. */
  async function todoRecien(usuario: string): Promise<RespuestaRecienInicio['tarjetas']> {
    const todas: TarjetaOfertaConVendedor[] = [];
    for (let desde = 0; ; desde += 24) {
      const pagina = (await como(usuario).get(`/v1/inicio/recien?desde=${desde}`).expect(200))
        .body as RespuestaRecienInicio;
      expect(pagina.tarjetas.length).toBeLessThanOrEqual(24);
      todas.push(...pagina.tarjetas);
      if (desde + 24 >= pagina.total) break;
    }
    return todas;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'equipo']) {
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

  describe('quién puede', () => {
    it('sin sesión no hay nada de esto', async () => {
      await http().get('/v1/inicio/recien').expect(401);
      await http().get('/v1/recien-llegados').expect(401);
      await http().post('/v1/recien-llegados/visto').set(CABECERAS).send({}).expect(401);
      await http().post('/v1/inicio/invitar-cerrado').set(CABECERAS).send({}).expect(401);
    });

    it('el equipo no tiene tienda: no tiene feed', async () => {
      await como('equipo').get('/v1/inicio/recien').expect(403);
      await como('equipo').get('/v1/recien-llegados').expect(403);
      await como('equipo').post('/v1/inicio/invitar-cerrado').expect(403);
    });

    it('«desde» se valida', async () => {
      await como('tiendab').get('/v1/inicio/recien?desde=-1').expect(400);
      await como('tiendab').get('/v1/inicio/recien?desde=abc').expect(400);
    });
  });

  describe('«Recién publicado» de a 24 (N15)', () => {
    it('trae todo lo de las demás tiendas, sin lo tuyo, sin repetir y sin dos seguidas de la misma', async () => {
      const tiendaB = await tienda('Tienda B');
      const total = await prisma.oferta.count({
        where: {
          estado: 'ACTIVA',
          stock: { gt: 0 },
          tiendaId: { not: tiendaB.id },
          tienda: { estado: 'ACTIVA' },
          producto: { fusionadoEnId: null },
        },
      });
      const todas = await todoRecien('tiendab');
      expect(todas).toHaveLength(total);
      expect(new Set(todas.map((t) => t.oferta_id)).size).toBe(total);
      expect(todas.some((t) => t.propia)).toBe(false);

      const deTienda = new Map(
        (
          await prisma.oferta.findMany({
            where: { id: { in: todas.map((t) => t.oferta_id) } },
            select: { id: true, tiendaId: true },
          })
        ).map((o) => [o.id, o.tiendaId]),
      );
      const orden = todas.map((t) => deTienda.get(t.oferta_id));
      orden.forEach((actual, i) => {
        // Dos seguidas de la misma solo si ya no quedan de otras tiendas.
        if (i > 0 && actual === orden[i - 1]) {
          expect(orden.slice(i).every((otra) => otra === actual)).toBe(true);
        }
      });
    });

    it('el inicio normal trae las primeras 24 y la página siguiente sigue donde terminó', async () => {
      const inicio = (await como('tiendab').get('/v1/inicio').expect(200)).body as RespuestaInicio;
      expect(inicio.fase).toBe('NORMAL');
      const primera = (await como('tiendab').get('/v1/inicio/recien').expect(200))
        .body as RespuestaRecienInicio;
      expect(inicio.recien.map((t) => t.oferta_id)).toEqual(
        primera.tarjetas.map((t) => t.oferta_id),
      );
      expect(inicio.publicaciones).toBe(primera.total);
    });

    it('lo de una tienda bloqueada no sale ni cuenta', async () => {
      const tiendaA = await tienda('Tienda A');
      const tiendaB = await tienda('Tienda B');
      const usuarioB = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendab' } });
      const antes = (await como('tiendab').get('/v1/inicio/recien').expect(200))
        .body as RespuestaRecienInicio;
      await prisma.bloqueo.create({
        data: { usuarioId: usuarioB.id, tiendaBloqueadaId: tiendaA.id },
      });
      const despues = (await como('tiendab').get('/v1/inicio/recien').expect(200))
        .body as RespuestaRecienInicio;
      const deA = await prisma.oferta.count({
        where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
      });
      expect(despues.total).toBe(antes.total - deA);
      expect(despues.tarjetas.some((t) => t.tienda.nombre === 'Tienda A')).toBe(false);
      await prisma.bloqueo.deleteMany({ where: { usuarioId: usuarioB.id } });
      expect(tiendaB.id).not.toBe(tiendaA.id);
    });
  });

  describe('la burbujita del precio (N06)', () => {
    it('Pase, Negociable, Socio y Por chat según quién mira', async () => {
      const tiendaA = await tienda('Tienda A');
      const tiendaB = await tienda('Tienda B');
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
      });
      const tarjeta = async (usuario = 'tiendab') =>
        (await todoRecien(usuario)).find((t) => t.oferta_id === oferta.id);

      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { precioCentimos: 388600n, moneda: 'PEN', precioVisible: true, negociable: true },
      });
      expect(await tarjeta()).toMatchObject({
        precio: { centimos: 388600, moneda: 'PEN' },
        negociable: true,
        precio_socio: false,
      });

      // «Solo mis socios»: para una tienda que no es socia es «Por chat», sin precio.
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { precioVisible: false, soloSocios: true },
      });
      expect(await tarjeta()).toMatchObject({
        precio: null,
        negociable: false,
        precio_socio: false,
      });

      // Siendo socia lo ve, con la burbujita «Socio».
      await prisma.socio.create({ data: { tiendaId: tiendaA.id, socioId: tiendaB.id } });
      expect(await tarjeta()).toMatchObject({
        precio: { centimos: 388600, moneda: 'PEN' },
        precio_socio: true,
      });
      // Otra tienda que no es socia sigue sin verlo.
      expect(await tarjeta('tiendac')).toMatchObject({ precio: null, precio_socio: false });

      // Precio público con descuento de socio: la socia ve el precio con descuento y «Socio».
      await prisma.oferta.update({
        where: { id: oferta.id },
        data: { precioVisible: true, soloSocios: false, descuentoSocioCentimos: 1000n },
      });
      expect(await tarjeta()).toMatchObject({
        precio: { centimos: 387600 },
        precio_socio: true,
      });
      expect(await tarjeta('tiendac')).toMatchObject({
        precio: { centimos: 388600 },
        precio_socio: false,
      });
      await prisma.socio.deleteMany({ where: { tiendaId: tiendaA.id } });
    });
  });

  describe('Publicar con «Precio fijo ▾ / Negociable» (N06)', () => {
    it('se guarda al publicar y se cambia al editar', async () => {
      const tiendaB = await tienda('Tienda B');
      const producto = await prisma.producto.findFirstOrThrow({
        where: { fusionadoEnId: null, ofertas: { none: { tiendaId: tiendaB.id } } },
      });
      const publicada = await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: producto.id,
          estado_detalle: 'SELLADO',
          con_factura: true,
          stock: 2,
          moneda: 'PEN',
          precio: '1240',
          quien_ve_precio: 'TODOS',
          negociable: true,
        })
        .expect(201);
      const id = publicada.body.oferta.id as string;
      const propia = (await como('tiendab').get(`/v1/ofertas/${id}`).expect(200))
        .body as OfertaPropia;
      expect(propia.negociable).toBe(true);
      expect(propia.detalle.con_factura).toBe(true);
      await como('tiendab').patch(`/v1/ofertas/${id}`, { negociable: false }).expect(200);
      expect((await prisma.oferta.findUniqueOrThrow({ where: { id } })).negociable).toBe(false);
    });

    it('«Al interno · por chat» no pide precio (error 16)', async () => {
      const tiendaB = await tienda('Tienda B');
      const producto = await prisma.producto.findFirstOrThrow({
        where: { fusionadoEnId: null, ofertas: { none: { tiendaId: tiendaB.id } } },
      });
      await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: producto.id,
          estado_detalle: 'SELLADO',
          stock: 1,
          precio: '',
          quien_ve_precio: 'NADIE',
        })
        .expect(201);
    });
  });

  describe('el banner «¿Conoces una tienda…?» (N07)', () => {
    it('la X se guarda en la cuenta de quien la toca', async () => {
      const antes = (await como('tiendab').get('/v1/inicio').expect(200)).body as RespuestaInicio;
      expect(antes.invitar_cerrado).toBe(false);
      await como('tiendab').post('/v1/inicio/invitar-cerrado').expect(204);
      await como('tiendab').post('/v1/inicio/invitar-cerrado').expect(204);
      const despues = (await como('tiendab').get('/v1/inicio').expect(200)).body as RespuestaInicio;
      expect(despues.invitar_cerrado).toBe(true);
      // Es de la persona, no de la tienda: el asesor de otra cuenta lo sigue viendo.
      const deKevin = (await como('tiendaa.kevin').get('/v1/inicio').expect(200))
        .body as RespuestaInicio;
      expect(deKevin.invitar_cerrado).toBe(false);
    });

    it('sin la cabecera de PaseLibre no se guarda (CSRF)', async () => {
      await http()
        .post('/v1/inicio/invitar-cerrado')
        .set('Cookie', cookies.tiendac ?? '')
        .send({})
        .expect(403);
    });
  });

  describe('«Recién llegados +N nuevo» (N07)', () => {
    const nuevos = async (usuario: string) =>
      ((await como(usuario).get('/v1/recien-llegados').expect(200)).body as RespuestaRecienLlegados)
        .nuevos;

    it('cuenta lo de las demás desde tu última visita, máximo 24 h, sin lo tuyo', async () => {
      const tiendaA = await tienda('Tienda A');
      const tiendaB = await tienda('Tienda B');
      // Todo lo de la semilla pasa a ser de hace 2 días: no cuenta.
      await prisma.oferta.updateMany({
        data: { creadaEn: new Date(Date.now() - 48 * 3600 * 1000) },
      });
      expect(await nuevos('tiendab')).toBe(0);

      const deA = await prisma.oferta.findMany({
        where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
        take: 2,
      });
      const deB = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: tiendaB.id, estado: 'ACTIVA', stock: { gt: 0 } },
      });
      await prisma.oferta.updateMany({
        where: { id: { in: [...deA.map((o) => o.id), deB.id] } },
        data: { creadaEn: new Date() },
      });
      expect(await nuevos('tiendab')).toBe(2);
      // Lo de tu tienda no cuenta: para Tienda A son solo la de B.
      expect(await nuevos('tiendaa')).toBe(1);

      // Entras a la página: vuelve a cero; lo que se publica después, sí cuenta.
      const visto = await como('tiendab').post('/v1/recien-llegados/visto').expect(200);
      expect(visto.body).toEqual({ nuevos: 0 });
      expect(await nuevos('tiendab')).toBe(0);
      await prisma.oferta.update({
        where: { id: deA[0]!.id },
        data: { creadaEn: new Date(Date.now() + 1000) },
      });
      expect(await nuevos('tiendab')).toBe(1);
      // La visita es de cada persona.
      expect(await nuevos('tiendaa')).toBe(1);
    });
  });

  describe('avisos (N07, error 36)', () => {
    it('abrir el chat marca leído su aviso, aunque lo haya creado otra parte', async () => {
      const tiendaA = await tienda('Tienda A');
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
      });
      const contacto = await como('tiendab')
        .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      const conversacion = contacto.body.conversacion_id as string;
      const usuarioB = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendab' } });
      const aviso = await prisma.aviso.create({
        data: {
          usuarioId: usuarioB.id,
          tipo: 'VENTA',
          titulo: 'Tienda A marcó la venta',
          enlace: `/mensajes/${conversacion}`,
        },
      });
      const otro = await prisma.aviso.create({
        data: { usuarioId: usuarioB.id, tipo: 'SISTEMA', titulo: 'Otro aviso', enlace: '/avisos' },
      });
      const antes = (await como('tiendab').get('/v1/contadores').expect(200)).body.avisos;
      await como('tiendab')
        .patch(`/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
      expect(
        (await prisma.aviso.findUniqueOrThrow({ where: { id: aviso.id } })).leidoEn,
      ).not.toBeNull();
      expect((await prisma.aviso.findUniqueOrThrow({ where: { id: otro.id } })).leidoEn).toBeNull();
      const despues = (await como('tiendab').get('/v1/contadores').expect(200)).body.avisos;
      expect(despues).toBe(antes - 1);
    });

    it('tocar un aviso lo marca leído y baja el contador', async () => {
      const usuarioB = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendab' } });
      const aviso = await prisma.aviso.findFirstOrThrow({
        where: { usuarioId: usuarioB.id, leidoEn: null },
      });
      const antes = (await como('tiendab').get('/v1/contadores').expect(200)).body.avisos;
      const respuesta = await como('tiendab')
        .post('/v1/avisos/leidos', { ids: [aviso.id] })
        .expect(200);
      expect(respuesta.body.sin_leer).toBe(antes - 1);
      expect((await como('tiendab').get('/v1/contadores').expect(200)).body.avisos).toBe(antes - 1);
      // Los avisos de otra persona no se tocan con tus ids.
      const usuarioC = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendac' } });
      const deC = await prisma.aviso.create({
        data: { usuarioId: usuarioC.id, tipo: 'SISTEMA', titulo: 'De C' },
      });
      await como('tiendab')
        .post('/v1/avisos/leidos', { ids: [deC.id] })
        .expect(200);
      expect((await prisma.aviso.findUniqueOrThrow({ where: { id: deC.id } })).leidoEn).toBeNull();
    });
  });
});
