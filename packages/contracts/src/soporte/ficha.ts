import { z } from 'zod';

import { whatsappSchema } from '../equipo/equipo.schemas.js';
import { claveNuevaSchema } from '../sesion/sesion.schemas.js';
import type { SesionParaCerrar } from '../sesion/sesion.types.js';

/** Con 3 advertencias el equipo revisa la cuenta (puede suspenderla). */
export const MAX_ADVERTENCIAS = 3;
/** «Ayudar como la tienda» dura una hora (N14). */
export const MINUTOS_SOPORTE = 60;
/** Hasta cuántos dispositivos puede subir el equipo el límite de una tienda (N10). */
export const MAX_LIMITE_DISPOSITIVOS = 10;

/** `GET /v1/equipo/panel/tiendas/:id/ficha`: la cabecera y lo de cada pestaña chica (N14). */
export interface FichaTienda {
  id: string;
  nombre: string;
  suspendida: boolean;
  /** «1 advertencia de 3»: las que dio el equipo, no los reportes. */
  advertencias: number;
  galeria: string | null;
  piso: string | null;
  stand: string | null;
  /** El usuario de la cuenta principal. Nunca su contraseña. */
  usuario: string | null;
  /** El WhatsApp de la tienda. */
  whatsapp: string;
  asesores: number;
  logo: string | null;
  portada: { ruta: string; posicion: number } | null;
  datos: {
    nombre: string;
    whatsapp: string;
    /** Slug de la galería; nulo si es independiente. */
    galeria: string | null;
    piso: string | null;
    stand: string | null;
    horario: string | null;
    indicaciones: string | null;
    descripcion: string | null;
  };
  publicaciones: number;
  reportes: number;
  limite_dispositivos: number;
  /** Las de la cuenta principal: «Sesiones · 2 de 2». */
  sesiones: SesionParaCerrar[];
  soporte: {
    /** La tienda tocó «Pedir ayuda al Equipo» y nadie entró todavía. */
    pedido_en: string | null;
    /** Alguien del equipo está ayudando ahora. */
    activo: { equipo: string; vence_en: string } | null;
  };
}

const textoOpcional = (maximo: number, mensaje: string) =>
  z.preprocess(
    (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
    z.string().trim().max(maximo, mensaje).nullable(),
  );

/** `PATCH /v1/equipo/panel/tiendas/:id/datos` (pestaña Datos): solo lo que cambia. */
export const datosTiendaEquipoSchema = z
  .strictObject({
    nombre: z
      .string()
      .trim()
      .min(2, 'Escribe el nombre de la tienda.')
      .max(120, 'El nombre llega hasta 120 caracteres.')
      .optional(),
    whatsapp: whatsappSchema.optional(),
    /** Slug de la galería; nulo para un independiente. */
    galeria: z.string().trim().max(80).nullable().optional(),
    piso: textoOpcional(20, 'El piso llega hasta 20 caracteres.').optional(),
    stand: textoOpcional(20, 'El stand llega hasta 20 caracteres.').optional(),
    horario: textoOpcional(120, 'El horario llega hasta 120 caracteres.').optional(),
    indicaciones: textoOpcional(240, '«Cómo llegar» llega hasta 240 caracteres.').optional(),
    descripcion: textoOpcional(500, 'La descripción llega hasta 500 caracteres.').optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'No hay nada que cambiar.',
  });
export type DatosTiendaEquipo = z.output<typeof datosTiendaEquipoSchema>;

/** Una publicación en la pestaña Publicaciones. */
export interface PublicacionDeTienda {
  id: string;
  titulo: string;
  precio: string | null;
  estado: 'ACTIVA' | 'PAUSADA';
  stock: number;
  actualizada_en: string;
}

/** `POST /v1/equipo/panel/tiendas/:id/publicaciones/:oferta/estado`: pausar o reactivar. */
export const estadoPublicacionEquipoSchema = z.strictObject({
  estado: z.enum(['ACTIVA', 'PAUSADA'], 'Elige si la pausas o la reactivas.'),
});
export type EstadoPublicacionEquipo = z.output<typeof estadoPublicacionEquipoSchema>;

/** Un renglón de «Últimos 10 chats» (pestaña Conversaciones). */
export interface ChatDeTienda {
  id: string;
  /** La otra tienda. */
  con: string;
  producto: string;
  /** El último mensaje, o nulo si fue una foto. */
  ultimo: string | null;
  fecha: string;
}

/** `GET /v1/equipo/panel/tiendas/:id/conversaciones`. */
export interface RespuestaChatsDeTienda {
  chats: ChatDeTienda[];
  total: number;
  /** El chat con el equipo: va en «Chats» del panel. */
  equipo: { ultimo: string | null; fecha: string } | null;
}

/** Un mensaje del chat en solo lectura (incluye los editados y los borrados). */
export interface MensajeEnLectura {
  id: string;
  texto: string | null;
  foto: string | null;
  /** Lo escribió esta tienda (va a la derecha). */
  de_la_tienda: boolean;
  /** Quien lo escribió («Luis», o el nombre de la otra tienda); nulo en los del sistema. */
  autor: string | null;
  creado_en: string;
  /** «(antes decía: …)». */
  antes: string | null;
  /** «(borrado por Pegasus5000)». */
  borrado_por: string | null;
}

/** `GET /v1/equipo/panel/tiendas/:id/conversaciones/:conversacion`: solo lectura, queda anotado. */
export interface LecturaDeChat {
  id: string;
  con: string;
  producto: string;
  mensajes: MensajeEnLectura[];
}

/** `GET /v1/equipo/panel/tiendas/:id/actividad`: búsquedas y vistas por categoría, sin chats. */
export interface ActividadDeTienda {
  dias: number;
  categorias: Array<{ categoria: string; busquedas: number; vistas: number; total: number }>;
}

/** `GET /v1/equipo/panel/tiendas/:id/reportes` (pestaña Reportes y advertencias). */
export interface ReportesDeTienda {
  advertencias: Array<{
    id: string;
    motivo: string;
    caso: string | null;
    por: string;
    fecha: string;
  }>;
  reportes: Array<{
    id: string;
    codigo: string;
    motivo: string;
    estado: 'ABIERTA' | 'EN_REVISION' | 'REVISADA' | 'DESCARTADA';
    de: string | null;
    fecha: string;
  }>;
}

/**
 * `POST /v1/equipo/panel/tiendas/:id/clave` (pestaña Acceso). Temporal: la arma la API y pide
 * cambiarla al entrar. Definitiva: la que dicta el dueño. Las dos cierran sus sesiones y le
 * avisan.
 */
export const claveTiendaEquipoSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('TEMPORAL') }),
  z.strictObject({ tipo: z.literal('DEFINITIVA'), clave: claveNuevaSchema }),
]);
export type ClaveTiendaEquipo = z.output<typeof claveTiendaEquipoSchema>;

export interface RespuestaClaveTienda {
  tipo: 'TEMPORAL' | 'DEFINITIVA';
  /** Solo la temporal: la definitiva ya la sabe el dueño. */
  clave_temporal: string | null;
  cerradas: number;
  /** Para «Mejor: enviar enlace por WhatsApp». */
  enlace_whatsapp: string | null;
}

/** `PUT /v1/equipo/panel/tiendas/:id/limite` («Límite de dispositivos ▾»). */
export const limiteDispositivosSchema = z.strictObject({
  limite: z
    .number()
    .int()
    .min(1, 'Al menos 1 dispositivo.')
    .max(MAX_LIMITE_DISPOSITIVOS, `Hasta ${MAX_LIMITE_DISPOSITIVOS} dispositivos.`),
});
export type LimiteDispositivos = z.output<typeof limiteDispositivosSchema>;

/** Un renglón de «Historial de cambios del Equipo». */
export interface CambioDelEquipo {
  id: string;
  /** «Fabrizio cambió el banner». */
  texto: string;
  fecha: string;
}

/** `GET/PUT /v1/equipo/respuesta-automatica` (N14). «{tienda}» se cambia por su nombre. */
export const respuestaAutomaticaSchema = z.strictObject({
  texto: z
    .string()
    .trim()
    .min(10, 'Escribe la respuesta automática.')
    .max(1000, 'La respuesta llega hasta 1000 letras.'),
});
export type RespuestaAutomatica = z.output<typeof respuestaAutomaticaSchema>;

/** `GET /v1/cuenta/soporte`: «Pedir ayuda al Equipo» en Ayuda. */
export interface EstadoSoporteTienda {
  pedido_en: string | null;
  activo: { equipo: string; vence_en: string } | null;
}
