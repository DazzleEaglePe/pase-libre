import { z } from 'zod';

/**
 * WhatsApp de Perú: se guarda solo con los 9 dígitos del celular.
 * Acepta «987 654 321», «+51 987654321» o «51987654321».
 */
export const whatsappSchema = z
  .string()
  .trim()
  .transform((valor) => {
    const digitos = valor.replace(/\D/g, '');
    return digitos.length === 11 && digitos.startsWith('51') ? digitos.slice(2) : digitos;
  })
  .refine((digitos) => /^9\d{8}$/.test(digitos), {
    message: 'Escribe un celular de 9 dígitos que empiece con 9.',
  });

/** Usuario para ingresar: minúsculas, números, punto, guion o guion bajo. */
export const nombreDeUsuarioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,40}$/,
    'El usuario lleva de 3 a 40 letras sin tildes, números, punto o guion.',
  );

const correoOpcional = z.preprocess(
  (valor) => (typeof valor === 'string' && valor.trim() === '' ? undefined : valor),
  z
    .email('Escribe un correo válido o déjalo vacío.')
    .transform((correo) => correo.trim().toLowerCase())
    .optional(),
);

const tiendaNuevaSchema = z.strictObject({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la tienda.').max(120),
  /** Slug de la galería; nulo para un independiente sin galería. */
  galeria: z.string().trim().max(80).nullable(),
  stand: z
    .string()
    .trim()
    .max(20)
    .transform((s) => s || null)
    .nullable()
    .optional(),
  whatsapp: whatsappSchema,
});

/**
 * Crear una cuenta (RF-35, D-42). El dueño y el independiente traen su tienda nueva;
 * el asesor se suma a una tienda que ya existe.
 */
export const crearCuentaSchema = z
  .strictObject({
    tipo: z.enum(['DUENO', 'ASESOR', 'INDEPENDIENTE']),
    tienda: tiendaNuevaSchema.optional(),
    tienda_id: z.uuid('Elige la tienda del asesor.').optional(),
    nombre: z.string().trim().min(2, 'Escribe el nombre de la persona a cargo.').max(120),
    usuario: nombreDeUsuarioSchema,
    correo: correoOpcional,
    /** Del asesor; el dueño y el independiente usan el de su tienda si no se indica. */
    whatsapp: whatsappSchema.optional(),
  })
  .superRefine((cuenta, contexto) => {
    if (cuenta.tipo === 'ASESOR') {
      if (!cuenta.tienda_id) {
        contexto.addIssue({
          code: 'custom',
          path: ['tienda_id'],
          message: 'Elige la tienda del asesor.',
        });
      }
      if (cuenta.tienda) {
        contexto.addIssue({
          code: 'custom',
          path: ['tienda'],
          message: 'Un asesor se suma a una tienda que ya existe.',
        });
      }
      return;
    }
    if (!cuenta.tienda) {
      contexto.addIssue({
        code: 'custom',
        path: ['tienda'],
        message: 'Faltan los datos de la tienda.',
      });
      return;
    }
    if (cuenta.tipo === 'DUENO' && !cuenta.tienda.galeria) {
      contexto.addIssue({
        code: 'custom',
        path: ['tienda', 'galeria'],
        message: 'Una tienda de galería necesita su galería.',
      });
    }
  });

export const filtroCuentasSchema = z.object({
  estado: z.enum(['todas', 'activa', 'sin_primer_ingreso', 'suspendida']).default('todas'),
  galeria: z.string().trim().max(80).optional(),
  q: z.string().trim().max(80).default(''),
});

export const cambiarEstadoCuentaSchema = z.strictObject({
  estado: z.enum(['ACTIVA', 'SUSPENDIDA']),
});

export type CrearCuentaEntrada = z.input<typeof crearCuentaSchema>;
export type CrearCuentaDatos = z.output<typeof crearCuentaSchema>;
export type FiltroCuentas = z.output<typeof filtroCuentasSchema>;
export type CambiarEstadoCuenta = z.infer<typeof cambiarEstadoCuentaSchema>;
