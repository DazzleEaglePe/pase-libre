import { z } from 'zod';

/** Usuario o correo: se compara sin distinguir mayúsculas (columnas citext). */
const identificadorSchema = z
  .string()
  .trim()
  .min(1, 'Escribe tu correo o usuario.')
  .max(254)
  .transform((valor) => valor.toLowerCase());

/** Reglas de la pantalla «Crea tu contraseña» del lienzo: 8 caracteres y un número. */
export const claveNuevaSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede superar los 128 caracteres.')
  .regex(/\d/, 'La contraseña debe tener al menos un número.');

export const ingresarSchema = z.strictObject({
  usuario: identificadorSchema,
  clave: z.string().min(1, 'Escribe tu contraseña.').max(128),
  recordar: z.boolean().default(false),
});

/**
 * En el primer ingreso (clave temporal) no se pide la clave actual: la persona
 * acaba de escribirla. En cualquier otro cambio sí es obligatoria.
 */
export const cambiarClaveSchema = z.strictObject({
  clave_actual: z.string().min(1).max(128).optional(),
  clave_nueva: claveNuevaSchema,
});

export type IngresarEntrada = z.input<typeof ingresarSchema>;
export type IngresarDatos = z.output<typeof ingresarSchema>;
export type CambiarClaveEntrada = z.infer<typeof cambiarClaveSchema>;
