import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { slugDe, tituloDeProducto } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
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

/** Una foto distinta por color, para saber cuál quedó. */
const foto = (color: string) =>
  sharp({ create: { width: 60, height: 60, channels: 3, background: color } })
    .jpeg()
    .toBuffer();
const nombreDeFoto = (marca: string, modelo: string) =>
  `${slugDe(tituloDeProducto(marca, modelo))}.jpg`;
/** Como lo escribiría una persona: el nombre del producto tal cual. */
const nombreHumano = (marca: string, modelo: string) => `${tituloDeProducto(marca, modelo)}.JPG`;

/** docs/17: el ZIP que actualiza lo que ya está, editar con fotos y «Eliminar todos». */
describe('Catálogo: fotos, ZIP que actualiza y «Eliminar todos» (docs/17)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();

  async function como(usuario: string): Promise<Record<string, string>> {
    let cookie = cookies.get(usuario);
    if (!cookie) {
      const respuesta = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200);
      cookie = cookieDe(respuesta);
      cookies.set(usuario, cookie);
    }
    return { ...CABECERAS, Cookie: cookie };
  }

  async function subirZip(filas: string[], fotos: Record<string, Buffer>, nombre = 'cat.zip') {
    const zip = new JSZip();
    zip.file('catalogo.csv', ['categoria,marca,modelo,version,codigo_parte', ...filas].join('\n'));
    for (const [archivo, contenido] of Object.entries(fotos))
      zip.file(`fotos/${archivo}`, contenido);
    const respuesta = await http()
      .post('/v1/equipo/catalogo/importar')
      .set(await como('equipo'))
      .attach('archivo', await zip.generateAsync({ type: 'nodebuffer' }), {
        filename: nombre,
        contentType: 'application/zip',
      })
      .expect(201);
    return respuesta.body;
  }
  const guardar = async (id: string, cuerpo?: object) =>
    (
      await http()
        .post(`/v1/equipo/catalogo/importar/${id}/crear`)
        .set(await como('equipo'))
        .send(cuerpo ?? {})
        .expect(201)
    ).body;
  const fotosDe = (codigoParte: string) =>
    prisma.productoFoto.findMany({
      where: { producto: { codigoParte } },
      orderBy: { orden: 'asc' },
      select: { ruta: true },
    });

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

  describe('Subir el ZIP: qué hacer con lo que ya existe', () => {
    let rojaDeA = '';

    it('«por confirmar» no es un código: esas filas se crean y se emparejan por el nombre', async () => {
      const revision = await subirZip(
        [
          'graficas,MSI,RTX 5060 8G Gaming Trio,OC,ZP-5060-A',
          'fuentes,Antec,CX300 ARGB,,por confirmar',
          'fuentes,Antec,C3 Gold,,Por confirmar',
        ],
        {
          'ZP-5060-A.jpg': await foto('#FF0000'),
          [nombreDeFoto('Antec', 'CX300 ARGB')]: await foto('#00FF00'),
          [nombreHumano('Antec', 'C3 Gold')]: await foto('#0000FF'),
        },
      );
      expect(revision).toMatchObject({ crear: 3, existentes: 0, incompletas: [], parecidos: [] });
      expect(await guardar(revision.id)).toEqual({ creados: 3, actualizados: 0 });
      const antec = await prisma.producto.findMany({
        where: { titulo: { startsWith: 'Antec' } },
        include: { fotos: true },
      });
      expect(antec).toHaveLength(2);
      expect(antec.every((p) => p.codigoParte === null && p.fotos.length === 1)).toBe(true);
      rojaDeA = (await fotosDe('ZP-5060-A'))[0]!.ruta;
    });

    it('muestra qué cambia en cada uno y avisa de los parecidos con otro código', async () => {
      const revision = await subirZip(
        [
          // Mismo código: corrige el modelo.
          'graficas,MSI,RTX 5060 Ti 8G Gaming Trio,OC,ZP-5060-A',
          // Sin código en el catálogo: se empareja por el nombre y recibe su código.
          'fuentes,Antec,CX300 ARGB,,ZP-CX300',
          // Nuevo.
          'procesadores,AMD,Ryzen 5 5500,Box,ZP-R5-5500',
          // Mismo nombre que el MSI de antes, otro código: no se crea.
          'graficas,MSI,RTX 5060 8G Gaming Trio,OC,ZP-5060-B',
          // Repetida dentro del archivo.
          'procesadores,AMD,Ryzen 5 5500,Box,ZP-R5-5500',
        ],
        {
          'ZP-5060-A.jpg': await foto('#FFAA00'),
          'ZP-CX300.jpg': await foto('#00AAFF'),
          'ZP-R5-5500.jpg': await foto('#AA00FF'),
        },
      );
      expect(revision).toMatchObject({ crear: 1, existentes: 2 });
      expect(revision.incompletas).toEqual([
        {
          fila: 6,
          lugar: null,
          producto: 'AMD Ryzen 5 5500 Box',
          motivo: 'REPETIDA',
          texto: 'Código repetido: ya está en la fila 4',
          foto_buscada: null,
        },
      ]);
      expect(revision.motivos).toEqual({
        sin_foto: 0,
        sin_categoria: 0,
        sin_marca: 0,
        sin_modelo: 0,
        sinonimo_largo: 0,
        repetida: 1,
      });
      expect(revision.parecidos).toEqual([
        {
          fila: 5,
          lugar: null,
          producto: 'MSI RTX 5060 8G Gaming Trio OC',
          codigo_parte: 'ZP-5060-B',
          con: { titulo: 'MSI RTX 5060 8G Gaming Trio OC', codigo_parte: 'ZP-5060-A' },
        },
      ]);
      const [msi, antec] = revision.ya_estan;
      expect(msi).toMatchObject({
        fila: 2,
        titulo: 'MSI RTX 5060 8G Gaming Trio OC',
        foto_antes: rojaDeA,
        publicaciones: 0,
        cambios: [
          {
            campo: 'Modelo',
            antes: 'RTX 5060 8G Gaming Trio',
            despues: 'RTX 5060 Ti 8G Gaming Trio',
          },
        ],
      });
      expect(msi.foto_nueva).toEqual(expect.any(String));
      expect(antec.cambios).toEqual([
        { campo: 'Código de parte', antes: 'sin código', despues: 'ZP-CX300' },
      ]);

      // «Dejarlos como están»: solo se crean los nuevos.
      expect(await guardar(revision.id, { existentes: 'DEJAR' })).toEqual({
        creados: 1,
        actualizados: 0,
      });
      expect((await fotosDe('ZP-5060-A'))[0]!.ruta).toBe(rojaDeA);
    });

    it('«Reemplazar solo las fotos» cambia la foto y borra la vieja, no los datos', async () => {
      const revision = await subirZip(['graficas,MSI,RTX 5060 Ti 8G Gaming Trio,OC,ZP-5060-A'], {
        'ZP-5060-A.jpg': await foto('#123456'),
      });
      expect(await guardar(revision.id, { existentes: 'SOLO_FOTOS' })).toEqual({
        creados: 0,
        actualizados: 1,
      });
      const msi = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'ZP-5060-A' },
        include: { fotos: true },
      });
      expect(msi.titulo).toBe('MSI RTX 5060 8G Gaming Trio OC');
      expect(msi.fotos).toHaveLength(1);
      expect(msi.fotos[0]!.ruta).not.toBe(rojaDeA);
      // La vieja ya no está: ni el archivo ni su fila.
      expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, rojaDeA))).toBe(false);
      expect(await prisma.archivo.count({ where: { ruta: rojaDeA } })).toBe(0);
    });

    it('«Reemplazar fotos y datos» corrige todo, respeta lo desmarcado y no duplica al subir dos veces', async () => {
      const filas = [
        'graficas,MSI,RTX 5060 Ti 8G Gaming Trio,OC,ZP-5060-A',
        'fuentes,Antec,CX300 ARGB,,ZP-CX300',
        'procesadores,AMD,Ryzen 5 5500,Box (con disipador),ZP-R5-5500',
      ];
      const fotos = {
        'ZP-5060-A.jpg': await foto('#FFAA00'),
        'ZP-CX300.jpg': await foto('#00AAFF'),
        'ZP-R5-5500.jpg': await foto('#AA00FF'),
      };
      const antes = await prisma.producto.count();
      const slugDelMsi = (
        await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'ZP-5060-A' } })
      ).slug;

      const primera = await subirZip(filas, fotos);
      expect(primera).toMatchObject({ crear: 0, existentes: 3 });
      // El Ryzen se desmarca: no se toca.
      expect(await guardar(primera.id, { existentes: 'FOTOS_Y_DATOS', omitir: [4] })).toEqual({
        creados: 0,
        actualizados: 2,
      });
      const msi = await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'ZP-5060-A' } });
      expect(msi).toMatchObject({
        titulo: 'MSI RTX 5060 Ti 8G Gaming Trio OC',
        modelo: 'RTX 5060 Ti 8G Gaming Trio',
        // La dirección de la ficha no cambia.
        slug: slugDelMsi,
      });
      expect(
        await prisma.producto.findFirstOrThrow({ where: { titulo: 'Antec CX300 ARGB' } }),
      ).toMatchObject({ codigoParte: 'ZP-CX300' });
      expect(
        await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'ZP-R5-5500' } }),
      ).toMatchObject({ version: 'Box' });

      // La segunda vez, el mismo ZIP completo: nada nuevo, nada duplicado.
      const segunda = await subirZip(filas, fotos);
      expect(segunda).toMatchObject({ crear: 0, existentes: 3, parecidos: [], incompletas: [] });
      expect(await guardar(segunda.id, { existentes: 'FOTOS_Y_DATOS' })).toEqual({
        creados: 0,
        actualizados: 3,
      });
      expect(await prisma.producto.count()).toBe(antes);
      expect(
        await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'ZP-R5-5500' } }),
      ).toMatchObject({ version: 'Box (con disipador)' });
      for (const codigo of ['ZP-5060-A', 'ZP-CX300', 'ZP-R5-5500']) {
        expect(await fotosDe(codigo)).toHaveLength(1);
      }
      // Confirmar dos veces la misma revisión no hace nada más.
      expect(await guardar(segunda.id, { existentes: 'FOTOS_Y_DATOS' })).toEqual({
        creados: 0,
        actualizados: 3,
      });
      const registro = await prisma.registroEquipo.findFirstOrThrow({
        orderBy: { creadoEn: 'desc' },
      });
      expect(registro.accion).toBe('actualizó 3 productos del catálogo (cat.zip)');
    });

    it('sin cuerpo sigue funcionando como antes: deja los que ya están', async () => {
      const revision = await subirZip(['fuentes,Antec,CX300 ARGB,,ZP-CX300'], {});
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.id}/crear`)
        .set(await como('equipo'))
        .expect(201, { creados: 0, actualizados: 0 });
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.id}/crear`)
        .set(await como('equipo'))
        .send({ existentes: 'BORRAR' })
        .expect(400);
    });
  });

  describe('Editar: todo, incluidas las fotos y la portada', () => {
    it('cambia las fotos y la principal, cuenta las publicaciones y borra la que se quitó', async () => {
      const cabeceras = await como('equipo');
      const conOfertas = await prisma.producto.findFirstOrThrow({
        where: { ofertas: { some: { estado: 'ACTIVA' } }, fusionadoEnId: null },
        include: {
          fotos: { orderBy: { orden: 'asc' } },
          _count: { select: { ofertas: { where: { estado: { in: ['ACTIVA', 'PAUSADA'] } } } } },
        },
      });
      const lista = await http()
        .get(`/v1/equipo/catalogo?q=${encodeURIComponent(conOfertas.titulo)}`)
        .set(cabeceras)
        .expect(200);
      const enLista = lista.body.productos.find((p: { id: string }) => p.id === conOfertas.id);
      expect(enLista).toMatchObject({
        publicaciones: conOfertas._count.ofertas,
        rutas_fotos: conOfertas.fotos.map((f) => f.ruta),
      });
      expect(enLista.publicaciones).toBeGreaterThan(0);

      const subida = await http()
        .post('/v1/archivos')
        .set(cabeceras)
        .attach('foto', await foto('#445566'), { filename: 'nueva.jpg', contentType: 'image/jpeg' })
        .expect(201);
      const viejas = conOfertas.fotos.map((f) => f.ruta);
      await http()
        .patch(`/v1/equipo/catalogo/${conOfertas.id}`)
        .set(cabeceras)
        .send({ fotos: [subida.body.ruta, ...viejas.slice(1)] })
        .expect(204);
      const despues = await prisma.productoFoto.findMany({
        where: { productoId: conOfertas.id },
        orderBy: { orden: 'asc' },
      });
      expect(despues.map((f) => f.ruta)).toEqual([subida.body.ruta, ...viejas.slice(1)]);
      if (viejas[0]) {
        const sigueUsada = await prisma.ofertaFoto.count({ where: { ruta: viejas[0] } });
        if (!sigueUsada) expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, viejas[0]))).toBe(false);
      }
      const registro = await prisma.registroEquipo.findFirstOrThrow({
        orderBy: { creadoEn: 'desc' },
      });
      expect(registro.accion).toMatch(/y cambió sus fotos$/);

      // Una foto que no subió nadie del equipo no entra.
      await http()
        .patch(`/v1/equipo/catalogo/${conOfertas.id}`)
        .set(cabeceras)
        .send({ fotos: ['2026/11/00000000-0000-0000-0000-000000000000.webp'] })
        .expect(400);
    });
  });

  describe('Eliminar todos', () => {
    it('borra por tandas solo los que nadie usa, con sus fotos', async () => {
      const cabeceras = await como('equipo');
      await http()
        .get('/v1/equipo/catalogo/eliminar-todos')
        .set(await como('tiendaa'))
        .expect(403);

      // Uno que solo usa un pedido en vivo también se queda.
      const libre = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'ZP-CX300' },
        include: { fotos: true },
      });
      const busco = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'ZP-R5-5500' },
      });
      const tienda = await prisma.tienda.findFirstOrThrow({ include: { usuarios: { take: 1 } } });
      await prisma.enVivo.create({
        data: {
          tipo: 'BUSCO',
          autorId: tienda.usuarios[0]!.id,
          tiendaId: tienda.id,
          categoriaId: busco.categoriaId,
          productoId: busco.id,
          titulo: busco.titulo,
          venceEn: new Date(Date.now() + 3_600_000),
        },
      });

      const resumen = await http()
        .get('/v1/equipo/catalogo/eliminar-todos')
        .set(cabeceras)
        .expect(200);
      const conUso = await prisma.producto.count({
        where: {
          fusionadoEnId: null,
          OR: [{ ofertas: { some: {} } }, { enVivo: { some: {} } }, { fusionados: { some: {} } }],
        },
      });
      expect(resumen.body).toMatchObject({ se_quedan: conUso });
      expect(resumen.body.se_eliminan).toBeGreaterThan(2);

      let vueltas = 0;
      let quedan = resumen.body.se_eliminan as number;
      let eliminados = 0;
      while (quedan > 0 && vueltas < 50) {
        const tanda = await http()
          .post('/v1/equipo/catalogo/eliminar-todos')
          .set(cabeceras)
          .send({ tanda: 2 })
          .expect(201);
        expect(tanda.body.eliminados).toBeLessThanOrEqual(2);
        eliminados += tanda.body.eliminados;
        quedan = tanda.body.quedan;
        vueltas++;
      }
      expect(eliminados).toBe(resumen.body.se_eliminan);
      expect(await prisma.producto.count({ where: { fusionadoEnId: null } })).toBe(conUso);
      expect(await prisma.producto.count({ where: { id: busco.id } })).toBe(1);
      expect(await prisma.producto.count({ where: { id: libre.id } })).toBe(0);
      expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, libre.fotos[0]!.ruta))).toBe(false);
    });
  });
});
