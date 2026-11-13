import { z } from 'zod';

import type { TipoMensaje } from './mensajes.types.js';

// ── «¿Lograste cerrar el trato?» (doc 19, punto 17) ─────────────────────────

/** La tarjeta sale recién con al menos 6 mensajes entre los dos. */
export const MENSAJES_PARA_PREGUNTAR_TRATO = 6;
/** «Todavía no»: vuelve a preguntar 24 h después, si siguen hablando. */
export const HORAS_TODAVIA_NO = 24;

/**
 * Lo que se dice cuando ya se está cerrando el trato, sin tildes ni mayúsculas. Cada una tiene
 * que empezar una palabra: «separa» encuentra «sepárala», pero no «preparado».
 */
export const PALABRAS_DE_TRATO = [
  'a cuanto',
  'ultimo',
  'separa',
  'te la separo',
  'paso a recoger',
  'paso en',
  'yape',
  'yapeo',
  'plin',
  'transferi',
  'listo',
  'trato',
  'cerramos',
] as const;

/** «¿A cuánto me la DEJAS?» → «a cuanto me la dejas»: sin tildes, mayúsculas ni signos. */
export function textoParaBuscar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Si el mensaje habla de cerrar el trato: tiene alguna de las palabras al empezar una palabra. */
export function hablaDeCerrarTrato(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const limpio = ` ${textoParaBuscar(texto)}`;
  return PALABRAS_DE_TRATO.some((palabra) => limpio.includes(` ${palabra}`));
}

/** Lo que quien vende ya respondió en este chat (se guarda por conversación en el servidor). */
export interface EstadoTrato {
  /** Cuándo tocó «Todavía no». */
  pospuesta_en: string | null;
  /** Tocó la X: no vuelve a salir en este chat. */
  descartada: boolean;
}

/** En `GET /v1/conversaciones/:id`, solo para quien vende. */
export interface TratoDelHilo extends EstadoTrato {
  /** Con lo que ya se habló (aun lo que no está cargado en la pantalla), ya corresponde preguntar. */
  preguntar: boolean;
}

export interface DatosTrato extends EstadoTrato {
  mensajes: ReadonlyArray<{ tipo: TipoMensaje; texto: string | null; creado_en: string }>;
  /** Ya hay una venta en este chat. */
  vendido: boolean;
  /** La publicación sigue y le queda stock. */
  hay_stock: boolean;
  ahora?: Date;
}

/**
 * Cuándo sale la tarjeta: al menos 6 mensajes entre los dos y alguno con una de las palabras.
 * No sale si ya está vendido, si no queda stock, si tocó la X, ni en las 24 h después de
 * «Todavía no» (y después, solo si siguieron hablando).
 */
export function debePreguntarTrato(datos: DatosTrato): boolean {
  if (datos.vendido || !datos.hay_stock || datos.descartada) return false;
  const delChat = datos.mensajes.filter((m) => m.tipo !== 'SISTEMA');
  if (delChat.length < MENSAJES_PARA_PREGUNTAR_TRATO) return false;
  if (datos.pospuesta_en) {
    const desde = Date.parse(datos.pospuesta_en);
    const ahora = (datos.ahora ?? new Date()).getTime();
    if (ahora - desde < HORAS_TODAVIA_NO * 3_600_000) return false;
    if (!delChat.some((m) => Date.parse(m.creado_en) > desde)) return false;
  }
  return delChat.some((m) => hablaDeCerrarTrato(m.texto));
}

/** `POST /v1/conversaciones/:id/trato`: «Todavía no» o la X. */
export const responderTratoSchema = z.strictObject({
  respuesta: z.enum(['TODAVIA_NO', 'NO_PREGUNTAR']),
});
export type ResponderTrato = z.output<typeof responderTratoSchema>;

// ── «Escribiendo…» (doc 19, punto 19) ──────────────────────────────────────

/** Lo que el navegador le manda al socket (el resto solo va del servidor al navegador). */
export const AL_SERVIDOR = { escribiendo: 'escribiendo' } as const;

/** Mientras la caja tiene texto, se avisa como mucho cada 3 s. */
export const ESCRIBIENDO_CADA_MS = 3_000;
/** Sin otro aviso en 5 s, se apaga. */
export const ESCRIBIENDO_SE_APAGA_MS = 5_000;

/** «Borró todo»: el otro apaga «escribiendo…» al instante, sin esperar los 5 s. */
const borro = z.literal(true).optional();

/**
 * `escribiendo`: en un chat entre tiendas, o en el hilo de una tienda con el Equipo. La tienda
 * manda `{ equipo: true }`; el Equipo, `{ equipo: true, tienda_id }`.
 */
export const escribiendoSchema = z.union([
  z.strictObject({ conversacion_id: z.uuid(), borro }),
  z.strictObject({ equipo: z.literal(true), tienda_id: z.uuid().optional(), borro }),
]);
export type EscribiendoDatos = z.output<typeof escribiendoSchema>;

/**
 * `chat:escribiendo`, a la otra persona del chat; en el hilo con el Equipo, a la tienda («El
 * equipo está escribiendo…») o a todo el Equipo (en la tienda de `tienda_id`). Con `borro`,
 * dejó la caja vacía.
 */
export type EventoEscribiendo = (
  { conversacion_id: string } | { equipo: true; tienda_id: string }
) & { borro?: true };
