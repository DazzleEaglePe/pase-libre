import type { Precio } from '../comun/dinero.js';
import type {
  DetalleOferta,
  ModoVenta,
  PerfilMemoria,
  VariantesOferta,
} from '../ofertas/ofertas.types.js';
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
/** Lo que ve en el chat la otra tienda cuando una tienda se eliminó para siempre (doc 19 §9). */
export const TIENDA_ELIMINADA = 'Tienda eliminada';
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
  /** La burbujita «Socio» del precio (N06), si la búsqueda la manda. */
  precio_socio?: boolean;
  /** La burbujita «Negociable» (N06), si la búsqueda la manda. */
  negociable?: boolean;
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

/** Lo que se entendió de lo escrito (BUS_Web, sección 6 del lienzo final). */
export interface Correccion {
  buscaste: string;
  mostramos: string;
  /** La categoría que se eligió por una palabra («gráfica»): «en Tarjetas de video». */
  categoria?: { slug: string; nombre: string } | null;
}

interface BaseBusqueda {
  /**
   * Presente cuando se entendió o corrigió lo escrito: «Mostrando resultados para gigabyte 3060
   * en Tarjetas de video · Buscar «gigabte treinta sesenta» tal cual» (BUS_Web).
   */
  correccion: Correccion | null;
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
  /**
   * Con la tienda reservada: `id` vacío, «Tienda reservada», sin stand ni logo (salvo para la
   * dueña y el equipo). `logo` es la ruta (`urlFoto`); sin él, las iniciales.
   */
  tienda: { id: string; nombre: string; stand: string | null; logo: string | null };
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
  /** «Negociable» al lado del precio (N06). */
  negociable: boolean;
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
  /** Lo que dice el catálogo de una memoria RAM (docs/19 §13); nulo si no se sabe. */
  perfil_memoria: PerfilMemoria | null;
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
  correccion: Correccion | null;
  total_productos: number;
  /** Con sesión, con «desde US$ 285 · 6 tiendas» (BUS_WebSug). */
  productos: Array<ProductoEnLista | ProductoEnListaConPrecio>;
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
  /** Las pastillas del título (docs/19 §13): Intel XMP, EXPO Ryzen, OEM, OC. */
  variantes?: VariantesOferta;
}

export interface TarjetaOfertaConVendedor extends TarjetaOferta {
  tienda: { nombre: string; stand: string | null };
  tienda_visible: boolean;
  /** Nulo si está al interno, salvo para la tienda dueña y el equipo. */
  precio: Precio | null;
  precio_visible: boolean;
  propia: boolean;
  /**
   * La burbujita del precio (N06): el precio que ves es de socio (con descuento, o de «Solo mis
   * socios»). Con precio y sin esto, «Pase»; sin precio, «Por chat».
   */
  precio_socio: boolean;
  /** «Pase + Negociable» (N06): el precio se puede conversar. Falso sin precio a la vista. */
  negociable: boolean;
}

interface BasePortada {
  categorias: CategoriaResumen[];
  galerias: GaleriaResumen[];
  totales: { productos: number; tiendas: number; galerias: number };
}

/**
 * El inicio de una tienda «crece solo» (FI_Web, FI_WebPocas, FI_WebNormal y SG_WebFeed, sección 5
 * del lienzo final): según cuánto hay publicado en la galería, muestra una cosa u otra.
 */
export type FaseInicio = 'DIA_1' | 'POCAS' | 'NORMAL';

/**
 * Las chapitas del Inicio (doc 20, punto 22), en su orden de prioridad: cada tarjeta lleva una
 * sola, la primera que le toque.
 * - `RECIEN`: «Recién publicado», publicada hace 20 minutos o menos.
 * - `MAS_BARATO`: «Más barato de la galería», el precio de pase más bajo de ese producto en su
 *   galería (con al menos 2 ofertas).
 * - `MUY_BUSCADO`: «Muy buscado hoy», el producto está entre los 10 más buscados de hoy.
 * - `BAJO`: «Bajó S/ 40», bajó de precio en las últimas 48 h.
 */
export const CHAPITAS_INICIO = ['RECIEN', 'MAS_BARATO', 'MUY_BUSCADO', 'BAJO'] as const;
export type ChapitaInicio = (typeof CHAPITAS_INICIO)[number];

/** Una tarjeta del Inicio: la de siempre, con su chapita (doc 20, punto 22). */
export interface TarjetaInicio extends TarjetaOfertaConVendedor {
  chapita: ChapitaInicio | null;
  /** Con `BAJO`: cuánto bajó, en céntimos de la moneda de su precio («Bajó S/ 40»). */
  bajo_centimos: number | null;
}

/** `GET /v1/inicio`: lo que solo ve una tienda en su inicio. */
export interface RespuestaInicio {
  /** DIA_1: nadie más publicó; POCAS: menos de 12 publicaciones de otras tiendas. */
  fase: FaseInicio;
  /** «De tiendas que sigues»: lo último de las que sigues (hasta 4) y sus nombres. */
  de_seguidas: { tiendas: string[]; ofertas: TarjetaOfertaConVendedor[] };
  /**
   * «Lo que más se pide en la galería»: lo más buscado en 30 días que tu tienda aún no
   * publica. `producto` es el slug si ya está en el catálogo («¿Lo tienes? Publícalo»).
   */
  mas_pedido: Array<{ texto: string; categoria: string | null; producto: string | null }>;
  /**
   * «Tiendas que ya están» (sin la tuya ni las que bloqueaste) y «5 de 20 tiendas ya
   * entraron». Una tienda con todo en reservado cuenta, pero no se muestra.
   */
  tiendas: {
    /** `logo`: la ruta (`urlFoto`); sin él, las iniciales. */
    visibles: Array<{ id: string; nombre: string; logo: string | null; detalle: string }>;
    reservadas: number;
    activas: number;
    meta: number;
  };
  /**
   * La tarjeta verde «★ Tiendas fundadoras · 7 de 10 ya entraron» (doc 20, punto 7): cuántas
   * hay, el máximo y sus iniciales.
   */
  fundadoras: { entraron: number; total: number; iniciales: string[] };
  /**
   * «Primeros pasos»: perfil con portada, horario y descripción, cuántas publicaste y si pediste
   * en vivo.
   */
  pasos: { perfil: boolean; publicadas: number; en_vivo: boolean };
  /** Publicaciones vigentes de otras tiendas (sin las bloqueadas): «Van 3 de 12». */
  publicaciones: number;
  /**
   * Con `POCAS`, «Lo nuevo en la galería» (hasta 11); con `NORMAL`, la página 1 del Inicio (doc
   * 20, puntos 4 y 4b): 20 en el orden por puntos, con el tope por tienda en cada fila de 5. Sin
   * las tuyas.
   */
  recien: TarjetaInicio[];
  /** «Ver todas las publicaciones (130)»: las vigentes de las demás tiendas. */
  total: number;
  /** Cuántas páginas de 20 tiene el Inicio: `‹ 1 2 3 … 7 Siguiente ›`. */
  total_paginas: number;
  /** Cuántas hay en todas esas páginas: en el celular van de a 10 (`RECIEN_POR_PAGINA_CELULAR`). */
  en_paginas: number;
  /**
   * Tocaste la X de la banda «¿Conoces una tienda…?» hace menos de 2 días (N07, doc 19 punto
   * 14): por ahora no sale. Pasados los 2 días vuelve, sin ningún aviso.
   */
  invitar_cerrado: boolean;
}

/** Desde cuántas publicaciones de otras tiendas el inicio es el normal (N16). */
export const PUBLICACIONES_INICIO_NORMAL = 12;
/** El Inicio (doc 20, punto 4): 5 tarjetas por fila… */
export const RECIEN_POR_FILA = 5;
/** …y 4 filas por página. */
export const RECIEN_FILAS = 4;
/** De a cuántas trae `GET /v1/inicio/recien?pagina=N`: una página del Inicio. */
export const RECIEN_POR_PAGINA = RECIEN_POR_FILA * RECIEN_FILAS;
/** Cuántas manda `GET /v1/inicio` en la fase normal: la página 1. */
export const RECIEN_INICIO = RECIEN_POR_PAGINA;
/** En el celular: 2 por fila y 10 por página, con la misma paginación. */
export const RECIEN_POR_PAGINA_CELULAR = 10;

/**
 * `GET /v1/inicio/recien?pagina=2`: una página del Inicio (doc 20, puntos 4 y 4b). El orden por
 * puntos es el mismo para todos por 60 s, así que la página 3 sigue donde terminó la 2.
 */
export interface RespuestaRecienInicio {
  tarjetas: TarjetaInicio[];
  pagina: number;
  total_paginas: number;
  /** Cuántas hay en todas las páginas: en el celular van de a 10. */
  en_paginas: number;
  /** «Ver todas las publicaciones (130)». */
  total: number;
}

/**
 * `GET /v1/recien-llegados`: el «+N nuevo» de «Recién llegados» (N07). Lo publicado desde tu
 * última visita a esa página, sin lo de tu tienda y como máximo lo de las últimas 24 h.
 */
export interface RespuestaRecienLlegados {
  nuevos: number;
}

export type RespuestaPortada =
  | (BasePortada & { audiencia: 'visitante'; recien_publicado: TarjetaOferta[] })
  | (BasePortada & {
      audiencia: 'vendedor' | 'equipo';
      recien_publicado: TarjetaOfertaConVendedor[];
    });
