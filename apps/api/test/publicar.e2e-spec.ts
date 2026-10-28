import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type {
  ArchivoSubido,
  OfertaPropia,
  RespuestaMisOfertas,
  RespuestaPublicar,
  RespuestaSugerencias,
} from '@paselibre/contracts';
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

const SLUG_VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';
const SLUG_GIGABYTE = 'gigabyte-geforce-rtx-3070-gaming-oc-8-gb';
const SLUG_REDRAGON = 'redragon-kumara-k-552-rgb';

/** Una foto JPEG de prueba, con un dato EXIF que no debe sobrevivir a la subida. */
function fotoJpeg(ancho = 64, alto = 48): Promise<Buffer> {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: '#C8F03C' } })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: 'ubicacion-secreta' } })
    .toBuffer();
}

describe('Publicar, fotos y Mis publicaciones (RF-05 a RF-10, RF-53)', () => {
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
    delete: (ruta: string) =>
      http()
        .delete(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? ''),
    subir: (foto: Buffer, nombre = 'foto.jpg', tipo = 'image/jpeg') =>
      http()
        .post('/v1/archivos')
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .attach('foto', foto, { filename: nombre, contentType: tipo }),
  });

  const idDe = async (slug: string) =>
    (await prisma.producto.findUniqueOrThrow({ where: { slug } })).id;

  beforeAll(async () => {
    await rm(CARPETA_MEDIA_PRUEBAS, { recursive: true, force: true });
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'equipo']) {
      const respuesta = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200);
      cookies[usuario] = cookieDe(respuesta);
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('permisos', () => {
    it('sin sesión no se publica, no se sube ni se ve Mis publicaciones', async () => {
      await http().post('/v1/ofertas').set(CABECERAS).send({}).expect(401);
      await http().get('/v1/mis-ofertas').expect(401);
      await http().get('/v1/catalogo/sugerencias?q=rtx').expect(401);
      // Sin foto adjunta: la API corta en 401 antes de leer el cuerpo, y si supertest
      // siguiera enviando el archivo a una conexión cerrada fallaría al azar (EPIPE).
      await http().post('/v1/archivos').set(CABECERAS).expect(401);
    });

    it('el equipo no publica: no tiene tienda', async () => {
      const respuesta = await como('equipo').get('/v1/mis-ofertas').expect(403);
      expect(respuesta.body.error.codigo).toBe('PROHIBIDO');
    });
  });

  describe('«Ya está en PaseLibre»', () => {
    it('sugiere los productos que coinciden y marca los que la tienda ya publicó', async () => {
      const respuesta = await como('tiendaa')
        .get('/v1/catalogo/sugerencias?q=rtx 3070')
        .expect(200);
      const { productos } = respuesta.body as RespuestaSugerencias;
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(productos.length).toBeGreaterThanOrEqual(4);
      const ventus = productos.find((p) => p.slug === SLUG_VENTUS);
      expect(ventus).toMatchObject({
        titulo: 'MSI GeForce RTX 3070 Ventus 3X OC 8 GB',
        categoria: { slug: 'graficas', nombre: 'Gráficas' },
        marca: 'MSI',
        ofertas: 4,
        propias: [{ condicion: 'USADO', estado: 'ACTIVA' }],
      });
      // El más ofrecido va primero.
      expect(productos[0]?.slug).toBe(SLUG_VENTUS);
    });

    it('tolera errores de tipeo igual que la búsqueda', async () => {
      const respuesta = await como('tiendab')
        .get('/v1/catalogo/sugerencias?q=rtx 3370')
        .expect(200);
      const cuerpo = respuesta.body as RespuestaSugerencias;
      expect(cuerpo.correccion).toEqual({ buscaste: 'rtx 3370', mostramos: 'rtx 3070' });
      expect(cuerpo.productos.map((p) => p.slug)).toContain(SLUG_VENTUS);
    });

    it('trae un solo producto para «Publicar uno igual» desde la ficha', async () => {
      const respuesta = await como('tiendab')
        .get(`/v1/catalogo/sugerencias?producto=${SLUG_GIGABYTE}`)
        .expect(200);
      expect(respuesta.body.productos).toHaveLength(1);
      expect(respuesta.body.productos[0]).toMatchObject({ slug: SLUG_GIGABYTE, propias: [] });
      await como('tiendab').get('/v1/catalogo/sugerencias?producto=no-existe').expect(404);
    });
  });

  describe('fotos (RNF-20)', () => {
    it('guarda la foto en WebP, sin EXIF y reducida', async () => {
      const respuesta = await como('tiendac')
        .subir(await fotoJpeg(3000, 2000))
        .expect(201);
      const foto = respuesta.body as ArchivoSubido;
      expect(foto.ruta).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/);
      expect(foto).toMatchObject({ ancho: 1600, alto: 1067 });

      const archivo = join(CARPETA_MEDIA_PRUEBAS, foto.ruta);
      const meta = await sharp(archivo).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();

      const servida = await http().get(`/media/${foto.ruta}`).expect(200);
      expect(servida.headers['content-type']).toBe('image/webp');
      expect(servida.headers['cache-control']).toContain('immutable');
    });

    it('revisa el contenido y no la extensión', async () => {
      const texto = await como('tiendac')
        .subir(Buffer.from('no soy una foto'), 'foto.jpg', 'image/jpeg')
        .expect(400);
      expect(texto.body.error.mensaje).toBe('Sube una foto JPEG, PNG o WebP.');

      const gif = await sharp({
        create: { width: 8, height: 8, channels: 3, background: '#000' },
      })
        .gif()
        .toBuffer();
      await como('tiendac').subir(gif, 'foto.png', 'image/png').expect(400);

      const sinFoto = await como('tiendac').post('/v1/archivos').expect(400);
      expect(sinFoto.body.error.mensaje).toBe('Elige una foto para subir.');
    });

    it('rechaza fotos de más de 8 MB', async () => {
      const respuesta = await como('tiendac')
        .subir(Buffer.alloc(8 * 1024 * 1024 + 1), 'grande.jpg')
        .expect(413);
      expect(respuesta.body.error.codigo).toBe('DATOS_INVALIDOS');
    });

    it('cuenta 30 subidas por hora por persona', async () => {
      const kevin = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa.kevin' } });
      await prisma.archivo.createMany({
        data: Array.from({ length: 30 }, (_, i) => ({
          usuarioId: kevin.id,
          tiendaId: kevin.tiendaId,
          ruta: `relleno/${i}.webp`,
          ancho: 1,
          alto: 1,
          bytes: 1,
        })),
      });
      const respuesta = await como('tiendaa.kevin')
        .subir(await fotoJpeg())
        .expect(429);
      expect(respuesta.body.error.codigo).toBe('DEMASIADAS_SOLICITUDES');
      // El dueño, desde la misma IP, sigue pudiendo subir.
      await como('tiendaa')
        .subir(await fotoJpeg())
        .expect(201);
      await prisma.archivo.deleteMany({ where: { ruta: { startsWith: 'relleno/' } } });
    });
  });

  describe('publicar uno igual', () => {
    let publicada: RespuestaPublicar;

    it('crea la oferta con los valores por defecto de la tienda', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_GIGABYTE),
          condicion: 'USADO',
          stock: 2,
          precio: '255',
        })
        .expect(201);
      publicada = respuesta.body as RespuestaPublicar;
      expect(publicada).toMatchObject({
        producto_nuevo: false,
        otras_ofertas: 1,
        oferta: {
          condicion: 'USADO',
          stock: 2,
          estado: 'ACTIVA',
          moneda: 'USD',
          // La tienda tiene el precio oculto por defecto (D-37).
          precio_visible: false,
          precio: { moneda: 'USD', centimos: 25500 },
          revisar: false,
          responsable: { nombre: 'Carla V.' },
          producto: { slug: SLUG_GIGABYTE, categoria: { slug: 'graficas' } },
        },
      });
    });

    it('aparece en la ficha: con sesión al interno, para el visitante sin precio ni tienda', async () => {
      const vendedor = await como('tiendac').get(`/v1/productos/${SLUG_GIGABYTE}`).expect(200);
      const suya = vendedor.body.ofertas.find((o: { id: string }) => o.id === publicada.oferta.id);
      expect(suya).toMatchObject({ tienda: { nombre: 'Tienda B' }, precio: null });

      const visitante = await http().get(`/v1/productos/${SLUG_GIGABYTE}`).expect(200);
      const texto = JSON.stringify(visitante.body);
      expect(visitante.body.ofertas).toHaveLength(2);
      expect(texto).not.toContain('"precio');
      expect(texto).not.toContain('Tienda B');
    });

    it('no deja publicar dos veces el mismo producto y condición', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_GIGABYTE),
          condicion: 'USADO',
          stock: 1,
        })
        .expect(409);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'CONFLICTO',
        detalles: { oferta_id: publicada.oferta.id },
      });
      expect(respuesta.body.error.mensaje).toMatch(/ya publicó este producto como usado/);

      const pausada = await como('tiendaa')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_REDRAGON),
          condicion: 'USADO',
          stock: 1,
        })
        .expect(409);
      expect(pausada.body.error.mensaje).toMatch(/pausado\. Reactívalo/);
    });

    it('el asesor publica para su tienda y queda como responsable de los mensajes', async () => {
      const respuesta = await como('tiendaa.kevin')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_GIGABYTE),
          condicion: 'NUEVO',
          stock: 1,
          precio: '1,299.90',
          moneda: 'PEN',
          precio_visible: true,
          descripcion: '  Con caja y garantía de 6 meses.  ',
        })
        .expect(201);
      expect(respuesta.body.oferta).toMatchObject({
        precio: { moneda: 'PEN', centimos: 129990 },
        precio_visible: true,
        descripcion: 'Con caja y garantía de 6 meses.',
        responsable: { nombre: 'Kevin S.' },
      });
    });
  });

  describe('producto nuevo', () => {
    const NUEVO = {
      categoria: 'graficas',
      marca: 'Zotac',
      modelo: 'Gaming GeForce RTX 3070 AMP Holo 8 GB',
      etiquetas: ['NVIDIA', 'RTX 3070', 'rtx-3070', '8 GB', 'Holo'],
    };
    let fotoProducto: ArchivoSubido;
    let fotoOferta: ArchivoSubido;

    it('crea el producto con sus fotos y la oferta en un solo paso', async () => {
      fotoProducto = (
        await como('tiendac')
          .subir(await fotoJpeg())
          .expect(201)
      ).body;
      fotoOferta = (
        await como('tiendac')
          .subir(await fotoJpeg())
          .expect(201)
      ).body;

      const respuesta = await como('tiendac')
        .post('/v1/ofertas', {
          producto_nuevo: { ...NUEVO, fotos: [fotoProducto.ruta] },
          condicion: 'NUEVO',
          stock: 3,
          precio: '280',
          fotos: [fotoOferta.ruta],
        })
        .expect(201);
      const cuerpo = respuesta.body as RespuestaPublicar;
      expect(cuerpo).toMatchObject({
        producto_nuevo: true,
        otras_ofertas: 0,
        oferta: {
          producto: {
            titulo: 'Zotac Gaming GeForce RTX 3070 AMP Holo 8 GB',
            slug: 'zotac-gaming-geforce-rtx-3070-amp-holo-8-gb',
            marca: 'Zotac',
            foto: fotoProducto.ruta,
            fotos: 1,
          },
          fotos: [{ ruta: fotoOferta.ruta, ancho: 64, alto: 48 }],
        },
      });

      const producto = await prisma.producto.findUniqueOrThrow({
        where: { slug: 'zotac-gaming-geforce-rtx-3070-amp-holo-8-gb' },
        include: { etiquetas: true, creadoPorTienda: true },
      });
      // Queda para que el equipo revise si estaba repetido (RF-54).
      expect(producto.revisado).toBe(false);
      expect(producto.creadoPorTienda?.nombre).toBe('Tienda C');
      // «RTX 3070» y «rtx-3070» son la misma etiqueta (RNF-26).
      expect(producto.etiquetas).toHaveLength(4);
      const usadas = await prisma.archivo.count({
        where: { ruta: { in: [fotoProducto.ruta, fotoOferta.ruta] }, usadoEn: { not: null } },
      });
      expect(usadas).toBe(2);
    });

    it('se encuentra en la búsqueda, también con errores de tipeo', async () => {
      const buscar = await http().get('/v1/buscar?q=amp holo').expect(200);
      expect(buscar.body.productos.map((p: { slug: string }) => p.slug)).toEqual([
        'zotac-gaming-geforce-rtx-3070-amp-holo-8-gb',
      ]);
      const corregida = await http().get('/v1/buscar?q=hollo').expect(200);
      expect(corregida.body.correccion?.mostramos).toBe('holo');
    });

    it('si ya existe, avisa y ofrece publicar uno igual', async () => {
      const respuesta = await como('tiendab')
        .post('/v1/ofertas', {
          producto_nuevo: { ...NUEVO, marca: 'zotac', modelo: `Zotac ${NUEVO.modelo}` },
          condicion: 'USADO',
          stock: 1,
        })
        .expect(409);
      expect(respuesta.body.error).toMatchObject({
        codigo: 'CONFLICTO',
        detalles: { producto: { slug: 'zotac-gaming-geforce-rtx-3070-amp-holo-8-gb' } },
      });
    });

    it('una marca nueva entra al catálogo de marcas', async () => {
      await como('tiendab')
        .post('/v1/ofertas', {
          producto_nuevo: { categoria: 'cases', marca: 'Lian Li', modelo: 'O11 Dynamic EVO' },
          condicion: 'NUEVO',
          stock: 2,
        })
        .expect(201);
      expect(await prisma.marca.findUnique({ where: { nombre: 'lian li' } })).not.toBeNull();
    });

    it('no acepta fotos ajenas ni ya usadas', async () => {
      const deOtraTienda = (
        await como('tiendac')
          .subir(await fotoJpeg())
          .expect(201)
      ).body;
      const ajena = await como('tiendab')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_VENTUS),
          condicion: 'NUEVO',
          stock: 1,
          fotos: [deOtraTienda.ruta],
        })
        .expect(400);
      expect(ajena.body.error.mensaje).toBe('Una de las fotos no es válida; súbela de nuevo.');

      await como('tiendac')
        .post('/v1/ofertas', {
          producto_id: await idDe(SLUG_VENTUS),
          condicion: 'USADO',
          stock: 1,
          fotos: [fotoOferta.ruta],
        })
        .expect(400);
      // Nada quedó a medias: la oferta no se creó.
      const ofertas = await prisma.oferta.count({
        where: {
          producto: { slug: SLUG_VENTUS },
          tienda: { nombre: 'Tienda C' },
          condicion: 'USADO',
        },
      });
      expect(ofertas).toBe(0);
    });
  });

  describe('Mis publicaciones', () => {
    let lista: RespuestaMisOfertas;
    const buscarEn = (titulo: string) =>
      lista.ofertas.find((o) => o.producto.titulo.startsWith(titulo)) as OfertaPropia;

    it('cuenta por pestaña y avisa las que llevan más de 7 días', async () => {
      const respuesta = await como('tiendaa').get('/v1/mis-ofertas?estado=todas').expect(200);
      lista = respuesta.body as RespuestaMisOfertas;
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(lista.tienda).toMatchObject({
        nombre: 'Tienda A',
        galeria: 'Maxiplaza',
        stand: '212',
        precio_visible_defecto: false,
        moneda_defecto: 'USD',
      });
      // Las 6 de la semilla más la que publicó Kevin.
      expect(lista.conteos).toEqual({ activas: 5, sin_stock: 1, pausadas: 1, todas: 7 });
      expect(lista.por_revisar).toBe(2);
      expect(buscarEn('Intel Core i5')).toMatchObject({
        revisar: true,
        precio_visible: false,
        // La tienda ve su propio precio aunque esté al interno.
        precio: { moneda: 'USD', centimos: 16500 },
      });
      expect(buscarEn('Redragon')).toMatchObject({ estado: 'PAUSADA', revisar: false });
    });

    it('filtra por pestaña y por texto', async () => {
      const sinStock = await como('tiendaa').get('/v1/mis-ofertas?estado=sin_stock').expect(200);
      expect(sinStock.body.ofertas.map((o: OfertaPropia) => o.producto.titulo)).toEqual([
        'MSI GeForce RTX 3060 Ventus 2X 12 GB',
      ]);
      const texto = await como('tiendaa').get('/v1/mis-ofertas?estado=todas&q=ddr5').expect(200);
      expect(texto.body.ofertas).toHaveLength(1);
      // Los conteos de las pestañas no dependen del texto buscado.
      expect(texto.body.conteos.todas).toBe(7);
    });

    it('el asesor ve las mismas ofertas que el dueño', async () => {
      const kevin = await como('tiendaa.kevin').get('/v1/mis-ofertas?estado=todas').expect(200);
      expect(kevin.body.conteos).toEqual(lista.conteos);
    });

    it('cambiar el stock o el precio cuenta como actualización; pausar no', async () => {
      const i5 = buscarEn('Intel Core i5');
      const mas = await como('tiendaa').patch(`/v1/ofertas/${i5.id}`, { stock: 4 }).expect(200);
      expect(mas.body).toMatchObject({ stock: 4, revisar: false });
      expect(new Date(mas.body.actualizada_en).getTime()).toBeGreaterThan(
        new Date(i5.actualizada_en).getTime(),
      );

      const visible = await como('tiendaa')
        .patch(`/v1/ofertas/${i5.id}`, { precio_visible: true })
        .expect(200);
      expect(visible.body.precio_visible).toBe(true);

      const pausada = await como('tiendaa')
        .patch(`/v1/ofertas/${i5.id}`, { estado: 'PAUSADA' })
        .expect(200);
      expect(pausada.body.estado).toBe('PAUSADA');
      expect(pausada.body.actualizada_en).toBe(visible.body.actualizada_en);

      await como('tiendaa').patch(`/v1/ofertas/${i5.id}`, { estado: 'ACTIVA' }).expect(200);
    });

    it('sin monto no hay precio visible', async () => {
      const i5 = buscarEn('Intel Core i5');
      const sinMonto = await como('tiendaa')
        .patch(`/v1/ofertas/${i5.id}`, { precio: '' })
        .expect(200);
      expect(sinMonto.body).toMatchObject({ precio: null, precio_visible: false });
      const respuesta = await como('tiendaa')
        .patch(`/v1/ofertas/${i5.id}`, { precio_visible: true })
        .expect(400);
      expect(respuesta.body.error.mensaje).toBe('Para mostrar el precio, escribe el monto.');
    });

    it('cambia, ordena y quita las fotos propias', async () => {
      const kingston = buscarEn('Kingston');
      const [a, b] = await Promise.all([
        como('tiendaa').subir(await fotoJpeg(40, 30)),
        como('tiendaa').subir(await fotoJpeg(30, 40)),
      ]);
      const rutaA = (a.body as ArchivoSubido).ruta;
      const rutaB = (b.body as ArchivoSubido).ruta;
      await como('tiendaa')
        .patch(`/v1/ofertas/${kingston.id}`, { fotos: [rutaA, rutaB] })
        .expect(200);
      const reordenada = await como('tiendaa')
        .patch(`/v1/ofertas/${kingston.id}`, { fotos: [rutaB] })
        .expect(200);
      expect(reordenada.body.fotos).toEqual([{ ruta: rutaB, ancho: 30, alto: 40 }]);
      expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, rutaB))).toBe(true);
    });

    it('otra tienda no puede tocar ni ver la oferta', async () => {
      const i5 = buscarEn('Intel Core i5');
      await como('tiendab').get(`/v1/ofertas/${i5.id}`).expect(404);
      await como('tiendab').patch(`/v1/ofertas/${i5.id}`, { stock: 0 }).expect(404);
      await como('tiendab').delete(`/v1/ofertas/${i5.id}`).expect(404);
      await como('tiendaa').get(`/v1/ofertas/${i5.id}`).expect(200);
    });

    it('«Siguen igual» confirma las que piden revisión', async () => {
      const antes = await como('tiendaa').get('/v1/mis-ofertas').expect(200);
      expect(antes.body.por_revisar).toBe(1);
      const respuesta = await como('tiendaa').post('/v1/ofertas/confirmar', {}).expect(200);
      expect(respuesta.body).toEqual({ confirmadas: 1 });
      const despues = await como('tiendaa').get('/v1/mis-ofertas').expect(200);
      expect(despues.body.por_revisar).toBe(0);
    });

    it('eliminar la saca del catálogo y deja publicarla de nuevo', async () => {
      const kingston = buscarEn('Kingston');
      await como('tiendaa').delete(`/v1/ofertas/${kingston.id}`).expect(204);
      await como('tiendaa').get(`/v1/ofertas/${kingston.id}`).expect(404);

      const ficha = await como('tiendab')
        .get(`/v1/productos/${kingston.producto.slug}`)
        .expect(200);
      expect(ficha.body.ofertas.map((o: { id: string }) => o.id)).not.toContain(kingston.id);

      await como('tiendaa')
        .post('/v1/ofertas', { producto_id: kingston.producto.id, condicion: 'NUEVO', stock: 6 })
        .expect(201);
      const eliminada = await prisma.oferta.findUniqueOrThrow({ where: { id: kingston.id } });
      expect(eliminada).toMatchObject({ estado: 'ELIMINADA', vigente: null });
    });
  });
});
