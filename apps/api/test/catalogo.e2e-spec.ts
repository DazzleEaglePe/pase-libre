import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';
const I5 = 'intel-core-i-5-14400-f';

interface Producto {
  titulo: string;
  slug: string;
  ofertas: {
    cantidad: number;
    precios_desde?: Array<{ moneda: string; centimos: number }>;
    al_interno?: number;
  };
}
interface Oferta {
  tienda: { nombre: string };
  precio: { centimos: number; moneda: string } | null;
  precio_visible: boolean;
  propia: boolean;
}

describe('Catálogo (RF-12 a RF-19, RF-44, RF-52)', () => {
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

  describe('búsqueda', () => {
    it('corrige «rtx 3370» a «rtx 3070» y agrupa las ofertas por producto', async () => {
      const respuesta = await http().get('/v1/buscar?q=rtx%203370').expect(200);
      expect(respuesta.body.correccion).toEqual({ buscaste: 'rtx 3370', mostramos: 'rtx 3070' });
      expect(respuesta.body.total_productos).toBe(5);
      expect(respuesta.body.total_ofertas).toBe(9);
      const ventus = respuesta.body.productos.find((p: Producto) => p.slug === VENTUS);
      expect(ventus.ofertas).toMatchObject({
        cantidad: 4,
        galerias: ['Cyberplaza', 'Maxiplaza'],
        stock_total: 7,
      });
    });

    it('corrige palabras con letras («ventsu») y entiende «RTX3070» pegado', async () => {
      const ventsu = await http().get('/v1/buscar?q=ventsu').expect(200);
      expect(ventsu.body.correccion?.mostramos).toBe('ventus');
      const pegado = await http().get('/v1/buscar?q=RTX3070').expect(200);
      expect(pegado.body.correccion).toBeNull();
      expect(pegado.body.total_productos).toBe(5);
    });

    it('sin coincidencias no inventa resultados y queda registrada (RF-32)', async () => {
      const respuesta = await http().get('/v1/buscar?q=xyzzy%20plasma').expect(200);
      expect(respuesta.body).toMatchObject({ total_productos: 0, correccion: null, productos: [] });
      const registrada = await prisma.busqueda.findFirst({ where: { texto: 'xyzzy plasma' } });
      expect(registrada?.resultados).toBe(0);
    });

    it('filtra por galería, condición, stock y categoría (RF-16, RF-17)', async () => {
      const independientes = await http().get('/v1/buscar?galeria=independientes').expect(200);
      expect(independientes.body.productos.map((p: Producto) => p.titulo).sort()).toEqual([
        'ASUS TUF Gaming B650-Plus WiFi',
        'ASUS TUF Gaming GeForce RTX 3070 Ti OC 8 GB',
      ]);

      const nuevosConStock = await http()
        .get('/v1/buscar?q=rtx%203070&condicion=nuevo&stock=true')
        .expect(200);
      expect(nuevosConStock.body.total_ofertas).toBe(3);

      const procesadores = await http().get('/v1/buscar?categoria=procesadores').expect(200);
      expect(procesadores.body.productos.map((p: Producto) => p.slug)).toEqual([I5]);

      const facetas = (await http().get('/v1/buscar?q=rtx%203070').expect(200)).body.facetas;
      expect(facetas.marcas[0]).toEqual({ slug: 'msi', nombre: 'MSI', cantidad: 5 });
      expect(facetas.con_stock).toBe(8);
    });

    it('no muestra ofertas pausadas ni de tiendas suspendidas', async () => {
      const pausada = await http().get('/v1/buscar?q=kumara').expect(200);
      expect(pausada.body.total_productos).toBe(0);

      await prisma.tienda.updateMany({
        where: { nombre: 'Tienda E' },
        data: { estado: 'SUSPENDIDA' },
      });
      try {
        const ficha = await http().get(`/v1/productos/${VENTUS}`).expect(200);
        expect(ficha.body.ofertas).toHaveLength(3);
      } finally {
        await prisma.tienda.updateMany({
          where: { nombre: 'Tienda E' },
          data: { estado: 'ACTIVA' },
        });
      }
    });

    it('con sesión trae el menor precio visible y ordena y filtra por precio', async () => {
      const cookie = await como('tiendab');
      const respuesta = await http()
        .get('/v1/buscar?q=rtx%203070&orden=precio_asc')
        .set('Cookie', cookie)
        .expect(200);
      expect(respuesta.body.audiencia).toBe('vendedor');
      const [primero] = respuesta.body.productos as Producto[];
      expect(primero?.slug).toBe(VENTUS);
      expect(primero?.ofertas.precios_desde).toEqual([
        { moneda: 'USD', centimos: 24000, monto: '240.00' },
      ]);
      expect(primero?.ofertas.al_interno).toBe(1);
      expect(respuesta.headers['cache-control']).toBe('private, no-store');

      // Hasta US$ 250: quedan las de 240 y 250 y todas las ofertas al interno.
      const filtrada = await http()
        .get('/v1/buscar?q=rtx%203070&precio_max=250')
        .set('Cookie', cookie)
        .expect(200);
      expect(
        filtrada.body.productos.map((p: Producto) => [p.slug, p.ofertas.cantidad]).sort(),
      ).toEqual([
        ['asus-tuf-gaming-geforce-rtx-3070-ti-oc-8-gb', 1],
        [VENTUS, 3],
        ['zotac-gaming-geforce-rtx-3070-twin-edge-8-gb', 1],
      ]);
    });

    it('quien aún tiene la clave temporal busca como visitante', async () => {
      const respuesta = await http()
        .get('/v1/buscar?q=rtx')
        .set('Cookie', await como('tiendad'))
        .expect(200);
      expect(respuesta.body.audiencia).toBe('visitante');
    });
  });

  describe('ficha', () => {
    it('con sesión: de menor a mayor precio, al interno al final y la oferta propia marcada', async () => {
      const respuesta = await http()
        .get(`/v1/productos/${VENTUS}`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const ofertas = respuesta.body.ofertas as Oferta[];
      expect(ofertas.map((o) => [o.tienda.nombre, o.precio?.centimos ?? null, o.propia])).toEqual([
        ['Tienda B', 24000, true],
        ['Tienda A', 25000, false],
        ['Tienda C', 26500, false],
        ['Tienda E', null, false],
      ]);
    });

    it('el precio oculto solo lo ven la tienda dueña y el equipo', async () => {
      const deTiendaA = (ofertas: Oferta[]) => ofertas.find((o) => o.tienda.nombre === 'Tienda A');

      const otra = await http()
        .get(`/v1/productos/${I5}`)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(deTiendaA(otra.body.ofertas)).toMatchObject({
        precio: null,
        precio_visible: false,
        propia: false,
      });

      const duena = await http()
        .get(`/v1/productos/${I5}`)
        .set('Cookie', await como('tiendaa'))
        .expect(200);
      expect(deTiendaA(duena.body.ofertas)).toMatchObject({
        precio: { moneda: 'USD', centimos: 16500 },
        precio_visible: false,
        propia: true,
      });

      const equipo = await http()
        .get(`/v1/productos/${I5}`)
        .set('Cookie', await como('equipo'))
        .expect(200);
      expect(equipo.body.audiencia).toBe('equipo');
      expect(deTiendaA(equipo.body.ofertas)?.precio?.centimos).toBe(16500);
    });

    it('trae etiquetas y características del producto', async () => {
      const respuesta = await http().get(`/v1/productos/${VENTUS}`).expect(200);
      expect(respuesta.body.producto).toMatchObject({
        titulo: 'MSI GeForce RTX 3070 Ventus 3X OC 8 GB',
        marca: 'MSI',
        categoria: { slug: 'graficas', nombre: 'Gráficas' },
        caracteristicas: { Memoria: '8 GB GDDR6, 256 bits' },
      });
      expect(respuesta.body.producto.etiquetas).toContain('RTX 3070');
    });

    it('un producto unido a otro redirige con 301 (RF-54)', async () => {
      const destino = await prisma.producto.findUniqueOrThrow({ where: { slug: VENTUS } });
      await prisma.producto.create({
        data: {
          titulo: 'RTX 3070 MSI Ventus 3x OC',
          slug: 'rtx-3070-msi-ventus-3-x-oc',
          categoriaId: destino.categoriaId,
          fusionadoEnId: destino.id,
        },
      });
      const respuesta = await http().get('/v1/productos/rtx-3070-msi-ventus-3-x-oc').expect(301);
      expect(respuesta.headers.location).toBe(`/v1/productos/${VENTUS}`);
      expect(respuesta.body).toEqual({ redirigir_a: VENTUS });
    });

    it('un producto que no existe responde 404 en español', async () => {
      const respuesta = await http().get('/v1/productos/no-existe').expect(404);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'NO_ENCONTRADO',
        mensaje: 'Este producto no existe en PaseLibre.',
      });
    });
  });

  describe('portada', () => {
    it('trae categorías con conteo, galerías con independientes y los totales', async () => {
      const respuesta = await http().get('/v1/portada').expect(200);
      expect(respuesta.body.categorias.map((c: { slug: string }) => c.slug)).toEqual([
        'graficas',
        'procesadores',
        'placas',
        'ram',
        'cases',
        'monitores',
        'perifericos',
      ]);
      expect(respuesta.body.galerias.map((g: { slug: string }) => g.slug)).toEqual([
        'maxiplaza',
        'cyberplaza',
        'independientes',
      ]);
      expect(respuesta.body.totales).toEqual({ productos: 13, tiendas: 6, galerias: 2 });
      expect(respuesta.body.recien_publicado).toHaveLength(8);
      // La web dibuja el ícono de la categoría cuando el producto aún no tiene fotos.
      for (const tarjeta of respuesta.body.recien_publicado) {
        expect(tarjeta.producto.categoria).toEqual({
          slug: expect.any(String),
          nombre: expect.any(String),
        });
      }
    });

    it('con sesión suma la tienda y el precio, y filtra por galería', async () => {
      const cookie = await como('tiendab');
      const respuesta = await http()
        .get('/v1/portada?galeria=independientes')
        .set('Cookie', cookie)
        .expect(200);
      expect(respuesta.body.audiencia).toBe('vendedor');
      for (const tarjeta of respuesta.body.recien_publicado) {
        expect(tarjeta.tienda.nombre).toBe('Jorge R.');
        expect(tarjeta.galeria).toBeNull();
      }
    });
  });
});
