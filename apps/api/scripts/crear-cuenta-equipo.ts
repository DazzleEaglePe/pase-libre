/**
 * Crea una cuenta del equipo de PaseLibre con una clave temporal.
 *
 *   pnpm cuenta:equipo -- --usuario dazz --nombre "Dazz" [--correo dazz@ejemplo.pe]
 *
 * La clave se muestra una sola vez en la terminal y el primer ingreso obliga a cambiarla.
 * Es la forma de crear la primera cuenta en staging o producción, donde no hay semilla demo.
 */
import { parseArgs } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { cifrarClave, generarClaveTemporal } from '../src/modules/sesion/clave';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      usuario: { type: 'string' },
      nombre: { type: 'string' },
      correo: { type: 'string' },
    },
  });
  const usuario = values.usuario?.trim().toLowerCase();
  const nombre = values.nombre?.trim();
  if (!usuario || !nombre) {
    throw new Error('Faltan datos: --usuario y --nombre son obligatorios.');
  }

  const prisma = new PrismaClient();
  try {
    const existente = await prisma.usuario.findUnique({ where: { usuario } });
    if (existente) throw new Error(`Ya existe una cuenta con el usuario «${usuario}».`);

    const clave = generarClaveTemporal();
    const creado = await prisma.usuario.create({
      data: {
        usuario,
        nombre,
        correo: values.correo?.trim().toLowerCase() || null,
        rol: 'EQUIPO',
        claveHash: await cifrarClave(clave),
        debeCambiarClave: true,
      },
    });
    await prisma.auditoria.create({
      data: {
        accion: 'crear_cuenta_equipo',
        objeto: 'usuario',
        objetoId: creado.id,
        datos: { usuario },
      },
    });
    console.log(`Cuenta del equipo creada: ${usuario}`);
    console.log(`Clave temporal (se muestra una sola vez): ${clave}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
