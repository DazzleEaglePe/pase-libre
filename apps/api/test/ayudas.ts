import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CABECERA_PASELIBRE } from '@paselibre/contracts';
import type { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/bootstrap/configure-application';
import { cifrarClave } from '../src/modules/sesion/clave';

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

export async function crearApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApplication(app, 'http://localhost:3000');
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
