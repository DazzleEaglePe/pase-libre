import type { INestApplication } from '@nestjs/common';
import type { DetalleConversacion, RespuestaContacto } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

interface Fila {
  id: string;
  stock: number;
  estado: 'ACTIVA' | 'PAUSADA';
  razon_pausa: string | null;
}

type Conteos = Record<
  'activas' | 'vigentes' | 'sin_stock' | 'no_disponibles' | 'pausadas' | 'todas',
  number
>;

/** «Pausar» pasa a «No disponible ▾» con su motivo (doc 20, punto 16). */
describe('«No disponible» y sus tres motivos (doc 20, punto 16)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  /** Tres publicaciones con stock de Tienda A, una para cada motivo. */
  let ofertas: Fila[] = [];

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

  const misOfertas = async (estado: string) =>
    (
      await http()
        .get(`/v1/mis-ofertas?estado=${estado}`)
        .set('Cookie', await como('tiendaa'))
        .expect(200)
    ).body as { conteos: Conteos; ofertas: Fila[] };

  const editar = async (id: string, cambios: Record<string, unknown>) =>
    (
      await http()
        .patch(`/v1/ofertas/${id}`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send(cambios)
        .expect(200)
    ).body as Fila;

  const ids = (lista: { ofertas: Fila[] }) => lista.ofertas.map((oferta) => oferta.id);

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    ofertas = (await misOfertas('activas')).ofertas.slice(0, 4);
    expect(ofertas).toHaveLength(4);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('«Se me acabó» no pausa: deja el stock en 0 y vuelve sola al subir la cantidad', async () => {
    const [oferta] = ofertas;
    const id = oferta?.id ?? '';
    const agotada = await editar(id, { estado: 'PAUSADA', razon_pausa: 'Se me acabó' });
    expect(agotada).toMatchObject({ estado: 'ACTIVA', stock: 0, razon_pausa: null });
    const fila = await prisma.oferta.findUniqueOrThrow({ where: { id } });
    expect(fila).toMatchObject({ estado: 'ACTIVA', stock: 0, razonPausa: null });

    // Sale de «Activas» y queda en «No disponibles», como «Sin stock».
    expect(ids(await misOfertas('activas'))).not.toContain(id);
    const noDisponibles = await misOfertas('no_disponibles');
    expect(ids(noDisponibles)).toContain(id);
    expect(noDisponibles.conteos.no_disponibles).toBe(
      noDisponibles.conteos.sin_stock +
        (await prisma.oferta.count({ where: { tiendaId: fila.tiendaId, estado: 'PAUSADA' } })),
    );

    // Vuelve sola cuando sube la cantidad: sin «Volver a mostrar».
    const devuelta = await editar(id, { stock: 3 });
    expect(devuelta).toMatchObject({ estado: 'ACTIVA', stock: 3 });
    expect(ids(await misOfertas('activas'))).toContain(id);
    expect(ids(await misOfertas('no_disponibles'))).not.toContain(id);
  });

  it('«La separé para un cliente» la oculta y en el chat dice «Separada»', async () => {
    const id = ofertas[1]?.id ?? '';
    const contacto = await http()
      .post(`/v1/ofertas/${id}/contacto`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ canal: 'CHAT' })
      .expect(200);
    const conversacion = (contacto.body as Extract<RespuestaContacto, { canal: 'CHAT' }>)
      .conversacion_id;
    const enElChat = async () =>
      (
        await http()
          .get(`/v1/conversaciones/${conversacion}`)
          .set('Cookie', await como('tiendab'))
          .expect(200)
      ).body as DetalleConversacion;

    expect((await enElChat()).oferta).toMatchObject({ estado: 'ACTIVA', separada: false });

    const separada = await editar(id, {
      estado: 'PAUSADA',
      razon_pausa: 'La separé para un cliente',
    });
    expect(separada).toMatchObject({
      estado: 'PAUSADA',
      razon_pausa: 'La separé para un cliente',
    });
    expect(ids(await misOfertas('activas'))).not.toContain(id);
    expect(ids(await misOfertas('no_disponibles'))).toContain(id);
    // La razón no viaja al chat: solo si está separada.
    const oferta = (await enElChat()).oferta;
    expect(oferta).toMatchObject({ estado: 'PAUSADA', separada: true });
    expect(oferta).not.toHaveProperty('razon_pausa');

    // Con otro motivo, el chat dice «No disponible» (separada: false).
    await editar(id, { estado: 'PAUSADA', razon_pausa: 'Otro motivo' });
    expect((await enElChat()).oferta).toMatchObject({ estado: 'PAUSADA', separada: false });
  });

  it('«Otro motivo» la oculta hasta «Volver a mostrar», que borra la razón', async () => {
    const id = ofertas[2]?.id ?? '';
    await editar(id, { estado: 'PAUSADA', razon_pausa: 'Otro motivo' });
    const fila = (await misOfertas('no_disponibles')).ofertas.find((otra) => otra.id === id);
    expect(fila).toMatchObject({ estado: 'PAUSADA', razon_pausa: 'Otro motivo' });
    expect(ids(await misOfertas('activas'))).not.toContain(id);

    // Subir el stock de una oculta por otro motivo no la muestra: solo «Volver a mostrar».
    await editar(id, { stock: 5 });
    expect((await prisma.oferta.findUniqueOrThrow({ where: { id } })).estado).toBe('PAUSADA');

    const visible = await editar(id, { estado: 'ACTIVA' });
    expect(visible).toMatchObject({ estado: 'ACTIVA', razon_pausa: null });
    expect(ids(await misOfertas('activas'))).toContain(id);
  });

  it('«pausadas» queda como alias de «no_disponibles», por los enlaces guardados', async () => {
    const [alias, nueva] = await Promise.all([
      misOfertas('pausadas'),
      misOfertas('no_disponibles'),
    ]);
    expect(ids(alias)).toEqual(ids(nueva));
    expect(alias.conteos.pausadas).toBe(alias.conteos.no_disponibles);
    expect(ids(alias).length).toBeGreaterThan(0);
  });

  it('la razón vieja «Se me acabó, espero mercadería» se lee como «Se me acabó»', async () => {
    const id = ofertas[3]?.id ?? '';
    await prisma.oferta.update({
      where: { id },
      data: { estado: 'PAUSADA', razonPausa: 'Se me acabó, espero mercadería' },
    });
    const fila = (await misOfertas('no_disponibles')).ofertas.find((otra) => otra.id === id);
    expect(fila).toMatchObject({ estado: 'PAUSADA', razon_pausa: 'Se me acabó' });

    // Igual que «Se me acabó»: al subir la cantidad vuelve sola.
    const devuelta = await editar(id, { stock: 2 });
    expect(devuelta).toMatchObject({ estado: 'ACTIVA', stock: 2, razon_pausa: null });
    expect(ids(await misOfertas('activas'))).toContain(id);
  });
});
