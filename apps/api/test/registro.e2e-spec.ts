import { createHash } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { RespuestaSolicitud, SolicitudEquipo } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { RUC_DE_EJEMPLO } from '../src/modules/registro/proveedores';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/** Un RUC válido (con su dígito de control) a partir de los 10 primeros dígitos. */
function rucCon(base: string): string {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, i) => total + peso * Number(base[i]), 0);
  const resto = 11 - (suma % 11);
  return base + String(resto === 10 ? 0 : resto === 11 ? 1 : resto);
}
// El dígito 10 decide lo que contesta la SUNAT simulada: 0 = de baja, 9 = no existe.
const RUC_DE_BAJA = rucCon('2060123450');
const RUC_INEXISTENTE = rucCon('2060123459');
const RUC_ACTIVO = rucCon('2060123451');

const HORARIO = {
  dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'],
  desde: '10:00',
  hasta: '20:00',
};
const CLAVE = 'mi-clave-de-tienda-26';

describe('Registro propio de tiendas (RF-01, RF-04)', () => {
  let apagada: INestApplication;
  let app: INestApplication;
  let equipo: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    apagada = await crearApp();
    app = await crearApp({ registro: true });
    equipo = cookieDe(
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: 'equipo', clave: CLAVE_DEMO })
        .expect(200),
    );
  });

  afterAll(async () => {
    await apagada.close();
    await app.close();
    await prisma.$disconnect();
  });

  /** Pide el código, lo confirma y devuelve el token del celular. */
  async function confirmarCelular(celular: string): Promise<string> {
    const pedido = await http()
      .post('/v1/registro/celular')
      .set(CABECERAS)
      .send({ celular })
      .expect(200);
    const confirmado = await http()
      .post('/v1/registro/celular/verificar')
      .set(CABECERAS)
      .send({ celular, codigo: pedido.body.codigo_prueba })
      .expect(200);
    return confirmado.body.token_celular as string;
  }

  /**
   * Un token ya confirmado, sin pasar por el SMS: el pedido de código se puede repetir solo una
   * vez por minuto, y estas pruebas necesitan varios del mismo celular.
   */
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

  const solicitud = (token: string, resto: Record<string, unknown> = {}) => ({
    token_celular: token,
    metodo: 'SIN_RUC_DNI',
    dni: '45678912',
    nombre_comercial: 'Tienda Nueva',
    categorias: ['Gráficas', 'RAM'],
    galeria: 'cyberplaza',
    galeria_otra: null,
    piso: '1',
    stand: '118',
    referencia: 'Al lado de las escaleras',
    horario: HORARIO,
    encargado: 'Rosa Mendoza',
    clave: CLAVE,
    acepta_terminos: true,
    ...resto,
  });

  const enviar = (cuerpo: object) =>
    http().post('/v1/registro/solicitudes').set(CABECERAS).send(cuerpo);

  const comoEquipo = {
    get: (ruta: string) => http().get(ruta).set('Cookie', equipo),
    post: (ruta: string, cuerpo: object = {}) =>
      http().post(ruta).set(CABECERAS).set('Cookie', equipo).send(cuerpo),
  };

  describe('apagado (lo normal en producción)', () => {
    it('dice que no está activo y sus rutas no existen', async () => {
      const opciones = await request(apagada.getHttpServer())
        .get('/v1/registro/opciones')
        .expect(200);
      expect(opciones.body).toEqual({ activo: false, galerias: [], categorias: [] });
      const pedido = await request(apagada.getHttpServer())
        .post('/v1/registro/celular')
        .set(CABECERAS)
        .send({ celular: '987000001' });
      expect(pedido.status).toBe(404);
    });
  });

  describe('el celular', () => {
    it('trae las galerías y las categorías para llenar el formulario', async () => {
      const respuesta = await http().get('/v1/registro/opciones').expect(200);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.body.activo).toBe(true);
      expect(respuesta.body.galerias.map((g: { slug: string }) => g.slug)).toContain('cyberplaza');
      expect(respuesta.body.categorias).toContain('Gráficas');
    });

    it('manda un código de 6 dígitos y no deja pedir otro enseguida', async () => {
      const celular = '987000010';
      const primero = await http()
        .post('/v1/registro/celular')
        .set(CABECERAS)
        .send({ celular: '+51 987 000 010' })
        .expect(200);
      expect(primero.body.codigo_prueba).toMatch(/^\d{6}$/);
      expect(primero.body.reenviar_en_s).toBe(60);
      const segundo = await http()
        .post('/v1/registro/celular')
        .set(CABECERAS)
        .send({ celular })
        .expect(429);
      expect(segundo.body.error.codigo).toBe('DEMASIADAS_SOLICITUDES');
    });

    it('rechaza un código equivocado, cuenta los intentos y a los 5 pide uno nuevo', async () => {
      const celular = '987000011';
      const pedido = await http()
        .post('/v1/registro/celular')
        .set(CABECERAS)
        .send({ celular })
        .expect(200);
      const malo = pedido.body.codigo_prueba === '000000' ? '111111' : '000000';
      const primero = await http()
        .post('/v1/registro/celular/verificar')
        .set(CABECERAS)
        .send({ celular, codigo: malo })
        .expect(400);
      expect(primero.body.error.mensaje).toContain('Te quedan 4 intentos');
      for (let i = 0; i < 4; i++) {
        await http()
          .post('/v1/registro/celular/verificar')
          .set(CABECERAS)
          .send({ celular, codigo: malo });
      }
      // Ya gastó los 5: ni el código bueno sirve.
      const agotado = await http()
        .post('/v1/registro/celular/verificar')
        .set(CABECERAS)
        .send({ celular, codigo: pedido.body.codigo_prueba })
        .expect(429);
      expect(agotado.body.error.codigo).toBe('DEMASIADAS_SOLICITUDES');
    });

    it('pide un celular peruano de verdad', async () => {
      await http().post('/v1/registro/celular').set(CABECERAS).send({ celular: '123' }).expect(400);
      // Sin la cabecera de la web, como todo lo que cambia datos.
      await http().post('/v1/registro/celular').send({ celular: '987000012' }).expect(403);
    });
  });

  describe('el RUC', () => {
    it('descarta un RUC mal escrito antes de preguntarle a SUNAT', async () => {
      await http().post('/v1/registro/ruc').set(CABECERAS).send({ ruc: '20512345678' }).expect(400);
      await http().post('/v1/registro/ruc').set(CABECERAS).send({ ruc: '1234' }).expect(400);
    });

    it('distingue activo y habido, de baja y que no existe', async () => {
      const bueno = await http()
        .post('/v1/registro/ruc')
        .set(CABECERAS)
        .send({ ruc: RUC_DE_EJEMPLO })
        .expect(200);
      expect(bueno.body).toEqual({
        encontrado: true,
        apto: true,
        datos: {
          razon_social: 'TIENDA B COMPUTER S.A.C.',
          estado: 'ACTIVO',
          condicion: 'HABIDO',
          domicilio: 'Cercado de Lima',
        },
      });
      const baja = await http()
        .post('/v1/registro/ruc')
        .set(CABECERAS)
        .send({ ruc: RUC_DE_BAJA })
        .expect(200);
      expect(baja.body).toMatchObject({ encontrado: true, apto: false });
      expect(baja.body.datos.condicion).toBe('NO HABIDO');
      const nada = await http()
        .post('/v1/registro/ruc')
        .set(CABECERAS)
        .send({ ruc: RUC_INEXISTENTE })
        .expect(200);
      expect(nada.body).toEqual({ encontrado: false, apto: false, datos: null });
    });
  });

  describe('con RUC activo y habido', () => {
    it('se aprueba sola y entra con su celular y su contraseña', async () => {
      const token = await confirmarCelular('987000020');
      const enviada = await enviar(
        solicitud(token, {
          metodo: 'RUC',
          ruc: RUC_ACTIVO,
          dni: undefined,
          nombre_comercial: 'Tienda con RUC',
        }),
      ).expect(201);
      const cuerpo = enviada.body as RespuestaSolicitud;
      expect(enviada.headers['cache-control']).toBe('no-store');
      expect(cuerpo).toMatchObject({
        estado: 'APROBADA',
        aprobada_sola: true,
        vence_en: null,
        usuario: '987000020',
      });
      expect(cuerpo.consulta).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(cuerpo.datos.ruc).toBe(RUC_ACTIVO);

      // Entra con el celular como usuario y la contraseña que eligió: sin clave temporal.
      const ingreso = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: '987000020', clave: CLAVE })
        .expect(200);
      expect(ingreso.body.usuario.debe_cambiar_clave).toBe(false);
      const yo = await http().get('/v1/yo').set('Cookie', cookieDe(ingreso)).expect(200);
      expect(yo.body.tienda).toMatchObject({ nombre: 'Tienda con RUC', stand: '118' });

      const tienda = await prisma.tienda.findFirstOrThrow({ where: { nombre: 'Tienda con RUC' } });
      expect(tienda.piso).toBe('1');
      expect(tienda.horario).toBe('Lun a sáb, de 10:00 a. m. a 8:00 p. m.');
      const auditoria = await prisma.auditoria.findFirst({
        where: { accion: 'aprobar_solicitud_por_ruc' },
      });
      expect(auditoria?.actorId).toBeNull();
    });

    it('con el RUC de baja queda para que una persona lo revise', async () => {
      const token = await confirmarCelular('987000021');
      const enviada = await enviar(
        solicitud(token, { metodo: 'RUC', ruc: RUC_DE_BAJA, dni: undefined }),
      ).expect(201);
      expect(enviada.body).toMatchObject({ estado: 'PENDIENTE', aprobada_sola: false });
      await comoEquipo
        .post(`/v1/equipo/solicitudes/${await idDe('987000021')}/rechazar`, {
          mensaje: 'RUC de baja.',
        })
        .expect(200);
    });

    it('si SUNAT no conoce el RUC, no recibe la solicitud', async () => {
      const token = await confirmarCelular('987000022');
      const respuesta = await enviar(
        solicitud(token, { metodo: 'RUC', ruc: RUC_INEXISTENTE, dni: undefined }),
      ).expect(400);
      expect(respuesta.body.error.mensaje).toContain('SUNAT no encontró');
    });
  });

  async function idDe(celular: string): Promise<string> {
    return (await prisma.solicitud.findFirstOrThrow({ where: { celular } })).id;
  }

  describe('sin RUC: la revisa una persona', () => {
    let consulta = '';
    let id = '';

    it('queda pendiente con 3 horas de plazo y no se puede repetir mientras tanto', async () => {
      const token = await confirmarCelular('987000030');
      const antes = Date.now();
      const enviada = await enviar(solicitud(token)).expect(201);
      expect(enviada.body).toMatchObject({
        estado: 'PENDIENTE',
        aprobada_sola: false,
        usuario: null,
      });
      const vence = new Date(enviada.body.vence_en).getTime();
      expect(vence - antes).toBeGreaterThan(2.9 * 3_600_000);
      expect(vence - antes).toBeLessThan(3.1 * 3_600_000);
      consulta = enviada.body.consulta;
      id = await idDe('987000030');

      // Ya no entra: la cuenta no existe hasta que la aprueben.
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: '987000030', clave: CLAVE })
        .expect(401);
      // Y con el mismo celular no puede abrir otra mientras esta siga en revisión.
      const repetida = await enviar(solicitud(await tokenDirecto('987000030'))).expect(409);
      expect(repetida.body.error.mensaje).toContain('en revisión');
    });

    it('el token del SMS vale una sola vez', async () => {
      const token = await confirmarCelular('987000031');
      await enviar(solicitud(token)).expect(201);
      const repetida = await enviar(solicitud(token)).expect(400);
      expect(repetida.body.error.mensaje).toContain('Confirma tu celular');
    });

    it('quien la envió la consulta con su código y nadie más', async () => {
      const propia = await http().get(`/v1/registro/solicitudes/${consulta}`).expect(200);
      expect(propia.body).toMatchObject({ estado: 'PENDIENTE', consulta: null });
      expect(propia.body.datos).toMatchObject({
        nombre_comercial: 'Tienda Nueva',
        galeria: 'cyberplaza',
        stand: '118',
      });
      // Ni el DNI ni la contraseña vuelven nunca.
      expect(JSON.stringify(propia.body)).not.toMatch(/45678912|clave|"dni"/i);
      await http().get('/v1/registro/solicitudes/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa').expect(404);
      await http().get('/v1/registro/solicitudes/corto').expect(400);
    });

    it('el equipo la ve primero en su cola, con el DNI', async () => {
      const lista = await comoEquipo.get('/v1/equipo/solicitudes').expect(200);
      expect(lista.headers['cache-control']).toBe('no-store');
      const primera = lista.body.solicitudes[0] as SolicitudEquipo;
      expect(primera.estado).toBe('PENDIENTE');
      const mia = (lista.body.solicitudes as SolicitudEquipo[]).find((s) => s.id === id)!;
      expect(mia).toMatchObject({
        dni: '45678912',
        galeria: 'Cyberplaza',
        horario: 'Lun a sáb, de 10:00 a. m. a 8:00 p. m.',
      });
      expect(lista.body.resumen.pendientes).toBeGreaterThanOrEqual(1);
    });

    it('si el equipo pide un cambio, lo ve quien la envió, lo corrige y vuelve a la cola', async () => {
      await comoEquipo
        .post(`/v1/equipo/solicitudes/${id}/pedir-cambios`, {
          mensaje: 'Falta el número de stand.',
        })
        .expect(200);
      const vista = await http().get(`/v1/registro/solicitudes/${consulta}`).expect(200);
      expect(vista.body).toMatchObject({
        estado: 'REQUIERE_CAMBIOS',
        mensaje_equipo: 'Falta el número de stand.',
        vence_en: null,
      });

      const corregida = await http()
        .put(`/v1/registro/solicitudes/${consulta}`)
        .set(CABECERAS)
        .send({ ...solicitud('x'), token_celular: undefined, clave: undefined, stand: '119' })
        .expect(200);
      expect(corregida.body).toMatchObject({ estado: 'PENDIENTE', mensaje_equipo: null });
      expect(corregida.body.datos.stand).toBe('119');
      expect(corregida.body.vence_en).not.toBeNull();
      // Ya no está en «requiere cambios»: no se corrige dos veces.
      await http()
        .put(`/v1/registro/solicitudes/${consulta}`)
        .set(CABECERAS)
        .send({ ...solicitud('x'), token_celular: undefined, clave: undefined })
        .expect(409);
    });

    it('al aprobarla se crea la tienda, se borra el DNI y entra con su contraseña', async () => {
      const aprobada = await comoEquipo.post(`/v1/equipo/solicitudes/${id}/aprobar`).expect(200);
      expect(aprobada.body).toMatchObject({ estado: 'APROBADA', aprobada_sola: false, dni: null });
      expect(aprobada.body.tienda_id).toMatch(/[0-9a-f-]{36}/);
      const fila = await prisma.solicitud.findUniqueOrThrow({ where: { id } });
      expect(fila.dni).toBeNull();
      const ingreso = await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: '987000030', clave: CLAVE })
        .expect(200);
      expect(ingreso.body.usuario.debe_cambiar_clave).toBe(false);
      const vista = await http().get(`/v1/registro/solicitudes/${consulta}`).expect(200);
      expect(vista.body).toMatchObject({ estado: 'APROBADA', usuario: '987000030' });
      // Y no se aprueba dos veces.
      await comoEquipo.post(`/v1/equipo/solicitudes/${id}/aprobar`).expect(409);
    });
  });

  describe('galería que aún no está en la lista', () => {
    it('el equipo tiene que elegir una galería para aprobarla', async () => {
      const token = await confirmarCelular('987000040');
      await enviar(solicitud(token, { galeria: null, galeria_otra: 'Galería Nueva' })).expect(201);
      const id = await idDe('987000040');
      const sin = await comoEquipo.post(`/v1/equipo/solicitudes/${id}/aprobar`).expect(400);
      expect(sin.body.error.mensaje).toContain('Galería Nueva');
      const con = await comoEquipo
        .post(`/v1/equipo/solicitudes/${id}/aprobar`, { galeria: 'maxiplaza' })
        .expect(200);
      expect(con.body.galeria).toBe('Maxiplaza');
    });

    it('exige una galería o el nombre de otra, no las dos ni ninguna', async () => {
      const token = await confirmarCelular('987000041');
      await enviar(solicitud(token, { galeria: null, galeria_otra: null })).expect(400);
      await enviar(solicitud(token, { galeria: 'cyberplaza', galeria_otra: 'Otra' })).expect(400);
      await enviar(solicitud(token, { galeria: 'no-existe' })).expect(400);
    });
  });

  describe('lo que no se acepta', () => {
    it('un celular que ya tiene cuenta', async () => {
      const respuesta = await enviar(solicitud(await tokenDirecto('987000030'))).expect(409);
      expect(respuesta.body.error.mensaje).toContain('ya tiene una cuenta');
    });

    it('una contraseña corta o demasiado común, o sin aceptar los términos', async () => {
      const token = await tokenDirecto('987000050');
      await enviar(solicitud(token, { clave: 'corta' })).expect(400);
      const comun = await enviar(solicitud(token, { clave: 'wilson2026' })).expect(400);
      expect(comun.body.error.mensaje).toContain('común');
      await enviar(solicitud(token, { acepta_terminos: false })).expect(400);
      // Los errores no gastan el token: con los datos bien, pasa.
      await enviar(solicitud(token)).expect(201);
    });

    it('un token inventado', async () => {
      await enviar(solicitud('a'.repeat(43))).expect(400);
    });

    it('rechazada, puede volver a pedirla con otro código', async () => {
      const token = await confirmarCelular('987000060');
      await enviar(solicitud(token)).expect(201);
      const id = await idDe('987000060');
      const rechazada = await comoEquipo
        .post(`/v1/equipo/solicitudes/${id}/rechazar`, {
          mensaje: 'No pudimos verificar el stand.',
        })
        .expect(200);
      expect(rechazada.body).toMatchObject({
        estado: 'RECHAZADA',
        dni: null,
        mensaje_equipo: 'No pudimos verificar el stand.',
      });
      await comoEquipo
        .post(`/v1/equipo/solicitudes/${id}/rechazar`, { mensaje: 'Otra vez.' })
        .expect(409);
      const otraVez = await tokenDirecto('987000060');
      await enviar(solicitud(otraVez)).expect(201);
    });
  });

  describe('el panel del equipo', () => {
    it('solo entra el equipo', async () => {
      await http().get('/v1/equipo/solicitudes').expect(401);
      const vendedor = cookieDe(
        await http()
          .post('/v1/sesion')
          .set(CABECERAS)
          .send({ usuario: 'tiendaa', clave: CLAVE_DEMO })
          .expect(200),
      );
      await http().get('/v1/equipo/solicitudes').set('Cookie', vendedor).expect(403);
      await http()
        .post('/v1/equipo/solicitudes/00000000-0000-4000-8000-000000000000/aprobar')
        .set(CABECERAS)
        .set('Cookie', vendedor)
        .send({})
        .expect(403);
    });

    it('filtra por estado y cuenta lo que hay', async () => {
      const lista = await comoEquipo.get('/v1/equipo/solicitudes?estado=APROBADA').expect(200);
      expect(
        (lista.body.solicitudes as SolicitudEquipo[]).every((s) => s.estado === 'APROBADA'),
      ).toBe(true);
      expect(lista.body.resumen.aprobadas).toBeGreaterThanOrEqual(3);
      await comoEquipo.get('/v1/equipo/solicitudes?estado=otra').expect(400);
      await comoEquipo.get('/v1/equipo/solicitudes/no-es-un-id').expect(400);
      await comoEquipo
        .get('/v1/equipo/solicitudes/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });
  });
});
