/**
 * Semilla de PaseLibre.
 *
 * - Base (todos los entornos): galerías, las 7 categorías iniciales (RF-11) y marcas.
 * - Demostración (solo si SEMILLA_DEMO=true y fuera de producción): las tiendas,
 *   cuentas, productos y ofertas del lienzo, para probar la web con datos reales.
 *
 * Se puede correr varias veces: busca antes de crear.
 */
import { PrismaClient } from '@prisma/client';

import { sembrarBase, sembrarDemo } from './semilla';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await sembrarBase(prisma);
  console.log('Semilla base lista: galerías, categorías y marcas.');

  const demo = process.env.SEMILLA_DEMO === 'true';
  if (!demo) return;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SEMILLA_DEMO no se puede usar en producción: crea cuentas con claves conocidas.',
    );
  }
  await sembrarDemo(prisma);
  console.log('Semilla de demostración lista: tiendas, cuentas, productos y ofertas del lienzo.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
