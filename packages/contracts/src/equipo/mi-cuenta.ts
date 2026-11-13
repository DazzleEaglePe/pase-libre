import { z } from 'zod';

import { nombreDeUsuarioSchema } from './equipo.schemas.js';

/**
 * «Mi cuenta» del Equipo (doc 19, punto 7): cada persona del Equipo cambia sus datos. La
 * contraseña va por `POST /v1/sesion/clave` y las sesiones por `/v1/cuenta/sesiones`, que no
 * piden tienda. El rol no se cambia aquí.
 */

/** `PATCH /v1/equipo/mi-cuenta`: solo lo que cambia. */
export const actualizarMiCuentaEquipoSchema = z
  .strictObject({
    nombre: z
      .string()
      .trim()
      .min(2, 'Escribe tu nombre.')
      .max(120, 'El nombre llega hasta 120 caracteres.')
      .optional(),
    usuario: nombreDeUsuarioSchema.optional(),
    /** Vacío lo borra. */
    correo: z
      .preprocess(
        (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor),
        z
          .email('Escribe un correo válido o déjalo vacío.')
          .transform((correo) => correo.trim().toLowerCase())
          .nullable(),
      )
      .optional(),
  })
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay nada que cambiar.');
export type ActualizarMiCuentaEquipoEntrada = z.input<typeof actualizarMiCuentaEquipoSchema>;
export type ActualizarMiCuentaEquipoDatos = z.output<typeof actualizarMiCuentaEquipoSchema>;

/** `GET` y `PATCH /v1/equipo/mi-cuenta`. */
export interface MiCuentaEquipo {
  nombre: string;
  usuario: string;
  correo: string | null;
}

/** `POST /v1/equipo/versiones/vista` (doc 19, punto 8): ya abrió la versión que corre. */
export interface RespuestaVersionVista {
  version_vista: string;
}
