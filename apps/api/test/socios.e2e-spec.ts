import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Precio socio y «¿Quién ve el precio?» (PS_Precio, PS_SociosWeb, sección 11 del lienzo final):
 * quién ve qué precio de una publicación, según si es socia de la tienda que la publicó.
 */
describe('Precio socio y tus socios (sección 11)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let tiendaA: string;
  let tiendaB: string;
  let ofertaId: string;
  let slug: string;

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

  const ofertaEnFicha = async (usuario: string | null) => {
    const peticion = http().get(`/v1/productos/${slug}`);
    if (usuario) peticion.set('Cookie', await como(usuario));
    const ficha = await peticion.expect(200);
    return (ficha.body.ofertas as Array<Record<string, unknown>>).find((o) => o.id === ofertaId);
  };

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
    tiendaB = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } })).id;
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', precioCentimos: { not: null } },
      include: { producto: true },
    });
    ofertaId = oferta.id;
    slug = oferta.producto.slug;
    await http()
      .patch(`/v1/ofertas/${ofertaId}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({
        precio: '240',
        moneda: 'USD',
        descuento_socio: '3',
        quien_ve_precio: 'TODOS',
        modo_venta: 'AMBOS',
        precio_facturado: '283',
        estado_detalle: 'OPEN_BOX',
        garantia: 'TRES_MESES',
        con_caja: true,
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sin ser socia se ve el precio de pase y el facturado; el visitante, ninguno', async () => {
    const deC = await ofertaEnFicha('tiendac');
    expect(deC).toMatchObject({
      precio: { moneda: 'USD', centimos: 24000 },
      precio_facturado: { moneda: 'USD', centimos: 28300 },
      precio_socio: false,
      modo_venta: 'AMBOS',
      detalle: { estado: 'OPEN_BOX', garantia: 'TRES_MESES', con_caja: true },
    });
    const visitante = await ofertaEnFicha(null);
    expect(visitante).not.toHaveProperty('precio');
    expect(visitante).not.toHaveProperty('precio_facturado');
    expect(visitante).toMatchObject({ detalle: { estado: 'OPEN_BOX' } });
  });

  it('la socia ve el precio con su descuento y le llega un aviso', async () => {
    const agregar = await http()
      .post('/v1/socios')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ tienda_id: tiendaB })
      .expect(200);
    await http()
      .put('/v1/socios/descuento')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ PEN: '10', USD: '' })
      .expect(200)
      .expect((r) =>
        expect(r.body.descuento_defecto.PEN).toMatchObject({ moneda: 'PEN', centimos: 1000 }),
      );
    expect(agregar.body.mis_socios.map((s: { nombre: string }) => s.nombre)).toEqual(['Tienda B']);

    // El descuento baja el pase y también el facturado (PS_Precio).
    expect(await ofertaEnFicha('tiendab')).toMatchObject({
      precio: { centimos: 23700 },
      precio_facturado: { centimos: 28000 },
      precio_socio: true,
      descuento_socio: { centimos: 300 },
    });
    expect(await ofertaEnFicha('tiendac')).toMatchObject({
      precio: { centimos: 24000 },
      precio_socio: false,
    });
    // La dueña ve su precio tal cual.
    expect(await ofertaEnFicha('tiendaa')).toMatchObject({ precio: { centimos: 24000 } });

    const avisos = await http()
      .get('/v1/avisos')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(avisos.body.avisos[0].titulo).toBe('Tienda A te agregó como socio');
    const deB = await http()
      .get('/v1/socios')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(deB.body.me_tienen.map((s: { nombre: string }) => s.nombre)).toEqual(['Tienda A']);
  });

  it('«Solo mis socios»: las demás tiendas no ven el precio', async () => {
    await http()
      .patch(`/v1/ofertas/${ofertaId}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ quien_ve_precio: 'SOCIOS' })
      .expect(200);
    expect(await ofertaEnFicha('tiendac')).toMatchObject({
      precio: null,
      precio_facturado: null,
      solo_socios: true,
    });
    expect(await ofertaEnFicha('tiendab')).toMatchObject({ precio: { centimos: 23700 } });

    await http()
      .delete(`/v1/socios/${tiendaB}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(await ofertaEnFicha('tiendab')).toMatchObject({ precio: null });
  });

  it('el buscador de tiendas no trae la propia y no se es socia de sí misma', async () => {
    const encontradas = await http()
      .get('/v1/tiendas/buscar?q=tienda')
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    const nombres = (encontradas.body as Array<{ nombre: string }>).map((t) => t.nombre);
    expect(nombres).toContain('Tienda B');
    expect(nombres).not.toContain('Tienda A');
    await http()
      .post('/v1/socios')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .send({ tienda_id: tiendaA })
      .expect(409);
  });
});
