import type { INestApplication } from '@nestjs/common';
import type {
  Contadores,
  RespuestaAvisos,
  RespuestaInicio,
  RespuestaYo,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const DIA_MS = 24 * 60 * 60 * 1000;
const haceDias = (dias: number) => new Date(Date.now() - dias * DIA_MS);

/**
 * Versión 1.10.0 (doc 19): la banda «¿Conoces una tienda…?», que en el inicio vuelve a los 2
 * días y en las secciones de la barra negra no vuelve más (punto 14), y el número de la
 * campanita, que se va al abrirla mientras el puntito de cada aviso sigue hasta tocarlo
 * (punto 15).
 */
describe('Banda de invitar y campanita (doc 19, puntos 14 y 15)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());
  const como = (usuario: string) => ({
    get: (ruta: string) =>
      http()
        .get(ruta)
        .set('Cookie', cookies[usuario] ?? ''),
    post: (ruta: string, cuerpo: object = {}) =>
      http()
        .post(ruta)
        .set(CABECERAS)
        .set('Cookie', cookies[usuario] ?? '')
        .send(cuerpo),
  });
  const usuarioDe = (usuario: string) => prisma.usuario.findUniqueOrThrow({ where: { usuario } });
  const inicio = async (usuario: string) =>
    (await como(usuario).get('/v1/inicio').expect(200)).body as RespuestaInicio;
  const yo = async (usuario: string) =>
    (await como(usuario).get('/v1/yo').expect(200)).body as RespuestaYo;
  const contadores = async (usuario: string) =>
    (await como(usuario).get('/v1/contadores').expect(200)).body as Contadores;

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac', 'equipo']) {
      cookies[usuario] = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario, clave: CLAVE_DEMO })
          .expect(200),
      );
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('la banda del inicio vuelve a los 2 días (punto 14)', () => {
    it('cada X guarda la fecha de nuevo, y pasados 2 días vuelve a salir', async () => {
      expect((await inicio('tiendab')).invitar_cerrado).toBe(false);

      await como('tiendab').post('/v1/inicio/invitar-cerrado').expect(204);
      expect((await inicio('tiendab')).invitar_cerrado).toBe(true);

      // Un día después sigue cerrada; a los 2 días, vuelve.
      await prisma.usuario.update({
        where: { usuario: 'tiendab' },
        data: { invitarCerradoEn: haceDias(1) },
      });
      expect((await inicio('tiendab')).invitar_cerrado).toBe(true);
      await prisma.usuario.update({
        where: { usuario: 'tiendab' },
        data: { invitarCerradoEn: haceDias(2.01) },
      });
      expect((await inicio('tiendab')).invitar_cerrado).toBe(false);

      // La X de otra vez cuenta otros 2 días (antes solo se guardaba la primera).
      const vieja = (await usuarioDe('tiendab')).invitarCerradoEn;
      await como('tiendab').post('/v1/inicio/invitar-cerrado').expect(204);
      const nueva = (await usuarioDe('tiendab')).invitarCerradoEn;
      expect(nueva!.getTime()).toBeGreaterThan(vieja!.getTime());
      expect((await inicio('tiendab')).invitar_cerrado).toBe(true);
    });

    it('cerrar la del inicio no la cierra en las secciones', async () => {
      await como('tiendac').post('/v1/inicio/invitar-cerrado').expect(204);
      expect((await yo('tiendac')).usuario.invitar_secciones_cerrado).toBe(false);
    });
  });

  describe('la banda de las secciones no vuelve (punto 14)', () => {
    it('sin sesión no se guarda, y el equipo no tiene banda', async () => {
      await http().post('/v1/secciones/invitar-cerrado').set(CABECERAS).send({}).expect(401);
      await como('equipo').post('/v1/secciones/invitar-cerrado').expect(403);
    });

    it('sin la cabecera de PaseLibre no se guarda (CSRF)', async () => {
      await http()
        .post('/v1/secciones/invitar-cerrado')
        .set('Cookie', cookies.tiendaa ?? '')
        .send({})
        .expect(403);
    });

    it('la X se guarda una vez y sigue cerrada aunque pasen los días', async () => {
      expect((await yo('tiendaa')).usuario.invitar_secciones_cerrado).toBe(false);

      await como('tiendaa').post('/v1/secciones/invitar-cerrado').expect(204);
      expect((await yo('tiendaa')).usuario.invitar_secciones_cerrado).toBe(true);
      const primera = (await usuarioDe('tiendaa')).invitarSeccionesCerradoEn;
      expect(primera).not.toBeNull();

      // Tocarla otra vez (desde otra pestaña) no cambia la fecha.
      await como('tiendaa').post('/v1/secciones/invitar-cerrado').expect(204);
      expect((await usuarioDe('tiendaa')).invitarSeccionesCerradoEn).toEqual(primera);

      // Un mes después sigue sin salir.
      await prisma.usuario.update({
        where: { usuario: 'tiendaa' },
        data: { invitarSeccionesCerradoEn: haceDias(30) },
      });
      expect((await yo('tiendaa')).usuario.invitar_secciones_cerrado).toBe(true);
      // Y la del inicio va aparte: sigue saliendo.
      expect((await inicio('tiendaa')).invitar_cerrado).toBe(false);
    });
  });

  describe('la campanita (punto 15)', () => {
    it('sin sesión no hay avisos vistos, y el equipo no tiene campanita', async () => {
      await http().post('/v1/avisos/vistos').set(CABECERAS).send({}).expect(401);
      await como('equipo').post('/v1/avisos/vistos').expect(403);
    });

    it('al abrirla el número vuelve a 0, pero cada aviso sigue sin leer hasta tocarlo', async () => {
      const usuarioC = await usuarioDe('tiendac');
      await prisma.aviso.deleteMany({ where: { usuarioId: usuarioC.id } });
      await prisma.usuario.update({ where: { id: usuarioC.id }, data: { avisosVistosEn: null } });
      const [primero] = await prisma.aviso.createManyAndReturn({
        data: ['Vendiste 1 RTX 5060', 'Nueva opinión', 'Tienda A te sigue'].map((titulo) => ({
          usuarioId: usuarioC.id,
          tipo: 'SISTEMA' as const,
          titulo,
        })),
      });
      // Sin abrirla nunca, cuenta todo lo sin leer, como hasta ahora.
      expect((await contadores('tiendac')).avisos).toBe(3);

      const respuesta = await como('tiendac').post('/v1/avisos/vistos').expect(200);
      expect((respuesta.body as Contadores).avisos).toBe(0);
      expect((await contadores('tiendac')).avisos).toBe(0);
      expect((await usuarioDe('tiendac')).avisosVistosEn).not.toBeNull();

      // La lista sigue con sus 3 sin leer (el puntito y la negrita).
      const lista = (await como('tiendac').get('/v1/avisos').expect(200)).body as RespuestaAvisos;
      expect(lista.sin_leer).toBe(3);
      expect(lista.avisos.every((aviso) => !aviso.leido)).toBe(true);

      // Tocar uno lo marca leído y no mueve el número, que ya estaba en 0.
      await como('tiendac')
        .post('/v1/avisos/leidos', { ids: [primero!.id] })
        .expect(200);
      expect((await contadores('tiendac')).avisos).toBe(0);
      const despues = (await como('tiendac').get('/v1/avisos').expect(200)).body as RespuestaAvisos;
      expect(despues.sin_leer).toBe(2);
    });

    it('cuenta solo lo que llegó después de abrirla, y lo de «No molestar» al terminar', async () => {
      const usuarioC = await usuarioDe('tiendac');
      await como('tiendac').post('/v1/avisos/vistos').expect(200);
      expect((await contadores('tiendac')).avisos).toBe(0);

      const nuevo = await prisma.aviso.create({
        data: { usuarioId: usuarioC.id, tipo: 'SISTEMA', titulo: 'Llegó después' },
      });
      // Con «No molestar», aparece recién al terminar el horario.
      const callado = await prisma.aviso.create({
        data: {
          usuarioId: usuarioC.id,
          tipo: 'SISTEMA',
          titulo: 'Llegó de noche',
          visibleDesde: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      expect((await contadores('tiendac')).avisos).toBe(1);

      // Terminó «No molestar»: ahora sí llegó (aunque se haya creado antes).
      await prisma.aviso.update({
        where: { id: callado.id },
        data: { visibleDesde: new Date() },
      });
      expect((await contadores('tiendac')).avisos).toBe(2);

      // Tocar uno nuevo sin abrir la campanita también lo baja.
      await como('tiendac')
        .post('/v1/avisos/leidos', { ids: [nuevo.id] })
        .expect(200);
      expect((await contadores('tiendac')).avisos).toBe(1);

      // «Marcar todo como leído» deja todo en 0.
      await como('tiendac').post('/v1/avisos/leidos').expect(200);
      expect((await contadores('tiendac')).avisos).toBe(0);
    });

    it('un mensaje nuevo en un chat ya avisado vuelve a contar', async () => {
      const tiendaA = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } });
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: { tiendaId: tiendaA.id, estado: 'ACTIVA', stock: { gt: 0 } },
      });
      const usuarioA = await usuarioDe('tiendaa');
      await prisma.aviso.deleteMany({ where: { usuarioId: usuarioA.id } });
      await como('tiendaa').post('/v1/avisos/vistos').expect(200);

      const contacto = await como('tiendab')
        .post(`/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      const conversacion = contacto.body.conversacion_id as string;
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Hola, ¿sigue disponible?' })
        .expect(201);
      expect((await contadores('tiendaa')).avisos).toBe(1);

      // Abre la campanita: el número se va, el aviso del chat sigue sin leer.
      await como('tiendaa').post('/v1/avisos/vistos').expect(200);
      expect((await contadores('tiendaa')).avisos).toBe(0);
      expect((await contadores('tiendaa')).mensajes).toBeGreaterThanOrEqual(1);

      // Otro mensaje del mismo chat actualiza ese aviso (no apila otro) y vuelve a contar.
      await como('tiendab')
        .post(`/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Te puedo pagar hoy.' })
        .expect(201);
      expect((await contadores('tiendaa')).avisos).toBe(1);
      expect(await prisma.aviso.count({ where: { usuarioId: usuarioA.id } })).toBe(1);
    });

    it('lo que abre una persona no cambia el número de las demás', async () => {
      const usuarioB = await usuarioDe('tiendab');
      await prisma.aviso.create({
        data: { usuarioId: usuarioB.id, tipo: 'SISTEMA', titulo: 'Para Tienda B' },
      });
      const antes = (await contadores('tiendab')).avisos;
      expect(antes).toBeGreaterThan(0);
      await como('tiendac').post('/v1/avisos/vistos').expect(200);
      expect((await contadores('tiendab')).avisos).toBe(antes);
    });
  });
});
