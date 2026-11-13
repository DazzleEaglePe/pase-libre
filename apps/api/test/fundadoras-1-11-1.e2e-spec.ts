import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { MAX_FUNDADORAS, type RespuestaInicio } from '@paselibre/contracts';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CLAVE_DEMO, sembrarBase, sembrarDemo } from '../prisma/semilla';
import {
  CABECERAS,
  cookieDe,
  crearApp,
  crearTiendaConDueno,
  usarBaseDePruebas,
  vaciarBase,
} from './ayudas';

const url = usarBaseDePruebas();
const prisma = new PrismaClient({ datasources: { db: { url } } });

const MIGRACION = readFileSync(
  resolve(
    __dirname,
    '../prisma/migrations/20261114150000_fundadoras_las_que_ya_estaban/migration.sql',
  ),
  'utf8',
);

/** doc 20b: 15 lugares, las que ya estaban entran y las nuevas entran solas mientras haya lugar. */
describe('Tiendas fundadoras 1.11.1', () => {
  let app: INestApplication;
  let equipo: string;
  const http = () => request(app.getHttpServer());
  let numero = 0;

  const crearCuenta = () => {
    numero += 1;
    return http()
      .post('/v1/equipo/cuentas')
      .set(CABECERAS)
      .set('Cookie', equipo)
      .send({
        tipo: 'DUENO',
        usuario: `nueva${numero}`,
        tienda: { nombre: `Nueva ${numero}`, galeria: 'cyberplaza', stand: '' },
      });
  };

  const fundadoras = () => prisma.tienda.count({ where: { fundadoraDesde: { not: null } } });

  /** Deja exactamente `cuantas` fundadoras (las más antiguas), creando tiendas si faltan. */
  async function dejarFundadoras(cuantas: number): Promise<void> {
    await prisma.tienda.updateMany({ data: { fundadoraDesde: null, fundadoraDia: null } });
    let activas = await prisma.tienda.count({ where: { estado: 'ACTIVA' } });
    while (activas < cuantas) {
      await crearTiendaConDueno(prisma, { usuario: `relleno${activas}` });
      activas += 1;
    }
    const elegidas = await prisma.tienda.findMany({
      where: { estado: 'ACTIVA' },
      orderBy: { creadaEn: 'asc' },
      take: cuantas,
      select: { id: true },
    });
    await prisma.tienda.updateMany({
      where: { id: { in: elegidas.map((t) => t.id) } },
      data: { fundadoraDesde: new Date(), fundadoraDia: 1 },
    });
  }

  beforeAll(async () => {
    await vaciarBase(prisma);
    await sembrarBase(prisma);
    await sembrarDemo(prisma);
    app = await crearApp();
    equipo = cookieDe(
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: 'equipo', clave: CLAVE_DEMO })
        .expect(200),
    );
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('son 15 lugares', () => {
    expect(MAX_FUNDADORAS).toBe(15);
  });

  it('la migración hace fundadoras a las que ya estaban, de la más antigua, con días repartidos', async () => {
    await prisma.tienda.updateMany({ data: { fundadoraDesde: null, fundadoraDia: null } });
    const activas = await prisma.tienda.findMany({
      where: { estado: 'ACTIVA' },
      orderBy: [{ creadaEn: 'asc' }, { nombre: 'asc' }],
      select: { id: true, creadaEn: true },
    });
    expect(activas.length).toBeGreaterThan(0);
    expect(activas.length).toBeLessThanOrEqual(MAX_FUNDADORAS);

    await prisma.$executeRawUnsafe(MIGRACION);

    const despues = await prisma.tienda.findMany({
      where: { id: { in: activas.map((t) => t.id) } },
      select: { id: true, fundadoraDesde: true, fundadoraDia: true },
    });
    const porId = new Map(despues.map((t) => [t.id, t]));
    activas.forEach((tienda, i) => {
      const fila = porId.get(tienda.id)!;
      // «Tienda fundadora desde» = cuando se registró.
      expect(fila.fundadoraDesde?.toISOString()).toBe(tienda.creadaEn.toISOString());
      // Lunes, martes… sábado, y vuelve a empezar.
      expect(fila.fundadoraDia).toBe((i % 6) + 1);
    });

    const cookie = cookieDe(
      await http()
        .post('/v1/sesion')
        .set(CABECERAS)
        .send({ usuario: 'tiendab', clave: CLAVE_DEMO })
        .expect(200),
    );
    const inicio = (await http().get('/v1/inicio').set('Cookie', cookie).expect(200))
      .body as RespuestaInicio;
    expect(inicio.fundadoras.entraron).toBe(activas.length);
    expect(inicio.fundadoras.total).toBe(MAX_FUNDADORAS);
    expect(inicio.fundadoras.iniciales).toHaveLength(activas.length);

    // Correrla otra vez no cambia nada: ya no quedan sin fundadora.
    await prisma.$executeRawUnsafe(MIGRACION);
    expect(await fundadoras()).toBe(activas.length);
  });

  it('con 14, la cuenta nueva es la 15.ª fundadora y la 16.ª entra normal', async () => {
    await dejarFundadoras(MAX_FUNDADORAS - 1);

    const quince = await crearCuenta().expect(201);
    const tienda15 = await prisma.usuario.findUniqueOrThrow({
      where: { usuario: quince.body.cuenta.usuario as string },
      select: { tienda: { select: { fundadoraDesde: true, fundadoraDia: true } } },
    });
    expect(tienda15.tienda?.fundadoraDesde).not.toBeNull();
    expect(tienda15.tienda?.fundadoraDia).toBeGreaterThanOrEqual(1);
    expect(await fundadoras()).toBe(MAX_FUNDADORAS);

    const dieciseis = await crearCuenta().expect(201);
    const tienda16 = await prisma.usuario.findUniqueOrThrow({
      where: { usuario: dieciseis.body.cuenta.usuario as string },
      select: { tienda: { select: { fundadoraDesde: true } } },
    });
    expect(tienda16.tienda?.fundadoraDesde).toBeNull();
    expect(await fundadoras()).toBe(MAX_FUNDADORAS);
  });

  it('dos altas a la vez con 14: solo una queda fundadora', async () => {
    await dejarFundadoras(MAX_FUNDADORAS - 1);
    const [a, b] = await Promise.all([crearCuenta(), crearCuenta()]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(await fundadoras()).toBe(MAX_FUNDADORAS);
  });
});
