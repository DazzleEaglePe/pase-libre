/**
 * Crea la cuenta de una tienda (dueño + tienda) con una clave temporal, desde el servidor.
 *
 *   pnpm cuenta:tienda -- --usuario darkalien --tienda "Dark Alien Planeta" --galeria cyberplaza \
 *     --stand "2B 105" [--persona "Nombre"] [--whatsapp 987654321]
 *
 * Es lo mismo que «Crear cuenta» del panel del equipo (RF-35), para cuando hay que hacerlo sin
 * entrar al panel. La clave sale una sola vez en la terminal y el primer ingreso obliga a
 * cambiarla. Sin `--whatsapp` la tienda queda con el número vacío y lo completa en Configuración.
 */
import { parseArgs } from 'node:util';

import { PrismaClient } from '@prisma/client';

import { RESPUESTAS_RAPIDAS_INICIALES } from '../src/modules/cuenta/respuestas-rapidas';
import { cifrarClave, generarClaveTemporal } from '../src/modules/sesion/clave';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      usuario: { type: 'string' },
      tienda: { type: 'string' },
      galeria: { type: 'string' },
      stand: { type: 'string' },
      piso: { type: 'string' },
      persona: { type: 'string' },
      whatsapp: { type: 'string' },
    },
  });
  const usuario = values.usuario?.trim().toLowerCase();
  const nombreTienda = values.tienda?.trim();
  if (!usuario || !nombreTienda) {
    throw new Error('Faltan datos: --usuario y --tienda son obligatorios.');
  }
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new Error('El usuario lleva de 3 a 40 letras sin tildes, números, punto o guion.');
  }
  const whatsapp = (values.whatsapp ?? '').replace(/\D/g, '').replace(/^51(?=9\d{8}$)/, '');
  if (whatsapp && !/^9\d{8}$/.test(whatsapp)) {
    throw new Error('El WhatsApp es un celular de 9 dígitos que empieza con 9.');
  }

  const prisma = new PrismaClient();
  try {
    if (await prisma.usuario.findUnique({ where: { usuario } })) {
      throw new Error(`Ya existe una cuenta con el usuario «${usuario}».`);
    }
    const galeria = values.galeria
      ? await prisma.galeria.findUnique({ where: { slug: values.galeria.trim() } })
      : null;
    if (values.galeria && !galeria) throw new Error(`No existe la galería «${values.galeria}».`);

    const clave = generarClaveTemporal();
    const claveHash = await cifrarClave(clave);
    const creado = await prisma.$transaction(async (tx) => {
      const tienda = await tx.tienda.create({
        data: {
          tipo: galeria ? 'TIENDA' : 'INDEPENDIENTE',
          nombre: nombreTienda,
          galeriaId: galeria?.id ?? null,
          stand: values.stand?.trim() || null,
          piso: values.piso?.trim() || null,
          whatsapp,
        },
      });
      const dueno = await tx.usuario.create({
        data: {
          tiendaId: tienda.id,
          rol: 'DUENO',
          usuario,
          nombre: values.persona?.trim() || nombreTienda,
          whatsapp: whatsapp || null,
          claveHash,
          debeCambiarClave: true,
          respuestasRapidas: {
            create: RESPUESTAS_RAPIDAS_INICIALES.map((texto, orden) => ({ texto, orden })),
          },
        },
      });
      await tx.auditoria.create({
        data: {
          accion: 'crear_cuenta',
          objeto: 'usuario',
          objetoId: dueno.id,
          datos: { usuario, tipo: 'DUENO', tienda_id: tienda.id, desde: 'script' },
        },
      });
      return { tienda, dueno };
    });
    console.log(`Cuenta creada: ${usuario} · ${creado.tienda.nombre}`);
    console.log(`Clave temporal (se muestra una sola vez): ${clave}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
