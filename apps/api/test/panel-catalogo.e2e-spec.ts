import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import JSZip from 'jszip';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Panel del lienzo final: modo oscuro (COR18), Catálogo (COR15) y Destacar en silencio (COR16). */
describe('Panel: modo oscuro, Catálogo y Destacar (COR15 a COR18)', () => {
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
  const equipo = async () => ({ ...CABECERAS, Cookie: await como('equipo') });

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

  it('el modo oscuro se guarda en la cuenta y sale en /yo', async () => {
    const cabeceras = await equipo();
    await http()
      .put('/v1/equipo/preferencias')
      .set(cabeceras)
      .send({ tema_oscuro: true })
      .expect(200, { tema_oscuro: true });
    const yo = await http().get('/v1/yo').set(cabeceras).expect(200);
    expect(yo.body.usuario.tema_oscuro).toBe(true);
    await http()
      .put('/v1/equipo/preferencias')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ tema_oscuro: true })
      .expect(403);
  });

  describe('Catálogo', () => {
    it('agrega un producto con sus versiones y lo encuentra aunque esté mal escrito', async () => {
      const cabeceras = await equipo();
      const { body } = await http()
        .post('/v1/equipo/catalogo')
        .set(cabeceras)
        .send({
          categoria: 'graficas',
          marca: 'ASUS',
          modelo: 'TUF Gaming RTX 5070',
          versiones: [
            { nombre: 'OC', codigo_parte: 'TUF-RTX5070-O12G-GAMING' },
            { nombre: 'Normal', codigo_parte: 'TUF-RTX5070-12G-GAMING' },
          ],
          caracteristicas: { Chip: 'RTX 5070', Memoria: '12 GB' },
          sinonimos: ['5070 tuf'],
        })
        .expect(201);
      expect(body).toEqual({ creados: 2 });

      const lista = await http()
        .get('/v1/equipo/catalogo?q=asus%20tuf%20gamng%205070')
        .set(cabeceras)
        .expect(200);
      const titulos = lista.body.productos.map((p: { titulo: string }) => p.titulo);
      expect(titulos).toEqual(
        expect.arrayContaining(['ASUS TUF Gaming RTX 5070 OC', 'ASUS TUF Gaming RTX 5070 Normal']),
      );
      const oc = lista.body.productos.find((p: { version: string }) => p.version === 'OC');
      expect(oc).toMatchObject({
        codigo_parte: 'TUF-RTX5070-O12G-GAMING',
        caracteristicas: { Chip: 'RTX 5070', Memoria: '12 GB' },
        sinonimos: ['5070 tuf'],
        tiendas: 0,
      });

      // El mismo código no se repite.
      await http()
        .post('/v1/equipo/catalogo')
        .set(cabeceras)
        .send({
          categoria: 'graficas',
          marca: 'Asus',
          modelo: 'TUF RTX 5070 OC',
          codigo_parte: 'tuf-rtx5070-o12g-gaming',
        })
        .expect(409);
    });

    it('lo publicado a mano queda por revisar: «¿Es este?» y unir con el del catálogo', async () => {
      const cabeceras = await equipo();
      // Tienda B publica a mano algo que ya está, con otro nombre pero el mismo código.
      const publicado = await http()
        .post('/v1/ofertas')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({
          producto_nuevo: {
            categoria: 'graficas',
            marca: 'Asus',
            modelo: 'Tuf 5070 OC doce gigas',
          },
          estado_detalle: 'SELLADO',
          stock: 1,
          precio: '2450',
        })
        .expect(201);
      const nuevo = await prisma.producto.findFirstOrThrow({
        where: { ofertas: { some: { id: publicado.body.oferta.id } } },
      });
      await prisma.producto.update({
        where: { id: nuevo.id },
        data: { codigoParte: 'tuf-rtx5070-o12g-gaming-x' },
      });

      const inicio = await http().get('/v1/equipo/inicio').set(cabeceras).expect(200);
      expect(inicio.body.catalogo_por_revisar).toBeGreaterThanOrEqual(1);

      const { body } = await http()
        .get('/v1/equipo/catalogo/por-revisar')
        .set(cabeceras)
        .expect(200);
      const fila = body.productos.find((p: { id: string }) => p.id === nuevo.id);
      expect(fila).toMatchObject({ tienda: 'Tienda B' });

      const destino = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'TUF-RTX5070-O12G-GAMING' },
      });
      await http()
        .post(`/v1/equipo/catalogo/${nuevo.id}/unir`)
        .set(cabeceras)
        .send({ con: destino.id })
        .expect(204);
      const oferta = await prisma.oferta.findUniqueOrThrow({
        where: { id: publicado.body.oferta.id },
      });
      expect(oferta.productoId).toBe(destino.id);
      const unido = await prisma.producto.findUniqueOrThrow({ where: { id: nuevo.id } });
      expect(unido).toMatchObject({ fusionadoEnId: destino.id, revisado: true });
    });

    it('corregir y agregar lo da por revisado', async () => {
      const cabeceras = await equipo();
      const publicado = await http()
        .post('/v1/ofertas')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({
          producto_nuevo: { categoria: 'ram', marca: 'Kingston', modelo: 'fury 32gb ddr5 6000' },
          estado_detalle: 'SELLADO',
          stock: 1,
          precio: '450',
        })
        .expect(201);
      const producto = await prisma.producto.findFirstOrThrow({
        where: { ofertas: { some: { id: publicado.body.oferta.id } } },
      });
      await http()
        .patch(`/v1/equipo/catalogo/${producto.id}`)
        .set(cabeceras)
        .send({ modelo: 'Fury Beast DDR5 32 GB 6000', codigo_parte: 'KF560C36BBEK2-32' })
        .expect(204);
      expect(await prisma.producto.findUniqueOrThrow({ where: { id: producto.id } })).toMatchObject(
        {
          titulo: 'Kingston Fury Beast DDR5 32 GB 6000',
          codigoParte: 'KF560C36BBEK2-32',
          revisado: true,
        },
      );
    });

    it('un .csv se revisa antes de guardar: crea los completos y omite los que ya están', async () => {
      const cabeceras = await equipo();
      const csv = [
        'categoria;marca;modelo;version;codigo_parte;chip;sinonimos',
        'graficas;MSI;RTX 5060 Ti Ventus 2X 16 GB;;V531-002R;RTX 5060 Ti;5060 ti msi',
        'Tarjetas de video;Gigabyte;RTX 4060 Eagle;OC 8 GB;GV-N4060EAGLE OC-8GD;RTX 4060;',
        'graficas;ASUS;TUF Gaming RTX 5070;OC;TUF-RTX5070-O12G-GAMING;RTX 5070;',
        'graficas;MSI;RTX 5060 8 GB;;;RTX 5060;',
        'cases;Corsair;4000D;;;;',
      ].join('\n');
      const revision = await http()
        .post('/v1/equipo/catalogo/importar')
        .set(cabeceras)
        .attach('archivo', Buffer.from(csv, 'utf8'), {
          filename: 'catalogo.csv',
          contentType: 'text/csv',
        })
        .expect(201);
      expect(revision.body).toMatchObject({
        nombre: 'catalogo.csv',
        filas_leidas: 5,
        crear: 2,
        existentes: 1,
      });
      expect(revision.body.incompletas).toEqual([
        { fila: 5, producto: 'MSI RTX 5060 8 GB', falta: 'Código de parte' },
        { fila: 6, producto: 'Corsair 4000D', falta: 'Código de parte' },
      ]);
      expect(await prisma.producto.count({ where: { codigoParte: 'V531-002R' } })).toBe(0);

      const creados = await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(cabeceras)
        .expect(201);
      expect(creados.body).toEqual({ creados: 2 });
      expect(
        await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'V531-002R' } }),
      ).toMatchObject({ titulo: 'MSI RTX 5060 Ti Ventus 2X 16 GB', revisado: true });
      // Confirmar dos veces no crea de nuevo.
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(cabeceras)
        .expect(201, { creados: 2 });
    });

    it('un .zip trae el Excel y la carpeta fotos/ con el código de parte', async () => {
      const cabeceras = await equipo();
      const zip = new JSZip();
      zip.file(
        'catalogo.csv',
        [
          'categoria,marca,modelo,codigo_parte',
          'procesadores,AMD,Ryzen 7 7800X3D,100-100000910WOF',
          'procesadores,AMD,Ryzen 5 7600,100-100001015BOX',
        ].join('\n'),
      );
      const foto = await sharp({
        create: { width: 80, height: 60, channels: 3, background: '#FF8A00' },
      })
        .jpeg()
        .toBuffer();
      zip.file('fotos/100-100000910WOF.jpg', foto);
      const revision = await http()
        .post('/v1/equipo/catalogo/importar')
        .set(cabeceras)
        .attach('archivo', await zip.generateAsync({ type: 'nodebuffer' }), {
          filename: 'catalogo-noviembre.zip',
          contentType: 'application/zip',
        })
        .expect(201);
      expect(revision.body).toMatchObject({ fotos_encontradas: 1, crear: 1 });
      expect(revision.body.incompletas).toEqual([
        { fila: 3, producto: 'AMD Ryzen 5 7600', falta: 'Foto (no está en fotos/)' },
      ]);
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(cabeceras)
        .expect(201, { creados: 1 });
      const ryzen = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: '100-100000910WOF' },
        include: { fotos: true },
      });
      expect(ryzen.fotos).toHaveLength(1);
    });

    it('rechaza otros formatos y solo deja entrar al equipo', async () => {
      await http()
        .post('/v1/equipo/catalogo/importar')
        .set(await equipo())
        .attach('archivo', Buffer.from('hola'), { filename: 'nota.txt', contentType: 'text/plain' })
        .expect(400);
      await http()
        .get('/v1/equipo/catalogo')
        .set('Cookie', await como('tiendaa'))
        .expect(403);
    });
  });

  describe('Destacar en silencio', () => {
    it('destaca, avisa a la tienda, la sube en el inicio y la marca solo para ella', async () => {
      const cabeceras = await equipo();
      const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
      const detalle = await http()
        .get(`/v1/equipo/panel/tiendas/${tiendaA.id}`)
        .set(cabeceras)
        .expect(200);
      expect(detalle.body.destacado).toBeNull();
      const elegida = detalle.body.para_destacar[0].oferta_id as string;

      const { body } = await http()
        .post(`/v1/equipo/panel/tiendas/${tiendaA.id}/destacar`)
        .set(cabeceras)
        .send({ duracion: '1h', ofertas: [elegida], avisar: true })
        .expect(201);
      expect(body).toMatchObject({
        tienda: { nombre: 'Tienda A' },
        publicaciones: 1,
        todas: false,
      });

      const aviso = await prisma.aviso.findFirst({
        where: { usuario: { usuario: 'tiendaa' }, titulo: { contains: 'empujoncito' } },
      });
      expect(aviso).not.toBeNull();

      // Otra tienda la ve entre los 4 primeros del inicio, sin etiqueta.
      const portada = await http()
        .get('/v1/portada')
        .set('Cookie', await como('tiendab'))
        .expect(200);
      const ids = portada.body.recien_publicado
        .slice(0, 4)
        .map((t: { oferta_id: string }) => t.oferta_id);
      expect(ids).toContain(elegida);
      expect(JSON.stringify(portada.body)).not.toMatch(/destacad|impulsad/i);

      // La tienda la ve «Impulsada por el equipo» en Mis publicaciones.
      const mias = await http()
        .get('/v1/mis-ofertas?estado=todas')
        .set('Cookie', await como('tiendaa'))
        .expect(200);
      const marcada = mias.body.ofertas.find((o: { id: string }) => o.id === elegida);
      expect(marcada.impulsada_hasta).toBe(body.hasta);

      const inicio = await http().get('/v1/equipo/inicio').set(cabeceras).expect(200);
      expect(inicio.body.destacadas).toMatchObject({ activas: 1, maximo: 3 });

      await http().delete(`/v1/equipo/destacados/${body.id}`).set(cabeceras).expect(204);
      const despues = await http().get('/v1/equipo/destacados').set(cabeceras).expect(200);
      expect(despues.body.activas).toHaveLength(0);
    });

    it('hasta 3 tiendas a la vez', async () => {
      const cabeceras = await equipo();
      const tiendas = await prisma.tienda.findMany({
        where: { nombre: { in: ['Tienda A', 'Tienda B', 'Tienda C', 'Tienda D'] } },
        orderBy: { nombre: 'asc' },
      });
      for (const tienda of tiendas.slice(0, 3)) {
        await http()
          .post(`/v1/equipo/panel/tiendas/${tienda.id}/destacar`)
          .set(cabeceras)
          .send({ duracion: '3h', avisar: false })
          .expect(201);
      }
      await http()
        .post(`/v1/equipo/panel/tiendas/${tiendas[3]!.id}/destacar`)
        .set(cabeceras)
        .send({ duracion: 'dia', avisar: false })
        .expect(409);
    });
  });
});
