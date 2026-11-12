import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Correcciones 11/11 · perfil (N03, N04, N09): la reputación con nivel, el comentario privado de
 * una opinión baja, «Pedir revisión al Equipo», el horario por días, el cambio de lugar que
 * confirma el Equipo y «Mi acceso».
 */
describe('Perfil, reputación y configuración (correcciones 11/11)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  let tiendaA: string;
  let tiendaB: string;
  let tiendaC: string;

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

  /** Una venta de A a otra tienda y su opinión, escritas directo en la base. */
  async function opinionSobreA(
    compradora: string,
    estrellas: number,
    texto: string | null,
    diasAtras = 0,
  ): Promise<string> {
    const oferta = await prisma.oferta.findFirstOrThrow({
      where: { tiendaId: tiendaA, estado: 'ACTIVA' },
      orderBy: { creadaEn: 'asc' },
    });
    const dueno = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    const autor = await prisma.usuario.findFirstOrThrow({ where: { tiendaId: compradora } });
    const venta = await prisma.venta.create({
      data: {
        ofertaId: oferta.id,
        compradorId: autor.id,
        tiendaCompradoraId: compradora,
        stockAntes: 5,
        stockDespues: 4,
        registradaPorId: dueno.id,
      },
    });
    const opinion = await prisma.opinion.create({
      data: {
        ventaId: venta.id,
        lado: 'COMPRADOR',
        autorTiendaId: compradora,
        autorId: autor.id,
        tiendaId: tiendaA,
        estrellas,
        texto,
        creadaEn: new Date(Date.now() - diasAtras * 86_400_000),
      },
    });
    return opinion.id;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    const id = async (nombre: string) =>
      (await prisma.tienda.findFirstOrThrow({ where: { nombre } })).id;
    tiendaA = await id('Tienda A');
    tiendaB = await id('Tienda B');
    tiendaC = await id('Tienda C');
    // Sin ventas ni opiniones de la semilla: cada prueba arma las suyas.
    await prisma.opinion.deleteMany({});
    await prisma.venta.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('con menos de 5 opiniones la tienda no tiene nivel («🌱 Nueva en PaseLibre»)', async () => {
    await opinionSobreA(tiendaB, 5, 'Todo bien');
    const { body } = await http()
      .get(`/v1/tiendas/${tiendaA}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(body.reputacion).toMatchObject({
      promedio: 5,
      opiniones: 1,
      ventas: 1,
      nivel: null,
      pases_60: 1,
    });
    expect(body.reputacion).toHaveProperty('responde_en');
    expect(body.reputacion).toHaveProperty('respondidos');
    expect(body).toMatchObject({ desde: expect.any(String), indicaciones: null });
  });

  it('desde 5 opiniones hay nivel, y una sola de 1 no lo hunde', async () => {
    for (let i = 0; i < 4; i++) await opinionSobreA(tiendaC, 5, null, 10);
    const antes = await http()
      .get(`/v1/tiendas/${tiendaA}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(antes.body.reputacion.opiniones).toBe(5);
    expect(antes.body.reputacion.nivel).not.toBeNull();
    await opinionSobreA(tiendaC, 1, null);
    const despues = await http()
      .get(`/v1/tiendas/${tiendaA}`)
      .set(CABECERAS)
      .set('Cookie', await como('tiendab'))
      .expect(200);
    expect(despues.body.reputacion.opiniones).toBe(6);
    expect(['BUENA', 'MUY_BUENA', 'REGULAR']).toContain(despues.body.reputacion.nivel);
  });

  describe('opinión baja con comentario privado', () => {
    let baja: string;

    beforeAll(async () => {
      baja = await opinionSobreA(tiendaB, 2, 'Demoró en separar el producto');
    });

    async function laBaja(usuario: string) {
      const { body } = await http()
        .get(`/v1/tiendas/${tiendaA}/opiniones?filtro=bajas`)
        .set(CABECERAS)
        .set('Cookie', await como(usuario))
        .expect(200);
      return (body.opiniones as Array<{ id: string; texto: string | null; privada: boolean }>).find(
        (opinion) => opinion.id === baja,
      );
    }

    it('otra tienda ve las estrellas pero no el comentario', async () => {
      const vista = await laBaja('tiendac');
      expect(vista).toMatchObject({ privada: true, texto: null, revision: null });
    });

    it('lo ven la tienda calificada (dueño y asesor), quien lo escribió y el Equipo', async () => {
      for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'equipo']) {
        const vista = await laBaja(usuario);
        expect(vista, usuario).toMatchObject({
          privada: true,
          texto: 'Demoró en separar el producto',
        });
      }
    });

    it('la respuesta a una opinión baja tampoco se ve fuera', async () => {
      await http()
        .post(`/v1/opiniones/${baja}/respuesta`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ texto: 'Te pedimos disculpas.' })
        .expect(204);
      const deC = await http()
        .get(`/v1/tiendas/${tiendaA}/opiniones?filtro=con_respuesta`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .expect(200);
      expect(deC.body.opiniones[0]).toMatchObject({ id: baja, respuesta: null });
      const deA = await http()
        .get(`/v1/tiendas/${tiendaA}/opiniones?filtro=con_respuesta`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .expect(200);
      expect(deA.body.opiniones[0].respuesta).toBe('Te pedimos disculpas.');
    });

    it('las estrellas bajas sí cuentan en el promedio', async () => {
      const { body } = await http()
        .get(`/v1/tiendas/${tiendaA}/opiniones`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .expect(200);
      const total = (body.opiniones as Array<{ estrellas: number }>).reduce(
        (suma, opinion) => suma + opinion.estrellas,
        0,
      );
      expect(body.reputacion.promedio).toBe(Math.round((total / body.opiniones.length) * 10) / 10);
    });

    it('«Pedir revisión al Equipo»: solo la tienda calificada, y una sola vez abierta', async () => {
      await http().post(`/v1/opiniones/${baja}/revision`).set(CABECERAS).send({}).expect(401);
      for (const usuario of ['tiendab', 'tiendac']) {
        await http()
          .post(`/v1/opiniones/${baja}/revision`)
          .set(CABECERAS)
          .set('Cookie', await como(usuario))
          .send({})
          .expect(404);
      }
      await http()
        .post(`/v1/opiniones/${baja}/revision`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .send({})
        .expect(403);

      const primera = await http()
        .post(`/v1/opiniones/${baja}/revision`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa.kevin'))
        .send({ motivo: 'Separamos el mismo día; lo dice el chat.' })
        .expect(200);
      expect(primera.body).toEqual({ codigo: expect.stringMatching(/^R-\d+$/), resuelta: false });
      const otraVez = await http()
        .post(`/v1/opiniones/${baja}/revision`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({})
        .expect(200);
      expect(otraVez.body.codigo).toBe(primera.body.codigo);
      expect(await prisma.denuncia.count({ where: { objeto: 'OPINION', objetoId: baja } })).toBe(1);

      // La tienda calificada ve el código; las demás no.
      expect(await laBaja('tiendaa')).toMatchObject({
        revision: { codigo: primera.body.codigo, resuelta: false },
      });
      expect(await laBaja('tiendac')).toMatchObject({ revision: null });

      // Llega a la cola del Equipo como un reporte sobre la tienda que escribió la opinión.
      const cola = await http()
        .get('/v1/equipo/reportes')
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(200);
      const enCola = (cola.body as Array<{ id: string; codigo: string; tienda: string }>).find(
        (reporte) => reporte.codigo === primera.body.codigo,
      );
      expect(enCola?.tienda).toBe('Tienda B');
      const detalle = await http()
        .get(`/v1/equipo/reportes/${enCola?.id}`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(200);
      expect(detalle.body.sobre).toContain('Opinión de 2 estrellas sobre Tienda A');
      expect(detalle.body.texto).toBe('Separamos el mismo día; lo dice el chat.');
    });
  });

  describe('Configuración · Datos de la tienda', () => {
    it('el horario por días escribe el texto y sale en el perfil', async () => {
      const horario = [
        { dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'], desde: '10:00', hasta: '19:00' },
      ];
      const { body } = await http()
        .patch('/v1/cuenta')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ tienda: { horario_tramos: horario, indicaciones: 'Escalera central' } })
        .expect(200);
      expect(body.tienda).toMatchObject({
        horario: 'Lunes a sábado, 10:00 a 19:00 · Domingo cerrado',
        horario_tramos: horario,
      });
      const perfil = await http()
        .get(`/v1/tiendas/${tiendaA}`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .expect(200);
      expect(perfil.body).toMatchObject({
        horario_tramos: horario,
        indicaciones: 'Escalera central',
      });
    });

    it('rechaza un horario con un día repetido o que cierra antes de abrir', async () => {
      for (const horario of [
        [
          { dias: ['lun'], desde: '10:00', hasta: '19:00' },
          { dias: ['lun'], desde: '11:00', hasta: '13:00' },
        ],
        [{ dias: ['lun'], desde: '19:00', hasta: '10:00' }],
      ]) {
        await http()
          .patch('/v1/cuenta')
          .set(CABECERAS)
          .set('Cookie', await como('tiendaa'))
          .send({ tienda: { horario_tramos: horario } })
          .expect(400);
      }
    });

    it('cambiar galería, piso o stand queda pendiente hasta que el Equipo lo confirma', async () => {
      const cyber = await prisma.galeria.findUniqueOrThrow({ where: { slug: 'cyberplaza' } });
      const antes = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } });

      await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .send({ galeria_id: cyber.id, piso: '2', stand: '2B 105' })
        .expect(401);
      const { body } = await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ galeria_id: cyber.id, piso: '2', stand: '2B 105' })
        .expect(200);
      expect(body.tienda.lugar_pendiente).toMatchObject({
        galeria: 'Cyberplaza',
        piso: '2',
        stand: '2B 105',
      });
      // Mientras tanto, nada cambia en la tienda ni en el perfil.
      expect(body.tienda).toMatchObject({ galeria: 'Maxiplaza', stand: antes.stand });
      const perfil = await http()
        .get(`/v1/tiendas/${tiendaA}`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .expect(200);
      expect(perfil.body).toMatchObject({ galeria: 'Maxiplaza', stand: antes.stand });

      // El asesor ve lo mismo (es de la tienda) y otro cambio reemplaza al pendiente.
      const delAsesor = await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa.kevin'))
        .send({ galeria_id: cyber.id, piso: '2', stand: '2B 106' })
        .expect(200);
      expect(delAsesor.body.tienda.lugar_pendiente.stand).toBe('2B 106');
      expect(
        await prisma.cambioLugar.count({ where: { tiendaId: tiendaA, estado: 'PENDIENTE' } }),
      ).toBe(1);

      // Las tiendas no ven ni confirman cambios; el Equipo sí.
      await http()
        .get('/v1/equipo/cambios-de-lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .expect(403);
      const lista = await http()
        .get('/v1/equipo/cambios-de-lugar')
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(200);
      const cambio = (lista.body as Array<{ id: string; tienda: { id: string } }>).find(
        (fila) => fila.tienda.id === tiendaA,
      );
      expect(cambio).toMatchObject({
        antes: { galeria: 'Maxiplaza', stand: antes.stand },
        despues: { galeria: 'Cyberplaza', piso: '2', stand: '2B 106' },
        pedido_por: 'Kevin S.',
      });
      await http()
        .post(`/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .expect(403);
      await http()
        .post(`/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(204);
      await http()
        .post(`/v1/equipo/cambios-de-lugar/${cambio?.id}/aprobar`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(404);

      const despues = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } });
      expect(despues).toMatchObject({ galeriaId: cyber.id, piso: '2', stand: '2B 106' });
      const duenoA = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
      expect(
        await prisma.aviso.count({
          where: { usuarioId: duenoA.id, titulo: 'El Equipo confirmó tu nuevo lugar' },
        }),
      ).toBe(1);
    });

    it('el Equipo puede no confirmar, y la tienda puede retirar lo que pidió', async () => {
      const maxi = await prisma.galeria.findUniqueOrThrow({ where: { slug: 'maxiplaza' } });
      await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({ galeria_id: maxi.id, piso: null, stand: '999' })
        .expect(200);
      const [cambio] = (
        await http()
          .get('/v1/equipo/cambios-de-lugar')
          .set(CABECERAS)
          .set('Cookie', await como('equipo'))
          .expect(200)
      ).body as Array<{ id: string }>;
      await http()
        .post(`/v1/equipo/cambios-de-lugar/${cambio?.id}/rechazar`)
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .send({ motivo: 'Ese stand no existe en Maxiplaza.' })
        .expect(204);
      const tiendaDeB = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaB } });
      expect(tiendaDeB.stand).toBe('101');
      const cuenta = await http()
        .get('/v1/cuenta')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(cuenta.body.tienda.lugar_pendiente).toBeNull();

      await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .send({ galeria_id: maxi.id, stand: '300' })
        .expect(200);
      const retirado = await http()
        .delete('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendab'))
        .expect(200);
      expect(retirado.body.tienda.lugar_pendiente).toBeNull();
    });

    it('pedir el mismo lugar de hoy no deja nada pendiente; una galería que no existe, no', async () => {
      const tienda = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaC } });
      const igual = await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .send({ galeria_id: tienda.galeriaId, piso: tienda.piso, stand: tienda.stand })
        .expect(200);
      expect(igual.body.tienda.lugar_pendiente).toBeNull();
      await http()
        .put('/v1/cuenta/lugar')
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .send({ galeria_id: '00000000-0000-4000-8000-000000000000', stand: '1' })
        .expect(400);
    });

    it('las galerías para elegir, solo para tiendas', async () => {
      const { body } = await http()
        .get('/v1/cuenta/galerias')
        .set(CABECERAS)
        .set('Cookie', await como('tiendac'))
        .expect(200);
      expect((body as Array<{ nombre: string }>).map((g) => g.nombre)).toEqual(
        expect.arrayContaining(['Maxiplaza', 'Cyberplaza']),
      );
      await http()
        .get('/v1/cuenta/galerias')
        .set(CABECERAS)
        .set('Cookie', await como('equipo'))
        .expect(403);
    });
  });

  it('«Mi acceso» es de cada persona: el asesor cambia su correo y su WhatsApp, no los del dueño', async () => {
    const antes = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    const { body } = await http()
      .patch('/v1/cuenta')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa.kevin'))
      .send({ correo: 'kevin@tiendaa.pe', whatsapp: '987654321' })
      .expect(200);
    expect(body.usuario).toMatchObject({
      usuario: 'tiendaa.kevin',
      correo: 'kevin@tiendaa.pe',
      whatsapp: '987654321',
    });
    const dueno = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
    expect(dueno).toMatchObject({ correo: antes.correo, whatsapp: antes.whatsapp });
    // El usuario lo cambia el Equipo PaseLibre.
    await http()
      .patch('/v1/cuenta')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa.kevin'))
      .send({ usuario: 'kevin2' })
      .expect(400);
  });

  it('«Tu mes»: ventas del mes y chats sin responder, solo para tu tienda', async () => {
    const { body } = await http()
      .get('/v1/cuenta/resumen')
      .set(CABECERAS)
      .set('Cookie', await como('tiendaa'))
      .expect(200);
    expect(body.ventas_mes).toBeGreaterThanOrEqual(1);
    expect(typeof body.sin_responder).toBe('number');
  });
});
