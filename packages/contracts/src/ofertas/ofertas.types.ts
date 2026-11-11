import type { Precio } from '../comun/dinero.js';
import type { Condicion, Foto } from '../catalogo/catalogo.types.js';
import type { TiendaDeSesion } from '../sesion/sesion.types.js';

/** Las fotos se sirven en `/media/<ruta>` (nginx en producción, la API en local). */
export function urlFoto(ruta: string): string {
  return `/media/${ruta}`;
}

/** Respuesta de `POST /v1/archivos`: la foto ya revisada, sin metadatos y en WebP. */
export interface ArchivoSubido {
  ruta: string;
  ancho: number;
  alto: number;
}

/** Lo que hace falta de un producto para elegirlo al publicar y para listar ofertas. */
export interface ProductoResumen {
  id: string;
  slug: string;
  titulo: string;
  categoria: { slug: string; nombre: string };
  marca: string | null;
  /** Unas pocas, para la línea «Gráficas · MSI · 8 GB GDDR6». */
  etiquetas: string[];
  /** Ruta de la primera foto base, o nula si el producto no tiene fotos. */
  foto: string | null;
  /** Cuántas fotos base tiene: «Usas sus 4 fotos». */
  fotos: number;
}

export type EstadoOfertaPropia = 'ACTIVA' | 'PAUSADA';

/** «Ya está en PaseLibre» (RF-53). */
export interface SugerenciaProducto extends ProductoResumen {
  /** Ofertas vigentes de todas las tiendas: «4 ofertas». */
  ofertas: number;
  /** Las de tu tienda sobre este producto, para no publicarlo dos veces. */
  propias: Array<{ id: string; condicion: Condicion; estado: EstadoOfertaPropia }>;
}

export interface RespuestaSugerencias {
  correccion: { buscaste: string; mostramos: string } | null;
  productos: SugerenciaProducto[];
}

/** Una oferta vista por su propia tienda: con su precio aunque esté al interno. */
export interface OfertaPropia {
  id: string;
  producto: ProductoResumen;
  condicion: Condicion;
  stock: number;
  /** Nulo si se publicó sin monto. */
  precio: Precio | null;
  moneda: Precio['moneda'];
  precio_visible: boolean;
  /** «Mostrar el nombre de mi tienda»: apagado, las demás tiendas ven «Tienda reservada». */
  tienda_visible: boolean;
  detalle: DetalleOferta;
  modo_venta: ModoVenta;
  precio_facturado: Precio | null;
  /** Cuánto menos ven tus socios; nulo sin precio socio. */
  descuento_socio: Precio | null;
  quien_ve_precio: QuienVePrecio;
  acepta_ofertas: boolean;
  /** Contactos por chat o WhatsApp en los últimos 7 días (solo en Mis publicaciones). */
  chats_semana: number;
  /** Tiendas que la vieron en la ficha en los últimos 7 días, una vez por día (MP_Web). */
  vistas_semana: number;
  /** «¿Por qué la pausas?»: nulo si está activa o se pausó sin decir. */
  razon_pausa: string | null;
  descripcion: string | null;
  fotos: Foto[];
  estado: EstadoOfertaPropia;
  actualizada_en: string;
  /** Activa y sin cambios hace más de 7 días: «Revísala» (RF-10). */
  revisar: boolean;
  /** Quien recibe los mensajes de esta oferta (A-11). */
  responsable: { id: string; nombre: string };
}

/**
 * `activas`: con stock; `vigentes`: activas con o sin stock (la pestaña «Activas» de MP_Web,
 * que avisa en la fila cuando no hay stock).
 */
export type PestanaMisOfertas = 'activas' | 'vigentes' | 'sin_stock' | 'pausadas' | 'todas';

/** `GET /v1/mis-ofertas` (RF-08, RF-10): las ofertas de la tienda de la sesión. */
export interface RespuestaMisOfertas {
  tienda: TiendaDeSesion;
  /** Por pestaña, sin contar el texto buscado. */
  conteos: Record<PestanaMisOfertas, number>;
  por_revisar: number;
  /** Las vistas de la semana de todas las publicaciones activas: «107 vistas esta semana». */
  vistas_semana: number;
  ofertas: OfertaPropia[];
  pagina: number;
  paginas: number;
}

/** `POST /v1/ofertas`. */
export interface RespuestaPublicar {
  oferta: OfertaPropia;
  /** Otras ofertas vigentes del mismo producto: «junto a otras 4». */
  otras_ofertas: number;
  producto_nuevo: boolean;
}

export interface RespuestaConfirmar {
  confirmadas: number;
}

export type EstadoDetalle = 'SELLADO' | 'OPEN_BOX' | 'USADO' | 'REACONDICIONADO' | 'OTRO';
export type Garantia =
  'SIN' | 'UN_MES' | 'TRES_MESES' | 'SEIS_MESES' | 'UN_ANIO' | 'FABRICA' | 'OTRA';
export type ModoVenta = 'PASE' | 'FACTURADO' | 'AMBOS';

/** «Pase», «Facturado» o «Pase y facturado», como lo dicen las filas del lienzo. */
export const TEXTO_MODO_VENTA: Record<ModoVenta, string> = {
  PASE: 'Pase',
  FACTURADO: 'Facturado',
  AMBOS: 'Pase y facturado',
};
export type QuienVePrecio = 'TODOS' | 'SOCIOS' | 'NADIE';

/** Lo que cuenta cómo está el producto (PUB_WebProducto): lo ve cualquiera, no es privado. */
export interface DetalleOferta {
  estado: EstadoDetalle;
  con_caja: boolean;
  con_factura: boolean;
  probado: boolean;
  garantia: Garantia | null;
  /** El texto de «Otro» en el estado (COR9), o nulo. */
  estado_otro: string | null;
  /** El texto de «Otro» en la garantía (COR9), o nulo. */
  garantia_otra: string | null;
  /** «En almacén · ~30 min». */
  en_almacen: boolean;
}

export const TEXTO_ESTADO_DETALLE: Record<EstadoDetalle, string> = {
  SELLADO: 'Nuevo sellado',
  OPEN_BOX: 'Open box',
  USADO: 'Usado',
  REACONDICIONADO: 'Reacondicionado',
  OTRO: 'Otro estado',
};

export const TEXTO_GARANTIA: Record<Garantia, string> = {
  SIN: 'Sin garantía',
  UN_MES: 'Garantía 1 mes',
  TRES_MESES: 'Garantía 3 meses',
  SEIS_MESES: 'Garantía 6 meses',
  UN_ANIO: 'Garantía 1 año',
  FABRICA: 'Garantía de fábrica',
  OTRA: 'Con garantía',
};

/** «Nuevo sellado», o lo que escribió quien publica con «Otro» (COR9). */
export function textoEstadoDetalle(detalle: Pick<DetalleOferta, 'estado' | 'estado_otro'>): string {
  return detalle.estado === 'OTRO' && detalle.estado_otro
    ? detalle.estado_otro
    : TEXTO_ESTADO_DETALLE[detalle.estado];
}

/** «Garantía 1 año», o «Garantía 2 años» si la escribió con «Otro» (COR9). */
export function textoGarantia(
  detalle: Pick<DetalleOferta, 'garantia' | 'garantia_otra'>,
): string | null {
  if (!detalle.garantia) return null;
  return detalle.garantia === 'OTRA' && detalle.garantia_otra
    ? `Garantía ${detalle.garantia_otra}`
    : TEXTO_GARANTIA[detalle.garantia];
}
