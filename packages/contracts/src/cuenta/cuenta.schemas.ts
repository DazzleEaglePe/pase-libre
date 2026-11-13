import { z } from 'zod';

import { whatsappSchema } from '../equipo/equipo.schemas.js';
import { rutaFotoSchema } from '../ofertas/ofertas.schemas.js';
import { horarioTiendaSchema } from '../tiendas/horario.js';

/** El zoom de la portada y del logo (docs/19 §20): la barrita va de 1× a 4×. */
export const ZOOM_MINIMO = 1;
export const ZOOM_MAXIMO = 4;

/** Por papel: «4 de 6» en «Cuando te escriben» y en «Cuando tú preguntas» (N11). */
export const MAX_RESPUESTAS_RAPIDAS = 6;

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
        /** El horario por días (N09); con él, `horario` se escribe solo. Nulo lo borra. */
        horario_tramos: horarioTiendaSchema.nullable(),
        /** «Cómo llegar» (PCH_WebLlegar): cómo se sube hasta el stand. */
        indicaciones: textoOpcional(240, 'Las indicaciones llegan hasta 240 caracteres.'),
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

/**
 * `PUT /v1/cuenta/lugar` (N09): galería, piso y stand nuevos. No cambian al toque: quedan
 * «Pendiente de aprobación» hasta que el Equipo los confirma.
 */
export const cambioLugarSchema = z.strictObject({
  galeria_id: z.uuid('Elige la galería.'),
  piso: opcional(z.string().trim().max(20, 'El piso llega hasta 20 caracteres.')).optional(),
  stand: z
    .string()
    .trim()
    .min(1, 'Escribe tu stand.')
    .max(20, 'El stand llega hasta 20 caracteres.'),
});
export type CambioLugarDatos = z.output<typeof cambioLugarSchema>;

/** `POST /v1/equipo/cambios-de-lugar/:id/rechazar`: por qué no (le llega a la tienda). */
export const rechazarCambioLugarSchema = z.strictObject({
  motivo: z
    .string()
    .trim()
    .max(300, 'Escribe hasta 300 caracteres.')
    .optional()
    .transform((texto) => texto || undefined),
});
export type RechazarCambioLugarDatos = z.output<typeof rechazarCambioLugarSchema>;

/** «22:00» → 1320. */
const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Elige una hora válida, como 22:00.')
  .transform((hora) => {
    const [h, m] = hora.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  });

/** `PUT /v1/cuenta/avisos` (RF-59): qué llega a la campanita y «No molestar». */
/**
 * `PUT /v1/cuenta/portada` (COR1): una foto nueva (de `POST /v1/archivos`), qué parte se ve
 * («Acomodar») o las dos cosas.
 */
export const portadaTiendaSchema = z
  .strictObject({
    ruta: rutaFotoSchema.optional(),
    posicion: z.number().int().min(0).max(100).optional(),
    /** El zoom (docs/19 §20), de 1 a 4. */
    zoom: z.number().min(ZOOM_MINIMO).max(ZOOM_MAXIMO).optional(),
    /** Qué parte se ve a lo ancho (docs/19 §20), de la izquierda (0) a la derecha (100). */
    x: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (datos) =>
      datos.ruta !== undefined ||
      datos.posicion !== undefined ||
      datos.zoom !== undefined ||
      datos.x !== undefined,
    { message: 'Sube una foto o acomoda la que tienes.' },
  );
export type PortadaDatos = z.output<typeof portadaTiendaSchema>;

/**
 * «Ajustar logo» (docs/19 §20): cómo se acomodó la foto original en el círculo.
 * - `x`, `y`: dónde cae el centro del círculo en la foto ya girada, de 0 a 1 (puede salirse un
 *   poco si se alejó con «Que entre entero»).
 * - `zoom`: 1 es el círculo del alto (o del ancho) de la foto; hasta 4. Menos de 1 aleja: lo usa
 *   «Que entre entero».
 * - `rotacion`: 0, 90, 180 o 270 grados («↺ Girar»).
 * - `fondo`: lo que queda fuera de la foto, `#rrggbb` o `transparente`.
 */
export const ajusteLogoSchema = z.strictObject({
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  zoom: z.number().min(0.1).max(ZOOM_MAXIMO),
  rotacion: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  fondo: z
    .string()
    .regex(/^(#[0-9a-f]{6}|transparente)$/i, 'Elige el color de fondo.')
    .transform((fondo) => fondo.toLowerCase()),
});
export type AjusteLogo = z.output<typeof ajusteLogoSchema>;

/**
 * `PUT /v1/cuenta/logo` (docs/19 §20): «Guardar» de «Ajustar logo». Con `ruta`, una foto nueva de
 * `POST /v1/archivos`; sin ella, se reacomoda la original que ya tiene («Ajustar»).
 */
export const logoTiendaSchema = z.strictObject({
  ruta: rutaFotoSchema.optional(),
  ajuste: ajusteLogoSchema,
});
export type LogoDatos = z.output<typeof logoTiendaSchema>;

export const avisosCuentaSchema = z.strictObject({
  campanita: z.strictObject({
    MENSAJE: z.boolean(),
    EN_VIVO: z.boolean().optional(),
    EN_VIVO_RESPUESTA: z.boolean().optional(),
    VENTA: z.boolean().optional(),
    RECORDATORIO: z.boolean().optional(),
    SEGUIDA: z.boolean().optional(),
    ALERTA: z.boolean().optional(),
    EQUIPO: z.boolean().optional(),
  }),
  no_molestar: z
    .strictObject({ desde: horaSchema, hasta: horaSchema })
    .refine(
      (horario) => horario.desde !== horario.hasta,
      'El horario debe empezar y terminar a horas distintas.',
    )
    .nullable(),
});

/**
 * `PUT /v1/cuenta/respuestas-rapidas` (RF-56, N11): la lista completa de un papel, en orden.
 * `{tienda}` es la ficha «Nombre de la tienda».
 */
export const respuestasRapidasSchema = z.strictObject({
  papel: z.enum(['vendedor', 'comprador'], 'Elige cuándo sale la respuesta rápida.'),
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

/** `POST /v1/cuenta/alertas`: «Avísame cuando alguien la publique» (EV_WebRes). */
export const alertaBusquedaSchema = z.strictObject({
  texto: z.string().trim().min(2, 'Escribe qué buscas.').max(120, 'Escribe hasta 120 caracteres.'),
});
export type AlertaBusquedaDatos = z.output<typeof alertaBusquedaSchema>;
