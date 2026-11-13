import type { Precio } from '../comun/dinero.js';
import type { Condicion, Correccion, Foto } from '../catalogo/catalogo.types.js';
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
  /**
   * Lo que dice el catálogo de una memoria RAM (docs/19 §13): con él, «¿Para qué procesador es?»
   * viene marcado al publicar. Nulo si no se sabe.
   */
  perfil_memoria: PerfilMemoria | null;
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
  /** Lo entendido o corregido, como en la barra de arriba (doc 20 §11: un solo buscador). */
  correccion: Correccion | null;
  /** «No hay uno igual. Lo más parecido:». */
  lo_mas_parecido: boolean;
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
  /** «Impulsada por el equipo» (COR16): destacada hasta esa hora. Solo la ve la tienda. */
  impulsada_hasta?: string | null;
  modo_venta: ModoVenta;
  precio_facturado: Precio | null;
  /** Cuánto menos ven tus socios; nulo sin precio socio. */
  descuento_socio: Precio | null;
  quien_ve_precio: QuienVePrecio;
  acepta_ofertas: boolean;
  /** «Precio fijo ▾ / Negociable» (N06). */
  negociable: boolean;
  /** Contactos por chat o WhatsApp en los últimos 7 días (solo en Mis publicaciones). */
  chats_semana: number;
  /** Tiendas que la vieron en la ficha en los últimos 7 días, una vez por día (MP_Web). */
  vistas_semana: number;
  /** «¿Por qué la pausas?»: nulo si está activa o se pausó sin decir. */
  razon_pausa: string | null;
  descripcion: string | null;
  fotos: Foto[];
  /**
   * La portada que eligió la tienda (docs/17 §5): la ruta de una de sus `fotos`, o nula si usa
   * la de siempre. La que se ve en el feed sale de `portadaDeOferta`.
   */
  portada: string | null;
  estado: EstadoOfertaPropia;
  actualizada_en: string;
  /** Activa y sin cambios hace más de 7 días: «Revísala» (RF-10). */
  revisar: boolean;
  /** Quien recibe los mensajes de esta oferta (A-11). */
  responsable: { id: string; nombre: string };
}

/**
 * La foto con la que sale una oferta en el feed, los resultados y el chat (docs/17 §5): la que
 * eligió la tienda; si no eligió, la primera del producto, y si el producto no tiene fotos, la
 * primera de la tienda. Nula sin ninguna (se dibuja la categoría). La API hace lo mismo.
 */
export function portadaDeOferta(
  oferta: Pick<OfertaPropia, 'portada' | 'fotos'> & { producto: Pick<ProductoResumen, 'foto'> },
): string | null {
  return oferta.portada ?? oferta.producto.foto ?? oferta.fotos[0]?.ruta ?? null;
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
  /** Con texto: lo entendido o corregido (doc 20 §11: un solo buscador). */
  correccion: Correccion | null;
  /** «No hay uno igual. Lo más parecido:». */
  lo_mas_parecido: boolean;
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

/** `POST /v1/ofertas/eliminar` (docs/19 §12). */
export interface RespuestaEliminarOfertas {
  eliminadas: number;
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

export type PerfilMemoria = 'XMP' | 'EXPO' | 'AMBOS';
export type Empaque = 'CAJA' | 'OEM';

/**
 * Lo que se marca al publicar según la categoría (docs/19 §13): para qué procesador es una RAM,
 * el empaque y si una tarjeta de video es OC. Nulo, sin marcar. Lo ve cualquiera.
 */
export interface VariantesOferta {
  perfil_memoria: PerfilMemoria | null;
  empaque: Empaque | null;
  oc: boolean | null;
}

/** Lo que cuenta cómo está el producto (PUB_WebProducto): lo ve cualquiera, no es privado. */
export interface DetalleOferta extends VariantesOferta {
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

// ── Para qué procesador es y el empaque (docs/19 §13) ──────────────────────

/**
 * Qué se pregunta al publicar en cada categoría (docs/19 §13): RAM, para qué procesador es y el
 * empaque; tarjetas de video, OC o normal y el empaque; almacenamiento, el empaque; procesadores,
 * Box o Tray. Las demás categorías no preguntan nada.
 */
export interface PreguntasDeCategoria {
  procesador: boolean;
  oc: boolean;
  /** `BOX_TRAY` en los procesadores: «Box (con caja)» o «Tray (OEM)». */
  empaque: 'CAJA_OEM' | 'BOX_TRAY' | null;
}

export function preguntasDeCategoria(categoria: string | null | undefined): PreguntasDeCategoria {
  switch (categoria) {
    case 'ram':
      return { procesador: true, oc: false, empaque: 'CAJA_OEM' };
    case 'graficas':
      return { procesador: false, oc: true, empaque: 'CAJA_OEM' };
    case 'almacenamiento':
      return { procesador: false, oc: false, empaque: 'CAJA_OEM' };
    case 'procesadores':
      return { procesador: false, oc: false, empaque: 'BOX_TRAY' };
    default:
      return { procesador: false, oc: false, empaque: null };
  }
}

/** Lo que una categoría no pregunta queda nulo: así una RAM no guarda «OC» por error. */
export function variantesDeCategoria(
  categoria: string | null | undefined,
  variantes: VariantesOferta,
): VariantesOferta {
  const preguntas = preguntasDeCategoria(categoria);
  return {
    perfil_memoria: preguntas.procesador ? variantes.perfil_memoria : null,
    empaque: preguntas.empaque ? variantes.empaque : null,
    oc: preguntas.oc ? variantes.oc : null,
  };
}

/**
 * El color de cada pastilla del título: Intel XMP en azul `#1d5fd1`, EXPO Ryzen en naranja
 * `#e8590c` (el color de AMD), OEM sin caja en gris `#6b7872`. Lo demás (OC) va solo en negrita.
 */
export type TonoPastilla = 'intel' | 'ryzen' | 'oem' | 'negrita';

export interface PastillaVariante {
  texto: string;
  tono: TonoPastilla;
}

/**
 * Las pastillas que van pegadas al final del título (docs/19 §13), en la tarjeta, la ficha y la
 * vista previa. «Sirve para los dos» lleva las dos. «OC» no se repite si el título ya lo dice.
 */
export function pastillasDeVariantes(
  variantes: Partial<VariantesOferta> | null | undefined,
  titulo = '',
): PastillaVariante[] {
  if (!variantes) return [];
  const pastillas: PastillaVariante[] = [];
  const perfil = variantes.perfil_memoria;
  if (perfil === 'XMP' || perfil === 'AMBOS') pastillas.push({ texto: 'Intel XMP', tono: 'intel' });
  if (perfil === 'EXPO' || perfil === 'AMBOS') {
    pastillas.push({ texto: 'EXPO Ryzen', tono: 'ryzen' });
  }
  if (variantes.oc === true && !/(^|[^a-z0-9])oc($|[^a-z0-9])/i.test(titulo)) {
    pastillas.push({ texto: 'OC', tono: 'negrita' });
  }
  if (variantes.empaque === 'OEM') pastillas.push({ texto: 'OEM sin caja', tono: 'oem' });
  return pastillas;
}

/**
 * «Perfil de memoria» en Características (docs/19 §13): «Intel XMP 2.0 · para placas Intel». Las
 * DDR5 usan XMP 3.0.
 */
export function textoPerfilMemoria(perfil: PerfilMemoria, titulo = ''): string {
  switch (perfil) {
    case 'XMP':
      return `Intel XMP ${/ddr\s*5/i.test(titulo) ? '3.0' : '2.0'} · para placas Intel`;
    case 'EXPO':
      return 'AMD EXPO · para placas AMD Ryzen';
    case 'AMBOS':
      return 'Intel XMP y AMD EXPO · sirve para los dos';
  }
}

/** «Empaque» en Características: «Con caja», «OEM · sin caja»; en procesadores, Box o Tray. */
export function textoEmpaque(empaque: Empaque, categoria: string | null | undefined): string {
  if (categoria === 'procesadores') return empaque === 'CAJA' ? 'Box (con caja)' : 'Tray (OEM)';
  return empaque === 'CAJA' ? 'Con caja' : 'OEM · sin caja';
}
