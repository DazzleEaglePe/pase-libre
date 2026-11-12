import type { INestApplication } from '@nestjs/common';
import type {
  ConversacionEnLista,
  HiloEquipoEnLista,
  OfertaConVendedor,
  RespuestaInicio,
  RespuestaNovedades,
  TiendaEnPanel,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const LOGO_A = 'tiendas/logo-a.webp';

/**
 * El logo de la tienda en todos lados (docs/18, punto 6): cada respuesta que pinta el círculo
 * de una tienda trae su `logo` (la ruta para `urlFoto`), o nulo para que salgan las iniciales.
 */
describe('Logo de la tienda (1.9.0, punto 6)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let tiendaA = '';

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

  const get = async (ruta: string, usuario: string) =>
    (
      await http()
        .get(ruta)
        .set('Cookie', await como(usuario))
        .expect(200)
    ).body;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    const tienda = await prisma.tienda.update({
      where: { id: (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id },
      data: { logo: LOGO_A },
    });
    tiendaA = tienda.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('la sesión trae el logo de tu tienda: cabecera, menú, saludo y Tu cuenta', async () => {
    const ingreso = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario: 'tiendaa', clave: CLAVE_DEMO })
      .expect(200);
    expect(ingreso.body.tienda).toMatchObject({ nombre: 'Tienda A', logo: LOGO_A });
    expect((await get('/v1/yo', 'tiendaa')).tienda).toMatchObject({ logo: LOGO_A });
    // Sin logo: nulo, y salen las iniciales.
    expect((await get('/v1/yo', 'tiendac')).tienda).toMatchObject({
      nombre: 'Tienda C',
      logo: null,
    });
  });

  it('«Tiendas que ya están» y el piloto traen el logo de cada una', async () => {
    const inicio = (await get('/v1/inicio', 'tiendac')) as RespuestaInicio;
    const a = inicio.tiendas.visibles.find((tienda) => tienda.id === tiendaA);
    expect(a).toMatchObject({ nombre: 'Tienda A', logo: LOGO_A });
    for (const tienda of inicio.tiendas.visibles) expect(tienda).toHaveProperty('logo');
  });

  it('la ficha trae el logo de cada tienda que lo tiene', async () => {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', tiendaVisible: true },
      select: { producto: { select: { slug: true } } },
    });
    const ficha = await get(`/v1/productos/${oferta.producto.slug}`, 'tiendab');
    const ofertas = ficha.ofertas as OfertaConVendedor[];
    expect(ofertas.find((o) => o.tienda.id === tiendaA)?.tienda.logo).toBe(LOGO_A);
    for (const o of ofertas) expect(o.tienda).toHaveProperty('logo');
  });

  it('la bandeja y el chat traen el logo de la otra tienda', async () => {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA', tiendaVisible: true, stock: { gt: 0 } },
      select: { id: true },
    });
    const contacto = await http()
      .post(`/v1/ofertas/${oferta.id}/contacto`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ canal: 'CHAT' })
      .expect(200);
    const id = contacto.body.conversacion_id as string;
    await http()
      .post(`/v1/conversaciones/${id}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .send({ texto: '¿Sigue disponible?' })
      .expect(201);

    const bandeja = await get('/v1/conversaciones', 'tiendab');
    const enLista = (bandeja.conversaciones as ConversacionEnLista[]).find((c) => c.id === id);
    expect(enLista?.otro.tienda).toMatchObject({ nombre: 'Tienda A', logo: LOGO_A });
    expect((await get(`/v1/conversaciones/${id}`, 'tiendab')).otro.tienda.logo).toBe(LOGO_A);
    // Del otro lado, Tienda B no tiene logo: nulo.
    expect((await get(`/v1/conversaciones/${id}`, 'tiendaa')).otro.tienda).toMatchObject({
      nombre: 'Tienda B',
      logo: null,
    });
  });

  it('las tiendas seguidas: los círculos de arriba, las novedades y las sugeridas', async () => {
    await http()
      .post(`/v1/tiendas/${tiendaA}/seguir`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendac'))
      .send({})
      .expect(200);
    const datos = (await get('/v1/seguidas/novedades', 'tiendac')) as RespuestaNovedades;
    expect(datos.seguidas).toEqual([
      expect.objectContaining({ id: tiendaA, nombre: 'Tienda A', logo: LOGO_A }),
    ]);
    expect(datos.novedades.length).toBeGreaterThan(0);
    for (const novedad of datos.novedades) expect(novedad.tienda.logo).toBe(LOGO_A);
    expect(datos.sugeridas.length).toBeGreaterThan(0);
    for (const sugerida of datos.sugeridas) expect(sugerida).toHaveProperty('logo');
  });

  it('el panel del Equipo: Tiendas, su ficha y los chats', async () => {
    const lista = (await get('/v1/equipo/panel/tiendas', 'equipo')) as TiendaEnPanel[];
    expect(lista.find((tienda) => tienda.id === tiendaA)?.logo).toBe(LOGO_A);
    expect((await get(`/v1/equipo/panel/tiendas/${tiendaA}`, 'equipo')).logo).toBe(LOGO_A);

    await http()
      .post(`/v1/equipo/chats/${tiendaA}/mensajes`)
      .set(CABECERAS)
      .set('Cookie', await como('equipo'))
      .send({ texto: 'Hola, Tienda A. Soy del equipo PaseLibre.' })
      .expect(201);
    const hilos = (await get('/v1/equipo/chats', 'equipo')) as HiloEquipoEnLista[];
    expect(hilos.find((hilo) => hilo.tienda.id === tiendaA)?.tienda.logo).toBe(LOGO_A);
  });
});
