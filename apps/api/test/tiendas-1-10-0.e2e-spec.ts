import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type {
  OfertaPropia,
  PerfilTienda,
  RespuestaBuscar,
  RespuestaCuenta,
  RespuestaFicha,
  RespuestaLogo,
  RespuestaPublicar,
  RespuestaSugerencias,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
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

/** Las descargas de Excel llegan como `Buffer`. */
const descargar = (prueba: request.Test) =>
  prueba.buffer(true).parse((res, listo) => {
    const partes: Buffer[] = [];
    res.on('data', (parte: Buffer) => partes.push(parte));
    res.on('end', () => listo(null, Buffer.concat(partes)));
  });

/**
 * Versión 1.10.0, para las tiendas (docs/19 §12, §13 y §20): borrar varias publicaciones desde el
 * perfil, «¿Para qué procesador es?» y el empaque al publicar, y «Ajustar logo» con la portada de
 * 2400 px.
 */
describe('Tiendas 1.10.0: borrar varias, procesador y empaque, ajustar logo (docs/19)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();

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
    send: (metodo: 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) =>
      http()[metodo](ruta).set(CABECERAS).set('Cookie', cookie(usuario)).send(cuerpo),
    subir: (foto: Buffer, ruta = '/v1/archivos') =>
      http()
        .post(ruta)
        .set(CABECERAS)
        .set('Cookie', cookie(usuario))
        .attach('foto', foto, { filename: 'foto.png', contentType: 'image/png' }),
  });

  const tiendaDe = async (usuario: string) =>
    (await prisma.usuario.findUniqueOrThrow({ where: { usuario } })).tiendaId ?? '';

  /** Un producto del catálogo de esa categoría, solo para estas pruebas. */
  async function producto(categoria: string, titulo: string, perfil?: 'XMP' | 'EXPO' | 'AMBOS') {
    const { id } = await prisma.categoria.findUniqueOrThrow({ where: { slug: categoria } });
    const slug = titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return prisma.producto.create({
      data: {
        categoriaId: id,
        titulo,
        slug,
        textoBusqueda: titulo.toLowerCase(),
        revisado: true,
        perfilMemoria: perfil ?? null,
      },
    });
  }

  async function publicar(usuario: string, productoId: string, extra: object = {}) {
    const respuesta = await como(usuario)
      .send('post', '/v1/ofertas', {
        producto_id: productoId,
        estado_detalle: 'SELLADO',
        stock: 3,
        precio: '120',
        quien_ve_precio: 'TODOS',
        ...extra,
      })
      .expect(201);
    return (respuesta.body as RespuestaPublicar).oferta;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'tiendae', 'equipo']) {
      await ingresar(usuario);
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // ── 12 · Borrar publicaciones desde el propio perfil ───────────────────────

  describe('«Eliminar varias» (punto 12)', () => {
    it('borra las de tu tienda y salen del perfil; repetirlo no falla', async () => {
      const tiendaA = await tiendaDe('tiendaa');
      const ofertas = await prisma.oferta.findMany({
        where: { tiendaId: tiendaA, estado: 'ACTIVA', tiendaVisible: true, stock: { gt: 0 } },
        take: 2,
        select: { id: true },
      });
      expect(ofertas).toHaveLength(2);
      const ids = ofertas.map((o) => o.id);
      const antes = (await como('tiendaa').get(`/v1/tiendas/${tiendaA}`)).body as PerfilTienda;

      const respuesta = await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', { ids })
        .expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.body).toEqual({ eliminadas: 2 });
      const filas = await prisma.oferta.findMany({ where: { id: { in: ids } } });
      for (const fila of filas) expect(fila).toMatchObject({ estado: 'ELIMINADA', vigente: null });

      const despues = (await como('tiendaa').get(`/v1/tiendas/${tiendaA}`)).body as PerfilTienda;
      expect(despues.total_productos).toBe(antes.total_productos - 2);
      expect(despues.productos.map((p) => p.oferta_id)).not.toEqual(expect.arrayContaining(ids));

      // «Deshacer» que llegó dos veces (o con `keepalive` al cerrar): no falla ni cuenta de nuevo.
      await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', { ids })
        .expect(200)
        .expect({ eliminadas: 0 });
    });

    it('con una sola ajena (o que no existe) no borra ninguna', async () => {
      const [propia, ajena] = await Promise.all([
        prisma.oferta.findFirstOrThrow({
          where: { tiendaId: await tiendaDe('tiendaa'), estado: 'ACTIVA' },
        }),
        prisma.oferta.findFirstOrThrow({
          where: { tiendaId: await tiendaDe('tiendab'), estado: 'ACTIVA' },
        }),
      ]);
      const respuesta = await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', { ids: [propia.id, ajena.id] })
        .expect(404);
      expect(respuesta.body.error.codigo).toBe('NO_ENCONTRADO');
      await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', {
          ids: [propia.id, '00000000-0000-4000-8000-000000000000'],
        })
        .expect(404);
      const siguen = await prisma.oferta.findMany({
        where: { id: { in: [propia.id, ajena.id] } },
        select: { estado: true },
      });
      expect(siguen.map((o) => o.estado)).toEqual(['ACTIVA', 'ACTIVA']);
    });

    it('hasta 50 por vez, al menos una y solo ids', async () => {
      const ids = Array.from(
        { length: 51 },
        (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      const muchas = await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', { ids })
        .expect(400);
      expect(muchas.body.error.mensaje).toContain('hasta 50');
      await como('tiendaa').send('post', '/v1/ofertas/eliminar', { ids: [] }).expect(400);
      await como('tiendaa')
        .send('post', '/v1/ofertas/eliminar', { ids: ['no-es-id'] })
        .expect(400);
      await como('tiendaa').send('post', '/v1/ofertas/eliminar', {}).expect(400);
    });

    it('pide el mismo permiso que eliminar una: el asesor sin «Publicar» y el equipo, no', async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: await tiendaDe('tiendaa'), estado: 'ACTIVA' },
      });
      // Un asesor sin «Publicar» (N12): vale desde su siguiente pedido.
      await prisma.usuario.update({
        where: { usuario: 'tiendaa.kevin' },
        data: { permisos: ['COMPRAR_VENDER'] },
      });
      const asesor = await como('tiendaa.kevin')
        .send('post', '/v1/ofertas/eliminar', { ids: [oferta.id] })
        .expect(403);
      expect(asesor.body.error.codigo).toBe('SIN_PERMISO');
      await como('tiendaa.kevin').send('delete', `/v1/ofertas/${oferta.id}`).expect(403);
      await como('equipo')
        .send('post', '/v1/ofertas/eliminar', { ids: [oferta.id] })
        .expect(403);
      await http()
        .post('/v1/ofertas/eliminar')
        .set(CABECERAS)
        .send({ ids: [oferta.id] })
        .expect(401);
      // Con «Publicar», el asesor sí.
      await prisma.usuario.update({
        where: { usuario: 'tiendaa.kevin' },
        data: { permisos: { push: 'PUBLICAR' } },
      });
      await como('tiendaa.kevin')
        .send('post', '/v1/ofertas/eliminar', { ids: [oferta.id] })
        .expect(200)
        .expect({ eliminadas: 1 });
    });
  });

  // ── 13 · Para qué procesador es y el empaque ───────────────────────────────

  describe('«¿Para qué procesador es?» y el empaque (punto 13)', () => {
    let xmp = '';
    let expo = '';
    let ambos = '';
    let grafica = '';

    beforeAll(async () => {
      xmp = (await producto('ram', 'Prueba Ram Uno DDR4 16 GB', 'XMP')).id;
      expo = (await producto('ram', 'Prueba Ram Dos DDR5 32 GB')).id;
      ambos = (await producto('ram', 'Prueba Ram Tres DDR5 16 GB')).id;
      grafica = (await producto('graficas', 'Prueba Grafica RTX 5060')).id;
    });

    it('el catálogo dice para qué procesador es: «Publicar uno igual» lo trae', async () => {
      const { productos } = (
        await como('tiendac')
          .get('/v1/catalogo/sugerencias?producto=prueba-ram-uno-ddr4-16-gb')
          .expect(200)
      ).body as RespuestaSugerencias;
      expect(productos[0]).toMatchObject({ id: xmp, perfil_memoria: 'XMP' });
    });

    it('se guarda al publicar; lo que la categoría no pregunta queda nulo', async () => {
      const ram = await publicar('tiendac', xmp, {
        perfil_memoria: 'XMP',
        empaque: 'OEM',
        // Una RAM no es OC: no se pregunta, no se guarda.
        oc: true,
      });
      expect(ram.detalle).toMatchObject({ perfil_memoria: 'XMP', empaque: 'OEM', oc: null });

      const tarjeta = await publicar('tiendac', grafica, {
        perfil_memoria: 'EXPO',
        empaque: 'CAJA',
        oc: true,
      });
      expect(tarjeta.detalle).toMatchObject({ perfil_memoria: null, empaque: 'CAJA', oc: true });

      const sinMarcar = await publicar('tiendac', expo);
      expect(sinMarcar.detalle).toMatchObject({ perfil_memoria: null, empaque: null, oc: null });

      await como('tiendac')
        .send('post', '/v1/ofertas', {
          producto_id: ambos,
          estado_detalle: 'SELLADO',
          stock: 1,
          perfil_memoria: 'DDR5',
        })
        .expect(400);
    });

    it('editar permite cambiarlo y quitarlo', async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { productoId: expo, tienda: { nombre: 'Tienda C' } },
      });
      const editada = (
        await como('tiendac')
          .send('patch', `/v1/ofertas/${oferta.id}`, {
            perfil_memoria: 'EXPO',
            empaque: 'CAJA',
          })
          .expect(200)
      ).body as OfertaPropia;
      expect(editada.detalle).toMatchObject({ perfil_memoria: 'EXPO', empaque: 'CAJA' });
      const una = (await como('tiendac').get(`/v1/ofertas/${oferta.id}`).expect(200))
        .body as OfertaPropia;
      expect(una.detalle.perfil_memoria).toBe('EXPO');

      // Lo que no llega se queda como estaba; nulo lo quita.
      const sinEmpaque = (
        await como('tiendac')
          .send('patch', `/v1/ofertas/${oferta.id}`, { empaque: null })
          .expect(200)
      ).body as OfertaPropia;
      expect(sinEmpaque.detalle).toMatchObject({ perfil_memoria: 'EXPO', empaque: null });

      await publicar('tiendab', ambos, { perfil_memoria: 'AMBOS' });
    });

    it('se ve en la ficha, en el feed y en el perfil', async () => {
      const ficha = (
        await como('tiendaa').get('/v1/productos/prueba-ram-uno-ddr4-16-gb').expect(200)
      ).body as RespuestaFicha;
      expect(ficha.producto.perfil_memoria).toBe('XMP');
      expect(ficha.ofertas[0]?.detalle).toMatchObject({ perfil_memoria: 'XMP', empaque: 'OEM' });
      // El visitante también: no es privado.
      const publica = (await http().get('/v1/productos/prueba-ram-uno-ddr4-16-gb').expect(200))
        .body as RespuestaFicha;
      expect(publica.ofertas[0]?.detalle.perfil_memoria).toBe('XMP');

      const tiendaC = await tiendaDe('tiendac');
      const perfil = (await como('tiendaa').get(`/v1/tiendas/${tiendaC}`).expect(200))
        .body as PerfilTienda;
      const enPerfil = perfil.productos.find((p) => p.producto.slug === 'prueba-grafica-rtx-5060');
      expect(enPerfil?.variantes).toEqual({ perfil_memoria: null, empaque: 'CAJA', oc: true });

      const portada = await como('tiendaa').get('/v1/portada').expect(200);
      for (const tarjeta of portada.body.recien_publicado)
        expect(tarjeta).toHaveProperty('variantes');
    });

    it('«Para Intel» y «Para Ryzen» en Memoria RAM: las marcadas así y las de los dos', async () => {
      const slugs = async (perfil: 'intel' | 'ryzen') => {
        const respuesta = (
          await como('tiendaa').get(`/v1/buscar?categoria=ram&perfil=${perfil}`).expect(200)
        ).body as RespuestaBuscar;
        return respuesta.productos.map((p) => p.slug).sort();
      };
      expect(await slugs('intel')).toEqual([
        'prueba-ram-tres-ddr5-16-gb',
        'prueba-ram-uno-ddr4-16-gb',
      ]);
      expect(await slugs('ryzen')).toEqual([
        'prueba-ram-dos-ddr5-32-gb',
        'prueba-ram-tres-ddr5-16-gb',
      ]);
      // El visitante también filtra (no dice nada de precios).
      const visitante = (await http().get('/v1/buscar?categoria=ram&perfil=ryzen').expect(200))
        .body as RespuestaBuscar;
      expect(visitante.productos.map((p) => p.slug).sort()).toEqual([
        'prueba-ram-dos-ddr5-32-gb',
        'prueba-ram-tres-ddr5-16-gb',
      ]);
      await como('tiendaa').get('/v1/buscar?categoria=ram&perfil=amd').expect(400);
    });

    it('la plantilla trae «Perfil de memoria» en Memoria RAM y el importador la lee', async () => {
      const descarga = await descargar(
        http().get('/v1/equipo/catalogo/plantilla').set('Cookie', cookie('equipo')),
      ).expect(200);
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(descarga.body as unknown as ArrayBuffer);
      const hoja = libro.getWorksheet('Memoria RAM')!;
      const titulos = (hoja.getRow(1).values as unknown[]).slice(1).map(String);
      expect(titulos).toContain('Perfil de memoria');
      const columna = titulos.indexOf('Perfil de memoria');
      const fila = (modelo: string, codigo: string, perfil: string) => {
        const valores: string[] = titulos.map(() => '');
        valores[0] = 'Kingston';
        valores[1] = modelo;
        valores[3] = codigo;
        valores[titulos.indexOf('Tipo *')] = 'DDR5';
        valores[titulos.indexOf('Capacidad *')] = '16 GB';
        valores[columna] = perfil;
        return valores;
      };
      hoja.addRow(fila('Fury Expo PL', 'PL-EXPO-1', 'EXPO Ryzen'));
      hoja.addRow(fila('Fury Dos PL', 'PL-AMBOS-1', 'Los dos'));
      hoja.addRow(fila('Fury Nada PL', 'PL-NADA-1', ''));
      // Uno que ya está: con «Reemplazar fotos y datos», el perfil cambia.
      hoja.addRow(fila('Ram Dos DDR5 32 GB', 'PL-DOS-1', 'xmp'));
      await prisma.producto.update({ where: { id: expo }, data: { codigoParte: 'PL-DOS-1' } });

      // Con sus fotos: los productos nuevos las necesitan (se buscan por el código de parte).
      const zip = new JSZip();
      zip.file('plantilla_catalogo_paselibre.xlsx', Buffer.from(await libro.xlsx.writeBuffer()));
      const foto = await sharp({
        create: { width: 60, height: 60, channels: 3, background: '#006B47' },
      })
        .jpeg()
        .toBuffer();
      for (const codigo of ['PL-EXPO-1', 'PL-AMBOS-1', 'PL-NADA-1']) {
        zip.file(`fotos/${codigo}.jpg`, foto);
      }
      const revision = await http()
        .post('/v1/equipo/catalogo/importar')
        .set(CABECERAS)
        .set('Cookie', cookie('equipo'))
        .attach('archivo', await zip.generateAsync({ type: 'nodebuffer' }), {
          filename: 'ram.zip',
        })
        .expect(201);
      expect(revision.body).toMatchObject({ crear: 3, existentes: 1 });
      const yaEsta = revision.body.ya_estan.find(
        (fila: { codigo_parte: string | null }) => fila.codigo_parte === 'PL-DOS-1',
      );
      expect(yaEsta?.cambios).toEqual(
        expect.arrayContaining([
          {
            campo: 'Perfil de memoria',
            antes: 'sin perfil',
            despues: expect.stringContaining('Intel XMP'),
          },
        ]),
      );
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(CABECERAS)
        .set('Cookie', cookie('equipo'))
        .send({ existentes: 'FOTOS_Y_DATOS' })
        .expect(201);
      const perfiles = await prisma.producto.findMany({
        where: { codigoParte: { in: ['PL-EXPO-1', 'PL-AMBOS-1', 'PL-NADA-1', 'PL-DOS-1'] } },
        select: { codigoParte: true, perfilMemoria: true, caracteristicas: true },
        orderBy: { codigoParte: 'asc' },
      });
      expect(perfiles).toEqual([
        expect.objectContaining({ codigoParte: 'PL-AMBOS-1', perfilMemoria: 'AMBOS' }),
        expect.objectContaining({ codigoParte: 'PL-DOS-1', perfilMemoria: 'XMP' }),
        expect.objectContaining({ codigoParte: 'PL-EXPO-1', perfilMemoria: 'EXPO' }),
        expect.objectContaining({ codigoParte: 'PL-NADA-1', perfilMemoria: null }),
      ]);
      // No queda repetido como característica.
      for (const fila of perfiles) {
        expect(fila.caracteristicas).not.toHaveProperty('Perfil de memoria');
      }
    });
  });

  // ── 20 · Ajustar el logo y zoom en la portada ──────────────────────────────

  describe('«Ajustar logo» y la portada (punto 20)', () => {
    /** Mitad izquierda roja y mitad derecha azul: se ve qué parte quedó en el círculo. */
    const dosColores = (ancho: number, alto: number) =>
      sharp({ create: { width: ancho, height: alto, channels: 3, background: '#0000ff' } })
        .composite([
          {
            input: {
              create: { width: ancho / 2, height: alto, channels: 3, background: '#ff0000' },
            },
            left: 0,
            top: 0,
          },
        ])
        .png()
        .toBuffer();

    /** El color de un píxel del logo guardado. */
    async function pixel(ruta: string, x: number, y: number) {
      const { data, info } = await sharp(join(CARPETA_MEDIA_PRUEBAS, ruta))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const i = (y * info.width + x) * 4;
      return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
    }

    let original = '';
    let primero: RespuestaLogo;

    it('arma el logo de 512 × 512 con la original y el ajuste, y lo deja puesto', async () => {
      original = (
        await como('tiendae')
          .subir(await dosColores(800, 400))
          .expect(201)
      ).body.ruta as string;
      const ajuste = { x: 0.25, y: 0.5, zoom: 2, rotacion: 0, fondo: '#FFFFFF' };
      const respuesta = await como('tiendae')
        .send('put', '/v1/cuenta/logo', { ruta: original, ajuste })
        .expect(200);
      primero = respuesta.body as RespuestaLogo;
      expect(primero).toEqual({
        logo: expect.stringMatching(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/),
        original,
        ajuste: { ...ajuste, fondo: '#ffffff' },
      });
      expect(primero.logo).not.toBe(original);
      const medidas = await sharp(join(CARPETA_MEDIA_PRUEBAS, primero.logo)).metadata();
      expect(medidas).toMatchObject({ width: 512, height: 512, format: 'webp' });
      // Zoom 2 sobre la mitad roja: todo rojo.
      expect(await pixel(primero.logo, 256, 256)).toMatchObject({ r: 255, b: 0 });
      expect(await pixel(primero.logo, 10, 10)).toMatchObject({ r: 255, b: 0 });

      // Lo ven la sesión, la cuenta y el perfil.
      expect((await como('tiendae').get('/v1/yo')).body.tienda.logo).toBe(primero.logo);
      const cuenta = (await como('tiendae').get('/v1/cuenta').expect(200)).body as RespuestaCuenta;
      expect(cuenta.tienda).toMatchObject({
        logo: primero.logo,
        logo_original: original,
        logo_ajuste: primero.ajuste,
      });
      const perfil = (await como('tiendaa').get(`/v1/tiendas/${await tiendaDe('tiendae')}`))
        .body as PerfilTienda;
      expect(perfil.logo).toBe(primero.logo);
    });

    it('«Ajustar» reacomoda la original sin volver a subirla y borra el armado de antes', async () => {
      // «Que entre entero» con fondo negro: la imagen completa, y las esquinas del fondo.
      const ajuste = { x: 0.5, y: 0.5, zoom: 0.45, rotacion: 90, fondo: '#000000' };
      const segundo = (await como('tiendae').send('put', '/v1/cuenta/logo', { ajuste }).expect(200))
        .body as RespuestaLogo;
      expect(segundo.original).toBe(original);
      expect(segundo.logo).not.toBe(primero.logo);
      expect(await pixel(segundo.logo, 2, 2)).toMatchObject({ r: 0, g: 0, b: 0, a: 255 });
      // Girada 90°: la mitad roja (izquierda) queda arriba.
      expect(await pixel(segundo.logo, 256, 200)).toMatchObject({ r: 255, b: 0 });
      expect(await pixel(segundo.logo, 256, 312)).toMatchObject({ r: 0, b: 255 });
      expect(await prisma.archivo.count({ where: { ruta: primero.logo } })).toBe(0);
      expect(await prisma.archivo.count({ where: { ruta: original } })).toBe(1);

      // Transparente: lo de afuera queda sin color.
      const transparente = (
        await como('tiendae')
          .send('put', '/v1/cuenta/logo', {
            ajuste: { ...ajuste, fondo: 'transparente' },
          })
          .expect(200)
      ).body as RespuestaLogo;
      expect((await pixel(transparente.logo, 2, 2)).a).toBe(0);
    });

    it('no deja usar una foto ajena ni un ajuste raro; el equipo no tiene logo', async () => {
      const ajena = (
        await como('tiendab')
          .subir(await dosColores(200, 200))
          .expect(201)
      ).body.ruta as string;
      const ajuste = { x: 0.5, y: 0.5, zoom: 1, rotacion: 0, fondo: '#ffffff' };
      await como('tiendae').send('put', '/v1/cuenta/logo', { ruta: ajena, ajuste }).expect(400);
      // La original que ya tiene sí: no se vuelve a reclamar.
      await como('tiendae').send('put', '/v1/cuenta/logo', { ruta: original, ajuste }).expect(200);
      for (const raro of [
        { ...ajuste, zoom: 5 },
        { ...ajuste, rotacion: 45 },
        { ...ajuste, fondo: 'rojo' },
        { ...ajuste, x: 3 },
      ]) {
        await como('tiendae').send('put', '/v1/cuenta/logo', { ajuste: raro }).expect(400);
      }
      // Sin logo ni imagen nueva no hay qué ajustar.
      await como('tiendab').send('put', '/v1/cuenta/logo', { ajuste }).expect(400);
      await como('equipo').send('put', '/v1/cuenta/logo', { ajuste }).expect(403);
    });

    it('un logo puesto sin ajustar (o quitado) no deja original ni ajuste aparte', async () => {
      const cuenta = (
        await como('tiendae')
          .send('patch', '/v1/cuenta', { tienda: { logo: null } })
          .expect(200)
      ).body as RespuestaCuenta;
      expect(cuenta.tienda).toMatchObject({ logo: null, logo_original: null, logo_ajuste: null });
      const tienda = await prisma.tienda.findUniqueOrThrow({
        where: { id: await tiendaDe('tiendae') },
      });
      expect(tienda).toMatchObject({ logo: null, logoOriginal: null, logoAjuste: null });
    });

    it('la portada se guarda de hasta 2400 px; las demás fotos, de 1600', async () => {
      const grande = await sharp({
        create: { width: 3000, height: 750, channels: 3, background: '#14123A' },
      })
        .png()
        .toBuffer();
      const portada = (await como('tiendae').subir(grande, '/v1/archivos?para=portada').expect(201))
        .body;
      expect(portada).toMatchObject({ ancho: 2400, alto: 600 });
      const foto = (await como('tiendae').subir(grande).expect(201)).body;
      expect(foto).toMatchObject({ ancho: 1600, alto: 400 });
      await como('tiendae').subir(grande, '/v1/archivos?para=logo').expect(400);

      const puesta = await como('tiendae')
        .send('put', '/v1/cuenta/portada', { ruta: portada.ruta })
        .expect(200);
      expect(puesta.body).toMatchObject({ ancho: 2400, zoom: 1, x: 50, posicion: 50 });
    });

    it('«Acomodar» guarda el zoom y la parte que se ve a lo ancho', async () => {
      const acomodada = await como('tiendae')
        .send('put', '/v1/cuenta/portada', {
          zoom: 2.456,
          x: 30,
          posicion: 70,
        })
        .expect(200);
      expect(acomodada.body).toMatchObject({ zoom: 2.46, x: 30, posicion: 70 });
      const perfil = (await como('tiendaa').get(`/v1/tiendas/${await tiendaDe('tiendae')}`))
        .body as PerfilTienda;
      expect(perfil.portada).toMatchObject({ zoom: 2.46, x: 30, posicion: 70 });
      for (const raro of [{ zoom: 0.5 }, { zoom: 4.5 }, { x: 101 }, { x: 10.5 }]) {
        await como('tiendae').send('put', '/v1/cuenta/portada', raro).expect(400);
      }
      // Quitarla vuelve todo a como estaba.
      await como('tiendae').send('delete', '/v1/cuenta/portada').expect(204);
      const tienda = await prisma.tienda.findUniqueOrThrow({
        where: { id: await tiendaDe('tiendae') },
      });
      expect(tienda).toMatchObject({ portadaRuta: null, portadaZoom: 1, portadaX: 50 });
    });
  });
});
