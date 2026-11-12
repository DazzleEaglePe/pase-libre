import { z } from 'zod';

/**
 * Equipo › Galerías (docs/18 §3): la lista de galerías de la avenida que leen Crear cuenta,
 * Datos de la tienda y Wilson en vivo. Se ordena arrastrando; una galería con tiendas no se
 * borra, solo se oculta.
 */

const nombreGaleriaSchema = z
  .string('Escribe el nombre de la galería.')
  .trim()
  .min(2, 'Escribe el nombre de la galería.')
  .max(80, 'El nombre llega hasta 80 letras.');

/** Metros desde una esquina de la avenida (para «a 3 min caminando»). Vacío = sin dato. */
const metrosSchema = z.preprocess(
  (valor) => (valor === '' ? null : valor),
  z
    .number('Escribe los metros con números.')
    .int('Escribe los metros sin decimales.')
    .min(0, 'Los metros no pueden ser negativos.')
    .max(5000, 'Escribe hasta 5000 metros.')
    .nullable(),
);

/** `POST /v1/equipo/galerias`: «+ Agregar galería». */
export const crearGaleriaSchema = z.strictObject({
  nombre: nombreGaleriaSchema,
  metros: metrosSchema.optional(),
});
export type CrearGaleriaEntrada = z.input<typeof crearGaleriaSchema>;
export type CrearGaleriaDatos = z.output<typeof crearGaleriaSchema>;

/** `PATCH /v1/equipo/galerias/:id`: «Editar». `activa: false` la oculta. */
export const editarGaleriaSchema = z
  .strictObject({
    nombre: nombreGaleriaSchema.optional(),
    metros: metrosSchema.optional(),
    activa: z.boolean().optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'No hay nada que cambiar.',
  });
export type EditarGaleriaDatos = z.output<typeof editarGaleriaSchema>;

/** `PUT /v1/equipo/galerias/orden`: todas las galerías, en el orden nuevo. */
export const ordenGaleriasSchema = z.strictObject({
  ids: z
    .array(z.uuid('Esa galería no existe.'))
    .min(1, 'Faltan las galerías.')
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, 'Hay una galería repetida.'),
});
export type OrdenGaleriasDatos = z.output<typeof ordenGaleriasSchema>;

/**
 * `POST /v1/equipo/galerias/avisos/:id/agregar`: «Agregar» de un aviso «Galería nueva: X». Se
 * puede corregir cómo quedó escrito antes de agregarla.
 */
export const agregarAvisoGaleriaSchema = z.strictObject({
  nombre: nombreGaleriaSchema.optional(),
  metros: metrosSchema.optional(),
});
export type AgregarAvisoGaleriaDatos = z.output<typeof agregarAvisoGaleriaSchema>;

export interface GaleriaEquipo {
  id: string;
  nombre: string;
  slug: string;
  /** Oculta: no sale en las listas públicas ni al registrarse; sus tiendas siguen igual. */
  activa: boolean;
  orden: number;
  metros: number | null;
  /** Tiendas en esta galería (de cualquier estado): con alguna no se puede borrar. */
  tiendas: number;
}

/**
 * «Galería nueva: X»: quien se registró eligió «Otra galería» y escribió X. Las que escribieron
 * lo mismo (sin mirar mayúsculas ni tildes) van en un solo aviso.
 */
export interface AvisoGaleria {
  /** La solicitud más antigua del grupo: es la que se usa para agregar o descartar. */
  id: string;
  nombre: string;
  /** El nombre comercial de las tiendas que la escribieron (sus solicitudes esperan). */
  tiendas: string[];
  creada_en: string;
}

/** `GET /v1/equipo/galerias`. */
export interface RespuestaGaleriasEquipo {
  galerias: GaleriaEquipo[];
  avisos: AvisoGaleria[];
}
