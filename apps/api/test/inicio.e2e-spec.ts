import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** El inicio que crece solo (FI_Web, FI_WebPocas, FI_WebNormal, SG_WebFeed: sección 5). */
describe('Inicio de una tienda (sección 5)', () => {
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

  const inicio = async (usuario = 'tiendab') =>
    (
      await http()
        .get('/v1/inicio')
        .set('Cookie', await como(usuario))
        .expect(200)
    ).body;

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

  it('sin tienda no hay inicio de tienda', async () => {
    await http().get('/v1/inicio').expect(403);
  });

  it('«Recién publicado» mezcla las tiendas: ninguna se repite hasta que pasan todas', async () => {
    const portada = await http()
      .get('/v1/portada')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    const tiendas = (portada.body.recien_publicado as Array<{ tienda: { nombre: string } }>).map(
      (tarjeta) => tarjeta.tienda.nombre,
    );
    const distintas = new Set(tiendas).size;
    expect(new Set(tiendas.slice(0, distintas)).size).toBe(distintas);
  });

  it('sin publicaciones de otras es el día 1; de 1 a 11, lo nuevo en lista; desde 12, el normal', async () => {
    const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
    const guardadas = await prisma.oferta.findMany({
      where: { tiendaId: { not: tiendaB.id }, stock: { gt: 0 } },
      select: { id: true, stock: true },
    });
    expect(guardadas.length).toBeGreaterThanOrEqual(12);
    await prisma.oferta.updateMany({
      where: { id: { in: guardadas.map((o) => o.id) } },
      data: { stock: 0 },
    });
    const dia1 = await inicio();
    expect(dia1.fase).toBe('DIA_1');
    expect(dia1.publicaciones).toBe(0);
    expect(dia1.recien).toEqual([]);

    for (const oferta of guardadas.slice(0, 3)) {
      await prisma.oferta.update({ where: { id: oferta.id }, data: { stock: 1 } });
    }
    const pocas = await inicio();
    expect(pocas.fase).toBe('POCAS');
    expect(pocas.publicaciones).toBe(3);
    expect(pocas.recien).toHaveLength(3);
    expect(pocas.recien.every((t: { propia: boolean }) => !t.propia)).toBe(true);
    // Todavía no llegó a 12: no hay hito.
    expect(
      (await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB.id } })).inicioNormalEn,
    ).toBeNull();

    for (const oferta of guardadas) {
      await prisma.oferta.update({ where: { id: oferta.id }, data: { stock: oferta.stock } });
    }
    expect((await inicio()).fase).toBe('NORMAL');
    expect(
      (await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB.id } })).inicioNormalEn,
    ).not.toBeNull();
  });

  it('el inicio normal no vuelve atrás aunque después haya menos de 12', async () => {
    const guardadas = await prisma.oferta.findMany({
      where: { stock: { gt: 0 } },
      select: { id: true, stock: true },
    });
    await prisma.oferta.updateMany({
      where: { id: { in: guardadas.map((o) => o.id) } },
      data: { stock: 0 },
    });
    const datos = await inicio();
    expect(datos.fase).toBe('NORMAL');
    expect(datos.publicaciones).toBe(0);
    // Otra tienda sin el hito sí ve su día 1: se decide por tienda.
    expect((await inicio('tiendac')).fase).toBe('DIA_1');
    for (const oferta of guardadas) {
      await prisma.oferta.update({ where: { id: oferta.id }, data: { stock: oferta.stock } });
    }
  });

  it('«De tiendas que sigues» trae lo último de las seguidas, sin las reservadas', async () => {
    const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
    await http()
      .post(`/v1/tiendas/${tiendaA.id}/seguir`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({})
      .expect(200);
    const datos = await inicio();
    expect(datos.de_seguidas.tiendas).toEqual(['Tienda A']);
    expect(datos.de_seguidas.ofertas.length).toBeGreaterThan(0);
    expect(datos.de_seguidas.ofertas.length).toBeLessThanOrEqual(4);
    expect(JSON.stringify(datos.de_seguidas)).not.toContain('Tienda reservada');
  });

  it('«Lo que más se pide» sale de lo buscado y dice si ya está en el catálogo', async () => {
    const producto = await prisma.producto.findFirstOrThrow({
      where: {
        fusionadoEnId: null,
        ofertas: { some: {}, none: { tienda: { nombre: 'Tienda B' } } },
      },
    });
    const texto = producto.titulo;
    await prisma.busqueda.createMany({
      data: [1, 2, 3].map(() => ({ texto, resultados: 1 })),
    });
    const datos = await inicio();
    expect(datos.mas_pedido.length).toBeGreaterThan(0);
    expect(datos.mas_pedido[0].producto).toBe(producto.slug);
    expect(datos.mas_pedido[0].categoria).toEqual(expect.any(String));
  });

  it('una tienda con todo en reservado cuenta, pero no se nombra', async () => {
    const tiendaC = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda C' } });
    const antes = await inicio();
    expect(antes.tiendas.visibles.map((t: { nombre: string }) => t.nombre)).toContain('Tienda C');
    await prisma.oferta.updateMany({
      where: { tiendaId: tiendaC.id },
      data: { tiendaVisible: false },
    });
    const despues = await inicio();
    expect(despues.tiendas.visibles.map((t: { nombre: string }) => t.nombre)).not.toContain(
      'Tienda C',
    );
    expect(despues.tiendas.reservadas).toBe(antes.tiendas.reservadas + 1);
    expect(despues.tiendas.activas).toBe(antes.tiendas.activas);
    expect(despues.tiendas.visibles.map((t: { nombre: string }) => t.nombre)).not.toContain(
      'Tienda B',
    );
    expect(despues.tiendas.meta).toBe(20);
  });

  it('«Primeros pasos» cuenta lo publicado y si pediste en vivo', async () => {
    const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
    const publicadas = await prisma.oferta.count({
      where: { tiendaId: tiendaB.id, estado: { not: 'ELIMINADA' } },
    });
    const { pasos } = await inicio();
    expect(pasos.publicadas).toBe(publicadas);
    expect(typeof pasos.perfil).toBe('boolean');
    expect(typeof pasos.en_vivo).toBe('boolean');
  });
});
