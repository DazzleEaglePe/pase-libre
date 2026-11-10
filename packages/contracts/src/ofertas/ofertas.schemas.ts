import { z } from 'zod';

import { centimosDeMonto } from '../comun/dinero.js';

/** Hasta 8 fotos por oferta y por producto (docs/05 §4.2). */
export const MAX_FOTOS = 8;
export const MAX_DESCRIPCION = 500;

/**
 * Ruta de una foto que devolvió `POST /v1/archivos` («2026/10/<uuid>.webp»). La API
 * comprueba además que la subió alguien de la misma tienda y que no se usó en otra parte.
 */
export const rutaFotoSchema = z
  .string()
  .regex(
    /^\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/,
    'Una de las fotos no es válida; súbela de nuevo.',
  );

const fotosSchema = z
  .array(rutaFotoSchema)
  .max(MAX_FOTOS, `Puedes subir hasta ${MAX_FOTOS} fotos.`)
  .refine((rutas) => new Set(rutas).size === rutas.length, 'Hay una foto repetida.');

/**
 * Monto como lo escribe el vendedor: «250», «1699.90», «1,699.90» o «250,50».
 * Sale en céntimos enteros, o nulo si quedó vacío (precio «al interno» sin monto).
 */
export const montoSchema = z
  .string()
  .trim()
  .max(20)
  .transform((texto, contexto) => {
    if (texto === '') return null;
    const centimos = centimosDeMonto(texto);
    if (centimos === null) {
      contexto.addIssue({
        code: 'custom',
        message: 'Escribe el monto con números, por ejemplo 250 o 1699.90.',
      });
      return z.NEVER;
    }
    return centimos;
  });

const descripcionSchema = z
  .string()
  .trim()
  .max(MAX_DESCRIPCION, `La descripción llega hasta ${MAX_DESCRIPCION} caracteres.`)
  .transform((texto) => texto || null);

const condicionSchema = z.enum(['NUEVO', 'USADO'], 'Elige si es nuevo o usado.');

/** «Estado» de PUB_WebProducto. Sellado y open box cuentan como nuevos en los filtros. */
export const ESTADOS_DETALLE = ['SELLADO', 'OPEN_BOX', 'USADO', 'REACONDICIONADO'] as const;
export const GARANTIAS = [
  'SIN',
  'UN_MES',
  'TRES_MESES',
  'SEIS_MESES',
  'UN_ANIO',
  'FABRICA',
] as const;
/** «¿Cómo lo vendes?»: pase (sin comprobante), facturado (con IGV) o los dos (PS_Precio). */
export const MODOS_VENTA = ['PASE', 'FACTURADO', 'AMBOS'] as const;
/** «¿Quién ve el precio?»: todas las tiendas con sesión, solo tus socios o nadie (por chat). */
export const QUIEN_VE_PRECIO = ['TODOS', 'SOCIOS', 'NADIE'] as const;

/** Nuevo o usado, según el estado que se eligió. */
export const condicionDeEstado = (estado: (typeof ESTADOS_DETALLE)[number]): 'NUEVO' | 'USADO' =>
  estado === 'SELLADO' || estado === 'OPEN_BOX' ? 'NUEVO' : 'USADO';

/** Lo que el lienzo final suma a una publicación: estado, garantía, stock y precios. */
const detalleOferta = {
  estado_detalle: z.enum(ESTADOS_DETALLE, 'Elige el estado.').optional(),
  con_caja: z.boolean().optional(),
  con_factura: z.boolean().optional(),
  probado: z.boolean().optional(),
  garantia: z.enum(GARANTIAS).nullable().optional(),
  en_almacen: z.boolean().optional(),
  modo_venta: z.enum(MODOS_VENTA).optional(),
  precio_facturado: montoSchema.optional(),
  descuento_socio: montoSchema.optional(),
  quien_ve_precio: z.enum(QUIEN_VE_PRECIO).optional(),
  acepta_ofertas: z.boolean().optional(),
};
const monedaSchema = z.enum(['USD', 'PEN'], 'Elige la moneda.');

/**
 * Producto nuevo (RF-05), cuando no está en el catálogo. El título se arma con la marca
 * y el modelo, como en la vista previa del lienzo.
 */
export const productoNuevoSchema = z.strictObject({
  categoria: z.string().trim().min(1, 'Elige la categoría.').max(80),
  marca: z.string().trim().min(1, 'Escribe la marca.').max(60, 'La marca es muy larga.'),
  modelo: z
    .string()
    .trim()
    .min(2, 'Escribe el modelo.')
    .max(120, 'El modelo llega hasta 120 caracteres.'),
  etiquetas: z
    .array(z.string().trim().min(1).max(40, 'Cada etiqueta llega hasta 40 caracteres.'))
    .max(12, 'Pon hasta 12 etiquetas.')
    .default([]),
  fotos: fotosSchema.default([]),
});

/**
 * `POST /v1/ofertas` (RF-05, RF-06, RF-53). Lleva `producto_id` para «Publicar uno igual»
 * o `producto_nuevo`; nunca los dos. Si no llegan la moneda o la visibilidad, se usan los
 * valores por defecto de la tienda (D-37).
 */
export const publicarSchema = z
  .strictObject({
    producto_id: z.uuid('Elige un producto del catálogo.').optional(),
    producto_nuevo: productoNuevoSchema.optional(),
    /** Si no llega, sale del estado (`estado_detalle`). */
    condicion: condicionSchema.optional(),
    ...detalleOferta,
    stock: z
      .number('Escribe la cantidad disponible.')
      .int('La cantidad va sin decimales.')
      .min(1, 'La cantidad debe ser al menos 1.')
      .max(9999, 'La cantidad llega hasta 9999.'),
    moneda: monedaSchema.optional(),
    precio: montoSchema.default(null),
    precio_visible: z.boolean().optional(),
    tienda_visible: z.boolean().optional(),
    descripcion: descripcionSchema.default(null),
    fotos: fotosSchema.default([]),
  })
  .superRefine((oferta, contexto) => {
    if (!oferta.producto_id === !oferta.producto_nuevo) {
      contexto.addIssue({
        code: 'custom',
        path: ['producto_id'],
        message: 'Elige un producto del catálogo o crea uno nuevo para publicar.',
      });
    }
    if (!oferta.condicion && !oferta.estado_detalle) {
      contexto.addIssue({ code: 'custom', path: ['estado_detalle'], message: 'Elige el estado.' });
    }
    const conMonto = oferta.precio !== null || (oferta.precio_facturado ?? null) !== null;
    if ((oferta.precio_visible || oferta.quien_ve_precio === 'TODOS') && !conMonto) {
      contexto.addIssue({
        code: 'custom',
        path: ['precio'],
        message: 'Para mostrar el precio, escribe el monto.',
      });
    }
    if (oferta.modo_venta && oferta.modo_venta !== 'PASE' && !oferta.precio_facturado) {
      contexto.addIssue({
        code: 'custom',
        path: ['precio_facturado'],
        message: 'Escribe el precio facturado, con IGV.',
      });
    }
    if (
      oferta.descuento_socio &&
      oferta.precio !== null &&
      oferta.descuento_socio >= oferta.precio
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['descuento_socio'],
        message: 'Lo que les bajas a tus socios tiene que ser menos que el precio.',
      });
    }
  });

/**
 * `PATCH /v1/ofertas/:id` (RF-06, RF-08, RF-09): solo lo que cambia. `fotos` reemplaza
 * la lista completa, en el orden en que llega.
 */
export const editarOfertaSchema = z
  .strictObject({
    condicion: condicionSchema.optional(),
    ...detalleOferta,
    stock: z
      .number('Escribe la cantidad disponible.')
      .int('La cantidad va sin decimales.')
      .min(0, 'La cantidad no puede ser negativa.')
      .max(9999, 'La cantidad llega hasta 9999.')
      .optional(),
    moneda: monedaSchema.optional(),
    precio: montoSchema.optional(),
    precio_visible: z.boolean().optional(),
    tienda_visible: z.boolean().optional(),
    descripcion: descripcionSchema.optional(),
    fotos: fotosSchema.optional(),
    estado: z.enum(['ACTIVA', 'PAUSADA']).optional(),
  })
  .refine((cambios) => Object.keys(cambios).length > 0, 'No hay nada que cambiar.');

export const misOfertasSchema = z.object({
  estado: z.enum(['activas', 'sin_stock', 'pausadas', 'todas']).default('activas'),
  q: z.string().trim().max(80).default(''),
  pagina: z.coerce.number().int().min(1).max(200).default(1),
});

/** «Siguen igual» (RF-10): sin `ids`, confirma todas las que piden revisión. */
export const confirmarOfertasSchema = z.strictObject({
  ids: z.array(z.uuid()).max(500).optional(),
});

/**
 * `GET /v1/catalogo/sugerencias` (RF-53): «Ya está en PaseLibre» mientras se escribe,
 * o un solo producto con `producto=<slug>` para «Publicar uno igual» desde la ficha.
 */
export const sugerenciasSchema = z
  .object({
    q: z.string().trim().max(100).default(''),
    producto: z.string().trim().max(220).optional(),
  })
  .refine((consulta) => consulta.q !== '' || consulta.producto, 'Escribe qué vas a publicar.');

export type PublicarEntrada = z.input<typeof publicarSchema>;
export type PublicarDatos = z.output<typeof publicarSchema>;
export type ProductoNuevoDatos = z.output<typeof productoNuevoSchema>;
export type EditarOfertaEntrada = z.input<typeof editarOfertaSchema>;
export type EditarOfertaDatos = z.output<typeof editarOfertaSchema>;
export type MisOfertasConsulta = z.output<typeof misOfertasSchema>;
export type ConfirmarOfertas = z.output<typeof confirmarOfertasSchema>;
export type SugerenciasConsulta = z.output<typeof sugerenciasSchema>;
