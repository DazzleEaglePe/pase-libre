import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const VENTUS = 'msi-geforce-rtx-3070-ventus-3-x-oc-8-gb';

interface OfertaFicha {
  id: string;
  tienda: { nombre: string };
  responde_en_min: number | null;
}

/** «Responde en ~10 min» de la ficha: la mediana de la primera respuesta, con 3 hilos o más. */
describe('Responde en', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  const deB: string[] = [];

  async function como(usuario: string): Promise<string> {
    const guardada = cookies.get(usuario);
    if (guardada) return guardada;
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    const cookie = cookieDe(respuesta);
    cookies.set(usuario, cookie);
    return cookie;
  }

  async function escribir(id: string, usuario: string, texto: string): Promise<void> {
    await http()
      .post(`/v1/conversaciones/${id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', await como(usuario))
      .send({ texto })
      .expect(201);
  }

  async function fichaVentus(usuario: string): Promise<OfertaFicha[]> {
    const ficha = await http()
      .get(`/v1/productos/${VENTUS}`)
      .set('Cookie', await como(usuario))
      .expect(200);
    return ficha.body.ofertas as OfertaFicha[];
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    const mias = await http()
      .get('/v1/mis-ofertas?estado=todas')
      .set('Cookie', await como('tiendab'))
      .expect(200);
    deB.push(...mias.body.ofertas.map((o: { id: string }) => o.id));
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('sin 3 hilos contestados no se muestra', async () => {
    const ofertas = await fichaVentus('tiendac');
    expect(ofertas.every((o) => o.responde_en_min === null)).toBe(true);
  });

  it('con 3 hilos contestados la tienda muestra cuánto tarda (al menos 1 minuto)', async () => {
    expect(deB.length).toBeGreaterThanOrEqual(3);
    for (const ofertaId of deB.slice(0, 3)) {
      const contacto = await http()
        .post(`/v1/ofertas/${ofertaId}/contacto`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ canal: 'CHAT' })
        .expect(200);
      await escribir(contacto.body.conversacion_id, 'tiendaa', '¿Sigue disponible?');
      await escribir(contacto.body.conversacion_id, 'tiendab', 'Sí, te lo separo.');
    }
    const ofertas = await fichaVentus('tiendac');
    const deTiendaB = ofertas.find((o) => o.tienda.nombre === 'Tienda B');
    expect(deTiendaB?.responde_en_min).toBe(1);
    // Las demás tiendas no tienen hilos: no muestran nada.
    expect(
      ofertas
        .filter((o) => o.tienda.nombre !== 'Tienda B')
        .every((o) => o.responde_en_min === null),
    ).toBe(true);
  });

  it('con la tienda reservada no se muestra: sería una pista de quién es', async () => {
    const ventusDeB = (await fichaVentus('tiendab')).find((o) => o.tienda.nombre === 'Tienda B');
    await http()
      .patch(`/v1/ofertas/${ventusDeB?.id}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ tienda_visible: false })
      .expect(200);
    const reservada = (await fichaVentus('tiendac')).find((o) => o.id === ventusDeB?.id);
    expect(reservada).toMatchObject({
      tienda: { nombre: 'Tienda reservada' },
      responde_en_min: null,
    });
  });
});
