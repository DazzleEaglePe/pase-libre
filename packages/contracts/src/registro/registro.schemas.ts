import { z } from 'zod';

import { whatsappSchema } from '../equipo/equipo.schemas.js';
import { claveNuevaSchema } from '../sesion/sesion.schemas.js';

/**
 * Registro propio de tiendas (RF-01, RF-04; sección 3 del lienzo «Versión final», D-54):
 * celular con código por SMS, RUC o «sin RUC», datos del stand y revisión.
 */

export const CATEGORIAS_REGISTRO = [
  'Gráficas',
  'Procesadores',
  'RAM',
  'Placas',
  'Monitores',
  'Almacenamiento',
  'Laptops',
  'Periféricos',
  'Redes',
  'Otros',
] as const;

export const DIAS_DE_ATENCION = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const;
export type DiaDeAtencion = (typeof DIAS_DE_ATENCION)[number];

export const ESTADOS_SOLICITUD = [
  'PENDIENTE',
  'REQUIERE_CAMBIOS',
  'APROBADA',
  'RECHAZADA',
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const METODOS_SOLICITUD = [
  'RUC',
  'SIN_RUC_DNI',
  'SIN_RUC_RECOMENDACION',
  'SIN_RUC_CREDENCIAL',
] as const;
export type MetodoSolicitud = (typeof METODOS_SOLICITUD)[number];

/** Horas que tiene el equipo para revisar a quien se registra sin RUC (lienzo: «máx. 3 h»). */
export const HORAS_DE_REVISION = 3;

/**
 * El dígito de control del RUC (módulo 11, el de SUNAT). Un RUC empieza con 10 (persona
 * natural), 15, 16, 17 (otros) o 20 (empresa) y tiene 11 dígitos. Solo descarta errores de
 * tipeo: que el RUC exista y esté activo lo dice SUNAT.
 */
export function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((total, peso, i) => total + peso * Number(ruc[i]), 0);
  const resto = 11 - (suma % 11);
  const control = resto === 10 ? 0 : resto === 11 ? 1 : resto;
  return control === Number(ruc[10]);
}

export const rucSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, 'El RUC lleva 11 dígitos.')
  .refine(rucValido, 'Revisa el RUC: no parece válido.');

export const pedirCodigoSchema = z.strictObject({ celular: whatsappSchema });
export type PedirCodigo = z.infer<typeof pedirCodigoSchema>;

export const verificarCodigoSchema = z.strictObject({
  celular: whatsappSchema,
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código lleva 6 dígitos.'),
});
export type VerificarCodigo = z.infer<typeof verificarCodigoSchema>;

export const consultarRucSchema = z.strictObject({ ruc: rucSchema });
export type ConsultarRuc = z.infer<typeof consultarRucSchema>;

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Escribe la hora como 10:00.');

export const horarioSchema = z
  .strictObject({
    dias: z
      .array(z.enum(DIAS_DE_ATENCION))
      .min(1, 'Elige al menos un día de atención.')
      .refine((dias) => new Set(dias).size === dias.length, 'Un día no puede repetirse.'),
    desde: hora,
    hasta: hora,
  })
  .refine((h) => h.desde < h.hasta, {
    path: ['hasta'],
    message: 'La hora de cierre es después de la de apertura.',
  });
export type Horario = z.infer<typeof horarioSchema>;

const NOMBRE_DIA: Record<DiaDeAtencion, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
};

function horaLegible(valor: string): string {
  const [h, m] = valor.split(':').map(Number) as [number, number];
  const doce = h % 12 === 0 ? 12 : h % 12;
  return `${doce}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** «Lun a sáb, de 10:00 a. m. a 8:00 p. m.»: los días seguidos se juntan con «a». */
export function horarioATexto(horario: Horario): string {
  const orden = DIAS_DE_ATENCION.filter((dia) => horario.dias.includes(dia));
  const tramos: string[] = [];
  let i = 0;
  while (i < orden.length) {
    let j = i;
    while (
      j + 1 < orden.length &&
      DIAS_DE_ATENCION.indexOf(orden[j + 1]!) === DIAS_DE_ATENCION.indexOf(orden[j]!) + 1
    )
      j++;
    const inicio = NOMBRE_DIA[orden[i]!];
    const fin = NOMBRE_DIA[orden[j]!].toLowerCase();
    tramos.push(j - i >= 2 ? `${inicio} a ${fin}` : j - i === 1 ? `${inicio} y ${fin}` : inicio);
    i = j + 1;
  }
  return `${tramos.join(', ')}, de ${horaLegible(horario.desde)} a ${horaLegible(horario.hasta)}`;
}

/** Las mismas reglas que «Crea tu contraseña»: 8 caracteres y un número. */
const claveRegistro = claveNuevaSchema;

const comunes = {
  nombre_comercial: z
    .string()
    .trim()
    .min(2, 'Escribe cómo te conocen en la galería.')
    .max(120, 'El nombre es demasiado largo.'),
  categorias: z
    .array(z.enum(CATEGORIAS_REGISTRO))
    .min(1, 'Elige al menos una categoría.')
    .refine((c) => new Set(c).size === c.length, 'Una categoría no puede repetirse.'),
  /** Slug de la galería, o nulo si es una que aún no está registrada (entonces va `galeria_otra`). */
  galeria: z.string().trim().min(1).max(80).nullable(),
  galeria_otra: z.string().trim().min(2).max(120).nullable(),
  piso: z.string().trim().max(20).nullable(),
  stand: z.string().trim().min(1, 'Escribe el número de tu stand.').max(20),
  referencia: z.string().trim().max(200).nullable(),
  horario: horarioSchema,
  encargado: z.string().trim().min(2, 'Escribe el nombre del encargado.').max(120),
  acepta_terminos: z.literal(true, 'Acepta los términos para continuar.'),
};

/** Lo que cambia entre quien se registra y quien corrige: el token del celular y la clave. */
function variantes<Extra extends z.ZodRawShape>(extra: Extra) {
  return [
    z.strictObject({
      ...extra,
      ...comunes,
      metodo: z.literal('RUC'),
      ruc: rucSchema,
    }),
    z.strictObject({
      ...extra,
      ...comunes,
      metodo: z.literal('SIN_RUC_DNI'),
      dni: z
        .string()
        .trim()
        .regex(/^\d{8}$/, 'El DNI lleva 8 dígitos.'),
    }),
    z.strictObject({
      ...extra,
      ...comunes,
      metodo: z.literal('SIN_RUC_RECOMENDACION'),
      recomienda_tienda: z
        .string()
        .trim()
        .min(2, 'Escribe qué tienda verificada te conoce.')
        .max(120),
    }),
    z.strictObject({
      ...extra,
      ...comunes,
      metodo: z.literal('SIN_RUC_CREDENCIAL'),
    }),
  ] as const;
}

type Galerias = { galeria: string | null; galeria_otra: string | null };
const unaGaleria = (datos: Galerias, contexto: z.RefinementCtx): void => {
  if ((datos.galeria === null) === (datos.galeria_otra === null)) {
    contexto.addIssue({
      code: 'custom',
      path: ['galeria'],
      message: 'Elige tu galería o escribe el nombre de la que no está en la lista.',
    });
  }
};

/** Enviar la solicitud: el token sale de verificar el código del SMS. */
export const crearSolicitudSchema = z
  .discriminatedUnion(
    'metodo',
    variantes({
      token_celular: z.string().min(20).max(100),
      clave: claveRegistro,
    }),
  )
  .superRefine(unaGaleria);
export type CrearSolicitud = z.infer<typeof crearSolicitudSchema>;

/** Corregir lo que el equipo pidió: se prueba con el código de consulta, sin otro SMS. */
export const corregirSolicitudSchema = z
  .discriminatedUnion('metodo', variantes({ clave: claveRegistro.optional() }))
  .superRefine(unaGaleria);
export type CorregirSolicitud = z.infer<typeof corregirSolicitudSchema>;

/** El código para consultar el estado: 32 caracteres que solo conoce quien se registró. */
export const codigoDeConsultaSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{20,64}$/, 'Esa solicitud no existe.');

// ── Panel del equipo ────────────────────────────────────────────────────────

export const filtroSolicitudesSchema = z.strictObject({
  estado: z.enum(ESTADOS_SOLICITUD).optional(),
});
export type FiltroSolicitudes = z.infer<typeof filtroSolicitudesSchema>;

export const aprobarSolicitudSchema = z.strictObject({
  /** Obligatoria si quien se registró escribió una galería que aún no está en la lista. */
  galeria: z.string().trim().min(1).max(80).optional(),
});
export type AprobarSolicitud = z.infer<typeof aprobarSolicitudSchema>;

export const mensajeDelEquipoSchema = z.strictObject({
  mensaje: z.string().trim().min(5, 'Cuéntale en una frase qué pasa.').max(500),
});
export type MensajeDelEquipo = z.infer<typeof mensajeDelEquipoSchema>;
