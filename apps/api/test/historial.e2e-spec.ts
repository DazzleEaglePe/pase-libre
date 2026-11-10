import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** «Mis ventas y compras» (HI_A2_Web, sección 16 del lienzo final). */
describe('Historial de ventas y compras (sección 16)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let ventaVisible: string;

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

  /** Una venta de Tienda A a Tienda B, como la marca el chat (con su conversación). */
  async function vender(reservada: boolean): Promise<string> {
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 1 }, tiendaVisible: true },
      orderBy: { creadaEn: reservada ? 'desc' : 'asc' },
    });
    if (reservada) {
      await prisma.oferta.update({ where: { id: oferta.id }, data: { tiendaVisible: false } });
    }
    const vendedor = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    const comprador = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });
    const conversacion = await prisma.conversacion.create({
      data: {
        ofertaId: oferta.id,
        compradorId: comprador.id,
        vendedorId: vendedor.id,
        tiendaCompradoraId: tiendaB.id,
        tiendaVendedoraId: tiendaA.id,
        participaciones: { create: [{ usuarioId: comprador.id }, { usuarioId: vendedor.id }] },
      },
    });
    const venta = await prisma.venta.create({
      data: {
        ofertaId: oferta.id,
        compradorId: comprador.id,
        tiendaCompradoraId: tiendaB.id,
        conversacionId: conversacion.id,
        stockAntes: oferta.stock,
        stockDespues: oferta.stock - 1,
        registradaPorId: vendedor.id,
        precioCentimos: 24000n,
        moneda: 'USD',
      },
    });
    return venta.id;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    ventaVisible = await vender(false);
    await vender(true);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('quien vende ve a quién le vendió, a cuánto y que puede recordarle', async () => {
    const respuesta = await http()
      .get('/v1/historial?lado=ventas')
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(respuesta.body.conteos).toEqual({ ventas: 2, compras: 0 });
    expect(respuesta.body.lista).toHaveLength(2);
    expect(respuesta.body.lista[0]).toMatchObject({
      otra_tienda: { nombre: 'Tienda B' },
      precio: { moneda: 'USD', centimos: 24000 },
      calificacion: null,
      puede_recordar: true,
      puede_calificar: false,
    });
    expect(
      respuesta.body.por_categoria.reduce((t: number, c: { items: number }) => t + c.items, 0),
    ).toBe(2);
  });

  it('quien compró a una tienda reservada no sabe cuál era', async () => {
    const respuesta = await http()
      .get('/v1/historial?lado=compras')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    const nombres = (respuesta.body.lista as Array<{ otra_tienda: { nombre: string } }>).map(
      (venta) => venta.otra_tienda.nombre,
    );
    expect(nombres.sort()).toEqual(['Tienda A', 'Tienda reservada']);
    expect(JSON.stringify(respuesta.body.tiendas)).not.toContain('reservada');
    expect(respuesta.body.lista.every((v: { puede_calificar: boolean }) => v.puede_calificar)).toBe(
      true,
    );
  });

  it('«Recordarle» una sola vez, con mensaje en el chat y aviso', async () => {
    await http()
      .post(`/v1/ventas/${ventaVisible}/recordar`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .expect(404);
    await http()
      .post(`/v1/ventas/${ventaVisible}/recordar`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .expect(204);
    await http()
      .post(`/v1/ventas/${ventaVisible}/recordar`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .expect(409);
    const avisos = await http()
      .get('/v1/avisos?categoria=VENTAS')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(avisos.body.avisos[0].titulo).toMatch(/^¿Cómo te fue con /);
  });

  it('el promedio cuenta los tres meses anteriores desde la primera venta', async () => {
    const vacio = await http()
      .get('/v1/historial?lado=ventas')
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(vacio.body.promedio_ventas).toBeNull();

    // Dos ventas hace dos meses: (0 + 2) / 2 meses desde la primera = 1 al mes.
    const haceDosMeses = new Date();
    haceDosMeses.setUTCDate(15);
    haceDosMeses.setUTCMonth(haceDosMeses.getUTCMonth() - 2);
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    const vendedor = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 1 } },
    });
    await prisma.venta.createMany({
      data: [1, 2].map(() => ({
        ofertaId: oferta.id,
        stockAntes: oferta.stock,
        stockDespues: oferta.stock - 1,
        registradaPorId: vendedor.id,
        creadaEn: haceDosMeses,
      })),
    });
    const respuesta = await http()
      .get('/v1/historial?lado=ventas')
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(respuesta.body.promedio_ventas).toBe(1);
    expect(respuesta.body.conteos.ventas).toBe(2);
    expect(respuesta.body.meses).toHaveLength(2);
  });

  it('descarga el mes en Excel', async () => {
    const respuesta = await http()
      .get('/v1/historial/excel?lado=ventas')
      .set('Cookie', await como('tiendaa'))
      .buffer(true)
      .parse((res, listo) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => listo(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(respuesta.headers['content-type']).toContain('spreadsheetml');
    // Un .xlsx es un zip: empieza con «PK».
    expect((respuesta.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });
});
