import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { Test } from '@nestjs/testing';
import { CABECERA_PASELIBRE } from '@paselibre/contracts';
import type { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/configure-application';
import { INTERRUPTOR_EN_VIVO } from '../src/modules/en-vivo/interruptor';
import { cifrarClave } from '../src/modules/sesion/clave';

/** Las fotos de las pruebas van a una carpeta temporal (ver vitest.config.ts). */
export const CARPETA_MEDIA_PRUEBAS = process.env.MEDIA_DIR ?? '';
if (!CARPETA_MEDIA_PRUEBAS.includes('paselibre-media-pruebas')) {
  throw new Error('Las pruebas necesitan MEDIA_DIR en una carpeta temporal (vitest.config.ts).');
}

/** Siempre la base de pruebas: nunca la de desarrollo. */
export function usarBaseDePruebas(): string {
  const rootEnvFile = resolve(__dirname, '../../../.env');
  if (!process.env.TEST_DATABASE_URL && existsSync(rootEnvFile)) {
    process.loadEnvFile(rootEnvFile);
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('Falta TEST_DATABASE_URL (ver .env.example).');
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'fatal';
  process.env.SESION_COOKIE_SEGURA = 'false';
  return url;
}

/** En vivo (D-53) va apagado salvo en su prueba, diga lo que diga el `.env` local. */
export async function crearApp(opciones: { enVivo?: boolean } = {}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(INTERRUPTOR_EN_VIVO)
    .useValue({ activo: opciones.enVivo ?? false })
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApplication(app, {
    webUrl: 'http://localhost:3000',
    carpetaMedia: CARPETA_MEDIA_PRUEBAS,
  });
  await app.init();
  return app;
}

/** Vacía las tablas de datos (las de catálogo base se recrean en cada prueba que las use). */
export async function vaciarBase(prisma: PrismaClient): Promise<void> {
  const tablas = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tablas.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

export const CLAVE_PRUEBA = 'galeria2026';
export const CABECERAS = { [CABECERA_PASELIBRE]: '1' };

/** Una tienda con su dueño. `temporal` deja la cuenta como la entrega el equipo. */
export async function crearTiendaConDueno(
  prisma: PrismaClient,
  opciones: { usuario: string; correo?: string; temporal?: boolean; suspendido?: boolean },
) {
  const galeria = await prisma.galeria.upsert({
    where: { slug: 'maxiplaza' },
    update: {},
    create: { nombre: 'Maxiplaza', slug: 'maxiplaza' },
  });
  const tienda = await prisma.tienda.create({
    data: {
      tipo: 'TIENDA',
      nombre: `Tienda ${opciones.usuario}`,
      galeriaId: galeria.id,
      stand: '212',
      whatsapp: '987111212',
    },
  });
  const usuario = await prisma.usuario.create({
    data: {
      tiendaId: tienda.id,
      usuario: opciones.usuario,
      correo: opciones.correo ?? null,
      nombre: 'Luis P.',
      rol: 'DUENO',
      claveHash: await cifrarClave(CLAVE_PRUEBA),
      debeCambiarClave: opciones.temporal ?? false,
      estado: opciones.suspendido ? 'SUSPENDIDO' : 'ACTIVO',
    },
  });
  return { tienda, usuario };
}

/** La cookie de sesión (`pl_sesion=…`) de una respuesta de ingreso. */
export function cookieDe(respuesta: Response): string {
  const cookies = respuesta.headers['set-cookie'] as unknown as string[] | undefined;
  const sesion = cookies?.find((c) => c.startsWith('pl_sesion='));
  if (!sesion) throw new Error('La respuesta no trae la cookie de sesión.');
  return sesion.split(';')[0] as string;
}
