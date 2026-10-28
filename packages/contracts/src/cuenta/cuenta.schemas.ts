import { z } from 'zod';

import { whatsappSchema } from '../equipo/equipo.schemas.js';
import { rutaFotoSchema } from '../ofertas/ofertas.schemas.js';

export const MAX_RESPUESTAS_RAPIDAS = 8;

/** Vacío es «no tengo»: se guarda nulo. */
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
    esquema.nullable(),
  );

const textoOpcional = (maximo: number, mensaje: string) =>
  opcional(z.string().trim().max(maximo, mensaje));

/**
 * `PATCH /v1/cuenta` (RF-58, RF-48, RF-57): solo lo que cambia. Lo de la persona va
 * arriba y lo de la tienda en `tienda`. El usuario, la galería y el stand no están: los
 * cambia el equipo.
 */
export const actualizarCuentaSchema = z
  .strictObject({
    nombre: z
      .string()
      .trim()
      .min(2, 'Escribe tu nombre y apellido.')
      .max(120, 'El nombre llega hasta 120 caracteres.')
      .optional(),
    correo: opcional(
      z.email('Escribe un correo válido o déjalo vacío.').transform((c) => c.trim().toLowerCase()),
    ).optional(),
    /** El de la persona. Vacío: sus contactos usan el WhatsApp de la tienda. */
    whatsapp: opcional(whatsappSchema).optional(),
    /** «Mostrar "Visto" en los mensajes» (RF-57). */
    mostrar_visto: z.boolean().optional(),
    tienda: z
      .strictObject({
        nombre: z
          .string()
          .trim()
          .min(2, 'Escribe el nombre de la tienda.')
          .max(120, 'El nombre llega hasta 120 caracteres.'),
        whatsapp: whatsappSchema,
        horario: textoOpcional(120, 'El horario llega hasta 120 caracteres.'),
        descripcion: textoOpcional(500, 'La descripción llega hasta 500 caracteres.'),
        /** Ruta de una foto subida con `POST /v1/archivos`, o nulo para quitar el logo. */
        logo: rutaFotoSchema.nullable(),
        /** Valores por defecto al publicar (RF-48, D-37). */
        precio_visible_defecto: z.boolean(),
        moneda_defecto: z.enum(['USD', 'PEN'], 'Elige la moneda.'),
      })
      .partial()
      .refine((tienda) => Object.keys(tienda).length > 0, 'No hay nada que cambiar.')
      .optional(),
  })
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay nada que cambiar.');

/** «22:00» → 1320. */
const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Elige una hora válida, como 22:00.')
  .transform((hora) => {
    const [h, m] = hora.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  });

/** `PUT /v1/cuenta/avisos` (RF-59): qué llega a la campanita y «No molestar». */
export const avisosCuentaSchema = z.strictObject({
  campanita: z.strictObject({
    MENSAJE: z.boolean(),
  }),
  no_molestar: z
    .strictObject({ desde: horaSchema, hasta: horaSchema })
    .refine(
      (horario) => horario.desde !== horario.hasta,
      'El horario debe empezar y terminar a horas distintas.',
    )
    .nullable(),
});

/** `PUT /v1/cuenta/respuestas-rapidas` (RF-56): la lista completa, en orden. */
export const respuestasRapidasSchema = z.strictObject({
  textos: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Una respuesta rápida no puede estar vacía.')
        .max(120, 'Cada respuesta rápida llega hasta 120 caracteres.'),
    )
    .max(MAX_RESPUESTAS_RAPIDAS, `Puedes tener hasta ${MAX_RESPUESTAS_RAPIDAS} respuestas rápidas.`)
    .refine(
      (textos) => new Set(textos.map((t) => t.toLowerCase())).size === textos.length,
      'Esa respuesta rápida ya está en la lista.',
    ),
});

export type ActualizarCuentaEntrada = z.input<typeof actualizarCuentaSchema>;
export type ActualizarCuentaDatos = z.output<typeof actualizarCuentaSchema>;
export type AvisosCuentaEntrada = z.input<typeof avisosCuentaSchema>;
export type AvisosCuentaDatos = z.output<typeof avisosCuentaSchema>;
export type RespuestasRapidasDatos = z.output<typeof respuestasRapidasSchema>;
