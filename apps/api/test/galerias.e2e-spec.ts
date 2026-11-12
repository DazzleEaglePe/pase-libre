import { createHash } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { GaleriaEquipo, RespuestaGaleriasEquipo } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Un RUC válido (con su dígito de control): el 10.º dígito en 1 = activo y habido en la SUNAT simulada. */
function rucCon(base: string): string {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, i) => total + peso * Number(base[i]), 0);
  const resto = 11 - (suma % 11);
  return base + String(resto === 10 ? 0 : resto === 11 ? 1 : resto);
}

const LAS_7 = [
  'cyberplaza',
  'compuplaza',
  'galerias-garcilaso',
  'maxiplaza',
  'galeria-centro-de-lima',
  'compu-wilson',
  'galeria-global-com',
];

/** Equipo › Galerías (docs/18 §3): la lista única de galerías y los avisos «Galería nueva». */
describe('Equipo › Galerías (docs/18 §3)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();

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

  /**
   * Pedidos como el equipo. Devuelve el pedido envuelto: un `await` directo sobre el de supertest
   * ya lo mandaría sin el `.expect`.
   */
  async function comoEquipo(prueba: (cookie: string) => request.Test) {
    const enviado = prueba(await como('equipo'));
    return { expect: (estado: number) => enviado.expect(estado) };
  }
  const equipo = {
    get: (ruta: string) => comoEquipo((cookie) => http().get(ruta).set('Cookie', cookie)),
    post: (ruta: string, cuerpo?: object) =>
      comoEquipo((cookie) => http().post(ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo)),
    patch: (ruta: string, cuerpo: object) =>
      comoEquipo((cookie) => http().patch(ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo)),
    put: (ruta: string, cuerpo: object) =>
      comoEquipo((cookie) => http().put(ruta).set(CABECERAS).set('Cookie', cookie).send(cuerpo)),
    delete: (ruta: string) =>
      comoEquipo((cookie) => http().delete(ruta).set(CABECERAS).set('Cookie', cookie)),
  };

  async function lista(): Promise<RespuestaGaleriasEquipo> {
    return (await (await equipo.get('/v1/equipo/galerias')).expect(200)).body;
  }

  async function idDe(slug: string): Promise<string> {
    return (await prisma.galeria.findUniqueOrThrow({ where: { slug } })).id;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ registro: true });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('quién entra', () => {
    it('sin sesión no, y una tienda tampoco', async () => {
      await http().get('/v1/equipo/galerias').expect(401);
      await http()
        .get('/v1/equipo/galerias')
        .set('Cookie', await como('tiendaa'))
        .expect(403);
      await http()
        .post('/v1/equipo/galerias')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ nombre: 'Galería de una tienda' })
        .expect(403);
      await http()
        .put('/v1/equipo/galerias/orden')
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({ ids: [await idDe('maxiplaza')] })
        .expect(403);
      await http()
        .delete(`/v1/equipo/galerias/${await idDe('galeria-global-com')}`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .expect(403);
      expect(await prisma.galeria.count({ where: { slug: 'galeria-de-una-tienda' } })).toBe(0);
    });
  });

  describe('la lista', () => {
    it('trae las 7 en su orden, con cuántas tiendas tiene cada una', async () => {
      const { galerias, avisos } = await lista();
      expect(galerias.map((g) => g.slug)).toEqual(LAS_7);
      expect(galerias.map((g) => g.orden)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      const tiendasEn = async (slug: string) =>
        prisma.tienda.count({ where: { galeria: { slug } } });
      const maxi = galerias.find((g) => g.slug === 'maxiplaza');
      expect(maxi?.tiendas).toBe(await tiendasEn('maxiplaza'));
      expect(maxi?.tiendas).toBeGreaterThan(0);
      expect(galerias.find((g) => g.slug === 'compuplaza')?.tiendas).toBe(0);
      expect(avisos).toEqual([]);
    });

    it('las listas públicas salen en el mismo orden', async () => {
      const publica = await http().get('/v1/galerias').expect(200);
      expect(publica.body.map((g: { slug: string }) => g.slug)).toEqual([
        ...LAS_7,
        'independientes',
      ]);
      const registro = await http().get('/v1/registro/opciones').expect(200);
      expect(registro.body.galerias.map((g: { slug: string }) => g.slug)).toEqual(LAS_7);
      const cuenta = await http()
        .get('/v1/cuenta/galerias')
        .set('Cookie', await como('tiendaa'))
        .expect(200);
      expect(cuenta.body.map((g: { nombre: string }) => g.nombre)).toEqual(
        (await lista()).galerias.map((g) => g.nombre),
      );
    });

    it('Wilson en vivo muestra las 7 aunque no tengan tiendas, las vacías como «Sin productos»', async () => {
      const wilson = await http().get('/v1/wilson').expect(200);
      expect(wilson.body.galerias.map((g: { slug: string }) => g.slug)).toEqual(LAS_7);
      const vacia = wilson.body.galerias.find(
        (g: { slug: string }) => g.slug === 'galeria-global-com',
      );
      expect(vacia).toMatchObject({ productos: 0, tiendas: 0, nivel: 'SIN' });
    });
  });

  describe('agregar, editar y ordenar', () => {
    let nueva: GaleriaEquipo;

    it('«+ Agregar galería» la pone al final, con sus metros si los dan', async () => {
      const creada = await (
        await equipo.post('/v1/equipo/galerias', { nombre: '  Plaza Tecno ', metros: 340 })
      ).expect(201);
      nueva = creada.body;
      expect(nueva).toMatchObject({
        nombre: 'Plaza Tecno',
        slug: 'plaza-tecno',
        activa: true,
        orden: 8,
        metros: 340,
        tiendas: 0,
      });
      const sinMetros = await (
        await equipo.post('/v1/equipo/galerias', { nombre: 'Galería Sin Metros' })
      ).expect(201);
      expect(sinMetros.body).toMatchObject({ metros: null, orden: 9 });
      const actividad = await prisma.registroEquipo.findFirst({
        where: { accion: 'agregó la galería Plaza Tecno' },
      });
      expect(actividad).not.toBeNull();
    });

    it('no acepta un nombre repetido, vacío ni «Independientes»', async () => {
      const repetida = await (
        await equipo.post('/v1/equipo/galerias', { nombre: 'plaza tecno' })
      ).expect(409);
      expect(repetida.body.error.mensaje).toBe('Ya hay una galería con ese nombre.');
      await (await equipo.post('/v1/equipo/galerias', { nombre: ' ' })).expect(400);
      await (await equipo.post('/v1/equipo/galerias', { nombre: 'Independientes' })).expect(400);
      await (await equipo.post('/v1/equipo/galerias', { nombre: 'X1', metros: -3 })).expect(400);
    });

    it('«Editar» cambia el nombre y los metros sin cambiar el slug', async () => {
      const editada = await (
        await equipo.patch(`/v1/equipo/galerias/${nueva.id}`, {
          nombre: 'Plaza Tecno Wilson',
          metros: null,
        })
      ).expect(200);
      expect(editada.body).toMatchObject({
        nombre: 'Plaza Tecno Wilson',
        slug: 'plaza-tecno',
        metros: null,
      });
      await (
        await equipo.patch(`/v1/equipo/galerias/${nueva.id}`, { nombre: 'Maxiplaza' })
      ).expect(409);
      await (await equipo.patch(`/v1/equipo/galerias/${nueva.id}`, {})).expect(400);
      await (
        await equipo.patch('/v1/equipo/galerias/00000000-0000-4000-8000-000000000000', {
          activa: false,
        })
      ).expect(404);
    });

    it('arrastrar guarda el orden nuevo, y las listas públicas lo siguen', async () => {
      const { galerias } = await lista();
      const ids = galerias.map((g) => g.id);
      // CompuPlaza primero, y Plaza Tecno Wilson en el tercer lugar.
      const compu = ids.splice(1, 1)[0] as string;
      ids.unshift(compu);
      ids.splice(ids.indexOf(nueva.id), 1);
      ids.splice(2, 0, nueva.id);
      await (await equipo.put('/v1/equipo/galerias/orden', { ids })).expect(204);
      const despues = await lista();
      expect(despues.galerias.map((g) => g.id)).toEqual(ids);
      expect(despues.galerias.map((g) => g.orden)).toEqual(ids.map((_, i) => i + 1));
      const registro = await http().get('/v1/registro/opciones').expect(200);
      expect(registro.body.galerias.slice(0, 3).map((g: { slug: string }) => g.slug)).toEqual([
        'compuplaza',
        'cyberplaza',
        'plaza-tecno',
      ]);
    });

    it('el orden tiene que traer todas las galerías, sin repetir', async () => {
      const { galerias } = await lista();
      const ids = galerias.map((g) => g.id);
      await (await equipo.put('/v1/equipo/galerias/orden', { ids: ids.slice(1) })).expect(409);
      await (
        await equipo.put('/v1/equipo/galerias/orden', { ids: [...ids.slice(1), ids[1]] })
      ).expect(400);
      expect((await lista()).galerias.map((g) => g.id)).toEqual(ids);
    });
  });

  describe('ocultar y borrar', () => {
    it('una galería con tiendas no se borra: se oculta y sale de las listas públicas', async () => {
      const maxi = await idDe('maxiplaza');
      const borrar = await (await equipo.delete(`/v1/equipo/galerias/${maxi}`)).expect(409);
      expect(borrar.body.error.mensaje).toContain('Puedes ocultarla');
      expect(await prisma.galeria.count({ where: { id: maxi } })).toBe(1);

      const oculta = await (
        await equipo.patch(`/v1/equipo/galerias/${maxi}`, { activa: false })
      ).expect(200);
      expect(oculta.body).toMatchObject({ activa: false });
      expect(oculta.body.tiendas).toBeGreaterThan(0);
      // Sus tiendas siguen en ella.
      expect(await prisma.tienda.count({ where: { galeriaId: maxi } })).toBe(oculta.body.tiendas);

      const slugs = (cuerpo: Array<{ slug: string }>) => cuerpo.map((g) => g.slug);
      expect(slugs((await http().get('/v1/galerias').expect(200)).body)).not.toContain('maxiplaza');
      expect(
        slugs((await http().get('/v1/registro/opciones').expect(200)).body.galerias),
      ).not.toContain('maxiplaza');
      expect(slugs((await http().get('/v1/wilson').expect(200)).body.galerias)).not.toContain(
        'maxiplaza',
      );
      // En el panel del equipo sigue, marcada como oculta.
      expect((await lista()).galerias.find((g) => g.id === maxi)?.activa).toBe(false);

      await (await equipo.patch(`/v1/equipo/galerias/${maxi}`, { activa: true })).expect(200);
      expect(slugs((await http().get('/v1/galerias').expect(200)).body)).toContain('maxiplaza');
    });

    it('una galería sin tiendas se puede borrar', async () => {
      const sinMetros = await idDe('galeria-sin-metros');
      await (await equipo.delete(`/v1/equipo/galerias/${sinMetros}`)).expect(204);
      expect(await prisma.galeria.count({ where: { id: sinMetros } })).toBe(0);
      await (await equipo.delete(`/v1/equipo/galerias/${sinMetros}`)).expect(404);
    });
  });

  describe('avisos «Galería nueva»', () => {
    async function tokenDirecto(celular: string): Promise<string> {
      const token = `token-de-prueba-${celular}-${Math.random().toString(36).slice(2)}`;
      await prisma.codigoCelular.create({
        data: {
          celular,
          codigoHash: '0'.repeat(64),
          expiraEn: new Date(Date.now() + 600_000),
          verificadoEn: new Date(),
          tokenHash: createHash('sha256').update(token).digest('hex'),
          tokenExpiraEn: new Date(Date.now() + 1_800_000),
        },
      });
      return token;
    }

    async function registrar(
      celular: string,
      nombre: string,
      galeriaOtra: string,
      conRuc = false,
    ): Promise<string> {
      await http()
        .post('/v1/registro/solicitudes')
        .set(CABECERAS)
        .send({
          token_celular: await tokenDirecto(celular),
          ...(conRuc
            ? { metodo: 'RUC', ruc: rucCon('2060123451') }
            : { metodo: 'SIN_RUC_DNI', dni: '45678912' }),
          nombre_comercial: nombre,
          categorias: ['RAM'],
          galeria: null,
          galeria_otra: galeriaOtra,
          piso: '1',
          stand: '118',
          referencia: null,
          horario: { dias: ['lun', 'mar'], desde: '10:00', hasta: '20:00' },
          encargado: 'Rosa Mendoza',
          clave: 'mi-clave-de-tienda-26',
          acepta_terminos: true,
        })
        .expect(201);
      const fila = await prisma.solicitud.findFirstOrThrow({
        where: { celular },
        orderBy: { creadaEn: 'desc' },
      });
      return fila.id;
    }

    let conRuc: string;
    let pendiente: string;
    let otra: string;

    it('quien elige «Otra galería» deja un aviso; los que escriben lo mismo van juntos', async () => {
      // Con RUC activo y habido, pero sin galería de la lista: no se aprueba sola todavía
      // (una tienda no puede quedar sin galería).
      conRuc = await registrar('987000501', 'Tienda Nube', 'Galería Nube Plaza', true);
      pendiente = await registrar('987000502', 'Tienda Lluvia', 'galeria nube plaza');
      otra = await registrar('987000503', 'Tienda Sol', 'Mi galería inventada');

      const filaRuc = await prisma.solicitud.findUniqueOrThrow({ where: { id: conRuc } });
      expect(filaRuc).toMatchObject({ estado: 'PENDIENTE', galeriaId: null, tiendaId: null });

      const { avisos } = await lista();
      expect(avisos).toHaveLength(2);
      expect(avisos[0]).toMatchObject({
        id: conRuc,
        nombre: 'Galería Nube Plaza',
        tiendas: ['Tienda Nube', 'Tienda Lluvia'],
      });
      expect(avisos[1]).toMatchObject({
        id: otra,
        nombre: 'Mi galería inventada',
        tiendas: ['Tienda Sol'],
      });

      const inicio = await (await equipo.get('/v1/equipo/inicio')).expect(200);
      expect(inicio.body.galerias_nuevas).toBe(2);
    });

    it('solo el equipo resuelve avisos', async () => {
      await http()
        .post(`/v1/equipo/galerias/avisos/${conRuc}/agregar`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .send({})
        .expect(403);
      await http()
        .post(`/v1/equipo/galerias/avisos/${otra}/descartar`)
        .set(CABECERAS)
        .set('Cookie', await como('tiendaa'))
        .expect(403);
      expect((await lista()).avisos).toHaveLength(2);
    });

    it('«Agregar» crea la galería y las tiendas que la escribieron quedan en ella', async () => {
      const agregada = await (
        await equipo.post(`/v1/equipo/galerias/avisos/${conRuc}/agregar`, { metros: 80 })
      ).expect(201);
      expect(agregada.body).toMatchObject({
        nombre: 'Galería Nube Plaza',
        slug: 'galeria-nube-plaza',
        activa: true,
        metros: 80,
        // La del RUC se aprobó sola al tener galería.
        tiendas: 1,
      });
      const { galerias, avisos } = await lista();
      expect(galerias.at(-1)?.slug).toBe('galeria-nube-plaza');
      expect(avisos.map((a) => a.id)).toEqual([otra]);

      const filaRuc = await prisma.solicitud.findUniqueOrThrow({ where: { id: conRuc } });
      expect(filaRuc).toMatchObject({ estado: 'APROBADA', aprobadaSola: true });
      const tienda = await prisma.tienda.findUniqueOrThrow({ where: { id: filaRuc.tiendaId! } });
      expect(tienda).toMatchObject({ nombre: 'Tienda Nube', galeriaId: agregada.body.id });
      expect(
        await prisma.registroEquipo.count({
          where: {
            tiendaId: tienda.id,
            accion: 'con la galería Galería Nube Plaza, se aprobó sola Tienda Nube (RUC)',
          },
        }),
      ).toBe(1);

      // La sin RUC sigue en la cola, ya con la galería: se aprueba sin elegir una.
      const filaPendiente = await prisma.solicitud.findUniqueOrThrow({ where: { id: pendiente } });
      expect(filaPendiente).toMatchObject({ estado: 'PENDIENTE', galeriaId: agregada.body.id });
      const aprobada = await (
        await equipo.post(`/v1/equipo/solicitudes/${pendiente}/aprobar`, {})
      ).expect(200);
      expect(aprobada.body.galeria).toBe('Galería Nube Plaza');
      const tiendaLluvia = await prisma.tienda.findUniqueOrThrow({
        where: { id: aprobada.body.tienda_id },
      });
      expect(tiendaLluvia.galeriaId).toBe(agregada.body.id);

      // Ya resuelto: no se agrega dos veces.
      await (await equipo.post(`/v1/equipo/galerias/avisos/${conRuc}/agregar`)).expect(404);
    });

    it('«Agregar» con un nombre que ya está usa esa galería', async () => {
      const id = await registrar('987000504', 'Tienda Brisa', 'Compu plaza');
      const agregada = await (
        await equipo.post(`/v1/equipo/galerias/avisos/${id}/agregar`, { nombre: 'CompuPlaza' })
      ).expect(201);
      expect(agregada.body.slug).toBe('compuplaza');
      expect(await prisma.galeria.count({ where: { slug: { startsWith: 'compu' } } })).toBe(2);
      const fila = await prisma.solicitud.findUniqueOrThrow({ where: { id } });
      expect(fila.galeriaId).toBe(agregada.body.id);
    });

    it('«Descartar» quita el aviso y no crea nada', async () => {
      const antes = await prisma.galeria.count();
      await (await equipo.post(`/v1/equipo/galerias/avisos/${otra}/descartar`)).expect(204);
      expect(await prisma.galeria.count()).toBe(antes);
      const { avisos } = await lista();
      expect(avisos).toEqual([]);
      const fila = await prisma.solicitud.findUniqueOrThrow({ where: { id: otra } });
      expect(fila.galeriaId).toBeNull();
      expect(fila.galeriaOtraResueltaEn).not.toBeNull();
      await (await equipo.post(`/v1/equipo/galerias/avisos/${otra}/descartar`)).expect(404);
      const inicio = await (await equipo.get('/v1/equipo/inicio')).expect(200);
      expect(inicio.body.galerias_nuevas).toBe(0);
    });
  });
});
