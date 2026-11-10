import type { Precio } from '../comun/dinero.js';
import type { DetalleOferta, ModoVenta } from '../ofertas/ofertas.types.js';
import type { TipoTienda } from '../sesion/sesion.types.js';

/**
 * Quién mira (docs/05 §5). Cada respuesta del catálogo dice para qué audiencia se armó:
 * - `visitante`: sin precio, tienda, stand ni WhatsApp.
 * - `vendedor`: con tienda, stand y los precios visibles; ve su propio precio oculto.
 * - `equipo`: como el vendedor, y además los precios ocultos de todos.
 */
export type Audiencia = 'visitante' | 'vendedor' | 'equipo';

/**
 * Lo que ven las demás tiendas cuando una oferta no muestra el nombre de su tienda
 * (`tienda_visible` apagado): ni nombre, ni stand, ni WhatsApp. La galería sí se ve.
 */
export const TIENDA_RESERVADA = 'Tienda reservada';
export type Condicion = 'NUEVO' | 'USADO';

export interface CategoriaResumen {
  slug: string;
  nombre: string;
  /** El grupo del menú «Todas las categorías»: Componentes, Equipos, Periféricos… */
  grupo: string | null;
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

/**
 * Solo con sesión: la oferta que la tarjeta pone al frente, para comparar y escribir sin abrir
 * la ficha. Es la más barata con stock; si ninguna tiene precio visible, la más reciente.
 */
export interface OfertaDestacada {
  id: string;
  condicion: Condicion;
  stock: number;
  /** Nombre de la galería, o «Independientes». */
  galeria: string;
  /** Nulo si está al interno: aquí no se cuenta ni el precio oculto de la tienda dueña. */
  precio: Precio | null;
  /** Con la tienda reservada: «Tienda reservada» y sin stand (salvo para la dueña y el equipo). */
  tienda: { nombre: string; stand: string | null };
  tienda_visible: boolean;
  propia: boolean;
  /**
   * La más barata de todos los resultados con stock (de cualquier página). Compara en
   * dólares con el tipo de cambio de la API; el precio que se muestra no se convierte.
   */
  mas_barata: boolean;
}

export interface ProductoEnListaConPrecio extends Omit<ProductoEnLista, 'ofertas'> {
  ofertas: ResumenOfertas & ResumenPrecios;
  oferta_destacada: OfertaDestacada;
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
    /**
     * En qué categorías hay resultados para lo escrito, sin contar el filtro de categoría:
     * las tarjetas de arriba de los resultados. Aquí `cantidad` son productos, no ofertas.
     */
    categorias: Faceta[];
  };
}

export type RespuestaBuscar =
  | (BaseBusqueda & {
      audiencia: 'visitante';
      productos: ProductoEnLista[];
      /** Sin resultados: «Parecidas que sí hay» (EV_WebRes), con menos palabras. */
      parecidas: ProductoEnLista[];
    })
  | (BaseBusqueda & {
      audiencia: 'vendedor' | 'equipo';
      productos: ProductoEnListaConPrecio[];
      parecidas: ProductoEnListaConPrecio[];
    });

// ── Ficha ───────────────────────────────────────────────────────────────────

export interface Foto {
  ruta: string;
  ancho: number | null;
  alto: number | null;
}

export interface OfertaPublica {
  id: string;
  condicion: Condicion;
  /** Estado, garantía, caja… (PUB_WebProducto): no es privado. */
  detalle: DetalleOferta;
  stock: number;
  /** Nombre de la galería, o nulo para un independiente sin galería. */
  galeria: string | null;
  tipo_vendedor: TipoTienda;
  descripcion: string | null;
  fotos: Foto[];
  actualizada_en: string;
}

export interface OfertaConVendedor extends OfertaPublica {
  /** Con la tienda reservada: `id` vacío, «Tienda reservada» y sin stand (salvo para la dueña y el equipo). */
  tienda: { id: string; nombre: string; stand: string | null };
  tienda_visible: boolean;
  modo_venta: ModoVenta;
  /** El precio con factura e IGV, con las mismas reglas que el precio de pase. */
  precio_facturado: Precio | null;
  /** El precio que ves es el de socio: la tienda te tiene como socia (PS_Precio). */
  precio_socio: boolean;
  /** Cuánto menos te sale por ser socia (para tachar el precio de siempre); nulo si no. */
  descuento_socio: Precio | null;
  /** El precio solo lo ven sus socios: para las demás es «Precio por chat» (PS_Precio). */
  solo_socios: boolean;
  acepta_ofertas: boolean;
  /**
   * Cuánto tarda la tienda, en minutos, en contestar el primer mensaje de un hilo (la mediana
   * de los últimos 60 días). Nulo con menos de 3 hilos contestados, o con la tienda reservada.
   */
  responde_en_min: number | null;
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

/**
 * `GET /v1/buscar/sugerencias`: hasta 5 productos para el desplegable del buscador, con la
 * misma búsqueda tolerante (y su corrección) pero sin precios ni tiendas, aunque haya sesión.
 */
export interface RespuestaSugerenciasBusqueda {
  correccion: { buscaste: string; mostramos: string } | null;
  total_productos: number;
  productos: ProductoEnLista[];
}

/**
 * `GET /v1/buscar/populares`: «Lo más buscado» del buscador. Búsquedas de los últimos 30
 * días que encontraron algo y se repitieron, ya normalizadas.
 */
export interface RespuestaMasBuscado {
  terminos: string[];
}

/**
 * `GET /v1/barra`: los numeritos de la barra de arriba (D_Barra) y del menú «Todas las
 * categorías» (CAT_Web1) que no salen de Pedidos en vivo. Igual para todos: sin precios.
 */
export interface RespuestaBarra {
  /** Ofertas vigentes publicadas hoy (hora de Lima): «Recién llegados +N hoy». */
  recien_hoy: number;
  /** «Lo más buscado hoy»; si hoy se buscó poco, lo de los últimos 30 días. */
  mas_buscado: string[];
  /** Si `mas_buscado` es de hoy. */
  mas_buscado_hoy: boolean;
  /** Pedidos en vivo encendido (`EN_VIVO`): la barra muestra sus entradas desde el servidor. */
  en_vivo: boolean;
}

/**
 * `GET /v1/mapa-del-sitio`: los productos que ve un visitante, para el `sitemap.xml` de la
 * web (RNF-42). La fecha es la de su oferta vigente más reciente.
 */
export interface RespuestaMapaDelSitio {
  productos: Array<{ slug: string; actualizado_en: string }>;
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
  tienda_visible: boolean;
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
