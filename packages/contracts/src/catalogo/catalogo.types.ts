import type { Precio } from '../comun/dinero.js';
import type { TipoTienda } from '../sesion/sesion.types.js';

/**
 * Quién mira (docs/05 §5). Cada respuesta del catálogo dice para qué audiencia se armó:
 * - `visitante`: sin precio, tienda, stand ni WhatsApp.
 * - `vendedor`: con tienda, stand y los precios visibles; ve su propio precio oculto.
 * - `equipo`: como el vendedor, y además los precios ocultos de todos.
 */
export type Audiencia = 'visitante' | 'vendedor' | 'equipo';
export type Condicion = 'NUEVO' | 'USADO';

export interface CategoriaResumen {
  slug: string;
  nombre: string;
  /** Productos con al menos una oferta vigente. */
  productos: number;
}

export interface GaleriaResumen {
  /** `independientes` agrupa a quienes no tienen galería. */
  slug: string;
  nombre: string;
  /** Ofertas vigentes en esa galería. */
  ofertas: number;
}

export interface Faceta {
  slug: string;
  nombre: string;
  cantidad: number;
}

// ── Listas (búsqueda) ───────────────────────────────────────────────────────

export interface ResumenOfertas {
  cantidad: number;
  galerias: string[];
  condiciones: Condicion[];
  stock_total: number;
  actualizada_en: string;
}

/** Solo con sesión: el menor precio visible por moneda y cuántas ofertas están al interno. */
export interface ResumenPrecios {
  precios_desde: Precio[];
  al_interno: number;
}

export interface ProductoEnLista {
  slug: string;
  titulo: string;
  categoria: { slug: string; nombre: string };
  marca: string | null;
  foto: string | null;
  ofertas: ResumenOfertas;
}

export interface ProductoEnListaConPrecio extends Omit<ProductoEnLista, 'ofertas'> {
  ofertas: ResumenOfertas & ResumenPrecios;
}

interface BaseBusqueda {
  /** Presente cuando se corrigió la búsqueda: «Mostramos resultados para … Buscaste …». */
  correccion: { buscaste: string; mostramos: string } | null;
  total_productos: number;
  total_ofertas: number;
  pagina: number;
  paginas: number;
  facetas: {
    galerias: Faceta[];
    marcas: Faceta[];
    condiciones: Faceta[];
    con_stock: number;
  };
}

export type RespuestaBuscar =
  | (BaseBusqueda & { audiencia: 'visitante'; productos: ProductoEnLista[] })
  | (BaseBusqueda & { audiencia: 'vendedor' | 'equipo'; productos: ProductoEnListaConPrecio[] });

// ── Ficha ───────────────────────────────────────────────────────────────────

export interface Foto {
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

export interface OfertaPublica {
  id: string;
  condicion: Condicion;
  stock: number;
  /** Nombre de la galería, o nulo para un independiente sin galería. */
  galeria: string | null;
  tipo_vendedor: TipoTienda;
  descripcion: string | null;
  fotos: Foto[];
  actualizada_en: string;
}

export interface OfertaConVendedor extends OfertaPublica {
  tienda: { id: string; nombre: string; stand: string | null };
  /** Nulo si el precio está al interno (o no tiene monto). La tienda dueña y el equipo sí lo ven. */
  precio: Precio | null;
  precio_visible: boolean;
  propia: boolean;
}

export interface ProductoDetalle {
  id: string;
  slug: string;
  titulo: string;
  modelo: string | null;
  categoria: { slug: string; nombre: string };
  marca: string | null;
  etiquetas: string[];
  caracteristicas: Record<string, string>;
  fotos: Foto[];
}

/**
 * `GET /v1/productos/:slug`. Para el visitante las ofertas van de la más reciente a la
 * más antigua (ordenarlas por precio delataría el precio); con sesión, de menor a mayor
 * precio y las ofertas al interno al final.
 */
export type RespuestaFicha =
  | { audiencia: 'visitante'; producto: ProductoDetalle; ofertas: OfertaPublica[] }
  | { audiencia: 'vendedor' | 'equipo'; producto: ProductoDetalle; ofertas: OfertaConVendedor[] };

/** Cuando el producto se unió a otro (RF-54), la API responde 301 con esto. */
export interface RespuestaRedireccion {
  redirigir_a: string;
}

// ── Portada ─────────────────────────────────────────────────────────────────

export interface TarjetaOferta {
  oferta_id: string;
  producto: {
    slug: string;
    titulo: string;
    categoria: { slug: string; nombre: string };
    foto: string | null;
  };
  condicion: Condicion;
  stock: number;
  galeria: string | null;
  actualizada_en: string;
}

export interface TarjetaOfertaConVendedor extends TarjetaOferta {
  tienda: { nombre: string; stand: string | null };
  /** Nulo si está al interno, salvo para la tienda dueña y el equipo. */
  precio: Precio | null;
  precio_visible: boolean;
  propia: boolean;
}

interface BasePortada {
  categorias: CategoriaResumen[];
  galerias: GaleriaResumen[];
  totales: { productos: number; tiendas: number; galerias: number };
}

export type RespuestaPortada =
  | (BasePortada & { audiencia: 'visitante'; recien_publicado: TarjetaOferta[] })
  | (BasePortada & {
      audiencia: 'vendedor' | 'equipo';
      recien_publicado: TarjetaOfertaConVendedor[];
    });
