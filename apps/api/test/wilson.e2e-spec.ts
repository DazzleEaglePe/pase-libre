import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Wilson en vivo, la página de una categoría y «De tiendas que sigues» (sección 8). */
describe('Wilson en vivo, categoría y seguidas (sección 8)', () => {
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

  describe('Wilson en vivo', () => {
    it('el visitante ve cuánto hay por galería, sin tiendas ni precios', async () => {
      const respuesta = await http().get('/v1/wilson').expect(200);
      expect(respuesta.body.audiencia).toBe('visitante');
      expect(respuesta.body.galerias.length).toBeGreaterThan(0);
      expect(respuesta.body.pisos).toEqual([]);
      const texto = JSON.stringify(respuesta.body.ofertas);
      expect(texto).not.toContain('"precio"');
      expect(texto).not.toContain('"tienda"');
    });

    it('con sesión, abre en tu galería, con la distancia y las tiendas por piso', async () => {
      const tiendaB = await prisma.tienda.findFirstOrThrow({
        where: { nombre: 'Tienda B' },
        include: { galeria: true },
      });
      expect(tiendaB.galeria).not.toBeNull();
      const otra = await prisma.galeria.findFirstOrThrow({
        where: { id: { not: tiendaB.galeriaId ?? undefined } },
      });
      await prisma.galeria.update({ where: { id: tiendaB.galeriaId ?? '' }, data: { metros: 0 } });
      await prisma.galeria.update({ where: { id: otra.id }, data: { metros: 225 } });

      const respuesta = await http()
        .get('/v1/wilson')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(respuesta.body.galeria).toMatchObject({ slug: tiendaB.galeria?.slug, mia: true });
      const lejos = respuesta.body.galerias.find((g: { slug: string }) => g.slug === otra.slug);
      expect(lejos.minutos).toBe(3);
      const tiendas = respuesta.body.pisos.flatMap(
        (piso: { tiendas: Array<{ nombre: string; mia: boolean }> }) => piso.tiendas,
      );
      expect(tiendas).toContainEqual(expect.objectContaining({ nombre: 'Tienda B', mia: true }));
    });

    it('con una categoría, cuenta solo lo de esa categoría', async () => {
      const todo = await http().get('/v1/wilson').expect(200);
      const slug = todo.body.categorias[0].slug;
      const filtrado = await http().get(`/v1/wilson?categoria=${slug}`).expect(200);
      const suma = (cuerpo: { galerias: Array<{ productos: number }> }) =>
        cuerpo.galerias.reduce((total, g) => total + g.productos, 0);
      expect(suma(filtrado.body)).toBeLessThanOrEqual(suma(todo.body));
      expect(filtrado.body.categoria.slug).toBe(slug);
    });
  });

  describe('Precios de pase por modelo', () => {
    it('sin sesión no se ven', async () => {
      await http().get('/v1/categorias/tarjetas-de-video/precios').expect(401);
    });

    it('el «desde» sale solo de los precios a la vista y guarda la historia del día', async () => {
      const categoria = await prisma.categoria.findFirstOrThrow({
        where: { productos: { some: { ofertas: { some: { precioVisible: true } } } } },
      });
      const respuesta = await http()
        .get(`/v1/categorias/${categoria.slug}/precios`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(respuesta.body.modelos.length).toBeGreaterThan(0);
      const modelo = respuesta.body.modelos.find((m: { desde: unknown }) => m.desde);
      const producto = await prisma.producto.findUniqueOrThrow({ where: { slug: modelo.slug } });
      const visibles = await prisma.oferta.findMany({
        where: {
          productoId: producto.id,
          estado: 'ACTIVA',
          stock: { gt: 0 },
          precioVisible: true,
          moneda: modelo.desde.moneda,
        },
        select: { precioCentimos: true },
      });
      expect(modelo.desde.centimos).toBe(
        Math.min(...visibles.map((o) => Number(o.precioCentimos))),
      );
      const historia = await prisma.precioDiario.count({ where: { productoId: producto.id } });
      expect(historia).toBe(1);

      // Con un día viejo en la historia, sale cuánto cambió.
      await prisma.precioDiario.create({
        data: {
          productoId: producto.id,
          dia: new Date(Date.now() - 10 * 86_400_000),
          moneda: modelo.desde.moneda,
          minimoCentimos: BigInt(modelo.desde.centimos * 2),
          promedioCentimos: BigInt(modelo.desde.centimos * 2),
          ofertas: 1,
        },
      });
      const otra = await http()
        .get(`/v1/categorias/${categoria.slug}/precios?orden=bajaron`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const despues = otra.body.modelos.find((m: { slug: string }) => m.slug === modelo.slug);
      expect(despues.cambio).toBe(-50);
      expect(despues.serie).toHaveLength(2);
      expect(otra.body.modelos[0].cambio).toBe(-50);
    });

    it('filtra por estado y por galería', async () => {
      const categoria = await prisma.categoria.findFirstOrThrow({
        where: { productos: { some: { ofertas: { some: {} } } } },
      });
      const todo = await http()
        .get(`/v1/categorias/${categoria.slug}/precios`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const usados = await http()
        .get(`/v1/categorias/${categoria.slug}/precios?estado=USADO`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(usados.body.resumen.publicadas).toBeLessThanOrEqual(todo.body.resumen.publicadas);
      await http()
        .get(`/v1/categorias/${categoria.slug}/precios?estado=NADA`)
        .set('Cookie', await como('tiendab'))
        .expect(400);
    });
  });

  describe('De tiendas que sigues', () => {
    it('sin seguir a nadie, sugiere tiendas', async () => {
      const respuesta = await http()
        .get('/v1/seguidas/novedades')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(respuesta.body.seguidas).toEqual([]);
      expect(respuesta.body.sugeridas.length).toBeGreaterThan(0);
      expect(respuesta.body.sugeridas.map((t: { nombre: string }) => t.nombre)).not.toContain(
        'Tienda B',
      );
    });

    it('lo publicado y lo que bajó de precio, sin delatar lo reservado', async () => {
      const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
      await http()
        .post(`/v1/tiendas/${tiendaA.id}/seguir`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({})
        .expect(200);
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: {
          tiendaId: tiendaA.id,
          estado: 'ACTIVA',
          stock: { gt: 0 },
          tiendaVisible: true,
          precioVisible: true,
          precioCentimos: { gt: 1000 },
        },
      });
      const antes = Number(oferta.precioCentimos);
      await http()
        .patch(`/v1/ofertas/${oferta.id}`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ precio: String((antes - 500) / 100) })
        .expect(200);
      // Una publicación nueva de hoy, reservada: no sale.
      await prisma.oferta.updateMany({
        where: { tiendaId: tiendaA.id, id: { not: oferta.id } },
        data: { creadaEn: new Date() },
      });
      const reservada = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: tiendaA.id, id: { not: oferta.id }, estado: 'ACTIVA' },
      });
      await prisma.oferta.update({ where: { id: reservada.id }, data: { tiendaVisible: false } });

      const respuesta = await http()
        .get('/v1/seguidas/novedades')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(respuesta.body.seguidas).toEqual([
        expect.objectContaining({ nombre: 'Tienda A', nuevo_hoy: true }),
      ]);
      const bajo = respuesta.body.novedades.find((n: { tipo: string }) => n.tipo === 'BAJO');
      expect(bajo).toMatchObject({
        tienda: { nombre: 'Tienda A' },
        oferta: { id: oferta.id, precio: { centimos: antes - 500 } },
        antes: { centimos: antes },
      });
      expect(JSON.stringify(respuesta.body)).not.toContain(reservada.id);
      expect(respuesta.body.novedades.some((n: { tipo: string }) => n.tipo === 'PUBLICO')).toBe(
        true,
      );

      const soloNuevos = await http()
        .get('/v1/seguidas/novedades?tipo=en_vivo')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(soloNuevos.body.novedades.every((n: { tipo: string }) => n.tipo === 'BUSCO')).toBe(
        true,
      );
    });
  });
});
