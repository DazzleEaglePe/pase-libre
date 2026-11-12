import { z } from 'zod';

import { PERMISOS_ASESOR, type PermisoAsesor } from '../sesion/sesion.types.js';
import { claveNuevaSchema } from '../sesion/sesion.schemas.js';

/** Hasta 3 asesores por tienda, contando los pausados (N12). */
export const MAX_ASESORES = 3;

const permisosSchema = z.array(z.enum(PERMISOS_ASESOR)).max(PERMISOS_ASESOR.length);

/**
 * `POST /v1/cuenta/asesores` («Añadir asesor»). El usuario es el de la tienda más un punto y
 * `sufijo` («darkalien.luis»). Sin `clave`, la API arma una; la contraseña se ve solo en la
 * respuesta.
 */
export const crearAsesorSchema = z.strictObject({
  nombre: z
    .string()
    .trim()
    .min(2, 'Escribe el nombre y apellido del asesor.')
    .max(120, 'El nombre llega hasta 120 caracteres.'),
  sufijo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,20}$/, 'Después del punto van de 2 a 20 letras sin tildes o números.'),
  clave: claveNuevaSchema.optional(),
  permisos: permisosSchema.optional(),
});
export type CrearAsesorDatos = z.output<typeof crearAsesorSchema>;

/** `PATCH /v1/cuenta/asesores/:id`: «Guardar permisos» o el interruptor Activo / Pausado. */
export const cambiarAsesorSchema = z
  .strictObject({
    activo: z.boolean().optional(),
    permisos: permisosSchema.optional(),
  })
  .refine((datos) => datos.activo !== undefined || datos.permisos !== undefined, {
    message: 'No hay nada que cambiar.',
  });
export type CambiarAsesorDatos = z.output<typeof cambiarAsesorSchema>;

/** `POST /v1/cuenta/asesores/:id/clave`: una contraseña nueva (sin `clave`, la arma la API). */
export const claveAsesorSchema = z.strictObject({ clave: claveNuevaSchema.optional() });
export type ClaveAsesorDatos = z.output<typeof claveAsesorSchema>;

export interface Asesor {
  id: string;
  nombre: string;
  usuario: string;
  activo: boolean;
  permisos: PermisoAsesor[];
  ultimo_ingreso_en: string | null;
}

/** `GET /v1/cuenta/asesores`: «2 de 3 · 1 activo». */
export interface RespuestaAsesores {
  asesores: Asesor[];
  maximo: number;
  /** Lo que va antes del punto: el usuario de la cuenta principal. */
  prefijo: string;
}

/**
 * Al crear un asesor o ponerle una contraseña nueva. La contraseña solo viaja aquí: en la base
 * queda cifrada y no se puede volver a mirar.
 */
export interface RespuestaClaveAsesor {
  asesor: Asesor;
  clave: string;
  /** Para «Enviar por WhatsApp». */
  mensaje: string;
}
