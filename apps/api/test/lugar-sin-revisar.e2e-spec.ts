import type { INestApplication } from '@nestjs/common';
import type { CambioDeLugar, RespuestaCuenta, RespuestaInicioEquipo } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Doc 19 §10: la tienda cambia su galería o stand y queda al instante (salvo «Otra galería»). El
 * Equipo lo ve en Solicitudes («Cambios de galería o stand · N») y decide después: Está bien,
 * Corregir o Deshacer. El número de Solicitudes los cuenta.
 */
describe('Cambio de galería o stand sin aprobación (doc 19 §10)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies: Record<string, string> = {};
  let tiendaA: string;
  let tiendaB: string;
  let maxi: string;
  let cyber: string;

  const ingreso = (usuario: string) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave: CLAVE_DEMO, cerrar: 'todas' });

  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    send: (metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo?: object) => {
      const peticion = http();
      return peticion[metodo](ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo);
    },
  });

  const cambios = async () =>
    (await como('equipo').get('/v1/equipo/cambios-de-lugar').expect(200)).body as CambioDeLugar[];
  const solicitudes = async () =>
    ((await como('equipo').get('/v1/equipo/inicio').expect(200)).body as RespuestaInicioEquipo)
      .solicitudes;
  const avisosDelEquipo = (tiendaId: string) =>
    prisma.aviso.count({ where: { tipo: 'EQUIPO', usuario: { tiendaId } } });

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = cookieDe(await ingreso(usuario).expect(200));
    }
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
    tiendaB = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } })).id;
    maxi = (await prisma.galeria.findUniqueOrThrow({ where: { slug: 'maxiplaza' } })).id;
    cyber = (await prisma.galeria.findUniqueOrThrow({ where: { slug: 'cyberplaza' } })).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('con una galería de la lista, el perfil cambia al instante y el Equipo lo ve', async () => {
    const antes = await solicitudes();
    const { body } = await como('tiendaa')
      .send('put', '/v1/cuenta/lugar', { galeria_id: cyber, piso: '3', stand: '3A 110' })
      .expect(200);
    const cuenta = body as RespuestaCuenta;
    expect(cuenta.tienda).toMatchObject({
      galeria: 'Cyberplaza',
      galeria_id: cyber,
      piso: '3',
      stand: '3A 110',
      lugar_pendiente: null,
    });
    const perfil = await como('tiendac').get(`/v1/tiendas/${tiendaA}`).expect(200);
    expect(perfil.body).toMatchObject({ galeria: 'Cyberplaza', stand: '3A 110' });

    const fila = await prisma.cambioLugar.findFirstOrThrow({ where: { tiendaId: tiendaA } });
    expect(fila).toMatchObject({
      estado: 'APLICADO_SIN_REVISAR',
      galeriaId: cyber,
      piso: '3',
      stand: '3A 110',
      galeriaAntesId: maxi,
      standAntes: '212',
    });
    const [cambio] = await cambios();
    expect(cambio).toMatchObject({
      estado: 'APLICADO_SIN_REVISAR',
      tienda: { id: tiendaA, nombre: 'Tienda A' },
      antes: { galeria: 'Maxiplaza', stand: '212' },
      despues: { galeria: 'Cyberplaza', piso: '3', stand: '3A 110' },
      galeria_otra: null,
      pedido_por: 'Luis P.',
    });
    // «Solicitudes N» lo cuenta.
    expect(await solicitudes()).toBe(antes + 1);
  });

  it('otro cambio antes de que el Equipo lo mire queda en la misma tarjeta; volver lo retira', async () => {
    await como('tiendaa.kevin')
      .send('put', '/v1/cuenta/lugar', { galeria_id: cyber, piso: '3', stand: '3A 111' })
      .expect(200);
    const lista = await cambios();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      antes: { galeria: 'Maxiplaza', stand: '212' },
      despues: { stand: '3A 111' },
      pedido_por: 'Kevin S.',
    });

    const antes = await solicitudes();
    await como('tiendaa')
      .send('put', '/v1/cuenta/lugar', { galeria_id: maxi, stand: '212' })
      .expect(200);
    expect(await cambios()).toHaveLength(0);
    expect(await solicitudes()).toBe(antes - 1);
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } })).toMatchObject({
      galeriaId: maxi,
      stand: '212',
    });
  });

  it('«Está bien»: se archiva, el número baja y a la tienda no le llega nada', async () => {
    await como('tiendaa')
      .send('put', '/v1/cuenta/lugar', { galeria_id: cyber, piso: '3', stand: '3A 110' })
      .expect(200);
    const [cambio] = await cambios();
    const antes = await solicitudes();
    const avisos = await avisosDelEquipo(tiendaA);
    await como('tiendaa')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
      .expect(403);
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
      .expect(204);
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
      .expect(404);
    expect(await prisma.cambioLugar.findUniqueOrThrow({ where: { id: cambio?.id } })).toMatchObject(
      { estado: 'APROBADO' },
    );
    expect(await solicitudes()).toBe(antes - 1);
    expect(await avisosDelEquipo(tiendaA)).toBe(avisos);
    // La tienda sigue donde se puso.
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } })).toMatchObject({
      galeriaId: cyber,
      stand: '3A 110',
    });
  });

  it('«Corregir»: el Equipo lo arregla ahí mismo («2b105» → «2B 105»)', async () => {
    await como('tiendab')
      .send('put', '/v1/cuenta/lugar', { galeria_id: cyber, piso: '2', stand: '2b105' })
      .expect(200);
    const cambio = (await cambios()).find((c) => c.tienda.id === tiendaB);
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/corregir`, { galeria_id: cyber })
      .expect(400);
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/corregir`, {
        galeria_id: cyber,
        piso: '2',
        stand: '2B 105',
      })
      .expect(204);
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB } })).toMatchObject({
      galeriaId: cyber,
      piso: '2',
      stand: '2B 105',
    });
    expect(await prisma.cambioLugar.findUniqueOrThrow({ where: { id: cambio?.id } })).toMatchObject(
      { estado: 'APROBADO', stand: '2B 105' },
    );
    expect(await cambios()).toHaveLength(0);
  });

  it('«Deshacer»: vuelve a como estaba y le avisa a la tienda, con el motivo', async () => {
    await como('tiendab')
      .send('put', '/v1/cuenta/lugar', { galeria_id: maxi, stand: '999' })
      .expect(200);
    const cambio = (await cambios()).find((c) => c.tienda.id === tiendaB);
    expect(cambio?.antes).toMatchObject({ galeria: 'Cyberplaza', piso: '2', stand: '2B 105' });
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/deshacer`, {
        motivo: 'Ese stand no existe en Maxiplaza.',
      })
      .expect(204);
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB } })).toMatchObject({
      galeriaId: cyber,
      piso: '2',
      stand: '2B 105',
    });
    expect(await prisma.cambioLugar.findUniqueOrThrow({ where: { id: cambio?.id } })).toMatchObject(
      { estado: 'RECHAZADO', motivo: 'Ese stand no existe en Maxiplaza.' },
    );
    const aviso = await prisma.aviso.findFirstOrThrow({
      where: {
        usuario: { usuario: 'tiendab' },
        titulo: 'El Equipo deshizo tu cambio de galería o stand',
      },
    });
    expect(aviso.extracto).toBe(
      'Motivo: Ese stand no existe en Maxiplaza. Tu perfil vuelve a decir Cyberplaza · Piso 2 · Stand 2B 105.',
    );
    // Deshacer solo los aplicados; uno ya resuelto no.
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/deshacer`, {})
      .expect(404);
  });

  it('«Otra galería» sigue pendiente: el perfil no cambia hasta que el Equipo la crea', async () => {
    const antes = await solicitudes();
    await como('tiendab')
      .send('put', '/v1/cuenta/lugar', { galeria_id: cyber, galeria_otra: 'Galería X', stand: '1' })
      .expect(400);
    await como('tiendab').send('put', '/v1/cuenta/lugar', { stand: '1' }).expect(400);
    const { body } = await como('tiendab')
      .send('put', '/v1/cuenta/lugar', { galeria_otra: 'Galería Nueva Wilson', stand: '5' })
      .expect(200);
    expect((body as RespuestaCuenta).tienda).toMatchObject({
      galeria: 'Cyberplaza',
      stand: '2B 105',
      lugar_pendiente: { galeria_id: null, galeria: 'Galería Nueva Wilson', stand: '5' },
    });
    const cambio = (await cambios()).find((c) => c.tienda.id === tiendaB);
    expect(cambio).toMatchObject({
      estado: 'PENDIENTE',
      galeria_otra: 'Galería Nueva Wilson',
      antes: { galeria: 'Cyberplaza', stand: '2B 105' },
      despues: { galeria_id: null, galeria: 'Galería Nueva Wilson', stand: '5' },
    });
    expect(await solicitudes()).toBe(antes + 1);
    // No hay galería que confirmar hasta que el Equipo la cree y la elija.
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
      .expect(409);
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/deshacer`, {})
      .expect(404);

    const creada = await prisma.galeria.create({
      data: { nombre: 'Galería Nueva Wilson', slug: 'galeria-nueva-wilson' },
    });
    await como('equipo')
      .send('post', `/v1/equipo/cambios-de-lugar/${cambio?.id}/corregir`, {
        galeria_id: creada.id,
        stand: '5',
      })
      .expect(204);
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB } })).toMatchObject({
      galeriaId: creada.id,
      piso: null,
      stand: '5',
    });
    expect(
      await prisma.aviso.count({
        where: { usuario: { usuario: 'tiendab' }, titulo: 'El Equipo confirmó tu nuevo lugar' },
      }),
    ).toBe(1);
    expect(await solicitudes()).toBe(antes);
  });

  it('el número de Solicitudes suma las cuentas por aprobar y los cambios sin revisar', async () => {
    await prisma.cambioLugar.updateMany({
      where: { estado: { in: ['PENDIENTE', 'APLICADO_SIN_REVISAR'] } },
      data: { estado: 'RETIRADO' },
    });
    const base = await prisma.solicitud.count({ where: { estado: 'PENDIENTE' } });
    expect(await solicitudes()).toBe(base);
    await como('tiendaa')
      .send('put', '/v1/cuenta/lugar', { galeria_id: maxi, stand: '212' })
      .expect(200);
    await como('tiendab')
      .send('put', '/v1/cuenta/lugar', { galeria_otra: 'Otra más', stand: '7' })
      .expect(200);
    const inicio = (await como('equipo').get('/v1/equipo/inicio').expect(200))
      .body as RespuestaInicioEquipo;
    expect(inicio.solicitudes).toBe(base + 2);
    expect(inicio.por_revisar).toBeGreaterThanOrEqual(base + 2);
  });
});
