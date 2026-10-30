import type { INestApplication } from '@nestjs/common';
import type {
  DetalleConversacion,
  EnVivoConVendedor,
  EnVivoPropio,
  RespuestaAvisos,
  RespuestaEnVivo,
  RespuestaMisEnVivo,
  RespuestaOpcionesEnVivo,
  RespuestaResponderEnVivo,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const SLUG_VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';

/** Claves que el visitante nunca recibe en En vivo (RF-77). */
const PROHIBIDAS = new Set(['precio', 'tienda', 'stand', 'nota', 'moneda', 'centimos']);

function clavesProhibidas(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.flatMap(clavesProhibidas);
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, v]) => [
      ...(PROHIBIDAS.has(clave) ? [clave] : []),
      ...clavesProhibidas(v),
    ]);
  }
  return [];
}

describe('En vivo: busco y ofertas flash (D-53, RF-24 a RF-27, RF-72 a RF-77)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
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
    patch: (ruta: string, cuerpo: object) =>
      http()
        .patch(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
    put: (ruta: string, cuerpo: object) =>
      http()
        .put(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });

  const ofertaDe = (slug: string, tienda: string) =>
    prisma.oferta.findFirstOrThrow({
      where: { producto: { slug }, tienda: { nombre: tienda }, vigente: true },
    });
  const kingstonDeA = () =>
    prisma.oferta.findFirstOrThrow({
      where: {
        producto: { titulo: { startsWith: 'Kingston Fury' } },
        tienda: { nombre: 'Tienda A' },
        vigente: true,
      },
    });

  const avisosEnVivo = async (usuario: string) =>
    ((await como(usuario).get('/v1/avisos').expect(200)).body as RespuestaAvisos).avisos.filter(
      (a) => a.tipo === 'EN_VIVO',
    );

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ enVivo: true });
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

  let busco: EnVivoPropio;
  let conversacion: string;

  describe('un busco', () => {
    it('sin sesión no se publica; el equipo tampoco publica', async () => {
      await http()
        .post('/v1/en-vivo')
        .set(CABECERAS)
        .send({ tipo: 'BUSCO', titulo: 'RTX 3070', categoria: 'graficas', duracion: '1h' })
        .expect(401);
      await como('equipo')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'RTX 3070',
          categoria: 'graficas',
          duracion: '1h',
        })
        .expect(403);
    });

    it('se publica como texto libre y avisa a las tiendas que tienen ese modelo con stock', async () => {
      const alcance = await como('tiendab')
        .get('/v1/en-vivo/alcance?q=RTX 3070 8 GB&categoria=graficas')
        .expect(200);
      expect(alcance.body.tiendas).toBeGreaterThanOrEqual(3);

      const respuesta = await como('tiendab')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'RTX 3070 8 GB',
          categoria: 'graficas',
          presupuesto: '260',
          duracion: '3h',
          nota: 'Cliente esperando en el stand.',
        })
        .expect(201);
      busco = respuesta.body as EnVivoPropio;
      expect(busco).toMatchObject({
        tipo: 'BUSCO',
        titulo: 'RTX 3070 8 GB',
        estado: 'VIVO',
        mio: true,
        propio: true,
        precio: { moneda: 'USD', centimos: 26_000 },
        avisadas: alcance.body.tiendas,
      });

      // Tienda A tiene la Ventus con stock: le llega el aviso. Tienda B no se avisa a sí misma.
      const [aviso] = await avisosEnVivo('tiendaa');
      expect(aviso).toMatchObject({
        titulo: 'Tienda B busca RTX 3070 8 GB',
        enlace: `/en-vivo?id=${busco.id}`,
      });
      expect(aviso?.extracto).toContain('Paga hasta US$ 260');
      expect(await avisosEnVivo('tiendab')).toHaveLength(0);
    });

    it('el visitante lo ve sin tienda, presupuesto ni nota', async () => {
      const respuesta = await http().get('/v1/en-vivo').expect(200);
      expect(respuesta.headers['cache-control']).toMatch(/^public/);
      const cuerpo = respuesta.body as RespuestaEnVivo;
      expect(cuerpo.audiencia).toBe('visitante');
      expect(cuerpo.en_vivo.map((e) => e.id)).toContain(busco.id);
      expect(clavesProhibidas(cuerpo)).toEqual([]);
    });

    it('con sesión se ve la tienda y el presupuesto, y se filtra por tipo', async () => {
      const cuerpo = (await como('tiendaa').get('/v1/en-vivo?tipo=busco').expect(200))
        .body as Exclude<RespuestaEnVivo, { audiencia: 'visitante' }>;
      const visto = cuerpo.en_vivo.find((e) => e.id === busco.id) as EnVivoConVendedor;
      expect(visto).toMatchObject({
        tienda: { nombre: 'Tienda B' },
        nota: 'Cliente esperando en el stand.',
        propio: false,
        respondiste: false,
      });
      const flash = (await como('tiendaa').get('/v1/en-vivo?tipo=flash').expect(200)).body;
      expect(flash.en_vivo).toEqual([]);
    });

    it('para responder se elige entre las publicaciones propias que coinciden', async () => {
      const ventusA = await ofertaDe(SLUG_VENTUS, 'Tienda A');
      const opciones = (await como('tiendaa').get(`/v1/en-vivo/${busco.id}/opciones`).expect(200))
        .body as RespuestaOpcionesEnVivo;
      expect(opciones.ofertas.map((o) => o.oferta_id)).toContain(ventusA.id);
      // Kevin no atiende esa publicación: no la puede ofrecer.
      const deKevin = await como('tiendaa.kevin')
        .get(`/v1/en-vivo/${busco.id}/opciones`)
        .expect(200);
      expect(deKevin.body.ofertas).toEqual([]);
    });

    it('«¡Lo tengo!» abre el chat con la tarjeta arriba; una sola respuesta por tienda', async () => {
      const ventusA = await ofertaDe(SLUG_VENTUS, 'Tienda A');
      await como('tiendaa')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, { texto: 'La tengo.' })
        .expect(400);
      const respuesta = await como('tiendaa')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, {
          oferta: ventusA.id,
          texto: 'Lo tengo: la Ventus usada a US$ 250. ¿Te la separo?',
        })
        .expect(201);
      conversacion = (respuesta.body as RespuestaResponderEnVivo).conversacion_id;

      const otra = await como('tiendaa')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, { oferta: ventusA.id, texto: 'Otra vez' })
        .expect(409);
      expect(otra.body.error).toMatchObject({
        codigo: 'YA_RESPONDISTE',
        detalles: { conversacion_id: conversacion },
      });
      const deKevin = await como('tiendaa.kevin')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, { oferta: ventusA.id, texto: 'Hola' })
        .expect(409);
      expect(deKevin.body.error.detalles).toEqual({ conversacion_id: null });
      await como('tiendab')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, { oferta: ventusA.id, texto: 'Mío' })
        .expect(409);

      // Quien buscó compra: el hilo es de la Ventus de Tienda A, con la tarjeta del busco.
      const detalle = (await como('tiendab').get(`/v1/conversaciones/${conversacion}`).expect(200))
        .body as DetalleConversacion;
      expect(detalle).toMatchObject({
        rol: 'comprador',
        otro: { tienda: { nombre: 'Tienda A' } },
        oferta: { id: ventusA.id },
        en_vivo: { id: busco.id, tipo: 'BUSCO', estado: 'VIVO', puede_cerrar: true },
      });
      const mensajes = (await como('tiendab').get(`/v1/conversaciones/${conversacion}/mensajes`))
        .body.mensajes as Array<{ tipo: string; texto: string }>;
      expect(mensajes.map((m) => m.tipo)).toEqual(['SISTEMA', 'TEXTO']);
      expect(mensajes[0]?.texto).toBe('Tienda A respondió «¡Lo tengo!» al busco «RTX 3070 8 GB»');

      const delOtroLado = (await como('tiendaa').get(`/v1/conversaciones/${conversacion}`))
        .body as DetalleConversacion;
      expect(delOtroLado.en_vivo?.puede_cerrar).toBe(false);

      const lista = (await como('tiendaa').get('/v1/en-vivo').expect(200)).body;
      expect(lista.en_vivo.find((e: EnVivoConVendedor) => e.id === busco.id)).toMatchObject({
        respondiste: true,
        conversacion_id: conversacion,
        respuestas: 1,
      });
    });

    it('«Lo tuyo en vivo» muestra quién respondió; se suma una hora y se cierra', async () => {
      const mios = (await como('tiendab').get('/v1/en-vivo/mios').expect(200))
        .body as RespuestaMisEnVivo;
      expect(mios.disponibles).toBe(2);
      expect(mios.en_vivo[0]?.respuestas_recibidas).toEqual([
        expect.objectContaining({ tienda: 'Tienda A', conversacion_id: conversacion }),
      ]);

      const antes = new Date(busco.vence_en).getTime();
      const sumado = (
        await como('tiendab').patch(`/v1/en-vivo/${busco.id}`, { accion: 'sumar_hora' }).expect(200)
      ).body as EnVivoPropio;
      expect(new Date(sumado.vence_en).getTime() - antes).toBe(60 * 60_000);
      await como('tiendaa').patch(`/v1/en-vivo/${busco.id}`, { accion: 'cerrar' }).expect(404);

      const cerrado = (
        await como('tiendab').patch(`/v1/en-vivo/${busco.id}`, { accion: 'cerrar' }).expect(200)
      ).body as EnVivoPropio;
      expect(cerrado.estado).toBe('CONSEGUIDO');
      await como('tiendab').patch(`/v1/en-vivo/${busco.id}`, { accion: 'cerrar' }).expect(409);

      const publico = (await http().get('/v1/en-vivo').expect(200)).body as RespuestaEnVivo;
      expect(publico.en_vivo.map((e) => e.id)).not.toContain(busco.id);
      expect(publico.cerrados_hoy.map((e) => e.id)).toContain(busco.id);
      await como('tiendac')
        .post(`/v1/en-vivo/${busco.id}/respuestas`, { texto: 'Tarde' })
        .expect(404);
    });

    it('hasta 3 en vivo a la vez por cuenta', async () => {
      const uno = {
        tipo: 'BUSCO',
        titulo: 'Intel Core i5 14400F',
        categoria: 'procesadores',
        duracion: '1h',
      };
      for (let i = 0; i < 3; i += 1) await como('tiendab').post('/v1/en-vivo', uno).expect(201);
      const cuarto = await como('tiendab').post('/v1/en-vivo', uno).expect(409);
      expect(cuarto.body.error.codigo).toBe('LIMITE_EN_VIVO');
    });

    it('quien apagó los avisos de En vivo no los recibe', async () => {
      const ajustes = await como('tiendac').get('/v1/cuenta/avisos').expect(200);
      expect(ajustes.body.campanita).toEqual({ MENSAJE: true, EN_VIVO: true });
      await como('tiendac')
        .put('/v1/cuenta/avisos', {
          campanita: { MENSAJE: true, EN_VIVO: false },
          no_molestar: null,
        })
        .expect(200);
      const antes = (await avisosEnVivo('tiendac')).length;
      await como('tiendaa')
        .post('/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: 'RTX 3070',
          categoria: 'graficas',
          duracion: '1h',
        })
        .expect(201);
      expect(await avisosEnVivo('tiendac')).toHaveLength(antes);
    });
  });

  describe('una oferta flash', () => {
    let flash: EnVivoPropio;

    it('sale de una publicación propia, con stock y sin repetirse', async () => {
      const kingston = await kingstonDeA();
      const base = { tipo: 'FLASH', oferta: kingston.id, precio: '90', duracion: '3h' };
      await como('tiendaa')
        .post('/v1/en-vivo', { ...base, cantidad: 7 })
        .expect(409);
      await como('tiendaa.kevin')
        .post('/v1/en-vivo', { ...base, cantidad: 2 })
        .expect(409);
      await como('tiendaa')
        .post('/v1/en-vivo', { ...base, precio: '', cantidad: 2 })
        .expect(400);

      flash = (
        await como('tiendaa')
          .post('/v1/en-vivo', { ...base, cantidad: 2 })
          .expect(201)
      ).body as EnVivoPropio;
      expect(flash).toMatchObject({
        tipo: 'FLASH',
        cantidad: 2,
        condicion: 'NUEVO',
        precio: { centimos: 9_000 },
      });
      await como('tiendaa')
        .post('/v1/en-vivo', { ...base, duracion: '1h', cantidad: 1 })
        .expect(409);
    });

    it('«¡Lo quiero!» abre el chat con quien la publicó; «Vendido» le resta unidades', async () => {
      const kingston = await kingstonDeA();
      await como('tiendaa.kevin')
        .post(`/v1/en-vivo/${flash.id}/respuestas`, { texto: '¡Lo quiero!' })
        .expect(409);

      const deC = (
        await como('tiendac')
          .post(`/v1/en-vivo/${flash.id}/respuestas`, { texto: '¡Lo quiero! Paso en 10 min.' })
          .expect(201)
      ).body as RespuestaResponderEnVivo;
      const deB = (
        await como('tiendab')
          .post(`/v1/en-vivo/${flash.id}/respuestas`, { texto: 'Me llevo una.' })
          .expect(201)
      ).body as RespuestaResponderEnVivo;

      const detalle = (await como('tiendaa').get(`/v1/conversaciones/${deC.conversacion_id}`))
        .body as DetalleConversacion;
      expect(detalle).toMatchObject({
        rol: 'vendedor',
        puede_vender: true,
        en_vivo: { tipo: 'FLASH', cantidad: 2, puede_cerrar: true },
      });

      await como('tiendaa')
        .post(`/v1/ofertas/${kingston.id}/vendido`, { conversacion_id: deC.conversacion_id })
        .expect(201);
      let fila = await prisma.enVivo.findUniqueOrThrow({ where: { id: flash.id } });
      expect(fila).toMatchObject({ cantidad: 1, vendidas: 1, estado: 'VIVO' });

      await como('tiendaa')
        .post(`/v1/ofertas/${kingston.id}/vendido`, { conversacion_id: deB.conversacion_id })
        .expect(201);
      fila = await prisma.enVivo.findUniqueOrThrow({ where: { id: flash.id } });
      expect(fila).toMatchObject({ cantidad: 0, vendidas: 2, estado: 'VENDIDO' });
      expect((await prisma.oferta.findUniqueOrThrow({ where: { id: kingston.id } })).stock).toBe(4);

      const mios = (await como('tiendaa').get('/v1/en-vivo/mios').expect(200))
        .body as RespuestaMisEnVivo;
      expect(mios.cerrados_hoy.find((e) => e.id === flash.id)).toMatchObject({
        estado: 'VENDIDO',
        vendidas: 2,
        respuestas_recibidas: expect.arrayContaining([
          expect.objectContaining({ tienda: 'Tienda C' }),
        ]),
      });
    });
  });
});
