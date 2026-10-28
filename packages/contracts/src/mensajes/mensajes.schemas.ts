import { z } from 'zod';

import { rutaFotoSchema } from '../ofertas/ofertas.schemas.js';

export const MAX_TEXTO_MENSAJE = 2000;
export const MENSAJES_POR_PAGINA = 50;

/** `POST /v1/ofertas/:id/contacto` (RF-21, RF-23): abre el chat o da el enlace de WhatsApp. */
export const contactarSchema = z.strictObject({
  canal: z.enum(['CHAT', 'WHATSAPP'], 'Elige cómo contactar.'),
});

/** `GET /v1/conversaciones` (RF-55): Todas, No leídos y Archivados, con buscador. */
export const filtroConversacionesSchema = z.object({
  filtro: z.enum(['todas', 'no_leidas', 'archivadas']).default('todas'),
  q: z.string().trim().max(80).default(''),
});

/** `GET /v1/conversaciones/:id/mensajes`: de los más nuevos hacia atrás, por páginas. */
export const historialSchema = z.object({
  antes: z.iso.datetime({ offset: true }).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(MENSAJES_POR_PAGINA),
});

/** Texto, foto o foto con texto (RF-39). Nada de archivos (D-30). */
export const enviarMensajeSchema = z
  .strictObject({
    texto: z
      .string()
      .trim()
      .max(MAX_TEXTO_MENSAJE, `El mensaje llega hasta ${MAX_TEXTO_MENSAJE} caracteres.`)
      .optional(),
    foto: rutaFotoSchema.optional(),
  })
  .transform(({ texto, foto }) => ({ texto: texto || undefined, foto }))
  .refine((mensaje) => mensaje.texto || mensaje.foto, 'Escribe un mensaje o elige una foto.');

/** `PATCH /v1/conversaciones/:id` (RF-57): leída o no leída, silenciar y archivar. */
export const cambiarConversacionSchema = z
  .strictObject({
    leida: z.boolean().optional(),
    silenciada: z.boolean().optional(),
    archivada: z.boolean().optional(),
  })
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay nada que cambiar.');

/** `POST /v1/denuncias` (RF-57, RNF-53). */
export const denunciaSchema = z.strictObject({
  objeto: z.enum(['CONVERSACION', 'OFERTA', 'TIENDA']),
  objeto_id: z.uuid('No encontramos lo que quieres denunciar.'),
  motivo: z
    .string()
    .trim()
    .min(5, 'Cuéntanos en pocas palabras qué pasó.')
    .max(500, 'El motivo llega hasta 500 caracteres.'),
});

/** `POST /v1/ofertas/:id/vendido` (RF-47): a quién, entre quienes escribieron por la oferta. */
export const vendidoSchema = z.strictObject({
  conversacion_id: z.uuid('Elige a quién se lo vendiste.'),
});

/** `POST /v1/avisos/leidos`: sin `ids`, todos («Marcar como leídos»). */
export const leerAvisosSchema = z.strictObject({
  ids: z.array(z.uuid()).max(100).optional(),
});

export type Contactar = z.output<typeof contactarSchema>;
export type FiltroConversaciones = z.output<typeof filtroConversacionesSchema>;
export type ConsultaHistorial = z.output<typeof historialSchema>;
export type EnviarMensajeEntrada = z.input<typeof enviarMensajeSchema>;
export type EnviarMensajeDatos = z.output<typeof enviarMensajeSchema>;
export type CambiarConversacion = z.output<typeof cambiarConversacionSchema>;
export type DenunciaEntrada = z.input<typeof denunciaSchema>;
export type DenunciaDatos = z.output<typeof denunciaSchema>;
export type Vendido = z.output<typeof vendidoSchema>;
export type LeerAvisos = z.output<typeof leerAvisosSchema>;
