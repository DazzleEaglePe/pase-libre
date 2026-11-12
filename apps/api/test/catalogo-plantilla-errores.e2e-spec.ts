import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const foto = (color: string) =>
  sharp({ create: { width: 60, height: 60, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

/** Las descargas de Excel llegan como `Buffer`. */
const descargar = (prueba: request.Test) =>
  prueba.buffer(true).parse((res, listo) => {
    const partes: Buffer[] = [];
    res.on('data', (parte: Buffer) => partes.push(parte));
    res.on('end', () => listo(null, Buffer.concat(partes)));
  });

async function abrir(contenido: Buffer): Promise<ExcelJS.Workbook> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido as unknown as ArrayBuffer);
  return libro;
}

const titulos = (hoja: ExcelJS.Worksheet) =>
  (hoja.getRow(1).values as unknown[]).slice(1).map((v) => String(v));

/** docs/18 §2 y §8: la plantilla en Excel, el Excel de varias pestañas y los motivos. */
describe('Catálogo: plantilla en Excel y filas que dicen qué pasa (docs/18)', () => {
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

  async function subir(contenido: Buffer, nombre: string) {
    return http()
      .post('/v1/equipo/catalogo/importar')
      .set(await como('equipo'))
      .attach('archivo', contenido, { filename: nombre });
  }

  async function plantilla(): Promise<Buffer> {
    const respuesta = await descargar(
      http()
        .get('/v1/equipo/catalogo/plantilla')
        .set(await como('equipo')),
    ).expect(200);
    return respuesta.body as Buffer;
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

  describe('«Descargar la plantilla»', () => {
    it('baja un .xlsx con «Cómo llenar» y una pestaña por categoría', async () => {
      const respuesta = await descargar(
        http()
          .get('/v1/equipo/catalogo/plantilla')
          .set(await como('equipo')),
      ).expect(200);
      expect(respuesta.headers['content-type']).toContain('spreadsheetml');
      expect(respuesta.headers['content-disposition']).toContain(
        'filename="plantilla_catalogo_paselibre.xlsx"',
      );
      const libro = await abrir(respuesta.body as Buffer);
      const categorias = await prisma.categoria.findMany({ orderBy: { orden: 'asc' } });
      const visibles = libro.worksheets.filter((h) => h.state === 'visible');
      expect(visibles.map((h) => h.name)).toEqual([
        'Cómo llenar',
        ...categorias.map((c) => c.nombre),
      ]);
      // Las marcas de la lista desplegable van en una pestaña escondida.
      expect(libro.getWorksheet('Listas')?.state).toBe('veryHidden');

      const ayuda = libro.getWorksheet('Cómo llenar')!;
      const textos = ayuda.getColumn(1).values.map((v) => String(v ?? ''));
      expect(textos.filter((t) => /^[1-5]\. /.test(t))).toHaveLength(5);
      expect(textos.join('\n')).toContain('Accesorios');

      const tarjetas = libro.getWorksheet('Tarjetas de video')!;
      expect(titulos(tarjetas)).toEqual([
        'Marca *',
        'Modelo *',
        'Serie / versión',
        'Código de parte',
        'Sinónimos',
        'VRAM (GB) *',
        'Tipo de memoria',
        'Bus',
        'Boost',
        'Foto *',
      ]);
      // Solo los títulos: el ejemplo va en «Cómo llenar».
      expect(tarjetas.actualRowCount).toBe(1);
      const relleno = (celda: ExcelJS.Cell) => (celda.fill as ExcelJS.FillPattern).fgColor?.argb;
      expect(relleno(tarjetas.getCell('A1'))).toBe('FF006B47');
      expect(relleno(tarjetas.getCell('C1'))).toBe('FF5B8F77');
      expect(tarjetas.getCell('A1').font?.color?.argb).toBe('FFFFFFFF');
      expect(tarjetas.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      // Listas desplegables en Marca y en «Tipo de memoria».
      expect(tarjetas.getCell('A2').dataValidation).toMatchObject({
        type: 'list',
        formulae: [expect.stringMatching(/^Listas!\$A\$1:\$A\$\d+$/)],
      });
      expect(tarjetas.getCell('G2').dataValidation).toMatchObject({
        type: 'list',
        formulae: ['"GDDR5,GDDR6,GDDR6X,GDDR7"'],
      });
      expect(titulos(libro.getWorksheet('Memoria RAM')!)).toEqual([
        'Marca *',
        'Modelo *',
        'Serie / versión',
        'Código de parte',
        'Sinónimos',
        'Tipo *',
        'Capacidad *',
        'Velocidad',
        'Latencia',
        'Formato',
        'Foto *',
      ]);
      // «Las demás»: solo las columnas de todas.
      expect(titulos(libro.getWorksheet('Accesorios')!)).toHaveLength(6);
      expect(libro.getWorksheet('Placas madre')!.getCell('H2').dataValidation).toMatchObject({
        formulae: ['"DDR4,DDR5"'],
      });
    });

    it('solo es para el equipo', async () => {
      await http()
        .get('/v1/equipo/catalogo/plantilla')
        .set('Cookie', (await como('tiendaa')).Cookie!)
        .expect(403);
    });
  });

  describe('El importador lee todas las pestañas', () => {
    it('la categoría sale del nombre de la pestaña y cada fila dice dónde está', async () => {
      const libro = await abrir(await plantilla());
      const tarjetas = libro.getWorksheet('Tarjetas de video')!;
      tarjetas.addRow([
        'ASUS',
        'TUF RTX 5070 PL',
        'OC',
        'PL-TUF-5070',
        'tuf 5070',
        '12',
        'GDDR7',
        '',
        '',
        'tuf-5070.webp',
      ]);
      // Sin marca: no se crea, y el error dice la pestaña y la fila.
      tarjetas.addRow(['', 'RTX 5060 sin marca', '', 'PL-5060-X', '', '8', '', '', '', '']);
      const ram = libro.getWorksheet('Memoria RAM')!;
      ram.addRow([
        'Kingston',
        'Fury Beast PL',
        '',
        'PL-KF-32',
        '',
        'DDR5',
        '32 GB',
        '',
        '',
        '',
        'PL-KF-32.jpg',
      ]);
      const contenido = Buffer.from(await libro.xlsx.writeBuffer());

      const zip = new JSZip();
      zip.file('plantilla_catalogo_paselibre.xlsx', contenido);
      zip.file(
        'fotos/tuf-5070.webp',
        await sharp(await foto('#22C47D'))
          .webp()
          .toBuffer(),
      );
      zip.file('fotos/PL-KF-32.jpg', await foto('#006B47'));
      const revision = await subir(await zip.generateAsync({ type: 'nodebuffer' }), 'cat.zip');
      expect(revision.status).toBe(201);
      // El ejemplo de «Cómo llenar» y las pestañas vacías no cuentan.
      expect(revision.body).toMatchObject({ filas_leidas: 3, crear: 2, existentes: 0 });
      expect(revision.body.incompletas).toEqual([
        {
          fila: 2,
          lugar: 'Tarjetas de video · fila 3',
          producto: 'RTX 5060 sin marca',
          motivo: 'SIN_MARCA',
          texto: 'Falta la marca',
          foto_buscada: null,
        },
      ]);

      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(await como('equipo'))
        .expect(201, { creados: 2, actualizados: 0 });
      const tuf = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'PL-TUF-5070' },
        include: { categoria: true, fotos: true, etiquetas: { include: { etiqueta: true } } },
      });
      expect(tuf).toMatchObject({
        titulo: 'ASUS TUF RTX 5070 PL OC',
        version: 'OC',
        caracteristicas: { 'VRAM (GB)': '12', 'Tipo de memoria': 'GDDR7' },
      });
      expect(tuf.categoria.slug).toBe('graficas');
      expect(tuf.fotos).toHaveLength(1);
      expect(tuf.etiquetas.map((e) => e.etiqueta.nombre)).toEqual(['tuf 5070']);
      const kingston = await prisma.producto.findFirstOrThrow({
        where: { codigoParte: 'PL-KF-32' },
        include: { categoria: true },
      });
      expect(kingston.categoria.slug).toBe('ram');
      expect(kingston.caracteristicas).toEqual({ Tipo: 'DDR5', Capacidad: '32 GB' });
    });

    it('un código repetido en dos pestañas dice en cuál está el primero', async () => {
      const libro = await abrir(await plantilla());
      libro.getWorksheet('Procesadores')!.addRow(['AMD', 'Ryzen 5 PL', '', 'PL-R5', '', '6 / 12']);
      libro.getWorksheet('Accesorios')!.addRow(['AMD', 'Ryzen 5 PL bis', '', 'PL-R5']);
      const revision = await subir(Buffer.from(await libro.xlsx.writeBuffer()), 'dos.xlsx');
      expect(revision.status).toBe(201);
      expect(revision.body.incompletas).toEqual([
        expect.objectContaining({
          lugar: 'Accesorios · fila 2',
          motivo: 'REPETIDA',
          texto: 'Código repetido: ya está en Procesadores · fila 2',
        }),
      ]);
    });

    it('una pestaña con datos pero sin la columna «Modelo» se avisa con su nombre', async () => {
      const libro = new ExcelJS.Workbook();
      libro.addWorksheet('Cómo llenar').addRow(['Hola']);
      const hoja = libro.addWorksheet('Monitores');
      hoja.addRow(['Marca', 'Nombre']);
      hoja.addRow(['LG', 'UltraGear']);
      const revision = await subir(Buffer.from(await libro.xlsx.writeBuffer()), 'mal.xlsx');
      expect(revision.status).toBe(400);
      expect(revision.body.error.mensaje).toBe(
        'A la pestaña «Monitores» le falta la columna «Modelo». Usa la plantilla.',
      );
    });

    it('un .xlsx de una sola hoja con la columna «categoría» sigue funcionando', async () => {
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet('Hoja1');
      hoja.addRow(['categoria', 'marca', 'modelo', 'codigo_parte', 'chip']);
      hoja.addRow(['graficas', 'Zotac', 'RTX 5060 Twin Edge PL', 'PL-ZT-5060', 'RTX 5060']);
      hoja.addRow(['Monitores', 'LG', '27GR75Q PL', 'PL-LG-27', '']);
      hoja.addRow(['', 'LG', '24GN60R PL', 'PL-LG-24', '']);
      const revision = await subir(Buffer.from(await libro.xlsx.writeBuffer()), 'viejo.xlsx');
      expect(revision.status).toBe(201);
      expect(revision.body).toMatchObject({ filas_leidas: 3, crear: 2 });
      expect(revision.body.incompletas).toEqual([
        {
          fila: 4,
          lugar: null,
          producto: 'LG 24GN60R PL',
          motivo: 'SIN_CATEGORIA',
          texto: 'Categoría vacía o mal escrita',
          foto_buscada: null,
        },
      ]);
      await http()
        .post(`/v1/equipo/catalogo/importar/${revision.body.id}/crear`)
        .set(await como('equipo'))
        .expect(201, { creados: 2, actualizados: 0 });
      expect(
        await prisma.producto.findFirstOrThrow({ where: { codigoParte: 'PL-ZT-5060' } }),
      ).toMatchObject({ caracteristicas: { Chip: 'RTX 5060' } });
    });
  });

  describe('Las filas con error dicen qué pasa', () => {
    it('cada fila tiene su motivo y su texto, y se cuentan por motivo', async () => {
      const zip = new JSZip();
      zip.file(
        'catalogo.csv',
        [
          'categoria;marca;modelo;codigo_parte;foto',
          'cases;Corsair;4000D Airflow PL;PL-4000D;PL-4000D.jpg',
          'cases;Corsair;5000D PL;PL-5000D;',
          'cases;Corsair;4000D PL;PL-4000D-B;corsair-4000d.webp',
          'cases;Corsair;3000D PL;PL-3000D;danada.jpg',
          'mouses;Logitech;G305 PL;PL-G305;PL-G305.jpg',
          'mouse;;G502 PL;PL-G502;PL-G502.jpg',
          'mouse;Logitech;;PL-G703;PL-G703.jpg',
          'cases;Corsair;4000D Airflow PL bis;PL-4000D;PL-4000D.jpg',
        ].join('\n'),
      );
      zip.file('fotos/PL-4000D.jpg', await foto('#FF0000'));
      zip.file('fotos/danada.jpg', Buffer.from('esto no es una foto'));
      const revision = await subir(await zip.generateAsync({ type: 'nodebuffer' }), 'malas.zip');
      expect(revision.status).toBe(201);
      expect(revision.body.crear).toBe(1);
      expect(
        revision.body.incompletas.map(
          (f: { fila: number; motivo: string; texto: string; foto_buscada: string | null }) => [
            f.fila,
            f.motivo,
            f.texto,
            f.foto_buscada,
          ],
        ),
      ).toEqual([
        [3, 'SIN_FOTO', 'Falta la foto', null],
        [4, 'FOTO_NO_ESTA', 'No está la foto en la carpeta', 'corsair-4000d.webp'],
        [5, 'FOTO_DANADA', 'La foto está dañada o no es una imagen', null],
        [6, 'SIN_CATEGORIA', 'Categoría vacía o mal escrita', null],
        [7, 'SIN_MARCA', 'Falta la marca', null],
        [8, 'SIN_MODELO', 'Falta el modelo', null],
        [9, 'REPETIDA', 'Código repetido: ya está en la fila 2', null],
      ]);
      expect(revision.body.motivos).toEqual({
        sin_foto: 3,
        sin_categoria: 1,
        sin_marca: 1,
        sin_modelo: 1,
        repetida: 1,
      });

      // «Descargar la lista en Excel»: fila, producto y qué pasa.
      const lista = await descargar(
        http()
          .get(`/v1/equipo/catalogo/importar/${revision.body.id}/errores`)
          .set(await como('equipo')),
      ).expect(200);
      expect(lista.headers['content-disposition']).toContain('filas_que_no_se_crean.xlsx');
      const hoja = (await abrir(lista.body as Buffer)).worksheets[0]!;
      expect(titulos(hoja)).toEqual(['Fila', 'Producto', 'Qué pasa']);
      expect(hoja.actualRowCount).toBe(8);
      expect((hoja.getRow(3).values as unknown[]).slice(1)).toEqual([
        '4',
        'Corsair 4000D PL',
        'No está la foto en la carpeta: corsair-4000d.webp',
      ]);

      // La lista es solo de quien subió el archivo.
      await http()
        .get(`/v1/equipo/catalogo/importar/${crypto.randomUUID()}/errores`)
        .set(await como('equipo'))
        .expect(404);
    });

    it('1 fila mala: el resto se crea y la mala no', async () => {
      const csv = ['categoria,marca,modelo', 'cases,Corsair,Una PL', 'cases,,Otra PL'].join('\n');
      const revision = await subir(Buffer.from(csv), 'uno.csv');
      expect(revision.body).toMatchObject({
        crear: 1,
        motivos: { sin_foto: 0, sin_categoria: 0, sin_marca: 1, sin_modelo: 0, repetida: 0 },
      });
    });
  });
});
