import type { INestApplication } from '@nestjs/common';
import type { RespuestaCuenta, SesionAbierta } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { dispositivoDe } from '../src/modules/cuenta/cuenta.service';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('Configuración (RF-48, RF-56, RF-58 a RF-60)', () => {
  let app: INestApplication;
  const cookies: Record<string, string> = {};
  const http = () => request(app.getHttpServer());

  const ingresar = async (usuario: string, agente = MAC) =>
    cookieDe(
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .set('User-Agent', agente)
        .send({ usuario, clave: CLAVE_DEMO })
        .expect(200),
    );

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
    for (const usuario of ['tiendaa', 'tiendab', 'tiendaa.kevin']) {
      cookies[usuario] = await ingresar(usuario);
    }
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('datos de la cuenta (RF-58)', () => {
    it('trae lo de la persona y lo de la tienda', async () => {
      const respuesta = await como('tiendaa').get('/v1/cuenta').expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.body as RespuestaCuenta).toMatchObject({
        usuario: { usuario: 'tiendaa', nombre: 'Luis P.', rol: 'DUENO', mostrar_visto: true },
        tienda: {
          nombre: 'Tienda A',
          galeria: 'Maxiplaza',
          stand: '212',
          logo: null,
          precio_visible_defecto: false,
          moneda_defecto: 'USD',
        },
      });
    });

    it('guarda lo que cambia; vacío es «no tengo»', async () => {
      const respuesta = await como('tiendaa')
        .send('patch', '/v1/cuenta', {
          nombre: 'Luis Pérez',
          whatsapp: '',
          tienda: {
            nombre: 'Tienda A · Gamer',
            whatsapp: '+51 987 111 213',
            horario: 'Lunes a sábado, 10:00 a 20:00',
            descripcion: '',
          },
        })
        .expect(200);
      expect(respuesta.body).toMatchObject({
        usuario: { nombre: 'Luis Pérez', whatsapp: null },
        tienda: {
          nombre: 'Tienda A · Gamer',
          whatsapp: '987111213',
          horario: 'Lunes a sábado, 10:00 a 20:00',
          descripcion: null,
        },
      });
    });

    it('el usuario, la galería y el stand solo los cambia el equipo', async () => {
      await como('tiendaa').send('patch', '/v1/cuenta', { usuario: 'otro' }).expect(400);
      await como('tiendaa')
        .send('patch', '/v1/cuenta', { tienda: { stand: '999' } })
        .expect(400);
    });

    it('un correo no se repite entre cuentas', async () => {
      const respuesta = await como('tiendab')
        .send('patch', '/v1/cuenta', { correo: 'LUIS@tiendaa.pe' })
        .expect(409);
      expect(respuesta.body.error.mensaje).toBe('Ese correo ya lo usa otra cuenta.');
      await como('tiendab').send('patch', '/v1/cuenta', { correo: 'no-es-correo' }).expect(400);
    });

    it('el logo es una foto subida por la tienda; se puede quitar', async () => {
      const foto = await sharp({
        create: { width: 64, height: 64, channels: 3, background: '#14161A' },
      })
        .png()
        .toBuffer();
      const subida = await http()
        .post('/v1/archivos')
        .set(CABECERAS)
        .set('Cookie', cookies.tiendaa ?? '')
        .attach('foto', foto, 'logo.png')
        .expect(201);
      await como('tiendab')
        .send('patch', '/v1/cuenta', { tienda: { logo: subida.body.ruta } })
        .expect(400);
      const conLogo = await como('tiendaa')
        .send('patch', '/v1/cuenta', { tienda: { logo: subida.body.ruta } })
        .expect(200);
      expect(conLogo.body.tienda.logo).toBe(subida.body.ruta);
      const sinLogo = await como('tiendaa')
        .send('patch', '/v1/cuenta', { tienda: { logo: null } })
        .expect(200);
      expect(sinLogo.body.tienda.logo).toBeNull();
    });
  });

  describe('preferencias (RF-48, RF-56)', () => {
    it('los valores por defecto se usan al publicar', async () => {
      await como('tiendab')
        .send('patch', '/v1/cuenta', {
          tienda: { precio_visible_defecto: true, moneda_defecto: 'PEN' },
        })
        .expect(200);
      const yo = await como('tiendab').get('/v1/yo').expect(200);
      expect(yo.body.tienda).toMatchObject({ precio_visible_defecto: true, moneda_defecto: 'PEN' });

      const producto = await prisma.producto.findFirstOrThrow({
        where: { titulo: 'Intel Core i5-14400F' },
      });
      const publicada = await como('tiendab')
        .send('post', '/v1/ofertas', {
          producto_id: producto.id,
          condicion: 'NUEVO',
          stock: 1,
          precio: '650',
        })
        .expect(201);
      expect(publicada.body.oferta).toMatchObject({
        moneda: 'PEN',
        precio_visible: true,
        precio: { moneda: 'PEN', centimos: 65000 },
      });
    });

    it('las respuestas rápidas se guardan en orden, sin repetir y hasta 8', async () => {
      const textos = ['Lo tengo, ¿para cuándo?', '¿Mejor precio por 2?', 'Te lo separo'];
      const guardadas = await como('tiendab')
        .send('put', '/v1/cuenta/respuestas-rapidas', { textos })
        .expect(200);
      expect(guardadas.body.map((r: { texto: string }) => r.texto)).toEqual(textos);
      const leidas = await como('tiendab').get('/v1/cuenta/respuestas-rapidas').expect(200);
      expect(leidas.body.map((r: { texto: string }) => r.texto)).toEqual(textos);

      const repetida = await como('tiendab')
        .send('put', '/v1/cuenta/respuestas-rapidas', { textos: ['Hola', 'hola'] })
        .expect(400);
      expect(repetida.body.error.mensaje).toBe('Esa respuesta rápida ya está en la lista.');
      await como('tiendab')
        .send('put', '/v1/cuenta/respuestas-rapidas', {
          textos: Array.from({ length: 9 }, (_, i) => `Respuesta ${i}`),
        })
        .expect(400);
      // Las de otra persona no cambiaron.
      const deLuis = await como('tiendaa').get('/v1/cuenta/respuestas-rapidas').expect(200);
      expect(deLuis.body).toHaveLength(4);
    });
  });

  describe('avisos y privacidad (RF-57, RF-59)', () => {
    let conversacion: string;

    beforeAll(async () => {
      const oferta = await prisma.oferta.findFirstOrThrow({
        where: {
          tienda: { nombre: 'Tienda A · Gamer' },
          producto: { titulo: { startsWith: 'Kingston' } },
        },
      });
      const contacto = await como('tiendab')
        .send('post', `/v1/ofertas/${oferta.id}/contacto`, { canal: 'CHAT' })
        .expect(200);
      conversacion = contacto.body.conversacion_id;
    });

    it('por defecto todo llega a la campanita y no hay «No molestar»', async () => {
      const respuesta = await como('tiendaa').get('/v1/cuenta/avisos').expect(200);
      expect(respuesta.body).toEqual({ campanita: { MENSAJE: true }, no_molestar: null });
    });

    it('guarda «No molestar» en hora de Lima y apaga los avisos de mensajes', async () => {
      const respuesta = await como('tiendaa')
        .send('put', '/v1/cuenta/avisos', {
          campanita: { MENSAJE: false },
          no_molestar: { desde: '22:00', hasta: '08:00' },
        })
        .expect(200);
      expect(respuesta.body).toEqual({
        campanita: { MENSAJE: false },
        no_molestar: { desde: '22:00', hasta: '08:00' },
      });
      const usuario = await prisma.usuario.findUniqueOrThrow({ where: { usuario: 'tiendaa' } });
      expect([usuario.noMolestarDesde, usuario.noMolestarHasta]).toEqual([1320, 480]);

      await como('tiendab')
        .send('post', `/v1/conversaciones/${conversacion}/mensajes`, { texto: '¿Tienes 2?' })
        .expect(201);
      const avisos = await como('tiendaa').get('/v1/avisos').expect(200);
      expect(avisos.body.sin_leer).toBe(0);
      // El chat sí cuenta el mensaje sin leer.
      expect((await como('tiendaa').get('/v1/contadores')).body.mensajes).toBe(1);
    });

    it('rechaza horarios que no son horas o que empiezan y terminan igual', async () => {
      await como('tiendaa')
        .send('put', '/v1/cuenta/avisos', {
          campanita: { MENSAJE: true },
          no_molestar: { desde: '25:00', hasta: '08:00' },
        })
        .expect(400);
      const igual = await como('tiendaa')
        .send('put', '/v1/cuenta/avisos', {
          campanita: { MENSAJE: true },
          no_molestar: { desde: '08:00', hasta: '08:00' },
        })
        .expect(400);
      expect(igual.body.error.mensaje).toBe(
        'El horario debe empezar y terminar a horas distintas.',
      );
    });

    it('sin «Visto» de un lado, ninguno de los dos lo ve', async () => {
      await como('tiendaa')
        .send('patch', `/v1/conversaciones/${conversacion}`, { leida: true })
        .expect(200);
      const conVisto = await como('tiendab')
        .get(`/v1/conversaciones/${conversacion}/mensajes`)
        .expect(200);
      expect(conVisto.body.visto_hasta).not.toBeNull();

      await como('tiendaa').send('patch', '/v1/cuenta', { mostrar_visto: false }).expect(200);
      const sinVisto = await como('tiendab')
        .get(`/v1/conversaciones/${conversacion}/mensajes`)
        .expect(200);
      expect(sinVisto.body.visto_hasta).toBeNull();
    });

    it('lista a los bloqueados y los desbloquea', async () => {
      await como('tiendaa').send('post', `/v1/conversaciones/${conversacion}/bloqueo`).expect(204);
      const lista = await como('tiendaa').get('/v1/cuenta/bloqueados').expect(200);
      expect(lista.body).toMatchObject([{ tienda: { nombre: 'Tienda B', galeria: 'Cyberplaza' } }]);
      await como('tiendaa')
        .send('delete', `/v1/cuenta/bloqueados/${lista.body[0].tienda.id}`)
        .expect(204);
      expect((await como('tiendaa').get('/v1/cuenta/bloqueados')).body).toEqual([]);
      await como('tiendab')
        .send('post', `/v1/conversaciones/${conversacion}/mensajes`, { texto: 'Gracias' })
        .expect(201);
    });
  });

  describe('seguridad (RF-60)', () => {
    it('reconoce el navegador de cada sesión', () => {
      expect(dispositivoDe(ANDROID)).toBe('Chrome en Android');
      expect(dispositivoDe(MAC)).toBe('Safari en Mac');
      expect(
        dispositivoDe(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
        ),
      ).toBe('Chrome en iPhone');
      expect(dispositivoDe(null)).toBe('Navegador desconocido');
    });

    it('lista las sesiones abiertas, con la actual primero', async () => {
      const celular = await ingresar('tiendaa.kevin', ANDROID);
      const sesiones = await como('tiendaa.kevin').get('/v1/cuenta/sesiones').expect(200);
      expect(sesiones.body.map((s: SesionAbierta) => [s.dispositivo, s.actual])).toEqual([
        ['Safari en Mac', true],
        ['Chrome en Android', false],
      ]);

      const otra = sesiones.body[1] as SesionAbierta;
      await como('tiendaa.kevin').send('delete', `/v1/cuenta/sesiones/${otra.id}`).expect(204);
      await http().get('/v1/yo').set('Cookie', celular).expect(401);
      await como('tiendaa.kevin').send('delete', `/v1/cuenta/sesiones/${otra.id}`).expect(404);
    });

    it('«Cerrar todas las demás» deja solo la actual', async () => {
      const [uno, dos] = [
        await ingresar('tiendaa.kevin', ANDROID),
        await ingresar('tiendaa.kevin'),
      ];
      const respuesta = await como('tiendaa.kevin')
        .send('post', '/v1/cuenta/sesiones/cerrar-otras')
        .expect(200);
      expect(respuesta.body).toEqual({ cerradas: 2 });
      await http().get('/v1/yo').set('Cookie', uno).expect(401);
      await http().get('/v1/yo').set('Cookie', dos).expect(401);
      await como('tiendaa.kevin').get('/v1/yo').expect(200);
    });

    it('no toca las sesiones de otra persona', async () => {
      const deLuis = await prisma.sesion.findFirstOrThrow({
        where: { usuario: { usuario: 'tiendaa' }, revocadaEn: null },
      });
      await como('tiendaa.kevin').send('delete', `/v1/cuenta/sesiones/${deLuis.id}`).expect(404);
      await como('tiendaa').get('/v1/yo').expect(200);
    });
  });
});
