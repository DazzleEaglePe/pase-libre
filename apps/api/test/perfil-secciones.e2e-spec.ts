import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type { PerfilTienda, RespuestaPublicacionesTienda } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import {
  CABECERAS,
  CARPETA_MEDIA_PRUEBAS,
  cookieDe,
  crearApp,
  usarBaseDePruebas,
  vaciarBase,
} from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Doc 20, punto 20: la pestaña Productos del perfil en tres secciones («Lo nuevo de esta semana»,
 * «Sus mejores precios» con «Más barato de la galería» y «Todo» con sus burbujas y «Ordenar ▾»),
 * y el logo borroso de un perfil privado (punto 5). Tienda A y Tienda E están en Maxiplaza.
 */
describe('Perfil de tienda: lo nuevo, sus mejores precios y todo (doc 20, punto 20)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  const ofertas = new Map<string, string>();
  let tiendaA = '';

  async function ingresar(usuario: string): Promise<void> {
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    cookies.set(usuario, cookieDe(respuesta));
  }
  const cookie = (usuario: string) => cookies.get(usuario) ?? '';
  const como = (usuario: string) => ({
    get: (ruta: string) => http().get(ruta).set('Cookie', cookie(usuario)),
    send: (metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo?: object) =>
      http()[metodo](ruta).set(CABECERAS).set('Cookie', cookie(usuario)).send(cuerpo),
  });

  async function producto(categoria: string, titulo: string) {
    const { id } = await prisma.categoria.findUniqueOrThrow({ where: { slug: categoria } });
    return prisma.producto.create({
      data: {
        categoriaId: id,
        titulo,
        slug: titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        textoBusqueda: titulo.toLowerCase(),
        revisado: true,
      },
    });
  }

  async function publicar(usuario: string, productoId: string, precio: string): Promise<string> {
    const respuesta = await como(usuario)
      .send('post', '/v1/ofertas', {
        producto_id: productoId,
        estado_detalle: 'SELLADO',
        stock: 3,
        precio,
        quien_ve_precio: 'TODOS',
      })
      .expect(201);
    return (respuesta.body as { oferta: { id: string } }).oferta.id;
  }

  const todo = async (usuario: string, consulta: string) =>
    (await como(usuario).get(`/v1/tiendas/${tiendaA}/publicaciones?${consulta}`).expect(200))
      .body as RespuestaPublicacionesTienda;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendae', 'equipo']) await ingresar(usuario);
    tiendaA =
      (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } })).tiendaId ?? '';
    // Lo de antes de la prueba queda viejo: «Lo nuevo de esta semana» solo trae lo de aquí.
    await prisma.oferta.updateMany({
      where: { tiendaId: tiendaA },
      data: { creadaEn: new Date(Date.now() - 10 * 86_400_000) },
    });

    const barata = await producto('sillas', 'Seccionprueba Silla Barata');
    const cara = await producto('sillas', 'Seccionprueba Silla Cara');
    const sola = await producto('soportes', 'Seccionprueba Soporte Solo');
    ofertas.set('barata', await publicar('tiendaa', barata.id, '100'));
    ofertas.set('cara', await publicar('tiendaa', cara.id, '150'));
    ofertas.set('sola', await publicar('tiendaa', sola.id, '80'));
    // En la misma galería (Maxiplaza), Tienda E vende la barata más cara y la cara más barata.
    await publicar('tiendae', barata.id, '120');
    await publicar('tiendae', cara.id, '130');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('«Lo nuevo de esta semana»: solo lo de los últimos 7 días, lo más nuevo primero', async () => {
    const perfil = (await como('tiendab').get(`/v1/tiendas/${tiendaA}`).expect(200))
      .body as PerfilTienda;
    expect(perfil.nuevas.map((p) => p.oferta_id)).toEqual([
      ofertas.get('sola'),
      ofertas.get('cara'),
      ofertas.get('barata'),
    ]);
  });

  it('«Sus mejores precios»: donde es la más barata de su galería, con la chapita', async () => {
    const perfil = (await como('tiendab').get(`/v1/tiendas/${tiendaA}`).expect(200))
      .body as PerfilTienda;
    expect(perfil.mejores_precios.map((p) => p.oferta_id)).toEqual([ofertas.get('barata')]);
    expect(perfil.mejores_precios[0]?.mas_barato).toBe(true);
    // En el perfil de E, la que le gana a A.
    const tiendaE =
      (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendae' } })).tiendaId ?? '';
    const deE = (await como('tiendab').get(`/v1/tiendas/${tiendaE}`).expect(200))
      .body as PerfilTienda;
    expect(deE.mejores_precios.map((p) => p.producto.titulo)).toEqual(['Seccionprueba Silla Cara']);
  });

  it('«Todo»: burbujas con solo sus categorías y cuántas; varias marcadas se suman', async () => {
    const perfil = (await como('tiendab').get(`/v1/tiendas/${tiendaA}`).expect(200))
      .body as PerfilTienda;
    const esperadas = await prisma.oferta.findMany({
      where: {
        tiendaId: tiendaA,
        estado: 'ACTIVA',
        tiendaVisible: true,
        stock: { gt: 0 },
        producto: { fusionadoEnId: null },
      },
      select: { producto: { select: { categoria: { select: { slug: true } } } } },
    });
    const cuenta = new Map<string, number>();
    for (const o of esperadas) {
      const slug = o.producto.categoria.slug;
      cuenta.set(slug, (cuenta.get(slug) ?? 0) + 1);
    }
    expect(Object.fromEntries(perfil.categorias.map((c) => [c.slug, c.cantidad]))).toEqual(
      Object.fromEntries(cuenta),
    );
    expect(perfil.categorias.reduce((suma, c) => suma + c.cantidad, 0)).toBe(
      perfil.total_productos,
    );
    expect(perfil.categorias.find((c) => c.slug === 'sillas')).toEqual({
      slug: 'sillas',
      nombre: 'Sillas gamer',
      cantidad: 2,
    });

    const dos = await todo('tiendab', 'categoria=sillas,soportes');
    expect(dos.total).toBe(3);
    expect(dos.productos.map((p) => p.producto.categoria.slug).sort()).toEqual([
      'sillas',
      'sillas',
      'soportes',
    ]);
    expect((await todo('tiendab', 'categoria=sillas')).total).toBe(2);
  });

  it('«Ordenar ▾»: recién publicados, por precio, más vistos y remates primero', async () => {
    const orden = async (consulta: string) =>
      (await todo('tiendab', `categoria=sillas,soportes&${consulta}`)).productos.map(
        (p) => [...ofertas.entries()].find(([, id]) => id === p.oferta_id)?.[0],
      );
    expect(await orden('orden=recientes')).toEqual(['sola', 'cara', 'barata']);
    expect(await orden('orden=precio_asc')).toEqual(['sola', 'barata', 'cara']);
    expect(await orden('orden=precio_desc')).toEqual(['cara', 'barata', 'sola']);

    const tiendas = await prisma.tienda.findMany({ where: { id: { not: tiendaA } }, take: 2 });
    const hoy = new Date(new Date().toISOString().slice(0, 10));
    await prisma.vistaOferta.createMany({
      data: [
        ...tiendas.map((t) => ({
          ofertaId: ofertas.get('barata') ?? '',
          tiendaId: t.id,
          dia: hoy,
        })),
        { ofertaId: ofertas.get('cara') ?? '', tiendaId: tiendas[0]?.id ?? '', dia: hoy },
      ],
    });
    expect(await orden('orden=vistos')).toEqual(['barata', 'cara', 'sola']);

    const oferta = await prisma.oferta.findUniqueOrThrow({
      where: { id: ofertas.get('barata') ?? '' },
      select: {
        productoId: true,
        responsableId: true,
        producto: { select: { categoriaId: true } },
      },
    });
    await prisma.enVivo.create({
      data: {
        tipo: 'FLASH',
        autorId: oferta.responsableId,
        tiendaId: tiendaA,
        categoriaId: oferta.producto.categoriaId,
        productoId: oferta.productoId,
        ofertaId: ofertas.get('barata') ?? '',
        titulo: 'Seccionprueba Silla Barata',
        precioCentimos: 9_000n,
        moneda: 'PEN',
        venceEn: new Date(Date.now() + 3_600_000),
      },
    });
    expect(await orden('orden=remates')).toEqual(['barata', 'sola', 'cara']);
  });

  it('tu propio perfil trae «Todo» para el tachito y «Eliminar varias»', async () => {
    const propio = (await como('tiendaa').get(`/v1/tiendas/${tiendaA}`).expect(200))
      .body as PerfilTienda;
    expect(propio.propia).toBe(true);
    expect(propio.productos.length).toBe(Math.min(propio.total_productos, 48));
    expect(propio.productos[0]?.oferta_id).toBe(ofertas.get('sola'));
  });

  it('bloqueada: sin sus publicaciones', async () => {
    const usuarioB = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } });
    await prisma.bloqueo.create({ data: { usuarioId: usuarioB.id, tiendaBloqueadaId: tiendaA } });
    expect((await todo('tiendab', '')).productos).toEqual([]);
    const perfil = (await como('tiendab').get(`/v1/tiendas/${tiendaA}`).expect(200))
      .body as PerfilTienda;
    expect(perfil).toMatchObject({
      bloqueada: true,
      productos: [],
      nuevas: [],
      mejores_precios: [],
    });
    await prisma.bloqueo.deleteMany({ where: { usuarioId: usuarioB.id } });
  });

  it('perfil privado: logo y portada en versión chica (`data:`), nunca la ruta original', async () => {
    const ruta = '2026/11/0b0e0c0a-1111-4222-8333-444455556666.webp';
    await mkdir(join(CARPETA_MEDIA_PRUEBAS, '2026/11'), { recursive: true });
    await sharp({
      create: { width: 512, height: 512, channels: 3, background: '#00875A' },
    })
      .webp()
      .toFile(join(CARPETA_MEDIA_PRUEBAS, ruta));
    await prisma.tienda.update({
      where: { id: tiendaA },
      data: { logo: ruta, portadaRuta: ruta, visibilidad: 'PRIVADO' },
    });
    const respuesta = await como('tiendab').get(`/v1/tiendas/${tiendaA}`).expect(200);
    const perfil = respuesta.body as PerfilTienda;
    expect(perfil.privada).toBe(true);
    expect(perfil.logo).toBeNull();
    expect(perfil.portada).toBeNull();
    expect(perfil.logo_borroso).toMatch(/^data:image\/webp;base64,/);
    expect(perfil.portada_borrosa).toMatch(/^data:image\/webp;base64,/);
    expect(respuesta.text).not.toContain(ruta);
    const chico = await sharp(
      Buffer.from((perfil.logo_borroso ?? '').split(',')[1] ?? '', 'base64'),
    ).metadata();
    expect(chico.width).toBeLessThanOrEqual(32);

    // En la búsqueda de tiendas con su nombre exacto, igual.
    const directorio = await como('tiendab').get('/v1/wilson/tiendas?q=Tienda%20A').expect(200);
    expect(directorio.text).not.toContain(ruta);
    expect(directorio.body.tiendas[0]).toMatchObject({ privada: true, logo: null });
    expect(directorio.body.tiendas[0].logo_borroso).toMatch(/^data:image\/webp;base64,/);
    await prisma.tienda.update({ where: { id: tiendaA }, data: { visibilidad: 'PUBLICO' } });
  });
});
