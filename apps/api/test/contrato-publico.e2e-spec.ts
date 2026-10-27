/**
 * Prueba de contrato público (docs/05 §5 y §13, RNF-18, RNF-50).
 *
 * Pide como visitante todo lo que el catálogo ofrece y falla si en cualquier parte
 * de la respuesta aparece un precio, una tienda, un stand o un WhatsApp. También
 * revisa que el visitante no pueda deducir precios por el orden ni por los filtros.
 */
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sembrarBase, sembrarDemo } from '../prisma/semilla';
import { crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const CLAVES_PROHIBIDAS = new Set([
  'precio',
  'precios_desde',
  'precio_visible',
  'al_interno',
  'centimos',
  'monto',
  'moneda',
  'tienda',
  'stand',
  'whatsapp',
  'propia',
]);

/** Recorre toda la respuesta y junta claves prohibidas y textos que delatan a una tienda. */
function fugas(valor: unknown, textosProhibidos: string[], ruta = '$'): string[] {
  if (Array.isArray(valor))
    return valor.flatMap((v, i) => fugas(v, textosProhibidos, `${ruta}[${i}]`));
  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([clave, v]) => [
      ...(CLAVES_PROHIBIDAS.has(clave) ? [`${ruta}.${clave}`] : []),
      ...fugas(v, textosProhibidos, `${ruta}.${clave}`),
    ]);
  }
  if (typeof valor === 'string') {
    return textosProhibidos.filter((t) => valor.includes(t)).map((t) => `${ruta} contiene «${t}»`);
  }
  return [];
}

describe('Contrato público: el visitante no recibe precio, tienda, stand ni WhatsApp', () => {
  let app: INestApplication;
  let textosProhibidos: string[];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    const tiendas = await prisma.tienda.findMany();
    // Nombres de tienda y WhatsApp: no pueden aparecer en ninguna respuesta pública.
    textosProhibidos = tiendas.flatMap((t) => [t.nombre, t.whatsapp]);
    app = await crearApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const slugs = async () =>
    (await prisma.producto.findMany({ select: { slug: true } })).map((p) => p.slug);

  it('portada, categorías y galerías', async () => {
    for (const ruta of [
      '/v1/portada',
      '/v1/portada?galeria=maxiplaza',
      '/v1/portada?galeria=independientes',
      '/v1/categorias',
      '/v1/galerias',
    ]) {
      const respuesta = await http().get(ruta).expect(200);
      expect(fugas(respuesta.body, textosProhibidos), ruta).toEqual([]);
    }
  });

  it('búsquedas, con y sin corrección, filtros y páginas', async () => {
    const rutas = [
      '/v1/buscar',
      '/v1/buscar?q=rtx%203070',
      '/v1/buscar?q=rtx%203370',
      '/v1/buscar?q=ventsu',
      '/v1/buscar?q=i5&categoria=procesadores',
      '/v1/buscar?galeria=independientes',
      '/v1/buscar?condicion=nuevo&stock=true',
      '/v1/buscar?q=rtx&precio_min=0&precio_max=250&orden=precio_asc',
      '/v1/buscar?pagina=2',
    ];
    for (const ruta of rutas) {
      const respuesta = await http().get(ruta).expect(200);
      expect(respuesta.body.audiencia, ruta).toBe('visitante');
      expect(fugas(respuesta.body, textosProhibidos), ruta).toEqual([]);
    }
  });

  it('la ficha de cada producto', async () => {
    for (const slug of await slugs()) {
      const respuesta = await http().get(`/v1/productos/${slug}`).expect(200);
      expect(respuesta.body.audiencia).toBe('visitante');
      expect(fugas(respuesta.body, textosProhibidos), slug).toEqual([]);
    }
  });

  it('el orden de las ofertas en la ficha no delata el precio: va por fecha', async () => {
    const respuesta = await http()
      .get('/v1/productos/msi-geforce-rtx-3070-ventus-3-x-oc-8-gb')
      .expect(200);
    const fechas: string[] = respuesta.body.ofertas.map(
      (o: { actualizada_en: string }) => o.actualizada_en,
    );
    expect(fechas).toEqual([...fechas].sort().reverse());
    expect(respuesta.body.ofertas).toHaveLength(4);
  });

  it('el filtro y el orden por precio se ignoran sin sesión', async () => {
    const sinFiltro = await http().get('/v1/buscar?q=rtx').expect(200);
    const conFiltro = await http()
      .get('/v1/buscar?q=rtx&precio_max=1&orden=precio_desc')
      .expect(200);
    const titulos = (r: request.Response) =>
      r.body.productos.map((p: { titulo: string }) => p.titulo);
    expect(titulos(conFiltro)).toEqual(titulos(sinFiltro));
    expect(conFiltro.body.total_ofertas).toBe(sinFiltro.body.total_ofertas);
  });

  it('lo público se puede cachear y varía según la cookie', async () => {
    const respuesta = await http().get('/v1/buscar?q=rtx').expect(200);
    expect(respuesta.headers['cache-control']).toMatch(/^public/);
    expect(respuesta.headers['vary']).toMatch(/Cookie/);
  });
});
