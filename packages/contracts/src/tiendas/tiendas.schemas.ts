import { z } from 'zod';

import { montoSchema } from '../ofertas/ofertas.schemas.js';

/** «¿De qué quieres que te avisemos?» al seguir a una tienda (SG_Web). */
export const AVISOS_SEGUIMIENTO = ['TODO', 'IMPORTANTE', 'NINGUNO'] as const;

/**
 * Lo que se puede marcar al opinar (PCH_CelCalificar). Quien compró opina de quien vendió;
 * quien vendió, de quien compró.
 */
export const ASPECTOS_DEL_VENDEDOR = [
  'Producto como se describió',
  'Precio como se publicó',
  'Rapidez para separar',
  'Buen trato',
] as const;
export const ASPECTOS_DEL_COMPRADOR = [
  'Llegó cuando dijo',
  'Pagó sin problema',
  'Buen trato',
] as const;

/** `POST /v1/tiendas/:id/seguir` y `PATCH` del mismo: con qué avisos. */
export const seguirTiendaSchema = z
  .object({ avisos: z.enum(AVISOS_SEGUIMIENTO).default('IMPORTANTE') })
  .strict();
export type SeguirTiendaDatos = z.infer<typeof seguirTiendaSchema>;

/** `POST /v1/ventas/:id/opinion`: las estrellas, lo que se marcó y un texto opcional. */
export const opinarSchema = z
  .object({
    estrellas: z
      .number()
      .int()
      .min(1, 'Elige de 1 a 5 estrellas.')
      .max(5, 'Elige de 1 a 5 estrellas.'),
    aspectos: z.array(z.string().max(40)).max(4).default([]),
    texto: z
      .string()
      .trim()
      .max(500, 'Escribe hasta 500 caracteres.')
      .optional()
      .transform((texto) => texto || undefined),
  })
  .strict();
export type OpinarDatos = z.infer<typeof opinarSchema>;

/** `POST /v1/opiniones/:id/respuesta`: la tienda opinada responde una vez. */
export const responderOpinionSchema = z
  .object({
    texto: z
      .string()
      .trim()
      .min(2, 'Escribe tu respuesta.')
      .max(500, 'Escribe hasta 500 caracteres.'),
  })
  .strict();
export type ResponderOpinionDatos = z.infer<typeof responderOpinionSchema>;

/**
 * `POST /v1/opiniones/:id/revision` (N03): la tienda calificada le pide al Equipo que revise una
 * opinión. Se guarda como un reporte; «Cuéntanos qué pasó» es opcional.
 */
export const pedirRevisionSchema = z
  .object({
    motivo: z
      .string()
      .trim()
      .max(500, 'Escribe hasta 500 caracteres.')
      .optional()
      .transform((texto) => texto || undefined),
  })
  .strict();
export type PedirRevisionDatos = z.infer<typeof pedirRevisionSchema>;

/** `GET /v1/tiendas/:id/opiniones?filtro=` (SG_WebOpiniones). */
export const filtroOpinionesSchema = z.object({
  filtro: z.enum(['todas', 'con_respuesta', 'cinco', 'bajas']).default('todas'),
});
export type FiltroOpinionesConsulta = z.infer<typeof filtroOpinionesSchema>;

/** `POST /v1/socios` (PS_SociosWeb): agregar una tienda como socia. */
export const agregarSocioSchema = z
  .object({
    tienda_id: z.uuid('Elige una tienda.'),
    /** «Avisarle que lo agregaste». */
    avisar: z.boolean().default(true),
  })
  .strict();

/** `PUT /v1/socios/descuento`: el descuento por defecto en soles y en dólares (nulo = ninguno). */
export const descuentoSocioSchema = z.object({ PEN: montoSchema, USD: montoSchema }).strict();
export type DescuentoSocioDatos = z.output<typeof descuentoSocioSchema>;
export type AgregarSocioDatos = z.infer<typeof agregarSocioSchema>;

/** `GET /v1/tiendas/buscar?q=`: para elegir a quién agregar de socia. */
export const buscarTiendasSchema = z.object({
  q: z.string().trim().min(1, 'Escribe el nombre de la tienda.').max(60),
});
export type BuscarTiendasConsulta = z.infer<typeof buscarTiendasSchema>;
