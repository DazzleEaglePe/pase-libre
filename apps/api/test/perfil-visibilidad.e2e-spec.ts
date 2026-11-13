import type { INestApplication } from '@nestjs/common';
import type {
  PerfilTienda,
  RespuestaAvisos,
  RespuestaBuscar,
  RespuestaDirectorioTiendas,
  RespuestaEnVivo,
  RespuestaFicha,
  RespuestaInicio,
  RespuestaPublicacionesTienda,
  RespuestaSeguidores,
  RespuestaSugerenciasConTiendas,
} from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import { CABECERAS, cookieDe, crearApp, usarBaseDePruebas, vaciarBase } from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

/**
 * Doc 20, punto 5: perfil Público / Privado / Oculto con dos tiendas de prueba. Tienda B queda
 * privada y Tienda C oculta (las dos en Cyberplaza); Tienda E, pública (Maxiplaza), sigue a B.
 * Tienda A no sigue a nadie. Se revisa el Inicio, la búsqueda, la ficha («Las tiendas que lo
 * tienen»), Pedidos en vivo y el directorio; las solicitudes para seguir, quitar seguidoras y que
 * el Equipo ve todo.
 */
describe('Perfil público, privado u oculto (doc 20, punto 5)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const cookies = new Map<string, string>();
  const ids = new Map<string, string>();
  let slug = '';

  async function ingresar(usuario: string): Promise<void> {
    const respuesta = await http()
      .post('/v1/sesion')
      .set(CABECERAS)
      .send({ usuario, clave: CLAVE_DEMO })
      .expect(200);
    cookies.set(usuario, cookieDe(respuesta));
  }
  const cookie = (usuario: string) => cookies.get(usuario) ?? '';
  const como = (usuario: string) => ({
    get: (ruta: string) => http().get(ruta).set('Cookie', cookie(usuario)),
    send: (metodo: 'post' | 'put' | 'delete', ruta: string, cuerpo?: object) =>
      http()[metodo](ruta).set(CABECERAS).set('Cookie', cookie(usuario)).send(cuerpo),
  });
  const tienda = (letra: string) => ids.get(letra) ?? '';

  async function publicar(usuario: string, productoId: string, precio = '120') {
    await como(usuario)
      .send('post', '/v1/ofertas', {
        producto_id: productoId,
        estado_detalle: 'SELLADO',
        stock: 3,
        precio,
        quien_ve_precio: 'TODOS',
      })
      .expect(201);
  }

  async function producto(titulo: string) {
    const { id } = await prisma.categoria.findUniqueOrThrow({ where: { slug: 'ram' } });
    return prisma.producto.create({
      data: {
        categoriaId: id,
        titulo,
        slug: titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        textoBusqueda: titulo.toLowerCase(),
        revisado: true,
      },
    });
  }

  /** Cuántas ofertas del producto de prueba ve cada quien en la búsqueda. */
  async function enLaBusqueda(usuario: string | null, filtro = ''): Promise<number> {
    const ruta = `/v1/buscar?q=zetaprueba${filtro}`;
    const respuesta = await (usuario ? como(usuario).get(ruta) : http().get(ruta)).expect(200);
    const cuerpo = respuesta.body as RespuestaBuscar;
    return cuerpo.productos.reduce((suma, p) => suma + p.ofertas.cantidad, 0);
  }

  async function tiendasDeLaFicha(usuario: string | null): Promise<number> {
    const ruta = `/v1/productos/${slug}`;
    const respuesta = await (usuario ? como(usuario).get(ruta) : http().get(ruta)).expect(200);
    return (respuesta.body as RespuestaFicha).ofertas.length;
  }

  async function directorio(usuario: string, q = '') {
    const respuesta = await como(usuario)
      .get(`/v1/wilson/tiendas${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .expect(200);
    return (respuesta.body as RespuestaDirectorioTiendas).tiendas;
  }

  async function avisosDe(usuario: string) {
    return ((await como(usuario).get('/v1/avisos').expect(200)).body as RespuestaAvisos).avisos;
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp({ enVivo: true });
    for (const usuario of ['tiendaa', 'tiendab', 'tiendac', 'tiendae', 'equipo']) {
      await ingresar(usuario);
    }
    for (const letra of ['a', 'b', 'c', 'e']) {
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { usuario: `tienda${letra}` },
      });
      ids.set(letra, usuario.tiendaId ?? '');
    }
    const p = await producto('Zetaprueba Fantasma DDR5 32GB');
    slug = p.slug;
    await publicar('tiendab', p.id, '100');
    await publicar('tiendac', p.id, '90');
    await publicar('tiendae', p.id, '110');
    // E ya seguía a B antes de que B pasara a privada: se queda.
    await como('tiendae')
      .send('post', `/v1/tiendas/${tienda('b')}/seguir`, {})
      .expect(200);
    // B y C publican un busco en vivo antes de cerrarse.
    for (const usuario of ['tiendab', 'tiendac']) {
      await como(usuario)
        .send('post', '/v1/en-vivo', {
          tipo: 'BUSCO',
          titulo: `Zetaprueba de ${usuario}`,
          categoria: 'ram',
          duracion: '3h',
        })
        .expect(201);
    }
    await como('tiendab')
      .send('put', '/v1/cuenta/visibilidad', { visibilidad: 'PRIVADO' })
      .expect(200);
    await como('tiendac')
      .send('put', '/v1/cuenta/visibilidad', { visibilidad: 'OCULTO' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('el selector guarda la visibilidad y el perfil propio la trae', async () => {
    const propio = (
      await como('tiendab')
        .get(`/v1/tiendas/${tienda('b')}`)
        .expect(200)
    ).body as PerfilTienda;
    expect(propio).toMatchObject({ visibilidad: 'PRIVADO', propia: true, privada: false });
    // En el perfil de otra no se dice.
    const ajeno = (
      await como('tiendaa')
        .get(`/v1/tiendas/${tienda('e')}`)
        .expect(200)
    ).body as PerfilTienda;
    expect(ajeno.visibilidad).toBeNull();
    await como('tiendab')
      .send('put', '/v1/cuenta/visibilidad', { visibilidad: 'SECRETO' })
      .expect(400);
  });

  it('búsqueda: la privada solo para quien la sigue, la oculta para nadie; el Equipo ve todo', async () => {
    expect(await enLaBusqueda('tiendaa')).toBe(1);
    expect(await enLaBusqueda(null)).toBe(1);
    expect(await enLaBusqueda('tiendae')).toBe(2);
    expect(await enLaBusqueda('equipo')).toBe(3);
    // Con un filtro de la oferta (sale de las ofertas, no del resumen), lo mismo.
    expect(await enLaBusqueda('tiendaa', '&galeria=cyberplaza')).toBe(0);
    expect(await enLaBusqueda(null, '&galeria=cyberplaza')).toBe(0);
    expect(await enLaBusqueda('tiendae', '&galeria=cyberplaza')).toBe(1);
    expect(await enLaBusqueda('equipo', '&galeria=cyberplaza')).toBe(2);
    // La dueña siempre ve lo suyo.
    expect(await enLaBusqueda('tiendac')).toBe(2);
  });

  it('ficha: «Las tiendas que lo tienen» sin la privada (salvo a su seguidora) ni la oculta', async () => {
    expect(await tiendasDeLaFicha('tiendaa')).toBe(1);
    expect(await tiendasDeLaFicha(null)).toBe(1);
    expect(await tiendasDeLaFicha('tiendae')).toBe(2);
    expect(await tiendasDeLaFicha('equipo')).toBe(3);
  });

  it('Inicio: nada de la privada ni de la oculta', async () => {
    const inicio = (await como('tiendaa').get('/v1/inicio').expect(200)).body as RespuestaInicio;
    const nombres = inicio.recien.map((tarjeta) => tarjeta.tienda.nombre);
    expect(nombres.length).toBeGreaterThan(0);
    expect(nombres).not.toContain('Tienda B');
    expect(nombres).not.toContain('Tienda C');
    expect(inicio.tiendas.visibles.map((t) => t.nombre)).not.toContain('Tienda B');
    expect(inicio.tiendas.visibles.map((t) => t.nombre)).not.toContain('Tienda C');
    // Quien sigue a la privada sí la ve; la oculta, no, aunque la siga.
    const deE = (await como('tiendae').get('/v1/inicio').expect(200)).body as RespuestaInicio;
    expect(deE.tiendas.visibles.map((t) => t.nombre)).toContain('Tienda B');
    expect(deE.tiendas.visibles.map((t) => t.nombre)).not.toContain('Tienda C');
  });

  it('Pedidos en vivo: lo de la privada solo a su seguidora; lo de la oculta, a nadie', async () => {
    const titulos = async (usuario: string | null) => {
      const respuesta = await (
        usuario ? como(usuario).get('/v1/en-vivo') : http().get('/v1/en-vivo')
      ).expect(200);
      return (respuesta.body as RespuestaEnVivo).en_vivo.map((item) => item.titulo);
    };
    expect(await titulos('tiendaa')).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Zetaprueba/)]),
    );
    expect(await titulos(null)).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Zetaprueba/)]),
    );
    const deE = await titulos('tiendae');
    expect(deE).toContain('Zetaprueba de tiendab');
    expect(deE).not.toContain('Zetaprueba de tiendac');
    expect(await titulos('equipo')).toEqual(
      expect.arrayContaining(['Zetaprueba de tiendab', 'Zetaprueba de tiendac']),
    );
  });

  it('directorio y buscador de tiendas: la privada solo con su nombre exacto, la oculta nunca', async () => {
    const nombres = (filas: Array<{ nombre: string }>) => filas.map((fila) => fila.nombre);
    expect(nombres(await directorio('tiendaa'))).not.toContain('Tienda B');
    expect(nombres(await directorio('tiendaa'))).not.toContain('Tienda C');
    expect(nombres(await directorio('tiendaa', 'tienda'))).not.toContain('Tienda B');
    const [privada] = await directorio('tiendaa', 'tienda b');
    expect(privada).toMatchObject({
      nombre: 'Tienda B',
      privada: true,
      galeria: null,
      stand: null,
      logo: null,
      vende: [],
    });
    expect(nombres(await directorio('tiendaa', 'Tienda C'))).toEqual([]);

    const sugerencias = async (usuario: string, q: string) =>
      (
        (
          await como(usuario)
            .get(`/v1/buscar/sugerencias?q=${encodeURIComponent(q)}`)
            .expect(200)
        ).body as RespuestaSugerenciasConTiendas
      ).tiendas;
    expect(await sugerencias('tiendaa', 'TIENDA B')).toEqual([
      expect.objectContaining({ nombre: 'Tienda B', privada: true, stand: null }),
    ]);
    expect(await sugerencias('tiendaa', 'tienda c')).toEqual([]);

    // Quien la sigue la ve completa; el Equipo ve las dos.
    expect(nombres(await directorio('tiendae'))).toContain('Tienda B');
    expect((await directorio('tiendae', 'tienda b'))[0]?.privada).toBeUndefined();
    expect(nombres(await directorio('equipo'))).toEqual(
      expect.arrayContaining(['Tienda B', 'Tienda C']),
    );

    // El buscador de socias sigue la misma regla.
    const socias = async (q: string) =>
      (
        await como('tiendaa')
          .get(`/v1/tiendas/buscar?q=${encodeURIComponent(q)}`)
          .expect(200)
      ).body as Array<{ nombre: string; stand: string | null }>;
    expect((await socias('tienda')).map((t) => t.nombre)).not.toContain('Tienda B');
    expect(await socias('tienda b')).toEqual([expect.objectContaining({ stand: null })]);
    expect(await socias('tienda c')).toEqual([]);
  });

  it('perfil privado visto por otra: nombre y galería, sin productos ni datos; el oculto no existe', async () => {
    const perfil = (
      await como('tiendaa')
        .get(`/v1/tiendas/${tienda('b')}`)
        .expect(200)
    ).body as PerfilTienda;
    expect(perfil).toMatchObject({
      nombre: 'Tienda B',
      galeria: 'Cyberplaza',
      privada: true,
      stand: null,
      logo: null,
      portada: null,
      productos: [],
      nuevas: [],
      mejores_precios: [],
      categorias: [],
      total_productos: 0,
      puede_escribir: false,
      solicitud_enviada: false,
      seguidores: 1,
    });
    const publicaciones = (
      await como('tiendaa')
        .get(`/v1/tiendas/${tienda('b')}/publicaciones`)
        .expect(200)
    ).body as RespuestaPublicacionesTienda;
    expect(publicaciones.productos).toEqual([]);
    await como('tiendaa')
      .get(`/v1/tiendas/${tienda('b')}/opiniones`)
      .expect(403);
    // No se la sigue directo: se pide.
    await como('tiendaa')
      .send('post', `/v1/tiendas/${tienda('b')}/seguir`, {})
      .expect(409);

    await como('tiendaa')
      .get(`/v1/tiendas/${tienda('c')}`)
      .expect(404);
    await como('tiendaa')
      .get(`/v1/tiendas/${tienda('c')}/publicaciones`)
      .expect(404);
    await como('tiendae')
      .send('post', `/v1/tiendas/${tienda('c')}/seguir`, {})
      .expect(404);

    // Quien la sigue y el Equipo la ven completa.
    const deE = (
      await como('tiendae')
        .get(`/v1/tiendas/${tienda('b')}`)
        .expect(200)
    ).body as PerfilTienda;
    expect(deE).toMatchObject({ privada: false, puede_escribir: true });
    expect(deE.total_productos).toBeGreaterThan(0);
    const delEquipo = (
      await como('equipo')
        .get(`/v1/tiendas/${tienda('c')}`)
        .expect(200)
    ).body as PerfilTienda;
    expect(delEquipo.privada).toBe(false);
    expect(delEquipo.total_productos).toBeGreaterThan(0);
  });

  it('«Cómo me ven»: la propia como la ve otra tienda', async () => {
    const privada = (
      await como('tiendab')
        .get(`/v1/tiendas/${tienda('b')}?como_me_ven=1`)
        .expect(200)
    ).body as PerfilTienda;
    expect(privada).toMatchObject({ como_me_ven: true, propia: false, privada: true });
    const oculta = (
      await como('tiendac')
        .get(`/v1/tiendas/${tienda('c')}?como_me_ven=1`)
        .expect(200)
    ).body as PerfilTienda;
    expect(oculta).toMatchObject({ como_me_ven: true, oculta: true, productos: [] });
    const publica = (
      await como('tiendae')
        .get(`/v1/tiendas/${tienda('e')}?como_me_ven=1`)
        .expect(200)
    ).body as PerfilTienda;
    expect(publica).toMatchObject({ como_me_ven: true, propia: false, privada: false });
    expect(publica.productos.length).toBeGreaterThan(0);
  });

  it('solicitar seguir, cancelar, rechazar (sin avisar) y aceptar', async () => {
    const b = tienda('b');
    const solicitudes = async () =>
      (await avisosDe('tiendab')).filter((aviso) => aviso.tipo === 'SOLICITUD_SEGUIR');

    // A una pública no se le pide.
    await como('tiendaa')
      .send('post', `/v1/tiendas/${tienda('e')}/solicitud`)
      .expect(409);

    await como('tiendaa').send('post', `/v1/tiendas/${b}/solicitud`).expect(200, {
      solicitud_enviada: true,
    });
    // Pedirla dos veces no vuelve a avisar.
    await como('tiendaa').send('post', `/v1/tiendas/${b}/solicitud`).expect(200);
    const [aviso] = await solicitudes();
    expect(aviso).toMatchObject({
      titulo: 'Tienda A quiere seguir tu tienda.',
      categoria: 'CUENTA',
      accion: { tipo: 'SOLICITUD_SEGUIR' },
    });
    expect(await solicitudes()).toHaveLength(1);
    expect(
      ((await como('tiendaa').get(`/v1/tiendas/${b}`)).body as PerfilTienda).solicitud_enviada,
    ).toBe(true);

    // Cancelar: se va también su aviso.
    await como('tiendaa').send('delete', `/v1/tiendas/${b}/solicitud`).expect(200, {
      solicitud_enviada: false,
    });
    expect(await solicitudes()).toHaveLength(0);

    // Rechazar: se borra y A no se entera.
    await como('tiendaa').send('post', `/v1/tiendas/${b}/solicitud`).expect(200);
    const [paraRechazar] = await solicitudes();
    const idRechazada =
      paraRechazar?.accion?.tipo === 'SOLICITUD_SEGUIR' ? paraRechazar.accion.solicitud_id : '';
    const avisosDeAAntes = (await avisosDe('tiendaa')).length;
    await como('tiendab')
      .send('post', `/v1/solicitudes-seguir/${idRechazada}/rechazar`)
      .expect(200);
    expect(await solicitudes()).toHaveLength(0);
    expect(await avisosDe('tiendaa')).toHaveLength(avisosDeAAntes);
    expect(((await como('tiendaa').get(`/v1/tiendas/${b}`)).body as PerfilTienda).privada).toBe(
      true,
    );
    // Otra tienda no puede responderla.
    await como('tiendab').send('post', `/v1/solicitudes-seguir/${idRechazada}/aceptar`).expect(404);

    // Aceptar: A la sigue y ve sus publicaciones; le llega un aviso.
    await como('tiendaa').send('post', `/v1/tiendas/${b}/solicitud`).expect(200);
    const [paraAceptar] = await solicitudes();
    const idAceptada =
      paraAceptar?.accion?.tipo === 'SOLICITUD_SEGUIR' ? paraAceptar.accion.solicitud_id : '';
    await como('tiendae').send('post', `/v1/solicitudes-seguir/${idAceptada}/aceptar`).expect(404);
    await como('tiendab').send('post', `/v1/solicitudes-seguir/${idAceptada}/aceptar`).expect(200);
    expect(await solicitudes()).toHaveLength(0);
    const perfil = (await como('tiendaa').get(`/v1/tiendas/${b}`).expect(200)).body as PerfilTienda;
    expect(perfil).toMatchObject({ privada: false, siguiendo: { avisos: 'IMPORTANTE' } });
    expect(perfil.productos.length).toBeGreaterThan(0);
    expect(await enLaBusqueda('tiendaa')).toBe(2);
    expect(await tiendasDeLaFicha('tiendaa')).toBe(2);
    expect((await avisosDe('tiendaa'))[0]?.titulo).toBe('Tienda B aceptó tu solicitud');
  });

  it('«Tus seguidores»: quitar a una la deja sin ver lo de la privada', async () => {
    const seguidoras = (await como('tiendab').get('/v1/cuenta/seguidores').expect(200))
      .body as RespuestaSeguidores;
    expect(seguidoras.total).toBe(2);
    expect(seguidoras.seguidoras.map((s) => s.nombre).sort()).toEqual(['Tienda A', 'Tienda E']);

    const despues = (
      await como('tiendab')
        .send('delete', `/v1/cuenta/seguidores/${tienda('a')}`)
        .expect(200)
    ).body as RespuestaSeguidores;
    expect(despues.seguidoras.map((s) => s.nombre)).toEqual(['Tienda E']);
    expect(await enLaBusqueda('tiendaa')).toBe(1);
    expect(
      ((await como('tiendaa').get(`/v1/tiendas/${tienda('b')}`)).body as PerfilTienda).privada,
    ).toBe(true);
  });

  it('una alerta de búsqueda no avisa de lo que publica una oculta', async () => {
    await como('tiendaa').send('post', '/v1/cuenta/alertas', { texto: 'omegaprueba' }).expect(201);
    const oculta = await producto('Omegaprueba Oculta 16GB');
    await publicar('tiendac', oculta.id);
    const alertas = async () =>
      (await avisosDe('tiendaa')).filter((aviso) => aviso.tipo === 'ALERTA');
    expect(await alertas()).toHaveLength(0);
    const publica = await producto('Omegaprueba Publica 16GB');
    await publicar('tiendae', publica.id);
    expect(await alertas()).toHaveLength(1);
  });

  it('al volver a Público, todo vuelve a verse', async () => {
    await como('tiendab')
      .send('put', '/v1/cuenta/visibilidad', { visibilidad: 'PUBLICO' })
      .expect(200);
    await como('tiendac')
      .send('put', '/v1/cuenta/visibilidad', { visibilidad: 'PUBLICO' })
      .expect(200);
    expect(await enLaBusqueda('tiendaa')).toBe(3);
    expect(await enLaBusqueda(null)).toBe(3);
    expect(await tiendasDeLaFicha(null)).toBe(3);
    expect((await directorio('tiendaa')).map((t) => t.nombre)).toEqual(
      expect.arrayContaining(['Tienda B', 'Tienda C']),
    );
  });
});
