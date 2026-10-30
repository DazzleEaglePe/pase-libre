import { z } from 'zod';

import { MAX_TEXTO_MENSAJE } from '../mensajes/mensajes.schemas.js';
import { montoSchema } from '../ofertas/ofertas.schemas.js';

/** Cuántas publicaciones en vivo puede tener una cuenta a la vez (RF-73). */
export const MAX_EN_VIVO_POR_CUENTA = 3;
export const MAX_NOTA_EN_VIVO = 120;
/** Nunca dura más de esto desde que se publicó, aunque se sumen horas (CHECK en la base). */
export const MAX_HORAS_EN_VIVO = 12;
/** «Hasta el cierre de hoy»: 8:00 p. m., hora de Lima (por confirmar con Fabrizio). */
export const HORA_CIERRE_EN_VIVO = 20;
export const DURACIONES_EN_VIVO = ['1h', '3h', 'cierre'] as const;

/** `GET /v1/en-vivo` (RF-75): la lista, con los filtros de la página «En vivo». */
export const enVivoConsultaSchema = z.object({
  tipo: z.enum(['todo', 'busco', 'flash']).default('todo'),
  categoria: z.string().trim().max(80).optional(),
  galeria: z.string().trim().max(80).optional(),
});

const duracionSchema = z.enum(DURACIONES_EN_VIVO, 'Elige cuánto dura.');
const notaSchema = z
  .string()
  .trim()
  .max(MAX_NOTA_EN_VIVO, `La nota llega hasta ${MAX_NOTA_EN_VIVO} letras.`)
  .default('')
  .transform((texto) => texto || null);
const cantidadSchema = z.coerce
  .number('Escribe la cantidad.')
  .int('La cantidad va sin decimales.')
  .min(1, 'La cantidad es al menos 1.')
  .max(99, 'La cantidad llega hasta 99.');
const monedaSchema = z.enum(['USD', 'PEN'], 'Elige la moneda.').default('USD');

/**
 * `POST /v1/en-vivo` (RF-24, RF-72, RF-73).
 *
 * - Busco: un producto del catálogo (`producto`) o un texto libre (`titulo` con su
 *   `categoria`), y un presupuesto opcional.
 * - Oferta flash: una de tus publicaciones (`oferta`), el precio de pase y cuántas
 *   unidades entran.
 */
export const publicarEnVivoSchema = z.discriminatedUnion('tipo', [
  z
    .strictObject({
      tipo: z.literal('BUSCO'),
      producto: z.uuid('Ese producto no está en PaseLibre.').optional(),
      titulo: z
        .string()
        .trim()
        .min(3, 'Escribe qué producto buscas.')
        .max(120, 'El producto llega hasta 120 letras.')
        .optional(),
      categoria: z.string().trim().min(1).max(80).optional(),
      cantidad: cantidadSchema.default(1),
      condicion: z.enum(['NUEVO', 'USADO']).nullable().default(null),
      moneda: monedaSchema,
      presupuesto: montoSchema.default(null),
      duracion: duracionSchema,
      nota: notaSchema,
    })
    .refine((busco) => busco.producto || busco.titulo, {
      path: ['titulo'],
      message: 'Elige un producto del catálogo o escribe qué buscas.',
    })
    .refine((busco) => busco.producto || busco.categoria, {
      path: ['categoria'],
      message: 'Elige la categoría.',
    }),
  z.strictObject({
    tipo: z.literal('FLASH'),
    oferta: z.uuid('Elige cuál de tus publicaciones pones en oferta.'),
    precio: montoSchema.refine((centimos) => centimos !== null, 'Escribe el precio de pase.'),
    moneda: monedaSchema,
    cantidad: cantidadSchema,
    duracion: duracionSchema,
    nota: notaSchema,
  }),
]);

/** `PATCH /v1/en-vivo/:id` (RF-27): solo quien lo publicó. */
export const cambiarEnVivoSchema = z.strictObject({
  accion: z.enum(['sumar_hora', 'cerrar'], 'No hay nada que cambiar.'),
});

/**
 * `POST /v1/en-vivo/:id/respuestas` (RF-26): «¡Lo tengo!» lleva la publicación que se
 * ofrece; «¡Lo quiero!», solo el mensaje.
 */
export const responderEnVivoSchema = z.strictObject({
  oferta: z.uuid('Elige cuál de tus publicaciones ofreces.').optional(),
  texto: z
    .string()
    .trim()
    .min(1, 'Escribe un mensaje.')
    .max(MAX_TEXTO_MENSAJE, `El mensaje llega hasta ${MAX_TEXTO_MENSAJE} caracteres.`),
});

/** `GET /v1/en-vivo/alcance` (RF-76): a cuántas tiendas les llegará el aviso de un busco. */
export const alcanceEnVivoSchema = z
  .object({
    producto: z.uuid().optional(),
    q: z.string().trim().max(120).default(''),
    categoria: z.string().trim().max(80).optional(),
  })
  .refine((consulta) => consulta.producto || consulta.q, 'Elige o escribe un producto.');

export type EnVivoConsulta = z.output<typeof enVivoConsultaSchema>;
export type PublicarEnVivoEntrada = z.input<typeof publicarEnVivoSchema>;
export type PublicarEnVivoDatos = z.output<typeof publicarEnVivoSchema>;
export type CambiarEnVivo = z.output<typeof cambiarEnVivoSchema>;
export type ResponderEnVivoEntrada = z.input<typeof responderEnVivoSchema>;
export type ResponderEnVivoDatos = z.output<typeof responderEnVivoSchema>;
export type AlcanceEnVivoConsulta = z.output<typeof alcanceEnVivoSchema>;
export type DuracionEnVivo = (typeof DURACIONES_EN_VIVO)[number];
