import type {
  RespuestaSugerenciasBusqueda,
  TarjetaOferta,
  TarjetaOfertaConVendedor,
} from '../catalogo/catalogo.types.js';
import type { Precio } from '../comun/dinero.js';
import type { EnVivoConVendedor } from '../en-vivo/en-vivo.types.js';
import type { DetalleOferta } from '../ofertas/ofertas.types.js';

/**
 * Qué tan verde sale una galería (N08): «Sin productos», y entre las que tienen, el tercio con
 * menos («Pocos»), el del medio («Varios») y el de más («Muchos»). Con menos de 20 productos en
 * todo Wilson, todas las que tienen salen «Pocos» (verde suave).
 */
export type NivelGaleria = 'SIN' | 'POCOS' | 'VARIOS' | 'MUCHOS';

/** Una galería de la avenida en «Wilson en vivo» (CAT_Web3, N08). */
export interface GaleriaEnVivo {
  slug: string;
  nombre: string;
  /** Publicaciones con stock (de la categoría elegida, si hay una). */
  productos: number;
  /** Las tiendas que tienen esas publicaciones. */
  tiendas: number;
  nivel: NivelGaleria;
  /** Es la galería de tu tienda: «Estás aquí». */
  mia: boolean;
  /** «a 3 min caminando» desde tu galería; nulo sin la posición de alguna de las dos. */
  minutos: number | null;
}

/**
 * «Tiendas por piso» de la galería elegida. Ya no se llena (llega vacío): lo reemplaza el
 * directorio de la pestaña «Tiendas» (`GET /v1/wilson/tiendas`), que no muestra las reservadas.
 */
export interface PisoDeGaleria {
  piso: string;
  tiendas: Array<{
    id: string;
    nombre: string;
    stand: string | null;
    mia: boolean;
    productos: number;
  }>;
}

/** `GET /v1/wilson` (CAT_Web3, CAT_Cel3): el mapa de calor de la avenida y lo de una galería. */
export type RespuestaWilson = {
  /** Las 3 categorías con más publicaciones, para los botones de arriba. */
  categorias: Array<{ slug: string; nombre: string }>;
  categoria: { slug: string; nombre: string } | null;
  galerias: GaleriaEnVivo[];
  /** La elegida (por defecto la tuya, o la que más tiene). */
  galeria: GaleriaEnVivo | null;
  pisos: PisoDeGaleria[];
} & (
  | { audiencia: 'visitante'; ofertas: Array<TarjetaOferta & { detalle: DetalleOferta }> }
  | {
      audiencia: 'vendedor' | 'equipo';
      ofertas: Array<TarjetaOfertaConVendedor & { detalle: DetalleOferta }>;
    }
);

/** «Se vende rápido», «Normal» o «Se mueve lento»: las ventas de 30 días. */
export type RitmoModelo = 'RAPIDO' | 'NORMAL' | 'LENTO';

/** Una fila de «Precios de pase por modelo» (CAT_Web4). */
export interface PrecioDeModelo {
  slug: string;
  titulo: string;
  /** El precio de pase más bajo hoy, entre los que se muestran. */
  desde: Precio | null;
  promedio: Precio | null;
  /** El más bajo de cada día de los últimos 30 (en céntimos de la misma moneda), viejo a nuevo. */
  serie: number[];
  /** Cuánto cambió el más bajo contra el día más viejo de la serie, en %; nulo sin historia. */
  cambio: number | null;
  tiendas: number;
  ofertas: number;
  ritmo: RitmoModelo;
}

/** `GET /v1/categorias/:slug/precios` (CAT_Web4, CAT_Cel4). Solo con sesión. */
export interface RespuestaPreciosCategoria {
  categoria: { slug: string; nombre: string };
  resumen: {
    publicadas: number;
    tiendas: number;
    en_vivo_hoy: number;
    mas_bajo: { precio: Precio; titulo: string } | null;
  };
  filtros: { marcas: string[]; galerias: Array<{ slug: string; nombre: string }> };
  modelos: PrecioDeModelo[];
}

interface TiendaDeNovedad {
  id: string;
  nombre: string;
  /** La ruta del logo (`urlFoto`); sin él, las iniciales. */
  logo: string | null;
  /** «Cyberplaza · Stand 214». */
  lugar: string;
}

/** Una publicación dentro de una novedad, con su precio para ti (socio incluido). */
export interface OfertaDeNovedad {
  id: string;
  producto: { slug: string; titulo: string; foto: string | null; categoria: { slug: string } };
  detalle: DetalleOferta;
  stock: number;
  precio: Precio | null;
  /** «Tu precio socio: US$ 637». */
  precio_socio: Precio | null;
}

/** Lo que pasó en una tienda que sigues (SEG_Web). */
export type NovedadSeguida =
  | {
      tipo: 'PUBLICO';
      tienda: TiendaDeNovedad;
      fecha: string;
      oferta: OfertaDeNovedad;
      /** «+2 más: Kingston Fury DDR5 32 GB · WD Blue 2 TB». */
      mas: string[];
    }
  | { tipo: 'BAJO'; tienda: TiendaDeNovedad; fecha: string; oferta: OfertaDeNovedad; antes: Precio }
  | {
      tipo: 'REMATE' | 'BUSCO';
      tienda: TiendaDeNovedad;
      fecha: string;
      en_vivo: EnVivoConVendedor;
    };

/** `GET /v1/seguidas/novedades` (SEG_Web, SEG_Cel). */
export interface RespuestaNovedades {
  /** Los círculos de arriba, con el punto si publicó hoy. */
  seguidas: Array<{ id: string; nombre: string; logo: string | null; nuevo_hoy: boolean }>;
  novedades: NovedadSeguida[];
  /** «Te pueden interesar»: activas que no sigues, con el porqué. */
  sugeridas: Array<{
    id: string;
    nombre: string;
    logo: string | null;
    lugar: string;
    vende: string | null;
    /** El promedio de sus estrellas; nulo sin opiniones. */
    estrellas: number | null;
    por: string;
  }>;
}

/**
 * La reputación corta de una tienda en el directorio y en el buscador (N13): «4,9 ★ · 31
 * opiniones» o «Nueva». La calcula una sola función del servidor (`reputacionCorta`).
 */
export interface ReputacionCorta {
  /** El promedio, con un decimal; nulo si es nueva. */
  estrellas: number | null;
  opiniones: number;
  nueva: boolean;
}

/** Una tienda del directorio (N13, pestaña «Tiendas» de Wilson en vivo). */
export interface TiendaDelDirectorio {
  id: string;
  nombre: string;
  /** La ruta del logo (`urlFoto`); sin él, las iniciales. */
  logo: string | null;
  /** Nulo para las independientes. */
  galeria: string | null;
  stand: string | null;
  piso: string | null;
  /** Sus categorías con más publicaciones a la vista, hasta 2: «Tarjetas de video · Monitores». */
  vende: string[];
  reputacion: ReputacionCorta;
  /** Alguien de la tienda tiene PaseLibre abierto ahora: el puntito verde. */
  en_linea: boolean;
  /** Es la tienda de quien mira. */
  propia: boolean;
}

/** `GET /v1/wilson/tiendas` (N13): solo con sesión. Sin las reservadas ni las que bloqueaste. */
export interface RespuestaDirectorioTiendas {
  tiendas: TiendaDelDirectorio[];
  total: number;
  pagina: number;
  hay_mas: boolean;
  /** Las opciones de «Todas las galerías ▾», «Piso ▾» y «Vende: … ▾». */
  filtros: {
    galerias: Array<{ slug: string; nombre: string }>;
    pisos: string[];
    categorias: Array<{ slug: string; nombre: string }>;
  };
}

/** Una tienda en la sección «TIENDAS» del buscador de arriba (N13). */
export interface TiendaEnBuscador {
  id: string;
  nombre: string;
  logo: string | null;
  galeria: string | null;
  stand: string | null;
  reputacion: ReputacionCorta;
  en_linea: boolean;
}

/**
 * `GET /v1/buscar/sugerencias` con las tiendas que coinciden con lo escrito (N13). Sin sesión
 * `tiendas` llega vacío: un visitante no ve tiendas.
 */
export type RespuestaSugerenciasConTiendas = RespuestaSugerenciasBusqueda & {
  tiendas: TiendaEnBuscador[];
};
