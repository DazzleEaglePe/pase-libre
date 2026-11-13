import type { INestApplication } from '@nestjs/common';
import type {
  EstadoSoporteTienda,
  FichaTienda,
  RespuestaChatEquipo,
  RespuestaYo,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase, hastaQue } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * «Ayudar como la tienda» (N14, mejora 39) y el chat del equipo con respuesta automática y
 * advertencias claras (N14, mejoras 37 y 38).
 */
describe('Modo soporte y chat del equipo (N14)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies: Record<string, string> = {};
  let tiendaA: string;

  const ingreso = (usuario: string) =>
    http().post('/v1/sesion').set(CABECERAS).send({ usuario, clave: CLAVE_DEMO, cerrar: 'todas' });

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

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    for (const usuario of ['tiendaa', 'tiendaa.kevin', 'tiendab', 'equipo']) {
      cookies[usuario] = cookieDe(await ingreso(usuario).expect(200));
    }
    tiendaA = (await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda A' } })).id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('«Ayudar como la tienda»', () => {
    it('la tienda lo pide desde Ayuda; el asesor no puede autorizarlo', async () => {
      await como('tiendaa.kevin').send('post', '/v1/cuenta/soporte').expect(403);
      const pedido = await como('tiendaa').send('post', '/v1/cuenta/soporte').expect(200);
      expect((pedido.body as EstadoSoporteTienda).pedido_en).not.toBeNull();
      const aviso = await hastaQue(() =>
        prisma.aviso.findFirstOrThrow({
          where: { usuario: { usuario: 'equipo' }, titulo: 'Tienda A pidió ayuda al Equipo' },
        }),
      );
      expect(aviso.enlace).toBe(`/equipo/tiendas/${tiendaA}`);
      const ficha = await como('equipo')
        .get(`/v1/equipo/panel/tiendas/${tiendaA}/ficha`)
        .expect(200);
      expect((ficha.body as FichaTienda).soporte.pedido_en).not.toBeNull();
    });

    it('solo el equipo lo activa', async () => {
      await como('tiendab').send('post', `/v1/equipo/panel/tiendas/${tiendaA}/soporte`).expect(403);
    });

    it('el equipo entra y ve PaseLibre como el dueño, con la franja de arriba', async () => {
      const inicio = await como('equipo')
        .send('post', `/v1/equipo/panel/tiendas/${tiendaA}/soporte`)
        .expect(200);
      const minutos = (new Date(inicio.body.vence_en).getTime() - Date.now()) / 60_000;
      expect(minutos).toBeGreaterThan(58);
      expect(minutos).toBeLessThanOrEqual(60);
      const yo = (await como('equipo').get('/v1/yo').expect(200)).body as RespuestaYo;
      expect(yo.usuario.usuario).toBe('tiendaa');
      expect(yo.usuario.rol).toBe('DUENO');
      expect(yo.soporte).toMatchObject({ tienda_id: tiendaA, tienda: 'Tienda A' });
      const aviso = await hastaQue(() =>
        prisma.aviso.findFirstOrThrow({
          where: {
            usuario: { usuario: 'tiendaa' },
            titulo: 'El Equipo PaseLibre ya está ayudándote',
          },
        }),
      );
      expect(aviso.extracto).toContain('No puede chatear ni cerrar ventas');
    });

    it('acomoda los datos de la tienda: queda registrado y la tienda recibe aviso', async () => {
      await como('equipo')
        .send('patch', '/v1/cuenta', { tienda: { horario: 'Lun a sáb 10:00–20:00' } })
        .expect(200);
      const tienda = await prisma.tienda.findUniqueOrThrow({ where: { id: tiendaA } });
      expect(tienda.horario).toBe('Lun a sáb 10:00–20:00');
      // El interceptor anota después de responder.
      await new Promise((listo) => setTimeout(listo, 100));
      const registro = await hastaQue(() =>
        prisma.registroEquipo.findFirstOrThrow({
          where: { tiendaId: tiendaA, accion: 'en modo soporte, actualizó los datos de tu tienda' },
        }),
      );
      expect(registro.autorId).toBe(
        (await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'equipo' } })).id,
      );
      await hastaQue(() =>
        prisma.aviso.findFirstOrThrow({
          where: {
            usuario: { usuario: 'tiendaa' },
            titulo: 'El Equipo PaseLibre actualizó los datos de tu tienda',
          },
        }),
      );
    });

    it('no puede chatear, cerrar ventas, ni tocar la seguridad o los datos de la persona', async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({ where: { tiendaId: tiendaA } });
      const otra = await prisma.oferta.findFirstOrThrow({
        where: { tienda: { nombre: 'Tienda B' }, estado: 'ACTIVA', tiendaVisible: true },
      });
      const vedadas = [
        como('equipo').get('/v1/conversaciones'),
        como('equipo').send('post', `/v1/ofertas/${otra.id}/contacto`, { canal: 'CHAT' }),
        como('equipo').send('post', `/v1/ofertas/${oferta.id}/vendido`, { unidades: 1 }),
        como('equipo').send('post', '/v1/equipo-chat/mensajes', { texto: 'hola' }),
        como('equipo').send('post', '/v1/sesion/clave', { clave_nueva: 'otra-clave-99' }),
        como('equipo').send('post', '/v1/cuenta/sesiones/cerrar-otras'),
        como('equipo').send('post', '/v1/cuenta/asesores', { nombre: 'X Y', sufijo: 'xy' }),
        como('equipo').send('patch', '/v1/cuenta', { correo: 'otro@correo.pe' }),
        como('equipo').send('delete', '/v1/sesion'),
      ];
      for (const peticion of vedadas) {
        const respuesta = await peticion;
        expect(respuesta.status).toBe(403);
      }
      // Tampoco usa el panel mientras ayuda.
      await como('equipo').get('/v1/equipo/inicio').expect(403);
    });

    it('«Salir» vuelve a ser el equipo', async () => {
      const salida = await como('equipo').send('post', '/v1/soporte/salir').expect(200);
      expect(salida.body.tienda_id).toBe(tiendaA);
      const yo = (await como('equipo').get('/v1/yo').expect(200)).body as RespuestaYo;
      expect(yo.usuario.rol).toBe('EQUIPO');
      expect(yo.soporte).toBeNull();
      await como('equipo').get('/v1/equipo/inicio').expect(200);
      const historial = await como('equipo')
        .get(`/v1/equipo/panel/tiendas/${tiendaA}/historial`)
        .expect(200);
      const textos = (historial.body as Array<{ texto: string }>).map((c) => c.texto);
      expect(textos.some((t) => t.endsWith('terminó de ayudar como la tienda'))).toBe(true);
      expect(
        textos.some((t) => t.endsWith('entró a ayudar como la tienda (la tienda lo pidió)')),
      ).toBe(true);
    });

    it('si lo activa el equipo sin pedido, a la tienda le avisa igual; a la hora se termina solo', async () => {
      await como('equipo').send('post', `/v1/equipo/panel/tiendas/${tiendaA}/soporte`).expect(200);
      await hastaQue(() =>
        prisma.aviso.findFirstOrThrow({
          where: {
            usuario: { usuario: 'tiendaa' },
            titulo: 'El Equipo PaseLibre entró a tu cuenta para ayudarte',
          },
        }),
      );
      await prisma.modoSoporte.updateMany({
        where: { terminadoEn: null, venceEn: { not: null } },
        data: { venceEn: new Date(Date.now() - 1000) },
      });
      const yo = (await como('equipo').get('/v1/yo').expect(200)).body as RespuestaYo;
      expect(yo.usuario.rol).toBe('EQUIPO');
      expect(
        await prisma.modoSoporte.count({ where: { terminadoEn: null, iniciadoEn: { not: null } } }),
      ).toBe(0);
    });

    it('a una tienda suspendida no se entra', async () => {
      await prisma.tienda.update({ where: { id: tiendaA }, data: { estado: 'SUSPENDIDA' } });
      await como('equipo').send('post', `/v1/equipo/panel/tiendas/${tiendaA}/soporte`).expect(409);
      await prisma.tienda.update({ where: { id: tiendaA }, data: { estado: 'ACTIVA' } });
      cookies.tiendaa = cookieDe(await ingreso('tiendaa').expect(200));
    });
  });

  describe('chat del equipo', () => {
    it('la respuesta automática sale la primera vez, no en cada mensaje', async () => {
      await como('tiendab').send('post', '/v1/equipo-chat/mensajes', { texto: '¿Cómo lo edito?' });
      await como('tiendab').send('post', '/v1/equipo-chat/mensajes', { texto: 'La portada' });
      const chat = (await como('tiendab').get('/v1/equipo-chat?leer=1').expect(200))
        .body as RespuestaChatEquipo;
      expect(chat.mensajes.map((m) => [m.texto.slice(0, 15), m.automatica])).toEqual([
        ['¿Cómo lo edito?', false],
        ['Hola, Tienda B ', true],
        ['La portada', false],
      ]);
      expect(chat.mensajes[1]?.texto).toContain(
        'En breve te atenderá un asesor del Equipo PaseLibre.',
      );
      expect(chat.mensajes[1]).toMatchObject({ de_equipo: true, autor: 'Equipo PaseLibre' });
    });

    it('tras 12 h sin conversación vuelve a salir, con el texto que editó el equipo', async () => {
      await como('tiendab')
        .send('put', '/v1/equipo/chats/respuesta-automatica', {
          texto: 'Hola {tienda}, ya te leemos.',
        })
        .expect(403);
      await como('equipo')
        .send('put', '/v1/equipo/chats/respuesta-automatica', {
          texto: 'Hola {tienda}, ya te leemos.',
        })
        .expect(200);
      const leida = await como('equipo').get('/v1/equipo/chats/respuesta-automatica').expect(200);
      expect(leida.body.texto).toBe('Hola {tienda}, ya te leemos.');
      await prisma.mensajeEquipo.updateMany({
        data: { creadoEn: new Date(Date.now() - 13 * 3_600_000) },
      });
      await como('tiendab').send('post', '/v1/equipo-chat/mensajes', { texto: 'Hola otra vez' });
      const chat = (await como('tiendab').get('/v1/equipo-chat').expect(200))
        .body as RespuestaChatEquipo;
      expect(chat.mensajes.at(-1)).toMatchObject({
        texto: 'Hola Tienda B, ya te leemos.',
        automatica: true,
      });
      expect(chat.sin_leer).toBe(0);
    });

    it('«Recibiste 1 advertencia de 3»: cuenta advertencias del equipo, no reportes', async () => {
      const tiendaB = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda B' } });
      const antes = (await como('tiendab').get('/v1/equipo-chat').expect(200))
        .body as RespuestaChatEquipo;
      expect(antes.advertencias).toBeUndefined();
      await como('equipo')
        .send('post', `/v1/equipo/panel/tiendas/${tiendaB.id}/advertencia`, {
          motivo: 'Un producto no era como se describió',
        })
        .expect(204);
      const chat = (await como('tiendab').get('/v1/equipo-chat').expect(200))
        .body as RespuestaChatEquipo;
      expect(chat.advertencias).toMatchObject({
        total: 1,
        maximo: 3,
        ultima: { motivo: 'Un producto no era como se describió' },
      });
      const aviso = await hastaQue(() =>
        prisma.aviso.findFirstOrThrow({
          where: { usuario: { usuario: 'tiendab' }, titulo: 'Recibiste 1 advertencia de 3' },
        }),
      );
      expect(aviso.extracto).toContain('Si llegas a 3, tu cuenta puede suspenderse.');
    });
  });
});
