import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

interface Producto {
  slug: string;
  ofertas: {
    cantidad: number;
    stock_total: number;
    precios_desde?: Array<{ moneda: string; centimos: number }>;
    al_interno?: number;
  };
  oferta_destacada?: {
    precio: { moneda: string; centimos: number } | null;
    tienda: { nombre: string; stand: string | null };
    mas_barata: boolean;
  };
}

/**
 * Compara `producto_resumen` con lo que sale de las ofertas en este momento: `faltan` son las
 * filas que debería tener y no tiene (o tiene distintas) y `sobran`, al revés.
 */
async function alDia(): Promise<{ faltan: number; sobran: number }> {
  const [fila] = await prisma.$queryRaw<Array<{ faltan: number; sobran: number }>>`
    WITH a AS (
      SELECT o.producto_id, coalesce(t.galeria_id::text, 'independientes') AS galeria,
             count(*)::int AS ofertas, sum(o.stock)::int AS stock,
             count(*) FILTER (WHERE o.condicion = 'NUEVO')::int AS nuevas,
             count(*) FILTER (WHERE o.condicion = 'USADO')::int AS usadas,
             count(*) FILTER (WHERE o.stock > 0)::int AS con_stock,
             max(o.actualizada_en) AS actualizada_en,
             min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'USD') AS desde_usd,
             min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'PEN') AS desde_pen,
             min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'USD' AND o.stock > 0) AS barata_usd,
             min(o.precio_centimos) FILTER (WHERE o.precio_visible AND o.moneda = 'PEN' AND o.stock > 0) AS barata_pen,
             count(*) FILTER (WHERE NOT o.precio_visible OR o.precio_centimos IS NULL)::int AS al_interno
      FROM oferta o JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      WHERE o.estado = 'ACTIVA'
      GROUP BY 1, 2
    ), verdad AS (
      SELECT p.id, p.categoria_id, p.marca_id, p.titulo::text, sum(a.ofertas)::int, sum(a.stock)::int,
             sum(a.nuevas)::int, sum(a.usadas)::int, sum(a.con_stock)::int,
             jsonb_object_agg(a.galeria, a.ofertas), max(a.actualizada_en),
             min(a.desde_usd), min(a.desde_pen), min(a.barata_usd), min(a.barata_pen), sum(a.al_interno)::int
      FROM a JOIN producto p ON p.id = a.producto_id AND p.fusionado_en_id IS NULL
      GROUP BY p.id
    ), resumen AS (
      SELECT producto_id, categoria_id, marca_id, titulo::text, ofertas, stock, nuevas, usadas, con_stock,
             galerias, actualizada_en, desde_usd, desde_pen, barata_usd, barata_pen, al_interno
      FROM producto_resumen
    )
    SELECT (SELECT count(*)::int FROM (SELECT * FROM verdad EXCEPT SELECT * FROM resumen) x) AS faltan,
           (SELECT count(*)::int FROM (SELECT * FROM resumen EXCEPT SELECT * FROM verdad) y) AS sobran`;
  return fila ?? { faltan: -1, sobran: -1 };
}

/** El resumen de la base para buscar (docs/16 §4.4): siempre al día y sin cambiar respuestas. */
describe('Resumen de productos para buscar', () => {
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
    const cookie = cookieDe(respuesta);
    cookies.set(usuario, cookie);
    return cookie;
  }

  async function buscar(ruta: string, usuario?: string) {
    const pedido = http().get(ruta);
    if (usuario) pedido.set('Cookie', await como(usuario));
    return (await pedido.expect(200)).body as {
      total_productos: number;
      total_ofertas: number;
      productos: Producto[];
      facetas: { con_stock: number };
    };
  }

  /** Un producto con ofertas vigentes donde la tienda no tiene ninguna. */
  async function productoSin(tiendaId: string) {
    const producto = await prisma.producto.findFirst({
      where: {
        fusionadoEnId: null,
        ofertas: { some: { estado: 'ACTIVA' }, none: { tiendaId, vigente: true } },
      },
      orderBy: { titulo: 'asc' },
    });
    if (!producto) throw new Error('La semilla no tiene un producto así.');
    return producto;
  }

  const tienda = (nombre: string) => prisma.tienda.findFirstOrThrow({ where: { nombre } });

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

  it('arranca al día con lo sembrado', async () => {
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect(await prisma.productoResumen.count()).toBeGreaterThan(5);
  });

  it('sigue al día al publicar, editar, pausar, vender y borrar', async () => {
    const tiendaC = await tienda('Tienda C');
    const producto = await productoSin(tiendaC.id);
    const ruta = `/v1/buscar?q=${encodeURIComponent(producto.titulo)}`;
    const delProducto = async (usuario?: string) =>
      (await buscar(ruta, usuario)).productos.find((p) => p.slug === producto.slug);
    const antes = await delProducto('tiendab');
    expect(antes).toBeDefined();
    const cookie = await como('tiendac');
    const editar = (id: string, cambios: object) =>
      http().patch(`/v1/ofertas/${id}`).set(CABECERAS).set('Cookie', cookie).send(cambios);

    const publicada = await http()
      .post('/v1/ofertas')
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({
        producto_id: producto.id,
        condicion: 'NUEVO',
        stock: 3,
        moneda: 'USD',
        precio: '1',
        precio_visible: true,
      })
      .expect(201);
    const id = publicada.body.oferta.id as string;
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const conLaNueva = await delProducto('tiendab');
    expect(conLaNueva?.ofertas.cantidad).toBe((antes?.ofertas.cantidad ?? 0) + 1);
    expect(conLaNueva?.ofertas.precios_desde).toContainEqual(
      expect.objectContaining({ moneda: 'USD', centimos: 100 }),
    );
    expect(conLaNueva?.oferta_destacada).toMatchObject({
      tienda: { nombre: 'Tienda C' },
      precio: { centimos: 100 },
      mas_barata: true,
    });

    // Precio oculto: deja de contar para «desde» y para «Más barato», y pasa a «al interno».
    await editar(id, { precio_visible: false }).expect(200);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const oculta = await delProducto('tiendab');
    expect(oculta?.ofertas.precios_desde).not.toContainEqual(
      expect.objectContaining({ centimos: 100 }),
    );
    expect(oculta?.ofertas.al_interno).toBe((antes?.ofertas.al_interno ?? 0) + 1);
    expect(oculta?.oferta_destacada?.precio?.centimos).not.toBe(100);

    // Vendida (stock 0), pausada, reactivada y borrada.
    await editar(id, { precio_visible: true, stock: 0 }).expect(200);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const vendida = await delProducto('tiendab');
    expect(vendida?.ofertas.stock_total).toBe(antes?.ofertas.stock_total);
    if (vendida?.oferta_destacada?.tienda.nombre === 'Tienda C') {
      expect(vendida.oferta_destacada.mas_barata).toBe(false);
    }
    await editar(id, { estado: 'PAUSADA', razon_pausa: 'La separé para un cliente' }).expect(200);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect((await delProducto())?.ofertas.cantidad).toBe(antes?.ofertas.cantidad);
    await editar(id, { estado: 'ACTIVA', stock: 2 }).expect(200);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    await http().delete(`/v1/ofertas/${id}`).set(CABECERAS).set('Cookie', cookie).expect(204);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect(await delProducto('tiendab')).toEqual(antes);
  });

  it('sigue al día al suspender una tienda, moverla de galería y cambiar o unir productos', async () => {
    const tiendaE = await tienda('Tienda E');
    const total = (await buscar('/v1/buscar')).total_ofertas;
    const deE = await prisma.oferta.count({ where: { tiendaId: tiendaE.id, estado: 'ACTIVA' } });
    expect(deE).toBeGreaterThan(0);

    await prisma.tienda.update({ where: { id: tiendaE.id }, data: { estado: 'SUSPENDIDA' } });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect((await buscar('/v1/buscar')).total_ofertas).toBe(total - deE);
    await prisma.tienda.update({ where: { id: tiendaE.id }, data: { estado: 'ACTIVA' } });
    const otraGaleria = await prisma.galeria.findFirstOrThrow({
      where: { id: { not: tiendaE.galeriaId ?? undefined } },
    });
    await prisma.tienda.update({ where: { id: tiendaE.id }, data: { galeriaId: otraGaleria.id } });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    await prisma.tienda.update({
      where: { id: tiendaE.id },
      data: { galeriaId: tiendaE.galeriaId },
    });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect((await buscar('/v1/buscar')).total_ofertas).toBe(total);

    // Otra categoría y otro título.
    const producto = await productoSin(tiendaE.id);
    const otra = await prisma.categoria.findFirstOrThrow({
      where: { id: { not: producto.categoriaId }, padreId: null },
    });
    await prisma.producto.update({
      where: { id: producto.id },
      data: { categoriaId: otra.id, titulo: `${producto.titulo} renovado` },
    });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const enOtra = await buscar(`/v1/buscar?categoria=${otra.slug}`);
    expect(enOtra.productos.map((p) => p.slug)).toContain(producto.slug);
    await prisma.producto.update({
      where: { id: producto.id },
      data: { categoriaId: producto.categoriaId, titulo: producto.titulo },
    });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });

    // Unir dos productos (RF-54): las ofertas pasan al otro y el unido deja de salir.
    const tiendaC = await tienda('Tienda C');
    const destino = await productoSin(tiendaC.id);
    const fuente = await prisma.producto.create({
      data: {
        categoriaId: destino.categoriaId,
        titulo: `${destino.titulo} repetido`,
        slug: `${destino.slug}-repetido`,
        textoBusqueda: `${destino.textoBusqueda} repetido`,
      },
    });
    await prisma.oferta.create({
      data: {
        productoId: fuente.id,
        tiendaId: tiendaC.id,
        responsableId: (await prisma.usuario.findFirstOrThrow({ where: { tiendaId: tiendaC.id } }))
          .id,
        condicion: 'NUEVO',
        stock: 1,
      },
    });
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const antesDeUnir = await prisma.productoResumen.findUniqueOrThrow({
      where: { productoId: destino.id },
    });
    await prisma.$transaction([
      prisma.oferta.updateMany({
        where: { productoId: fuente.id },
        data: { productoId: destino.id },
      }),
      prisma.producto.update({ where: { id: fuente.id }, data: { fusionadoEnId: destino.id } }),
    ]);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    expect(
      await prisma.productoResumen.findUnique({ where: { productoId: fuente.id } }),
    ).toBeNull();
    expect(
      (await prisma.productoResumen.findUniqueOrThrow({ where: { productoId: destino.id } }))
        .ofertas,
    ).toBe(antesDeUnir.ofertas + 1);
  });

  it('dos tiendas que publican el mismo producto a la vez no se pisan el resumen', async () => {
    const [tiendaA, tiendaB] = await Promise.all([tienda('Tienda A'), tienda('Tienda B')]);
    const producto = await prisma.producto.findFirstOrThrow({
      where: {
        fusionadoEnId: null,
        ofertas: {
          some: { estado: 'ACTIVA' },
          none: { tiendaId: { in: [tiendaA.id, tiendaB.id] }, condicion: 'USADO', vigente: true },
        },
      },
    });
    const responsable = async (tiendaId: string) =>
      (await prisma.usuario.findFirstOrThrow({ where: { tiendaId } })).id;
    const nueva = async (tiendaId: string) => ({
      productoId: producto.id,
      tiendaId,
      responsableId: await responsable(tiendaId),
      condicion: 'USADO' as const,
      stock: 1,
      precioCentimos: 5_000n,
      moneda: 'USD' as const,
      precioVisible: true,
    });
    const [datosA, datosB] = await Promise.all([nueva(tiendaA.id), nueva(tiendaB.id)]);
    const antes = await prisma.productoResumen.findUniqueOrThrow({
      where: { productoId: producto.id },
    });

    // La primera publica y tarda en confirmar; la segunda publica mientras tanto.
    const otra = new PrismaClient({ datasources: { db: { url } } });
    try {
      const primera = prisma.$transaction(async (tx) => {
        await tx.oferta.create({ data: datosA });
        await dormir(400);
      });
      await dormir(100);
      const segunda = otra.$transaction(async (tx) => {
        await tx.oferta.create({ data: datosB });
      });
      await Promise.all([primera, segunda]);
    } finally {
      await otra.$disconnect();
    }

    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
    const despues = await prisma.productoResumen.findUniqueOrThrow({
      where: { productoId: producto.id },
    });
    expect(despues.ofertas).toBe(antes.ofertas + 2);
  });

  it('el precio oculto y la tienda reservada se cuidan igual con el resumen', async () => {
    const tiendaC = await tienda('Tienda C');
    const producto = await productoSin(tiendaC.id);
    const ruta = `/v1/buscar?q=${encodeURIComponent(producto.titulo)}`;
    const delProducto = async (usuario?: string) =>
      (await buscar(ruta, usuario)).productos.find((p) => p.slug === producto.slug);
    const cookie = await como('tiendac');
    const publicada = await http()
      .post('/v1/ofertas')
      .set(CABECERAS)
      .set('Cookie', cookie)
      .send({
        producto_id: producto.id,
        condicion: 'USADO',
        stock: 1,
        moneda: 'USD',
        precio: '2',
        precio_visible: true,
        tienda_visible: false,
      })
      .expect(201);

    // Otra tienda ve la oferta más barata como «Tienda reservada», sin stand.
    expect((await delProducto('tiendab'))?.oferta_destacada).toMatchObject({
      tienda: { nombre: 'Tienda reservada', stand: null },
      precio: { centimos: 200 },
      mas_barata: true,
    });
    // El equipo sí ve quién es.
    expect((await delProducto('equipo'))?.oferta_destacada?.tienda.nombre).toBe('Tienda C');
    // El visitante no recibe precio ni tienda.
    const visitante = await buscar(ruta);
    expect(JSON.stringify(visitante)).not.toMatch(
      /precios_desde|oferta_destacada|al_interno|Tienda [A-Z]|reservada|"stand"/,
    );

    await http()
      .delete(`/v1/ofertas/${publicada.body.oferta.id as string}`)
      .set(CABECERAS)
      .set('Cookie', cookie)
      .expect(204);
    expect(await alDia()).toEqual({ faltan: 0, sobran: 0 });
  });

  it('sale lo mismo del resumen que agrupando las ofertas', async () => {
    // Pedir todas las galerías obliga a agrupar las ofertas sin cambiar cuáles entran.
    const galerias = [
      ...(await prisma.galeria.findMany({ select: { slug: true } })).map((g) => g.slug),
      'independientes',
    ].join(',');
    const rutas = [
      '/v1/buscar',
      '/v1/buscar?q=rtx',
      '/v1/buscar?q=rtx%203070&orden=precio_asc',
      '/v1/buscar?orden=precio_desc',
      '/v1/buscar?categoria=graficas',
      '/v1/buscar?marca=msi,asus',
      '/v1/buscar?pagina=9',
    ];
    for (const usuario of [undefined, 'tiendab', 'tiendaa', 'equipo']) {
      for (const ruta of rutas) {
        const conResumen = await buscar(ruta, usuario);
        const separador = ruta.includes('?') ? '&' : '?';
        const conOfertas = await buscar(`${ruta}${separador}galeria=${galerias}`, usuario);
        expect(conOfertas, `${usuario ?? 'visitante'} ${ruta}`).toEqual(conResumen);
      }
    }
  });
});
