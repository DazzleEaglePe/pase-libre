import type { INestApplication } from '@nestjs/common';
import {
  MAX_FUNDADORAS,
  RECIEN_INICIO,
  RECIEN_POR_FILA,
  type DestacadoActivo,
  type FundadoraEnPanel,
  type HiloEquipoEnLista,
  type PerfilTienda,
  type RespuestaChatEquipo,
  type RespuestaFundadoras,
  type RespuestaInicio,
  type RespuestaRecienInicio,
  type TarjetaInicio,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { diaDeLaSemanaEnLima } from '../src/modules/catalogo/puntos-inicio';
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

const MINUTO = 60_000;
const hace = (minutos: number) => new Date(Date.now() - minutos * MINUTO);
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/**
 * El Inicio de la 1.11.0 (doc 20): 20 por página con paginación (4), las chapitas (22), el orden
 * por puntos con el tope por tienda en cada fila y «Destacar» con fuerza (4b), y las tiendas
 * fundadoras (7).
 */
describe('Inicio 1.11.0 (doc 20, puntos 4, 22, 4b y 7)', () => {
  let app: INestApplication;
  const cookies = new Map<string, string>();
  const http = () => request(app.getHttpServer());
  let categoriaId = '';
  /** Dark Alien (14 publicaciones) y otras 6 tiendas con 6 cada una. */
  const darkAlien = { tiendaId: '', usuarioId: '' };
  const otras: Array<{ tiendaId: string; usuarioId: string; usuario: string }> = [];
  let productoN = 0;

  async function entrar(usuario: string, clave = CLAVE_PRUEBA): Promise<string> {
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
  const get = async (usuario: string, ruta: string, clave?: string) =>
    http()
      .get(ruta)
      .set('Cookie', await entrar(usuario, clave));
  const enviar = async (
    metodo: 'post' | 'patch' | 'delete',
    usuario: string,
    ruta: string,
    cuerpo: object = {},
    clave?: string,
  ) => {
    const cookie = await entrar(usuario, clave);
    const pedido = http();
    return pedido[metodo](ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo);
  };

  async function producto(): Promise<string> {
    productoN += 1;
    const fila = await prisma.producto.create({
      data: {
        categoriaId,
        titulo: `Producto del inicio ${productoN}`,
        slug: `producto-del-inicio-${productoN}`,
      },
      select: { id: true },
    });
    return fila.id;
  }

  async function publicar(
    tiendaId: string,
    responsableId: string,
    datos: {
      productoId?: string;
      creadaEn?: Date;
      precio?: bigint;
      precioAnterior?: bigint;
      bajoEn?: Date;
    } = {},
  ): Promise<string> {
    const creadaEn = datos.creadaEn ?? new Date();
    const fila = await prisma.oferta.create({
      data: {
        productoId: datos.productoId ?? (await producto()),
        tiendaId,
        responsableId,
        condicion: 'NUEVO',
        precioCentimos: datos.precio ?? 10_000n,
        moneda: 'PEN',
        precioVisible: true,
        creadaEn,
        actualizadaEn: creadaEn,
        precioAnteriorCentimos: datos.precioAnterior ?? null,
        precioBajoEn: datos.bajoEn ?? null,
      },
      select: { id: true },
    });
    return fila.id;
  }

  /** Todas las páginas del Inicio, como las trae la paginación. */
  async function todasLasPaginas(usuario = 'mirona'): Promise<RespuestaRecienInicio[]> {
    const paginas: RespuestaRecienInicio[] = [];
    for (let numero = 1; ; numero += 1) {
      const respuesta = await get(usuario, `/v1/inicio/recien?pagina=${numero}`);
      expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
      const pagina = respuesta.body as RespuestaRecienInicio;
      paginas.push(pagina);
      if (numero >= pagina.total_paginas) break;
    }
    return paginas;
  }

  const tiendaDe = async (ids: string[]) =>
    new Map(
      (
        await prisma.oferta.findMany({
          where: { id: { in: ids } },
          select: { id: true, tiendaId: true },
        })
      ).map((o) => [o.id, o.tiendaId]),
    );

  async function quitarTodo() {
    await prisma.destacado.deleteMany();
    await prisma.tienda.updateMany({
      data: {
        fundadoraDesde: null,
        fundadoraDia: null,
        fundadoraSello: true,
        fundadoraPrioridad: true,
      },
    });
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    // Lo de la semilla no cuenta: el Inicio de estas pruebas es solo lo que se crea aquí.
    await prisma.oferta.updateMany({ data: { stock: 0 } });
    app = await crearApp();
    categoriaId = (await prisma.categoria.findFirstOrThrow({ select: { id: true } })).id;

    // Quien mira: una tienda sin publicaciones por grupo de pruebas (el límite es 60 por minuto).
    for (const usuario of ['mirona', 'mironab', 'mironac', 'mironad']) {
      await crearTiendaConDueno(prisma, { usuario });
    }
    const da = await crearTiendaConDueno(prisma, { usuario: 'darkalien' });
    darkAlien.tiendaId = da.tienda.id;
    darkAlien.usuarioId = da.usuario.id;
    for (const usuario of ['otra1', 'otra2', 'otra3', 'otra4', 'otra5', 'otra6']) {
      const { tienda, usuario: dueno } = await crearTiendaConDueno(prisma, { usuario });
      otras.push({ tiendaId: tienda.id, usuarioId: dueno.id, usuario });
    }
    // Las 6 otras publicaron hace 2 a 3 horas; Dark Alien subió 14 de golpe recién.
    for (const [n, otra] of otras.entries()) {
      for (let i = 0; i < 6; i += 1) {
        await publicar(otra.tiendaId, otra.usuarioId, { creadaEn: hace(120 + n * 5 + i) });
      }
    }
    for (let i = 0; i < 14; i += 1) {
      await publicar(darkAlien.tiendaId, darkAlien.usuarioId, { creadaEn: hace(1 + i / 10) });
    }
  });

  beforeEach(async () => {
    await quitarTodo();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('paginación y tope por tienda (puntos 4 y 4b)', () => {
    it('Dark Alien con 14 y 6 tiendas más: ninguna fila con más de 2 de ella', async () => {
      const paginas = await todasLasPaginas();
      const tarjetas = paginas.flatMap((pagina) => pagina.tarjetas);
      expect(tarjetas).toHaveLength(14 + 36);
      const deTienda = await tiendaDe(tarjetas.map((t) => t.oferta_id));
      const tiendas = tarjetas.map((t) => deTienda.get(t.oferta_id) ?? '');
      for (let i = 0; i < tiendas.length; i += RECIEN_POR_FILA) {
        const fila = tiendas.slice(i, i + RECIEN_POR_FILA);
        expect(fila.filter((t) => t === darkAlien.tiendaId).length).toBeLessThanOrEqual(2);
        // Con 7 tiendas el tope es 2 para todas. Solo se pasa para no dejar huecos: cuando lo
        // que queda es de tiendas que ya llenaron su tope en esa fila.
        const cuantas = new Map<string, number>();
        for (const t of fila) cuantas.set(t, (cuantas.get(t) ?? 0) + 1);
        if (Math.max(...cuantas.values()) > 2) {
          const llenas = [...cuantas].filter(([, n]) => n >= 2).map(([t]) => t);
          expect(tiendas.slice(i + RECIEN_POR_FILA).every((t) => llenas.includes(t))).toBe(true);
        }
      }
      // Lo de Dark Alien es lo más nuevo: llena su tope desde la primera fila.
      const primera = tarjetas.slice(0, RECIEN_POR_FILA);
      expect(primera.filter((t) => deTienda.get(t.oferta_id) === darkAlien.tiendaId)).toHaveLength(
        2,
      );
    });

    it('de a 20, sin repetir: la página 2 sigue donde terminó la 1 y la 1 es la del inicio', async () => {
      const paginas = await todasLasPaginas();
      expect(paginas).toHaveLength(3);
      expect(paginas.map((pagina) => pagina.tarjetas.length)).toEqual([20, 20, 10]);
      expect(
        paginas.every(
          (pagina) => pagina.total_paginas === 3 && pagina.total === 50 && pagina.en_paginas === 50,
        ),
      ).toBe(true);
      const ids = paginas.flatMap((pagina) => pagina.tarjetas.map((t) => t.oferta_id));
      expect(new Set(ids).size).toBe(50);

      const respuesta = await get('mirona', '/v1/inicio');
      expect(respuesta.status).toBe(200);
      const inicio = respuesta.body as RespuestaInicio;
      expect(inicio.fase).toBe('NORMAL');
      expect(inicio.recien).toHaveLength(RECIEN_INICIO);
      expect(inicio.total_paginas).toBe(3);
      expect(inicio.total).toBe(50);
      expect(inicio.recien.map((t) => t.oferta_id)).toEqual(ids.slice(0, RECIEN_INICIO));

      // Pedir la 2 dos veces da lo mismo; más allá de la última, nada.
      const otraVez = (await get('mirona', '/v1/inicio/recien?pagina=2'))
        .body as RespuestaRecienInicio;
      expect(otraVez.tarjetas.map((t) => t.oferta_id)).toEqual(ids.slice(20, 40));
      const fuera = (await get('mirona', '/v1/inicio/recien?pagina=9'))
        .body as RespuestaRecienInicio;
      expect(fuera.tarjetas).toEqual([]);
    });

    it('la tienda que mira no ve lo suyo', async () => {
      const tarjetas = (await todasLasPaginas('darkalien')).flatMap((p) => p.tarjetas);
      expect(tarjetas).toHaveLength(36);
      expect(tarjetas.some((t) => t.propia)).toBe(false);
    });
  });

  describe('las chapitas (punto 22)', () => {
    const buscar = async (id: string): Promise<TarjetaInicio | undefined> =>
      (await todasLasPaginas('mironab')).flatMap((p) => p.tarjetas).find((t) => t.oferta_id === id);

    it('«Recién publicado» solo hasta los 20 minutos', async () => {
      const nueva = await publicar(otras[0]!.tiendaId, otras[0]!.usuarioId, {
        creadaEn: hace(10),
      });
      const vieja = await publicar(otras[0]!.tiendaId, otras[0]!.usuarioId, {
        creadaEn: hace(25),
      });
      expect((await buscar(nueva))?.chapita).toBe('RECIEN');
      expect((await buscar(vieja))?.chapita).toBeNull();
      await prisma.oferta.deleteMany({ where: { id: { in: [nueva, vieja] } } });
    });

    it('«Más barato de la galería»: el precio más bajo del producto en su galería, con al menos 2', async () => {
      const productoId = await producto();
      const cara = await publicar(otras[1]!.tiendaId, otras[1]!.usuarioId, {
        productoId,
        precio: 30_000n,
        creadaEn: hace(300),
      });
      const barata = await publicar(otras[2]!.tiendaId, otras[2]!.usuarioId, {
        productoId,
        precio: 25_000n,
        creadaEn: hace(300),
      });
      expect((await buscar(barata))?.chapita).toBe('MAS_BARATO');
      expect((await buscar(cara))?.chapita).toBeNull();
      // Sola en la galería ya no compite.
      await prisma.oferta.update({ where: { id: cara }, data: { stock: 0 } });
      expect((await buscar(barata))?.chapita).toBeNull();
      await prisma.oferta.deleteMany({ where: { productoId } });
    });

    it('«Muy buscado hoy»: con 3 vistas de hoy entra al top 10', async () => {
      const productoId = await producto();
      const oferta = await publicar(otras[3]!.tiendaId, otras[3]!.usuarioId, {
        productoId,
        creadaEn: hace(300),
      });
      const dia = new Date(`${DIA_LIMA.format(new Date())}T00:00:00Z`);
      const vistas = otras
        .slice(0, 2)
        .map((o) => ({ ofertaId: oferta, tiendaId: o.tiendaId, dia }));
      await prisma.vistaOferta.createMany({ data: vistas });
      // Con 2 no llega al mínimo.
      expect((await buscar(oferta))?.chapita).toBeNull();
      await prisma.vistaOferta.create({
        data: { ofertaId: oferta, tiendaId: otras[4]!.tiendaId, dia },
      });
      expect((await buscar(oferta))?.chapita).toBe('MUY_BUSCADO');
      await prisma.vistaOferta.deleteMany({ where: { ofertaId: oferta } });
      await prisma.oferta.delete({ where: { id: oferta } });
    });

    it('«Bajó de precio» en las últimas 48 h, con cuánto bajó', async () => {
      const bajo = await publicar(otras[4]!.tiendaId, otras[4]!.usuarioId, {
        precio: 36_000n,
        precioAnterior: 40_000n,
        bajoEn: hace(60),
        creadaEn: hace(3000),
      });
      const tarjeta = await buscar(bajo);
      expect(tarjeta?.chapita).toBe('BAJO');
      expect(tarjeta?.bajo_centimos).toBe(4_000);
      expect(tarjeta?.precio).toMatchObject({ centimos: 36_000, moneda: 'PEN' });
      // Hace más de 48 h ya no.
      await prisma.oferta.update({ where: { id: bajo }, data: { precioBajoEn: hace(49 * 60) } });
      expect((await buscar(bajo))?.chapita).toBeNull();
      expect((await buscar(bajo))?.bajo_centimos).toBeNull();
      await prisma.oferta.delete({ where: { id: bajo } });
    });
  });

  describe('«Destacar» con fuerza (punto 4b)', () => {
    it('por defecto es Media; Fuerte sube una vieja a la primera fila y no hay lugares fijos', async () => {
      const otra = otras[5]!;
      const vieja = await publicar(otra.tiendaId, otra.usuarioId, { creadaEn: hace(4 * 24 * 60) });
      const posicion = async () =>
        (await todasLasPaginas('mironac'))
          .flatMap((p) => p.tarjetas)
          .findIndex((t) => t.oferta_id === vieja);
      const sinDestacar = await posicion();
      expect(sinDestacar).toBeGreaterThanOrEqual(40);

      const media = (
        await enviar(
          'post',
          'equipo',
          `/v1/equipo/panel/tiendas/${otra.tiendaId}/destacar`,
          { duracion: '1h', ofertas: [vieja], avisar: false },
          CLAVE_DEMO,
        )
      ).body as DestacadoActivo;
      expect(media.fuerza).toBe('MEDIA');
      const conMedia = await posicion();
      expect(conMedia).toBeLessThan(sinDestacar);

      const fuerte = (
        await enviar(
          'post',
          'equipo',
          `/v1/equipo/panel/tiendas/${otra.tiendaId}/destacar`,
          { duracion: '1h', ofertas: [vieja], avisar: false, fuerza: 'FUERTE' },
          CLAVE_DEMO,
        )
      ).body as DestacadoActivo;
      expect(fuerte.fuerza).toBe('FUERTE');
      expect(await posicion()).toBeLessThan(RECIEN_POR_FILA);
      const guardado = await prisma.destacado.findFirstOrThrow({
        where: { tiendaId: otra.tiendaId, quitadoEn: null },
      });
      expect(guardado.fuerza).toBe('FUERTE');

      const suave = (
        await enviar(
          'post',
          'equipo',
          `/v1/equipo/panel/tiendas/${otra.tiendaId}/destacar`,
          { duracion: '1h', ofertas: [vieja], avisar: false, fuerza: 'SUAVE' },
          CLAVE_DEMO,
        )
      ).body as DestacadoActivo;
      expect(suave.fuerza).toBe('SUAVE');
      // Suave suma menos: queda entre la Media y donde estaba.
      const conSuave = await posicion();
      expect(conSuave).toBeGreaterThanOrEqual(conMedia);
      expect(conSuave).toBeLessThanOrEqual(sinDestacar);

      await enviar(
        'post',
        'equipo',
        `/v1/equipo/panel/tiendas/${otra.tiendaId}/destacar`,
        { duracion: '1h', fuerza: 'BRUTAL' },
        CLAVE_DEMO,
      ).then((r) => expect(r.status).toBe(400));
      await prisma.oferta.delete({ where: { id: vieja } });
    });
  });

  describe('tiendas fundadoras (punto 7)', () => {
    async function agregar(tiendaId: string, dia?: number) {
      return enviar(
        'post',
        'equipo',
        '/v1/equipo/fundadoras',
        dia ? { tienda_id: tiendaId, dia } : { tienda_id: tiendaId },
        CLAVE_DEMO,
      );
    }

    it('solo el Equipo las maneja', async () => {
      await get('mirona', '/v1/equipo/fundadoras').then((r) => expect(r.status).toBe(403));
      await http().get('/v1/equipo/fundadoras').expect(401);
    });

    it('máximo 10: la 11.ª da 409 y al quitar una se libera el lugar', async () => {
      const tiendas = await prisma.tienda.findMany({
        where: { estado: 'ACTIVA' },
        orderBy: { creadaEn: 'asc' },
        select: { id: true },
      });
      expect(tiendas.length).toBeGreaterThan(MAX_FUNDADORAS);
      for (const tienda of tiendas.slice(0, MAX_FUNDADORAS)) {
        const respuesta = await agregar(tienda.id);
        expect(respuesta.status).toBe(201);
        expect((respuesta.body as FundadoraEnPanel).dia).toBeGreaterThanOrEqual(1);
      }
      const once = await agregar(tiendas[MAX_FUNDADORAS]!.id);
      expect(once.status).toBe(409);
      expect(once.body.error.mensaje).toContain('Ya están las 10');
      // Una que ya es fundadora tampoco entra dos veces.
      expect((await agregar(tiendas[0]!.id)).status).toBe(409);

      const lista = (await get('equipo', '/v1/equipo/fundadoras', CLAVE_DEMO))
        .body as RespuestaFundadoras;
      expect(lista.maximo).toBe(10);
      expect(lista.fundadoras).toHaveLength(10);
      // Sin día elegido se reparten: ningún día con más de 2.
      const porDia = new Map<number | null, number>();
      for (const f of lista.fundadoras) porDia.set(f.dia, (porDia.get(f.dia) ?? 0) + 1);
      expect(Math.max(...porDia.values())).toBeLessThanOrEqual(2);

      await enviar('delete', 'equipo', `/v1/equipo/fundadoras/${tiendas[0]!.id}`, {}, CLAVE_DEMO);
      expect((await agregar(tiendas[MAX_FUNDADORAS]!.id, 3)).status).toBe(201);

      const inicio = (await get('mirona', '/v1/inicio')).body as RespuestaInicio;
      expect(inicio.fundadoras.entraron).toBe(10);
      expect(inicio.fundadoras.total).toBe(10);
      expect(inicio.fundadoras.iniciales).toHaveLength(10);
    });

    it('su día, el sello y la prioridad se cambian; el sello sale solo en su perfil', async () => {
      expect((await agregar(darkAlien.tiendaId, 2)).status).toBe(201);
      const cambio = await enviar(
        'patch',
        'equipo',
        `/v1/equipo/fundadoras/${darkAlien.tiendaId}`,
        { dia: 5, prioridad: false },
        CLAVE_DEMO,
      );
      expect(cambio.status).toBe(200);
      expect(cambio.body).toMatchObject({ dia: 5, sello: true, prioridad: false });
      expect(
        (
          await enviar(
            'patch',
            'equipo',
            `/v1/equipo/fundadoras/${darkAlien.tiendaId}`,
            { dia: 7 },
            CLAVE_DEMO,
          )
        ).status,
      ).toBe(400);

      const perfil = (await get('mirona', `/v1/tiendas/${darkAlien.tiendaId}`))
        .body as PerfilTienda;
      expect(perfil.fundadora?.desde).toBeTruthy();
      await enviar(
        'patch',
        'equipo',
        `/v1/equipo/fundadoras/${darkAlien.tiendaId}`,
        { sello: false },
        CLAVE_DEMO,
      );
      const sinSello = (await get('mirona', `/v1/tiendas/${darkAlien.tiendaId}`))
        .body as PerfilTienda;
      expect(sinSello.fundadora).toBeNull();
      // Nada en las tarjetas del feed: la tarjeta no trae ningún dato de fundadora.
      const tarjeta = (await todasLasPaginas('mironad'))[0]!.tarjetas[0]!;
      expect(Object.keys(tarjeta).some((clave) => clave.includes('fundador'))).toBe(false);
    });

    it('su día destacado suma 25 en el Inicio (hora de Lima), sin ninguna marca', async () => {
      const hoy = diaDeLaSemanaEnLima(new Date());
      const otra = otras[1]!;
      // De hace 2 días y medio: 5 puntos, detrás de todas las de hace 2 horas (25).
      const vieja = await publicar(otra.tiendaId, otra.usuarioId, { creadaEn: hace(60 * 60) });
      const posicion = async () =>
        (await todasLasPaginas('mironad'))
          .flatMap((p) => p.tarjetas)
          .findIndex((t) => t.oferta_id === vieja);
      const antes = await posicion();
      // Otro día no cambia nada.
      expect((await agregar(otra.tiendaId, hoy === 1 ? 2 : 1)).status).toBe(201);
      if (hoy !== 1) expect(await posicion()).toBe(antes);
      if (hoy <= 6) {
        await enviar(
          'patch',
          'equipo',
          `/v1/equipo/fundadoras/${otra.tiendaId}`,
          { dia: hoy },
          CLAVE_DEMO,
        );
        expect(await posicion()).toBeLessThan(antes);
      }
      await prisma.oferta.delete({ where: { id: vieja } });
    });

    it('prioridad en el chat: fija arriba para ella y primera en Equipo › Chats', async () => {
      const fundadora = otras[2]!;
      const comun = otras[3]!;
      expect((await agregar(fundadora.tiendaId)).status).toBe(201);
      await enviar('post', fundadora.usuario, '/v1/equipo-chat/mensajes', {
        texto: 'Hola, soy fundadora',
      });
      await enviar('post', comun.usuario, '/v1/equipo-chat/mensajes', {
        texto: 'Hola, escribo después',
      });

      const suyo = (await get(fundadora.usuario, '/v1/equipo-chat')).body as RespuestaChatEquipo;
      expect(suyo.prioridad_fundadora).toBe(true);
      const delOtro = (await get(comun.usuario, '/v1/equipo-chat')).body as RespuestaChatEquipo;
      expect(delOtro.prioridad_fundadora).toBeUndefined();

      const hilos = (await get('equipo', '/v1/equipo/chats', CLAVE_DEMO))
        .body as HiloEquipoEnLista[];
      expect(hilos[0]?.tienda.id).toBe(fundadora.tiendaId);
      expect(hilos[0]?.prioridad_fundadora).toBe(true);
      expect(hilos.find((h) => h.tienda.id === comun.tiendaId)?.prioridad_fundadora).toBe(false);

      // Con la prioridad apagada vuelve a su lugar.
      await enviar(
        'patch',
        'equipo',
        `/v1/equipo/fundadoras/${fundadora.tiendaId}`,
        { prioridad: false },
        CLAVE_DEMO,
      );
      const despues = (await get('equipo', '/v1/equipo/chats', CLAVE_DEMO))
        .body as HiloEquipoEnLista[];
      expect(despues[0]?.tienda.id).toBe(comun.tiendaId);
    });
  });
});
