import type { INestApplication } from '@nestjs/common';
import { normalizarTexto, slugDe, type PerfilMemoria } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import {
  CABECERAS,
  CLAVE_PRUEBA,
  cookieDe,
  crearApp,
  crearTiendaConDueno,
  usarBaseDePruebas,
  vaciarBase,
} from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

interface ProductoDePrueba {
  titulo: string;
  categoria: string;
  marca: string;
  codigo?: string;
  sinonimos?: string[];
  caracteristicas?: Record<string, string>;
  /** El perfil guardado en el producto (A8). */
  perfil?: PerfilMemoria;
  /** El perfil guardado solo en la publicación. */
  perfilOferta?: PerfilMemoria;
}

/**
 * El catálogo del tablero P46: lo justo para las 10 filas. Todas las publicaciones son de una
 * sola tienda, para que Mis publicaciones y Pedir en vivo vean lo mismo que la barra.
 */
const PRODUCTOS: ProductoDePrueba[] = [
  {
    titulo: 'G.Skill Trident Z5 Neo 64GB DDR5 6000',
    categoria: 'ram',
    marca: 'G.Skill',
    sinonimos: ['DDR5'],
    perfil: 'EXPO',
  },
  {
    titulo: 'G.Skill Ripjaws V 16GB DDR4 3200',
    categoria: 'ram',
    marca: 'G.Skill',
    sinonimos: ['DDR4'],
    perfil: 'XMP',
  },
  {
    // Publicada antes de la 1.10.0 en el producto, pero marcada en la publicación.
    titulo: 'Corsair Vengeance 32GB DDR5 5600',
    categoria: 'ram',
    marca: 'Corsair',
    sinonimos: ['DDR5'],
    perfilOferta: 'EXPO',
  },
  {
    titulo: 'Kingston NV3 1TB',
    categoria: 'almacenamiento',
    marca: 'Kingston',
    codigo: 'SNV3S/1000G',
    sinonimos: ['M.2 NVMe', 'SSD'],
    caracteristicas: { Interfaz: 'PCIe 4.0' },
  },
  {
    titulo: 'Kingston NV3 2TB',
    categoria: 'almacenamiento',
    marca: 'Kingston',
    codigo: 'SNV3S/2000G',
    sinonimos: ['M.2 NVMe', 'SSD'],
  },
  {
    titulo: 'Kingston A400 480GB',
    categoria: 'almacenamiento',
    marca: 'Kingston',
    codigo: 'SA400S37/480G',
    sinonimos: ['SSD'],
    caracteristicas: { Tipo: 'SATA 2.5"' },
  },
  {
    titulo: 'Kingston Fury Renegade G5 1TB',
    categoria: 'almacenamiento',
    marca: 'Kingston',
    codigo: 'SFYR2S/1T0',
    sinonimos: ['M.2 NVMe', 'SSD'],
  },
  {
    // «M.2» solo en las características: el tipo también se busca ahí.
    titulo: 'Samsung 9100 Pro 1TB',
    categoria: 'almacenamiento',
    marca: 'Samsung',
    codigo: 'MZ-VAP1T0',
    sinonimos: ['SSD'],
    caracteristicas: { Tipo: 'M.2 NVMe', Interfaz: 'PCIe 5.0' },
  },
  {
    titulo: 'MSI Spatium S270 480GB',
    categoria: 'almacenamiento',
    marca: 'MSI',
    sinonimos: ['SATA', 'SSD'],
  },
  { titulo: 'DeepCool CC560 FS negro', categoria: 'cases', marca: 'DeepCool' },
  { titulo: 'DeepCool CG530 4F', categoria: 'cases', marca: 'DeepCool' },
  { titulo: 'Redragon Flick L P032', categoria: 'mouse-pads', marca: 'Redragon' },
  { titulo: 'Logitech G240 Cloth', categoria: 'mouse-pads', marca: 'Logitech' },
  { titulo: 'DeepCool AK400 Digital', categoria: 'refrigeracion', marca: 'DeepCool' },
  { titulo: 'Cooler Master Hyper 212 Black', categoria: 'refrigeracion', marca: 'Cooler Master' },
  {
    titulo: 'MSI Radeon RX 5600 XT Mech OC 6GB',
    categoria: 'graficas',
    marca: 'MSI',
    sinonimos: ['AMD', 'RX 5600 XT'],
  },
];

const EXCEL = 'SSD Kingston NV3 1TB M.2 2280 NVMe PCIe 4.0 SNV3S/1000G Nuevo Sellado Original';

/** Las 10 filas del tablero P46: lo que se escribe, lo que debe salir y en qué categoría. */
const FILAS: Array<{
  q: string;
  categoria: string;
  esperados: string[];
  loMasParecido?: true;
  primero?: string;
}> = [
  {
    q: 'ram gskill',
    categoria: 'ram',
    esperados: ['G.Skill Ripjaws V 16GB DDR4 3200', 'G.Skill Trident Z5 Neo 64GB DDR5 6000'],
  },
  {
    q: 'almacenamiento kingston',
    categoria: 'almacenamiento',
    esperados: [
      'Kingston A400 480GB',
      'Kingston Fury Renegade G5 1TB',
      'Kingston NV3 1TB',
      'Kingston NV3 2TB',
    ],
  },
  {
    q: 'm.2 1tb',
    categoria: 'almacenamiento',
    esperados: ['Kingston Fury Renegade G5 1TB', 'Kingston NV3 1TB', 'Samsung 9100 Pro 1TB'],
  },
  {
    q: 'sata 480',
    categoria: 'almacenamiento',
    esperados: ['Kingston A400 480GB', 'MSI Spatium S270 480GB'],
  },
  {
    q: 'case deepcool',
    categoria: 'cases',
    esperados: ['DeepCool CC560 FS negro', 'DeepCool CG530 4F'],
  },
  {
    q: 'mouse pad',
    categoria: 'mouse-pads',
    esperados: ['Logitech G240 Cloth', 'Redragon Flick L P032'],
  },
  {
    q: 'cooler',
    categoria: 'refrigeracion',
    esperados: ['Cooler Master Hyper 212 Black', 'DeepCool AK400 Digital'],
  },
  {
    q: 'ram expo',
    categoria: 'ram',
    esperados: ['Corsair Vengeance 32GB DDR5 5600', 'G.Skill Trident Z5 Neo 64GB DDR5 6000'],
  },
  { q: '5600xt', categoria: 'graficas', esperados: ['MSI Radeon RX 5600 XT Mech OC 6GB'] },
  {
    // Sobran palabras («2280», «PCIe 4.0», «Nuevo Sellado»…): sale en «Lo más parecido», primero.
    q: EXCEL,
    categoria: 'almacenamiento',
    esperados: ['Kingston Fury Renegade G5 1TB', 'Kingston NV3 1TB', 'Kingston NV3 2TB'],
    loMasParecido: true,
    primero: 'Kingston NV3 1TB',
  },
];

const ordenados = (titulos: string[]) => [...titulos].sort((a, b) => a.localeCompare(b, 'es'));

/** Doc 20 §11: un solo buscador. Las 10 filas del tablero P46, en los 5 buscadores. */
describe('Un solo buscador para todo (doc 20 §11)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let tiendaA = '';
  let autorA = '';

  async function como(usuario: string, clave = CLAVE_DEMO): Promise<string> {
    const guardada = cookies.get(usuario);
    if (guardada) return guardada;
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave })
      .expect(200);
    cookies.set(usuario, cookieDe(respuesta));
    return cookieDe(respuesta);
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ enVivo: true });

    const { tienda, usuario } = await crearTiendaConDueno(prisma, { usuario: 'buscador' });
    const terminos = new Map<string, number>();
    for (const p of PRODUCTOS) {
      const categoria = await prisma.categoria.findUniqueOrThrow({ where: { slug: p.categoria } });
      const marca = await prisma.marca.upsert({
        where: { nombre: p.marca },
        update: {},
        create: { nombre: p.marca, slug: slugDe(p.marca) },
      });
      const textoBusqueda = normalizarTexto(
        [p.titulo, p.marca, p.codigo ?? '', ...(p.sinonimos ?? [])].join(' '),
      );
      for (const palabra of new Set(textoBusqueda.split(' '))) {
        terminos.set(palabra, (terminos.get(palabra) ?? 0) + 1);
      }
      const producto = await prisma.producto.create({
        data: {
          titulo: p.titulo,
          slug: slugDe(p.titulo),
          categoriaId: categoria.id,
          marcaId: marca.id,
          codigoParte: p.codigo ?? null,
          caracteristicas: p.caracteristicas ?? {},
          perfilMemoria: p.perfil ?? null,
          textoBusqueda,
          revisado: true,
        },
      });
      await prisma.oferta.create({
        data: {
          productoId: producto.id,
          tiendaId: tienda.id,
          responsableId: usuario.id,
          condicion: 'NUEVO',
          stock: 2,
          moneda: 'USD',
          precioCentimos: 10_000n,
          precioVisible: true,
          perfilMemoria: p.perfilOferta ?? null,
        },
      });
    }
    for (const [palabra, veces] of terminos) {
      await prisma.termino.upsert({
        where: { palabra },
        update: { veces: { increment: veces } },
        create: { palabra, veces },
      });
    }
    const a = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    tiendaA = a.tiendaId ?? '';
    autorA = a.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  /** Los 5 buscadores, cada uno con lo que encuentra para `q` (sus títulos). */
  async function enLosCinco(fila: (typeof FILAS)[number]) {
    const q = encodeURIComponent(fila.q);
    const barra = (await http().get(`/v1/buscar?q=${q}`).expect(200)).body;
    const publicar = (
      await http()
        .get(`/v1/catalogo/sugerencias?q=${q}`)
        .set('Cookie', await como('buscador', CLAVE_PRUEBA))
        .expect(200)
    ).body;
    const mias = (
      await http()
        .get(`/v1/mis-ofertas?estado=todas&q=${q}`)
        .set('Cookie', await como('buscador', CLAVE_PRUEBA))
        .expect(200)
    ).body;
    const catalogo = (
      await http()
        .get(`/v1/equipo/catalogo?q=${q}`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(200)
    ).body;
    // Pedir en vivo: otra tienda pide eso «a mano» en su categoría y la tienda de prueba ve
    // con qué publicaciones puede responder «¡Lo tengo!».
    const categoria = await prisma.categoria.findUniqueOrThrow({
      where: { slug: fila.categoria },
    });
    const busco = await prisma.enVivo.create({
      data: {
        tipo: 'BUSCO',
        autorId: autorA,
        tiendaId: tiendaA,
        categoriaId: categoria.id,
        titulo: fila.q,
        venceEn: new Date(Date.now() + 60 * 60_000),
      },
    });
    const enVivo = (
      await http()
        .get(`/v1/en-vivo/${busco.id}/opciones`)
        .set('Cookie', await como('buscador', CLAVE_PRUEBA))
        .expect(200)
    ).body;
    return {
      barra,
      publicar,
      mias,
      catalogo,
      titulos: {
        barra: (barra.productos as Array<{ titulo: string }>).map((p) => p.titulo),
        publicar: (publicar.productos as Array<{ titulo: string }>).map((p) => p.titulo),
        mias: (mias.ofertas as Array<{ producto: { titulo: string } }>).map(
          (o) => o.producto.titulo,
        ),
        catalogo: (catalogo.productos as Array<{ titulo: string }>).map((p) => p.titulo),
        enVivo: (enVivo.ofertas as Array<{ titulo: string }>).map((o) => o.titulo),
      },
    };
  }

  for (const fila of FILAS) {
    const nombre = fila.q === EXCEL ? 'un nombre largo pegado del Excel' : `«${fila.q}»`;
    it(`${nombre} da lo mismo en los 5 buscadores`, async () => {
      const { barra, publicar, mias, catalogo, titulos } = await enLosCinco(fila);
      const esperados = ordenados(fila.esperados);
      for (const [buscador, encontrados] of Object.entries(titulos)) {
        expect(ordenados(encontrados), buscador).toEqual(esperados);
      }
      const parecido = fila.loMasParecido ?? false;
      for (const [buscador, respuesta] of Object.entries({ barra, publicar, mias, catalogo })) {
        expect(respuesta.lo_mas_parecido, buscador).toBe(parecido);
      }
      if (fila.primero) {
        expect(titulos.barra[0]).toBe(fila.primero);
        expect(titulos.publicar[0]).toBe(fila.primero);
        expect(titulos.mias[0]).toBe(fila.primero);
        expect(titulos.catalogo[0]).toBe(fila.primero);
      }
    });
  }

  it('«Lo más parecido» también con sesión y con filtros de la publicación', async () => {
    const cookie = await como('tiendab');
    for (const filtros of ['', '&stock=true&condicion=nuevo']) {
      const respuesta = (
        await http()
          .get(`/v1/buscar?q=${encodeURIComponent(EXCEL)}${filtros}`)
          .set('Cookie', cookie)
          .expect(200)
      ).body;
      expect(respuesta.audiencia).toBe('vendedor');
      expect(respuesta.lo_mas_parecido).toBe(true);
      expect(respuesta.productos[0].titulo).toBe('Kingston NV3 1TB');
      expect(respuesta.productos[0].oferta_destacada.precio).not.toBeNull();
      expect(respuesta.total_productos).toBe(3);
    }
    const sugerencias = (
      await http()
        .get(`/v1/buscar/sugerencias?q=${encodeURIComponent(EXCEL)}`)
        .set('Cookie', cookie)
        .expect(200)
    ).body;
    expect(sugerencias.lo_mas_parecido).toBe(true);
    expect(sugerencias.productos[0].titulo).toBe('Kingston NV3 1TB');
  });

  it('la barra dice lo que entendió: la categoría y el perfil', async () => {
    const gskill = (await http().get('/v1/buscar?q=ram%20gskill').expect(200)).body;
    expect(gskill.correccion).toMatchObject({
      buscaste: 'ram gskill',
      mostramos: 'g skill',
      categoria: { slug: 'ram', nombre: 'Memoria RAM' },
    });
    const expo = (await http().get('/v1/buscar?q=ram%20expo').expect(200)).body;
    expect(expo.correccion).toMatchObject({
      mostramos: 'Memoria RAM con EXPO',
      categoria: { slug: 'ram' },
    });
  });

  it('«xmp» y «ram intel» traen las XMP', async () => {
    for (const q of ['xmp', 'ram intel']) {
      const respuesta = (
        await http()
          .get(`/v1/buscar?q=${encodeURIComponent(q)}`)
          .expect(200)
      ).body;
      expect(respuesta.productos.map((p: { titulo: string }) => p.titulo)).toEqual([
        'G.Skill Ripjaws V 16GB DDR4 3200',
      ]);
    }
  });

  it('«ram», «memoria» y «procesador» funcionan en Publicar y en Mis publicaciones', async () => {
    const cookie = await como('buscador', CLAVE_PRUEBA);
    for (const q of ['ram', 'memoria']) {
      const publicar = (await http().get(`/v1/catalogo/sugerencias?q=${q}`).set('Cookie', cookie))
        .body;
      expect(publicar.productos.length).toBeGreaterThan(0);
      for (const p of publicar.productos as Array<{ categoria: { slug: string } }>) {
        expect(p.categoria.slug).toBe('ram');
      }
      const mias = (await http().get(`/v1/mis-ofertas?estado=todas&q=${q}`).set('Cookie', cookie))
        .body;
      expect(mias.ofertas).toHaveLength(3);
    }
    const procesador = (
      await http().get('/v1/catalogo/sugerencias?q=procesador').set('Cookie', cookie)
    ).body;
    expect(procesador.productos.map((p: { titulo: string }) => p.titulo)).toEqual([
      'Intel Core i5-14400F',
    ]);
  });

  it('Mis publicaciones corrige las letras cambiadas («kingstn»)', async () => {
    const mias = (
      await http()
        .get('/v1/mis-ofertas?estado=todas&q=kingstn%20a400')
        .set('Cookie', await como('buscador', CLAVE_PRUEBA))
        .expect(200)
    ).body;
    expect(mias.correccion).toMatchObject({
      buscaste: 'kingstn a400',
      mostramos: 'kingston a 400',
    });
    expect(mias.ofertas.map((o: { producto: { titulo: string } }) => o.producto.titulo)).toEqual([
      'Kingston A400 480GB',
    ]);
  });
});
