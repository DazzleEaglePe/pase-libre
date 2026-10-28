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
  descripcion: string | null;
  fotos: Foto[];
  estado: EstadoOfertaPropia;
  actualizada_en: string;
  /** Activa y sin cambios hace más de 7 días: «Revísala» (RF-10). */
  revisar: boolean;
  /** Quien recibe los mensajes de esta oferta (A-11). */
  responsable: { id: string; nombre: string };
}

export type PestanaMisOfertas = 'activas' | 'sin_stock' | 'pausadas' | 'todas';

/** `GET /v1/mis-ofertas` (RF-08, RF-10): las ofertas de la tienda de la sesión. */
export interface RespuestaMisOfertas {
  tienda: TiendaDeSesion;
  /** Por pestaña, sin contar el texto buscado. */
  conteos: Record<PestanaMisOfertas, number>;
  por_revisar: number;
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
