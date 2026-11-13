import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

interface TiendaListada {
  id: string;
  nombre: string;
  galeria: string | null;
  stand: string | null;
  piso: string | null;
  vende: string[];
  reputacion: { estrellas: number | null; opiniones: number; nueva: boolean };
  en_linea: boolean;
  propia: boolean;
}

/**
 * Buscar tiendas (N13): la pestaña «Tiendas» de Wilson en vivo (`GET /v1/wilson/tiendas`) y la
 * sección «TIENDAS» del buscador (`GET /v1/buscar/sugerencias`). Lo que más importa: un
 * visitante no ve tiendas, las reservadas nunca salen y las que bloqueaste tampoco.
 */
describe('Directorio de tiendas y tiendas en el buscador (N13)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  const ids = new Map<string, string>();

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

  async function directorio(
    usuario: string,
    consulta = '',
  ): Promise<{
    tiendas: TiendaListada[];
    total: number;
    hay_mas: boolean;
    filtros: {
      galerias: Array<{ slug: string; nombre: string }>;
      pisos: string[];
      categorias: Array<{ slug: string; nombre: string }>;
    };
  }> {
    const respuesta = await http()
      .get(`/v1/wilson/tiendas${consulta}`)
      .set('Cookie', await como(usuario))
      .expect(200);
    expect(respuesta.headers['cache-control']).toContain('no-store');
    return respuesta.body;
  }

  async function enElBuscador(usuario: string | null, q: string) {
    const pedido = http().get(`/v1/buscar/sugerencias?q=${encodeURIComponent(q)}`);
    if (usuario) pedido.set('Cookie', await como(usuario));
    const respuesta = await pedido.expect(200);
    return respuesta.body as { tiendas: TiendaListada[]; productos: unknown[] };
  }

  const nombres = (lista: Array<{ nombre: string }>) => lista.map((tienda) => tienda.nombre);

  /** Una venta de Tienda A con su opinión, para que la tienda tenga reputación. */
  async function opinar(sobre: string, estrellas: number): Promise<void> {
    const oferta = await prisma.oferta.findFirstOrThrow({ where: { tiendaId: ids.get(sobre) } });
    const autor = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendaa' } });
    const venta = await prisma.venta.create({
      data: {
        ofertaId: oferta.id,
        stockAntes: 1,
        stockDespues: 0,
        registradaPorId: autor.id,
        tiendaCompradoraId: autor.tiendaId,
      },
    });
    await prisma.opinion.create({
      data: {
        ventaId: venta.id,
        lado: 'COMPRADOR',
        autorTiendaId: autor.tiendaId ?? '',
        autorId: autor.id,
        tiendaId: ids.get(sobre) ?? '',
        estrellas,
      },
    });
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const tienda of await prisma.tienda.findMany()) ids.set(tienda.nombre, tienda.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('sin sesión', () => {
    it('el directorio pide iniciar sesión', async () => {
      const respuesta = await http().get('/v1/wilson/tiendas').expect(401);
      expect(respuesta.body.error.codigo).toBe('SIN_SESION');
      expect(JSON.stringify(respuesta.body)).not.toContain('Tienda B');
    });

    it('el buscador no muestra tiendas', async () => {
      const cuerpo = await enElBuscador(null, 'tienda');
      expect(cuerpo.tiendas).toEqual([]);
      expect(JSON.stringify(cuerpo)).not.toContain('Tienda B');
    });
  });

  describe('con sesión', () => {
    it('lista las tiendas activas con su galería, stand, lo que vende y su reputación', async () => {
      const cuerpo = await directorio('tiendab');
      expect(nombres(cuerpo.tiendas)).toEqual(
        expect.arrayContaining(['Tienda A', 'Tienda B', 'Tienda C', 'Tienda D', 'Tienda E']),
      );
      const tiendaA = cuerpo.tiendas.find((tienda) => tienda.nombre === 'Tienda A');
      expect(tiendaA).toMatchObject({
        galeria: 'Maxiplaza',
        stand: '212',
        reputacion: { estrellas: null, opiniones: 0, nueva: true },
        en_linea: false,
        propia: false,
      });
      expect(tiendaA?.vende.length).toBeGreaterThan(0);
      expect(tiendaA?.vende.length).toBeLessThanOrEqual(2);
      expect(cuerpo.tiendas.find((tienda) => tienda.nombre === 'Tienda B')?.propia).toBe(true);
      // Nada de WhatsApp en el directorio.
      expect(JSON.stringify(cuerpo)).not.toContain('987111212');
      expect(cuerpo.total).toBe(cuerpo.tiendas.length);
      expect(cuerpo.hay_mas).toBe(false);
    });

    it('«4,9 ★ · 31 opiniones»: el promedio y cuántas, y por defecto la mejor primero', async () => {
      await opinar('Tienda C', 5);
      await opinar('Tienda C', 4);
      await opinar('Tienda E', 2);
      const cuerpo = await directorio('tiendab');
      const tiendaC = cuerpo.tiendas.find((tienda) => tienda.nombre === 'Tienda C');
      expect(tiendaC?.reputacion).toEqual({ estrellas: 4.5, opiniones: 2, nueva: false });
      expect(cuerpo.tiendas[0]?.nombre).toBe('Tienda C');
      // Una tienda mal calificada va después de las nuevas.
      expect(cuerpo.tiendas.at(-1)?.nombre).toBe('Tienda E');

      const porNombre = await directorio('tiendab', '?orden=nombre');
      expect(nombres(porNombre.tiendas)).toEqual(
        [...nombres(porNombre.tiendas)].sort((a, b) => a.localeCompare(b, 'es')),
      );
    });

    it('filtra por galería, independientes, piso y lo que vende', async () => {
      const todas = await directorio('tiendab');
      expect(todas.filtros.galerias.map((g) => g.slug)).toEqual(
        expect.arrayContaining(['cyberplaza', 'maxiplaza', 'independientes']),
      );

      const cyber = await directorio('tiendab', '?galeria=cyberplaza');
      expect(cyber.tiendas.every((tienda) => tienda.galeria === 'Cyberplaza')).toBe(true);
      expect(nombres(cyber.tiendas)).toEqual(expect.arrayContaining(['Tienda B', 'Tienda C']));

      const solas = await directorio('tiendab', '?galeria=independientes');
      expect(nombres(solas.tiendas)).toEqual(['Jorge R.']);

      await prisma.tienda.update({ where: { id: ids.get('Tienda A') }, data: { piso: '2' } });
      const conPisos = await directorio('tiendab', '?galeria=maxiplaza');
      expect(conPisos.filtros.pisos).toEqual(['2']);
      const piso2 = await directorio('tiendab', '?galeria=maxiplaza&piso=2');
      expect(nombres(piso2.tiendas)).toEqual(['Tienda A']);

      const categoria = todas.filtros.categorias[0];
      expect(categoria).toBeDefined();
      const venden = await directorio('tiendab', `?vende=${categoria?.slug}`);
      expect(venden.tiendas.length).toBeGreaterThan(0);
      expect(venden.tiendas.every((tienda) => tienda.vende.length > 0)).toBe(true);
      const conCategoria = await prisma.tienda.count({
        where: {
          estado: 'ACTIVA',
          ofertas: {
            some: {
              estado: 'ACTIVA',
              tiendaVisible: true,
              producto: { categoria: { slug: categoria?.slug } },
            },
          },
        },
      });
      expect(venden.total).toBe(conCategoria);
    });

    it('busca por un pedazo del nombre, sin importar tildes ni mayúsculas', async () => {
      const cuerpo = await directorio('tiendab', `?q=${encodeURIComponent('TIÉNDA d')}`);
      expect(nombres(cuerpo.tiendas)).toEqual(['Tienda D']);
      const comodin = await directorio('tiendab', `?q=${encodeURIComponent('%')}`);
      expect(comodin.tiendas).toEqual([]);
    });

    it('rechaza filtros que no existen', async () => {
      await http()
        .get('/v1/wilson/tiendas?orden=precio')
        .set('Cookie', await como('tiendab'))
        .expect(400);
      await http()
        .get('/v1/wilson/tiendas?pagina=0')
        .set('Cookie', await como('tiendab'))
        .expect(400);
    });

    it('el buscador de arriba muestra las que coinciden, la que empieza así primero', async () => {
      const cuerpo = await enElBuscador('tiendab', 'tienda');
      expect(cuerpo.tiendas.length).toBeLessThanOrEqual(3);
      expect(cuerpo.tiendas.length).toBeGreaterThan(0);
      const una = await enElBuscador('tiendab', 'tienda c');
      expect(una.tiendas).toEqual([
        expect.objectContaining({
          nombre: 'Tienda C',
          galeria: 'Cyberplaza',
          stand: '118',
          reputacion: { estrellas: 4.5, opiniones: 2, nueva: false },
        }),
      ]);
      expect(JSON.stringify(una.tiendas)).not.toContain('987333118');
      // Con una sola letra todavía no busca tiendas.
      expect((await enElBuscador('tiendab', 't')).tiendas).toEqual([]);
    });
  });

  describe('privacidad', () => {
    it('una tienda reservada (todo con «Tienda reservada») no sale para nadie', async () => {
      await prisma.oferta.updateMany({
        where: { tiendaId: ids.get('Tienda D') },
        data: { tiendaVisible: false },
      });
      for (const usuario of ['tiendab', 'tiendaa', 'equipo']) {
        const cuerpo = await directorio(usuario);
        expect(nombres(cuerpo.tiendas)).not.toContain('Tienda D');
        expect(JSON.stringify(cuerpo)).not.toContain(ids.get('Tienda D'));
        const filtrado = await directorio(usuario, '?galeria=maxiplaza&q=tienda%20d');
        expect(filtrado.tiendas).toEqual([]);
        const buscador = await enElBuscador(usuario, 'tienda d');
        expect(buscador.tiendas).toEqual([]);
        expect(JSON.stringify(buscador.tiendas)).not.toContain('Tienda D');
      }
    });

    it('lo reservado de una tienda visible no cuenta en lo que vende', async () => {
      const ofertas = await prisma.oferta.findMany({
        where: { tiendaId: ids.get('Tienda E'), estado: 'ACTIVA' },
        include: { producto: { include: { categoria: true } } },
      });
      const porCategoria = new Map<string, string[]>();
      for (const oferta of ofertas) {
        const nombre = oferta.producto.categoria.nombre;
        porCategoria.set(nombre, [...(porCategoria.get(nombre) ?? []), oferta.id]);
      }
      expect(porCategoria.size).toBeGreaterThan(1);
      // La que más publica: sin lo reservado, ya no es lo que vende.
      const [escondida, deEsa] = [...porCategoria.entries()].sort(
        (a, b) => b[1].length - a[1].length,
      )[0] ?? ['', []];
      await prisma.oferta.updateMany({
        where: { id: { in: deEsa } },
        data: { tiendaVisible: false },
      });
      const todas = await directorio('tiendab', '?orden=nombre');
      const tiendaE = todas.tiendas.find((tienda) => tienda.nombre === 'Tienda E');
      expect(tiendaE).toBeDefined();
      expect(tiendaE?.vende).not.toContain(escondida);
      await prisma.oferta.updateMany({
        where: { id: { in: deEsa } },
        data: { tiendaVisible: true },
      });
    });

    it('una tienda que aún no publica nada sí sale, como «Nueva»', async () => {
      const galeria = await prisma.galeria.findUniqueOrThrow({ where: { slug: 'cyberplaza' } });
      const nueva = await prisma.tienda.create({
        data: {
          tipo: 'TIENDA',
          nombre: 'Pegaso Computer',
          galeriaId: galeria.id,
          stand: '1-24',
          whatsapp: '987000124',
        },
      });
      ids.set('Pegaso Computer', nueva.id);
      const buscador = await enElBuscador('tiendab', 'pega');
      expect(buscador.tiendas).toEqual([
        expect.objectContaining({
          nombre: 'Pegaso Computer',
          reputacion: { estrellas: null, opiniones: 0, nueva: true },
        }),
      ]);
    });

    it('las suspendidas y las de perfil privado (buscadas a medias) no salen', async () => {
      await prisma.tienda.update({
        where: { id: ids.get('Pegaso Computer') },
        data: { estado: 'SUSPENDIDA' },
      });
      expect((await enElBuscador('tiendab', 'pega')).tiendas).toEqual([]);
      await prisma.tienda.update({
        where: { id: ids.get('Pegaso Computer') },
        data: { estado: 'ACTIVA', visibilidad: 'PRIVADO' },
      });
      expect((await enElBuscador('tiendab', 'pega')).tiendas).toEqual([]);
      expect(nombres((await directorio('tiendab')).tiendas)).not.toContain('Pegaso Computer');
    });

    it('las que bloqueaste no salen; las demás tiendas sí las ven', async () => {
      const usuarioB = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendab' } });
      await prisma.bloqueo.create({
        data: { usuarioId: usuarioB.id, tiendaBloqueadaId: ids.get('Tienda E') ?? '' },
      });
      expect(nombres((await directorio('tiendab')).tiendas)).not.toContain('Tienda E');
      expect((await enElBuscador('tiendab', 'tienda e')).tiendas).toEqual([]);
      expect(nombres((await directorio('tiendaa')).tiendas)).toContain('Tienda E');
      expect(nombres((await enElBuscador('tiendaa', 'tienda e')).tiendas)).toEqual(['Tienda E']);
    });

    it('bloqueada desde un chat de la tienda reservada sigue: si se fuera, delataría cuál era', async () => {
      const usuarioA = await prisma.usuario.findFirstOrThrow({ where: { usuario: 'tiendaa' } });
      await prisma.bloqueo.create({
        data: {
          usuarioId: usuarioA.id,
          tiendaBloqueadaId: ids.get('Tienda C') ?? '',
          reservada: true,
        },
      });
      expect(nombres((await directorio('tiendaa')).tiendas)).toContain('Tienda C');
    });
  });

  describe('Wilson en vivo (N08)', () => {
    it('todas las galerías, la tuya primero, con su nivel y las tiendas que tienen productos', async () => {
      // Tienda C no bloqueó a nadie: cuenta todo lo de Wilson.
      const respuesta = await http()
        .get('/v1/wilson')
        .set('Cookie', await como('tiendac'))
        .expect(200);
      const galerias = respuesta.body.galerias as Array<{
        slug: string;
        productos: number;
        tiendas: number;
        nivel: string;
        mia: boolean;
      }>;
      expect(galerias[0]).toMatchObject({ slug: 'cyberplaza', mia: true });
      const activas = await prisma.galeria.count({ where: { activa: true } });
      expect(galerias).toHaveLength(activas);
      for (const galeria of galerias) {
        expect(['SIN', 'POCOS', 'VARIOS', 'MUCHOS']).toContain(galeria.nivel);
        expect(galeria.nivel === 'SIN').toBe(galeria.productos === 0);
        const conStock = await prisma.tienda.count({
          where: {
            estado: 'ACTIVA',
            galeria: { slug: galeria.slug },
            ofertas: { some: { estado: 'ACTIVA', stock: { gt: 0 } } },
          },
        });
        expect(galeria.tiendas).toBe(conStock);
      }
      // Las tiendas por piso ya no van aquí: están en la pestaña «Tiendas».
      expect(respuesta.body.pisos).toEqual([]);

      const visitante = await http().get('/v1/wilson').expect(200);
      expect(visitante.body.galerias.some((g: { mia: boolean }) => g.mia)).toBe(false);
    });

    it('solo cuentan los productos con stock', async () => {
      const antes = await http().get('/v1/wilson').expect(200);
      const cyber = (cuerpo: { galerias: Array<{ slug: string; productos: number }> }) =>
        cuerpo.galerias.find((g) => g.slug === 'cyberplaza')?.productos ?? 0;
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: ids.get('Tienda B'), estado: 'ACTIVA', stock: { gt: 0 } },
      });
      await prisma.oferta.update({ where: { id: oferta.id }, data: { stock: 0 } });
      const despues = await http().get('/v1/wilson').expect(200);
      expect(cyber(despues.body)).toBe(cyber(antes.body) - 1);
    });
  });
});
