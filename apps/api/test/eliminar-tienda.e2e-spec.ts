import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type {
  ConversacionEnLista,
  DetalleConversacion,
  FichaTienda,
  RespuestaConversaciones,
  RespuestaMensajes,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
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

const HORA = 3_600_000;

/**
 * Doc 19 §9: suspender al instante (sin contraseña, con motivo opcional) y «Eliminar
 * definitivamente» recién 24 h después, con la contraseña de la persona del Equipo (3 errores =
 * 15 min). Se borra todo lo de la tienda y nada de las demás: en los chats, la otra tienda
 * conserva sus mensajes y ve «Tienda eliminada».
 */
describe('Suspender y eliminar una tienda (doc 19 §9)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies: Record<string, string> = {};

  let tiendaA: string;
  let tiendaB: string;
  let tiendaC: string;
  let usuariosA: string[];
  let equipoId: string;
  /** B le compra a A: el chat queda para B, sin la publicación. */
  let chatBCompraA: string;
  /** A le compra a B: el chat y la venta quedan para B. */
  let chatACompraB: string;
  /** A le escribió a C y C nunca contestó: se borra. */
  let chatSoloDeA: string;
  let ofertasA: string[];
  let ventaDeB: string;
  let productoCreadoPorA: string;
  let rutaLogo: string;
  let avisoAjeno: string;

  const ingreso = (usuario: string, clave = CLAVE_DEMO) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave, cerrar: 'todas' });

  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    send: (metodo: 'post' | 'patch' | 'put' | 'delete', ruta: string, cuerpo?: object) => {
      const peticion = http();
      return peticion[metodo](ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo);
    },
  });

  const escribir = (usuario: string, conversacion: string, texto: string) =>
    como(usuario)
      .send('post', `/v1/conversaciones/${conversacion}/mensajes`, { texto })
      .expect(201);

  async function ofertaVisible(tienda: string) {
    return prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tienda, estado: 'ACTIVA', tiendaVisible: true, stock: { gt: 0 } },
      orderBy: { creadaEn: 'asc' },
    });
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = cookieDe(await ingreso(usuario).expect(200));
    }
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
    tiendaB = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } })).id;
    tiendaC = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda C' } })).id;
    usuariosA = (await prisma.usuario.findMany({ where: { tiendaId: tiendaA } })).map((u) => u.id);
    equipoId = (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'equipo' } })).id;

    // ── Lo que A deja en PaseLibre antes de que la suspendan ──────────────────
    const deA = await ofertaVisible(tiendaA);
    const deB = await ofertaVisible(tiendaB);
    const deC = await ofertaVisible(tiendaC);
    chatBCompraA = (
      await como('tiendab').send('post', `/v1/ofertas/${deA.id}/contacto`, { canal: 'CHAT' })
    ).body.conversacion_id as string;
    await escribir('tiendab', chatBCompraA, 'Hola, ¿la tienes todavía?');
    await escribir('tiendaa', chatBCompraA, 'Sí, pasa por el stand 212.');
    await como('tiendaa')
      .send('post', `/v1/ofertas/${deA.id}/vendido`, { conversacion_id: chatBCompraA })
      .expect(201);

    chatACompraB = (
      await como('tiendaa').send('post', `/v1/ofertas/${deB.id}/contacto`, { canal: 'CHAT' })
    ).body.conversacion_id as string;
    await escribir('tiendaa', chatACompraB, 'Hola Carla, ¿me separas una?');
    await escribir('tiendab', chatACompraB, 'Listo, te la separo.');
    await como('tiendab')
      .send('post', `/v1/ofertas/${deB.id}/vendido`, { conversacion_id: chatACompraB })
      .expect(201);
    ventaDeB = (await prisma.venta.findFirstOrThrow({ where: { ofertaId: deB.id } })).id;

    chatSoloDeA = (
      await como('tiendaa').send('post', `/v1/ofertas/${deC.id}/contacto`, { canal: 'CHAT' })
    ).body.conversacion_id as string;
    await escribir('tiendaa', chatSoloDeA, '¿Precio por mayor?');

    // B opina de A por la venta, y A de B.
    const ventaDeA = await prisma.venta.findFirstOrThrow({ where: { ofertaId: deA.id } });
    const [duenoA, duenoB] = await Promise.all([
      prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } }),
      prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendab' } }),
    ]);
    await prisma.opinion.create({
      data: {
        ventaId: ventaDeA.id,
        lado: 'COMPRADOR',
        autorTiendaId: tiendaB,
        autorId: duenoB.id,
        tiendaId: tiendaA,
        estrellas: 5,
      },
    });
    await prisma.opinion.create({
      data: {
        ventaId: ventaDeB,
        lado: 'COMPRADOR',
        autorTiendaId: tiendaA,
        autorId: duenoA.id,
        tiendaId: tiendaB,
        estrellas: 4,
      },
    });

    // Seguidores, socios, bloqueos, reportes, avisos, pedido en vivo, chat con el Equipo.
    await prisma.seguimiento.create({
      data: { tiendaId: tiendaB, seguidaId: tiendaA, usuarioId: duenoB.id },
    });
    await prisma.seguimiento.create({
      data: { tiendaId: tiendaA, seguidaId: tiendaC, usuarioId: duenoA.id },
    });
    await prisma.socio.create({ data: { tiendaId: tiendaA, socioId: tiendaB } });
    await prisma.bloqueo.create({ data: { usuarioId: duenoB.id, tiendaBloqueadaId: tiendaA } });
    await prisma.denuncia.create({
      data: {
        denuncianteId: duenoB.id,
        objeto: 'TIENDA',
        objetoId: tiendaA,
        tiendaDenunciadaId: tiendaA,
        tipo: 'ESTAFA',
      },
    });
    await prisma.denuncia.create({
      data: {
        denuncianteId: duenoA.id,
        objeto: 'TIENDA',
        objetoId: tiendaC,
        tiendaDenunciadaId: tiendaC,
        tipo: 'TRATO',
      },
    });
    await prisma.aviso.create({
      data: {
        usuarioId: duenoB.id,
        tipo: 'SEGUIDA',
        titulo: 'Tienda A publicó algo nuevo',
        enlace: `/tiendas/${tiendaA}`,
      },
    });
    avisoAjeno = (
      await prisma.aviso.create({
        data: { usuarioId: duenoB.id, tipo: 'EQUIPO', titulo: 'Novedades', enlace: '/avisos' },
      })
    ).id;
    const categoria = await prisma.categoria.findFirstOrThrow();
    await prisma.enVivo.create({
      data: {
        tipo: 'BUSCO',
        autorId: duenoA.id,
        tiendaId: tiendaA,
        categoriaId: categoria.id,
        titulo: 'Busco RTX 3060',
        venceEn: new Date(Date.now() + 4 * HORA),
      },
    });
    await prisma.hiloEquipo.create({
      data: {
        tiendaId: tiendaA,
        mensajes: { create: { autorId: duenoA.id, deEquipo: false, texto: 'Hola Equipo' } },
      },
    });
    productoCreadoPorA = deB.productoId;
    await prisma.producto.update({
      where: { id: productoCreadoPorA },
      data: { creadoPorTiendaId: tiendaA },
    });
    // El logo de A, con su archivo en la carpeta de fotos.
    rutaLogo = `2026/11/${randomUUID()}.webp`;
    const destino = join(CARPETA_MEDIA_PRUEBAS, rutaLogo);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, 'logo de prueba');
    await prisma.archivo.create({
      data: {
        usuarioId: duenoA.id,
        tiendaId: tiendaA,
        ruta: rutaLogo,
        ancho: 10,
        alto: 10,
        bytes: 14,
        usadoEn: new Date(),
      },
    });
    await prisma.tienda.update({ where: { id: tiendaA }, data: { logo: rutaLogo } });
    ofertasA = (await prisma.oferta.findMany({ where: { tiendaId: tiendaA } })).map((o) => o.id);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('suspender: al instante, sin contraseña, con motivo, y se cierran sus sesiones', async () => {
    await como('tiendab')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaA}/suspension`, { suspender: true })
      .expect(403);
    // No hay campo para la contraseña: suspender nunca la pide.
    await como('equipo')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaA}/suspension`, {
        suspender: true,
        clave: CLAVE_DEMO,
      })
      .expect(400);
    await como('equipo')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaA}/suspension`, {
        suspender: true,
        motivo: 'Spam o publicaciones falsas',
      })
      .expect(204);

    const tienda = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } });
    expect(tienda).toMatchObject({
      estado: 'SUSPENDIDA',
      suspendidaPorId: equipoId,
      motivoSuspension: 'Spam o publicaciones falsas',
    });
    expect(Date.now() - (tienda.suspendidaEn?.getTime() ?? 0)).toBeLessThan(60_000);
    expect(
      await prisma.sesion.count({ where: { usuarioId: { in: usuariosA }, revocadaEn: null } }),
    ).toBe(0);
    await como('tiendaa').get('/v1/yo').expect(401);

    const ficha = (
      await como('equipo').get(`/v1/equipo/panel/tiendas/${tiendaA}/ficha`).expect(200)
    ).body as FichaTienda;
    expect(ficha.suspendida).toBe(true);
    expect(ficha.puede_eliminar).toBe(true);
    expect(ficha.suspension).toMatchObject({ por: 'Dazz', motivo: 'Spam o publicaciones falsas' });
    expect(
      Date.parse(ficha.suspension?.eliminable_desde ?? '') - Date.parse(ficha.suspension?.en ?? ''),
    ).toBe(24 * HORA);
    expect(ficha.suspension?.publicaciones.activas).toBeGreaterThan(0);

    // Suspender otra vez no reinicia las 24 h.
    await prisma.tienda.update({
      where: { id: tiendaA },
      data: { suspendidaEn: new Date(Date.now() - 2 * HORA) },
    });
    await como('equipo')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaA}/suspension`, { suspender: true })
      .expect(204);
    const otraVez = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } });
    expect(Date.now() - (otraVez.suspendidaEn?.getTime() ?? 0)).toBeGreaterThan(HORA);
    expect(otraVez.motivoSuspension).toBe('Spam o publicaciones falsas');
  });

  it('reactivar no pierde nada y la vuelve a cero', async () => {
    await como('equipo')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaC}/suspension`, { suspender: true })
      .expect(204);
    await como('equipo')
      .send('post', `/v1/equipo/panel/tiendas/${tiendaC}/suspension`, { suspender: false })
      .expect(204);
    expect(await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaC } })).toMatchObject({
      estado: 'ACTIVA',
      suspendidaEn: null,
      suspendidaPorId: null,
      motivoSuspension: null,
    });
    const ficha = (
      await como('equipo').get(`/v1/equipo/panel/tiendas/${tiendaC}/ficha`).expect(200)
    ).body as FichaTienda;
    expect(ficha.suspension).toBeNull();
  });

  it('eliminar: solo el Equipo, solo suspendida y recién 24 h después', async () => {
    const ruta = `/v1/equipo/panel/tiendas/${tiendaA}`;
    await http().delete(ruta).set(CABECERAS).send({ clave: CLAVE_DEMO }).expect(401);
    await como('tiendab').send('delete', ruta, { clave: CLAVE_DEMO }).expect(403);
    await como('equipo').send('delete', ruta, {}).expect(400);

    const activa = await como('equipo')
      .send('delete', `/v1/equipo/panel/tiendas/${tiendaC}`, { clave: CLAVE_DEMO })
      .expect(409);
    expect(activa.body.error.mensaje).toMatch(/^Primero suspende a Tienda C/);

    // Suspendida hace 2 h: faltan 22 h.
    const temprano = await como('equipo').send('delete', ruta, { clave: CLAVE_DEMO }).expect(409);
    expect(temprano.body.error.mensaje).toMatch(
      /^Podrás eliminarla en 22 h \((hoy|mañana) \d{2}:\d{2}\)\. Mientras tanto se puede reactivar sin perder nada\.$/,
    );
    expect(await prisma.tienda.count({ where: { id: tiendaA } })).toBe(1);
  });

  it('pide tu contraseña, no la de la tienda: con 3 errores espera 15 min', async () => {
    await prisma.tienda.update({
      where: { id: tiendaA },
      data: { suspendidaEn: new Date(Date.now() - 25 * HORA) },
    });
    const ruta = `/v1/equipo/panel/tiendas/${tiendaA}`;
    const primero = await como('equipo')
      .send('delete', ruta, { clave: 'no-es-esta-1' })
      .expect(400);
    expect(primero.body.error).toMatchObject({
      codigo: 'CLAVE_ACTUAL_INCORRECTA',
      mensaje: 'Esa no es tu contraseña. Te quedan 2 intentos.',
    });
    const segundo = await como('equipo')
      .send('delete', ruta, { clave: 'no-es-esta-2' })
      .expect(400);
    expect(segundo.body.error.mensaje).toBe('Esa no es tu contraseña. Te queda 1 intento.');
    const tercero = await como('equipo')
      .send('delete', ruta, { clave: 'no-es-esta-3' })
      .expect(429);
    expect(tercero.body.error).toMatchObject({
      codigo: 'CUENTA_BLOQUEADA_TEMPORALMENTE',
      mensaje: 'Escribiste mal tu contraseña 3 veces. Vuelve a intentarlo en 15 min.',
    });
    // Bloqueada, ni con la correcta.
    await como('equipo').send('delete', ruta, { clave: CLAVE_DEMO }).expect(429);
    expect(await prisma.tienda.count({ where: { id: tiendaA } })).toBe(1);
    // El bloqueo es solo de esto: el panel y el ingreso siguen.
    await como('equipo').get('/v1/equipo/inicio').expect(200);
    expect(
      (await prisma.usuario.findUniqueOrThrow({ where: { id: equipoId } })).intentosFallidos,
    ).toBe(0);

    // Pasan 16 minutos.
    await prisma.auditoria.updateMany({
      where: { actorId: equipoId, accion: { startsWith: 'eliminar_tienda' } },
      data: { creadaEn: new Date(Date.now() - 16 * 60_000) },
    });
    const otraVez = await como('equipo')
      .send('delete', ruta, { clave: 'no-es-esta-4' })
      .expect(400);
    expect(otraVez.body.error.mensaje).toBe('Esa no es tu contraseña. Te quedan 2 intentos.');
  });

  it('si algo de otra tienda depende de ella, no se borra nada', async () => {
    const deB = await ofertaVisible(tiendaB);
    const extraña = await prisma.venta.create({
      data: {
        ofertaId: deB.id,
        stockAntes: 2,
        stockDespues: 1,
        registradaPorId: usuariosA[0] ?? '',
      },
    });
    const respuesta = await como('equipo')
      .send('delete', `/v1/equipo/panel/tiendas/${tiendaA}`, { clave: CLAVE_DEMO })
      .expect(409);
    expect(respuesta.body.error.mensaje).toMatch(/No se borró nada/);
    expect(await prisma.tienda.count({ where: { id: tiendaA } })).toBe(1);
    expect(await prisma.mensaje.count({ where: { autorId: { in: usuariosA } } })).toBe(3);
    expect(await prisma.oferta.count({ where: { tiendaId: tiendaA } })).toBe(ofertasA.length);
    expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, rutaLogo))).toBe(true);
    await prisma.venta.delete({ where: { id: extraña.id } });
  });

  it('con la contraseña correcta se borra todo lo de la tienda y nada de las demás', async () => {
    const ofertasB = await prisma.oferta.count({ where: { tiendaId: tiendaB } });
    const ofertasC = await prisma.oferta.count({ where: { tiendaId: tiendaC } });
    await como('equipo')
      .send('delete', `/v1/equipo/panel/tiendas/${tiendaA}`, { clave: CLAVE_DEMO })
      .expect(204);

    // La tienda, sus personas y sus sesiones.
    expect(await prisma.tienda.count({ where: { id: tiendaA } })).toBe(0);
    expect(await prisma.usuario.count({ where: { id: { in: usuariosA } } })).toBe(0);
    expect(await prisma.sesion.count({ where: { usuarioId: { in: usuariosA } } })).toBe(0);
    // Sus publicaciones y fotos; su perfil (el archivo del logo ya no está).
    expect(await prisma.oferta.count({ where: { id: { in: ofertasA } } })).toBe(0);
    expect(await prisma.ofertaFoto.count({ where: { ofertaId: { in: ofertasA } } })).toBe(0);
    expect(await prisma.archivo.count({ where: { ruta: rutaLogo } })).toBe(0);
    expect(existsSync(join(CARPETA_MEDIA_PRUEBAS, rutaLogo))).toBe(false);
    // Sus pedidos en vivo, sus avisos y los avisos de otros que llevan a su perfil.
    expect(await prisma.enVivo.count({ where: { tiendaId: tiendaA } })).toBe(0);
    expect(await prisma.aviso.count({ where: { usuarioId: { in: usuariosA } } })).toBe(0);
    expect(await prisma.aviso.count({ where: { enlace: { contains: tiendaA } } })).toBe(0);
    expect(await prisma.aviso.count({ where: { id: avisoAjeno } })).toBe(1);
    // Seguidores, socios, bloqueos, opiniones, chat con el Equipo, reportes que hizo.
    expect(
      await prisma.seguimiento.count({
        where: { OR: [{ tiendaId: tiendaA }, { seguidaId: tiendaA }] },
      }),
    ).toBe(0);
    expect(
      await prisma.socio.count({ where: { OR: [{ tiendaId: tiendaA }, { socioId: tiendaA }] } }),
    ).toBe(0);
    expect(await prisma.bloqueo.count({ where: { tiendaBloqueadaId: tiendaA } })).toBe(0);
    expect(
      await prisma.opinion.count({
        where: { OR: [{ tiendaId: tiendaA }, { autorTiendaId: tiendaA }] },
      }),
    ).toBe(0);
    expect(await prisma.hiloEquipo.count({ where: { tiendaId: tiendaA } })).toBe(0);
    expect(await prisma.denuncia.count({ where: { denuncianteId: { in: usuariosA } } })).toBe(0);
    expect(await prisma.mensaje.count({ where: { autorId: { in: usuariosA } } })).toBe(0);

    // Las otras tiendas, intactas.
    expect(await prisma.oferta.count({ where: { tiendaId: tiendaB } })).toBe(ofertasB);
    expect(await prisma.oferta.count({ where: { tiendaId: tiendaC } })).toBe(ofertasC);
    // La venta de B a A sigue, sin comprador; el producto que creó A sigue en el catálogo.
    expect(await prisma.venta.findUniqueOrThrow({ where: { id: ventaDeB } })).toMatchObject({
      compradorId: null,
      tiendaCompradoraId: null,
    });
    expect(
      await prisma.producto.findUniqueOrThrow({ where: { id: productoCreadoPorA } }),
    ).toMatchObject({ creadoPorTiendaId: null });
    // El reporte de B contra A queda (es de B), cerrado y sin tienda.
    const reporte = await prisma.denuncia.findFirstOrThrow({ where: { objetoId: tiendaA } });
    expect(reporte).toMatchObject({ tiendaDenunciadaId: null, estado: 'REVISADA' });

    // En el historial del Equipo queda solo el nombre, quién y cuándo.
    expect(await prisma.registroEquipo.count({ where: { tiendaId: tiendaA } })).toBe(0);
    const anotado = await prisma.registroEquipo.findFirstOrThrow({
      where: { accion: { contains: 'Tienda A' } },
    });
    expect(anotado).toMatchObject({
      accion: 'eliminó a Tienda A',
      autorId: equipoId,
      tiendaId: null,
    });

    // Ni filas que apunten a la tienda o a sus personas.
    const [huerfanas] = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT (
        (SELECT count(*) FROM conversacion WHERE tienda_compradora_id = ${tiendaA}::uuid
           OR tienda_vendedora_id = ${tiendaA}::uuid
           OR comprador_id = ANY(${usuariosA}::uuid[]) OR vendedor_id = ANY(${usuariosA}::uuid[]))
        + (SELECT count(*) FROM solicitud WHERE tienda_id = ${tiendaA}::uuid)
        + (SELECT count(*) FROM mensaje WHERE ${usuariosA}::uuid[] && oculto_para)
      )::int AS total`;
    expect(huerfanas?.total).toBe(0);
  });

  it('en los chats, la otra tienda conserva sus mensajes y ve «Tienda eliminada»', async () => {
    // El chat en el que solo escribió A ya no existe.
    expect(await prisma.conversacion.count({ where: { id: chatSoloDeA } })).toBe(0);

    const { body } = await como('tiendab').get('/v1/conversaciones').expect(200);
    const lista = (body as RespuestaConversaciones).conversaciones;
    const compra = lista.find((c) => c.id === chatBCompraA) as ConversacionEnLista;
    const venta = lista.find((c) => c.id === chatACompraB) as ConversacionEnLista;
    expect(compra).toMatchObject({
      otra_eliminada: true,
      otro: { id: '', nombre: 'Tienda eliminada', tienda: { id: '', nombre: 'Tienda eliminada' } },
      oferta: { id: '', producto: { titulo: 'Publicación eliminada' } },
    });
    expect(venta).toMatchObject({ rol: 'vendedor', otra_eliminada: true });
    expect(venta.otro.nombre).toBe('Tienda eliminada');

    const detalle = (await como('tiendab').get(`/v1/conversaciones/${chatBCompraA}`).expect(200))
      .body as DetalleConversacion;
    expect(detalle).toMatchObject({
      otra_eliminada: true,
      puede_vender: false,
      sobre_tienda: null,
      whatsapp: { puedes_pedir: false, puedes_compartir: false },
    });
    const mensajes = (
      await como('tiendab').get(`/v1/conversaciones/${chatBCompraA}/mensajes`).expect(200)
    ).body as RespuestaMensajes;
    const textos = mensajes.mensajes.filter((m) => m.tipo === 'TEXTO').map((m) => m.texto);
    expect(textos).toEqual(['Hola, ¿la tienes todavía?']);
    const deB = (
      await como('tiendab').get(`/v1/conversaciones/${chatACompraB}/mensajes`).expect(200)
    ).body as RespuestaMensajes;
    expect(deB.mensajes.filter((m) => m.tipo === 'TEXTO').map((m) => m.texto)).toEqual([
      'Listo, te la separo.',
    ]);

    // Ya no se escribe ni se le pide el WhatsApp; archivar sí.
    const escrito = await como('tiendab')
      .send('post', `/v1/conversaciones/${chatBCompraA}/mensajes`, { texto: '¿Hola?' })
      .expect(409);
    expect(escrito.body.error.mensaje).toMatch(/ya no está en PaseLibre/);
    await como('tiendab')
      .send('post', `/v1/conversaciones/${chatBCompraA}/whatsapp/pedido`)
      .expect(409);
    await como('tiendab')
      .send('patch', `/v1/conversaciones/${chatBCompraA}`, { archivada: true, leida: true })
      .expect(200);

    // El Equipo lo lee igual desde la ficha de B.
    const chats = await como('equipo')
      .get(`/v1/equipo/panel/tiendas/${tiendaB}/conversaciones`)
      .expect(200);
    expect(
      (chats.body.chats as Array<{ id: string; con: string; producto: string }>).find(
        (chat) => chat.id === chatBCompraA,
      ),
    ).toMatchObject({ con: 'Tienda eliminada', producto: 'Publicación eliminada' });
  });

  it('en Cuentas, suspender una cuenta tampoco pide contraseña y guarda el motivo', async () => {
    const rosa = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendac' } });
    await como('equipo')
      .send('patch', `/v1/equipo/cuentas/${rosa.id}`, {
        estado: 'SUSPENDIDA',
        motivo: 'Suplantación',
      })
      .expect(200);
    const auditoria = await prisma.auditoria.findFirstOrThrow({
      where: { objetoId: rosa.id, accion: 'suspender' },
    });
    expect(auditoria.datos).toEqual({ motivo: 'Suplantación' });
    await como('equipo')
      .send('patch', `/v1/equipo/cuentas/${rosa.id}`, { estado: 'ACTIVA' })
      .expect(200);
  });
});
