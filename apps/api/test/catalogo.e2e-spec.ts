import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { PORTADA_RECIENTES } from '../src/modules/catalogo/catalogo.service';
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
  oferta_destacada: {
    precio: { moneda: string; centimos: number; monto: string } | null;
    mas_barata: boolean;
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

      const rtx = (await http().get('/v1/buscar?q=rtx%203070').expect(200)).body;
      const facetas = rtx.facetas;
      expect(facetas.marcas[0]).toEqual({ slug: 'msi', nombre: 'MSI', cantidad: 5 });
      expect(facetas.con_stock).toBe(8);
      // Las tarjetas de categoría cuentan productos, no ofertas.
      expect(facetas.categorias).toEqual([
        { slug: 'graficas', nombre: 'Tarjetas de video', cantidad: rtx.total_productos },
      ]);
    });

    it('las tarjetas de categoría no se achican al elegir una', async () => {
      const todas = (await http().get('/v1/buscar').expect(200)).body;
      expect(todas.facetas.categorias.length).toBeGreaterThan(1);
      const suma = todas.facetas.categorias.reduce(
        (total: number, c: { cantidad: number }) => total + c.cantidad,
        0,
      );
      expect(suma).toBe(todas.total_productos);

      const enProcesadores = (await http().get('/v1/buscar?categoria=procesadores').expect(200))
        .body;
      expect(enProcesadores.facetas.categorias).toEqual(todas.facetas.categorias);
      expect(enProcesadores.total_productos).toBe(
        todas.facetas.categorias.find((c: { slug: string }) => c.slug === 'procesadores').cantidad,
      );
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

    it('con sesión cada producto trae su oferta más barata para escribirle', async () => {
      const respuesta = await http()
        .get('/v1/buscar?q=rtx%203070&orden=precio_asc')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const destacadas = new Map(
        (respuesta.body.productos as Producto[]).map((p) => [p.slug, p.oferta_destacada]),
      );
      // Ventus: la de 240 es de la propia Tienda B, así que se destaca la de afuera más barata
      // (Tienda A, 250), que igual es la más barata de todos los resultados.
      expect(destacadas.get(VENTUS)).toMatchObject({
        condicion: 'USADO',
        stock: 2,
        galeria: expect.any(String),
        precio: { moneda: 'USD', centimos: 25000 },
        tienda: { nombre: 'Tienda A' },
        propia: false,
        mas_barata: true,
      });
      // Para otra tienda, la de Tienda B es la más barata y no es suya.
      const deOtra = await http()
        .get('/v1/buscar?q=rtx%203070')
        .set('Cookie', await como('tiendaa'))
        .expect(200);
      const ventus = (deOtra.body.productos as Producto[]).find((p) => p.slug === VENTUS);
      expect(ventus?.oferta_destacada).toMatchObject({
        tienda: { nombre: 'Tienda B' },
        precio: { centimos: 24000 },
        propia: false,
      });
      // Si la única oferta es la propia, se destaca igual y va marcada.
      const propia = await http()
        .get('/v1/buscar?q=antryx')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(propia.body.productos[0]?.oferta_destacada).toMatchObject({
        tienda: { nombre: 'Tienda B' },
        propia: true,
      });
      // Solo una por todos los resultados lleva «Más barato».
      const baratas = (respuesta.body.productos as Producto[]).filter(
        (p) => p.oferta_destacada?.mas_barata,
      );
      expect(baratas.map((p) => p.slug)).toEqual([VENTUS]);
      // Sin stock ni precio visible: la oferta sale, sin precio y sin marcar.
      const zotac = destacadas.get('zotac-gaming-geforce-rtx-3070-twin-edge-8-gb');
      expect(zotac).toMatchObject({ stock: 0, precio: null, mas_barata: false });
    });

    it('«Más barato primero» compara soles con dólares', async () => {
      const respuesta = await http()
        .get('/v1/buscar?orden=precio_asc')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const productos = respuesta.body.productos as Producto[];
      const posicion = (slug: string) => productos.findIndex((p) => p.slug === slug);
      // Kingston US$ 98; el mouse de S/ 420 son ~US$ 112; el monitor de S/ 799, ~US$ 213;
      // la Ventus de US$ 240. Solo en una misma vara el monitor queda antes que la Ventus.
      const kingston = posicion('kingston-fury-beast-ddr-5-32-gb-2-16-6000-mhz');
      const mouse = posicion('logitech-g-502-x-plus-inalambrico');
      const monitor = posicion('lg-ultragear-27-gs-60-f-27-180-hz');
      expect(kingston).toBeGreaterThanOrEqual(0);
      expect(kingston).toBeLessThan(mouse);
      expect(mouse).toBeLessThan(monitor);
      expect(monitor).toBeLessThan(posicion(VENTUS));
      expect(productos[kingston]?.oferta_destacada.mas_barata).toBe(true);
      // Lo que se muestra no se convierte: el mouse sigue en soles.
      expect(productos[mouse]?.oferta_destacada.precio).toEqual({
        moneda: 'PEN',
        centimos: 42000,
        monto: '420.00',
      });
    });

    it('el visitante no recibe oferta destacada, ni tienda, ni stand', async () => {
      const respuesta = await http().get('/v1/buscar?q=rtx%203070').expect(200);
      expect(respuesta.body.audiencia).toBe('visitante');
      for (const producto of respuesta.body.productos as Array<Record<string, unknown>>) {
        expect(producto).not.toHaveProperty('oferta_destacada');
      }
      expect(JSON.stringify(respuesta.body)).not.toMatch(/Tienda [A-Z]|tienda|stand/i);
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
        categoria: { slug: 'graficas', nombre: 'Tarjetas de video' },
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

    it('una dirección que no puede ser de un producto responde 404, no 500', async () => {
      for (const slug of [
        '%00',
        'con%20espacio',
        '..%2fetc',
        'a'.repeat(400),
        encodeURIComponent('ñandú'),
      ]) {
        const respuesta = await http().get(`/v1/productos/${slug}`).expect(404);
        expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
      }
    });

    it('un producto que no existe responde 404 en español', async () => {
      const respuesta = await http().get('/v1/productos/no-existe').expect(404);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'NO_ENCONTRADO',
        mensaje: 'Este producto no existe en PaseLibre.',
      });
    });
  });

  describe('buscador de la barra', () => {
    it('sugiere productos mientras se escribe; con sesión, con «desde» (BUS_WebSug)', async () => {
      const cookie = await como('tiendab');
      const respuesta = await http()
        .get('/v1/buscar/sugerencias?q=rtx%2030')
        .set('Cookie', cookie)
        .expect(200);
      expect(respuesta.body.correccion).toBeNull();
      expect(respuesta.body.productos.length).toBeGreaterThan(0);
      expect(respuesta.body.productos.length).toBeLessThanOrEqual(5);
      expect(respuesta.body.productos.map((p: Producto) => p.slug)).toContain(VENTUS);
      for (const producto of respuesta.body.productos) {
        expect(producto.ofertas.precios_desde).toEqual(expect.any(Array));
      }
      // Sin sesión, ni precio ni tienda.
      const visitante = await http().get('/v1/buscar/sugerencias?q=rtx%2030').expect(200);
      for (const producto of visitante.body.productos) {
        expect(producto.ofertas.precios_desde).toBeUndefined();
      }
    });

    it('corrige «rtx 3370», filtra por categoría y no registra lo que se escribe', async () => {
      const antes = await prisma.busqueda.count();
      const corregida = await http().get('/v1/buscar/sugerencias?q=rtx%203370').expect(200);
      expect(corregida.body.correccion).toEqual({ buscaste: 'rtx 3370', mostramos: 'rtx 3070' });

      const enOtraCategoria = await http()
        .get('/v1/buscar/sugerencias?q=rtx&categoria=procesadores')
        .expect(200);
      expect(enOtraCategoria.body.total_productos).toBe(0);

      const vacia = await http().get('/v1/buscar/sugerencias?q=').expect(200);
      expect(vacia.body).toEqual({
        correccion: null,
        total_productos: 0,
        productos: [],
        tiendas: [],
      });
      expect(await prisma.busqueda.count()).toBe(antes);
    });

    it('«Lo más buscado» junta lo que se repitió y encontró algo', async () => {
      await prisma.busqueda.deleteMany();
      await prisma.busqueda.createMany({
        data: [
          { texto: 'RTX3070', resultados: 3 },
          { texto: 'rtx 3070', resultados: 3 },
          { texto: 'rtx 3370', textoCorregido: 'rtx 3070', resultados: 3 },
          { texto: 'i5 14400f', resultados: 1 },
          { texto: 'i5 14400F', resultados: 1 },
          { texto: 'SSD 1TB', resultados: 1 },
          { texto: 'ssd   1tb', resultados: 1 },
          { texto: 'una sola vez', resultados: 2 },
          { texto: 'no existe', resultados: 0 },
          { texto: 'no existe', resultados: 0 },
        ],
      });
      const respuesta = await http().get('/v1/buscar/populares').expect(200);
      expect(respuesta.body).toEqual({ terminos: ['rtx 3070', 'i5 14400f', 'ssd 1tb'] });

      // Por categoría: solo lo que hoy encuentra algo en ella («ssd 1tb» no encuentra nada).
      const enGraficas = await http().get('/v1/buscar/populares?categoria=graficas').expect(200);
      expect(enGraficas.body).toEqual({ terminos: ['rtx 3070'] });
      const enProcesadores = await http()
        .get('/v1/buscar/populares?categoria=procesadores')
        .expect(200);
      expect(enProcesadores.body).toEqual({ terminos: ['i5 14400f'] });
      const enMonitores = await http().get('/v1/buscar/populares?categoria=monitores').expect(200);
      expect(enMonitores.body).toEqual({ terminos: [] });
    });
  });

  describe('mapa del sitio (RNF-42)', () => {
    it('lista los productos que ve un visitante, sin los unidos ni los sin oferta vigente', async () => {
      const respuesta = await http().get('/v1/mapa-del-sitio').expect(200);
      const slugs = respuesta.body.productos.map((p: { slug: string }) => p.slug);
      expect(slugs).toHaveLength(13);
      expect(slugs).toContain(VENTUS);

      const sinOfertaVigente = await prisma.producto.findMany({
        where: { ofertas: { none: { estado: 'ACTIVA' } } },
        select: { slug: true },
      });
      expect(sinOfertaVigente.length).toBeGreaterThan(0);
      for (const { slug } of sinOfertaVigente) expect(slugs).not.toContain(slug);

      for (const producto of respuesta.body.productos) {
        expect(Number.isNaN(Date.parse(producto.actualizado_en))).toBe(false);
      }
      expect(respuesta.headers['cache-control']).toContain('public');
    });
  });

  describe('portada', () => {
    it('la barra trae «Recién llegados» de hoy y lo más buscado, igual para todos', async () => {
      const visitante = await http().get('/v1/barra').expect(200);
      // La semilla publica todo hoy: cada oferta vigente con stock cuenta como recién llegada.
      const conStock = await prisma.oferta.count({
        where: { estado: 'ACTIVA', stock: { gt: 0 }, tienda: { estado: 'ACTIVA' } },
      });
      expect(visitante.body.recien_hoy).toBe(conStock);
      expect(Array.isArray(visitante.body.mas_buscado)).toBe(true);
      expect(typeof visitante.body.mas_buscado_hoy).toBe('boolean');
      expect(Object.keys(visitante.body).sort()).toEqual([
        'en_vivo',
        'mas_buscado',
        'mas_buscado_hoy',
        'recien_hoy',
      ]);
      const vendedor = await http()
        .get('/v1/barra')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(vendedor.body).toEqual(visitante.body);
    });

    it('trae categorías con conteo, galerías con independientes y los totales', async () => {
      const respuesta = await http().get('/v1/portada').expect(200);
      // Las 21 del lienzo final, en el orden del menú y con su grupo.
      const categorias = respuesta.body.categorias as Array<{ slug: string; grupo: string }>;
      expect(categorias).toHaveLength(21);
      expect(categorias.slice(0, 4).map((c) => c.slug)).toEqual([
        'procesadores',
        'graficas',
        'placas',
        'ram',
      ]);
      expect(new Set(categorias.map((c) => c.grupo))).toEqual(
        new Set(['Componentes', 'Equipos', 'Periféricos', 'Energía, redes y más']),
      );
      expect(respuesta.body.galerias.map((g: { slug: string }) => g.slug)).toEqual([
        'maxiplaza',
        'cyberplaza',
        'independientes',
      ]);
      expect(respuesta.body.totales).toEqual({ productos: 13, tiendas: 6, galerias: 2 });
      // La fila de «Recién publicado» se desliza: la base de pruebas tiene más ofertas que el tope.
      expect(respuesta.body.recien_publicado).toHaveLength(PORTADA_RECIENTES);
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
