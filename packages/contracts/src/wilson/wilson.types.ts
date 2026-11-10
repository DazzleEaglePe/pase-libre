import type { TarjetaOferta, TarjetaOfertaConVendedor } from '../catalogo/catalogo.types.js';
import type { Precio } from '../comun/dinero.js';
import type { EnVivoConVendedor } from '../en-vivo/en-vivo.types.js';
import type { DetalleOferta } from '../ofertas/ofertas.types.js';

/** Una galería de la avenida en «Wilson en vivo» (CAT_Web3). */
export interface GaleriaEnVivo {
  slug: string;
  nombre: string;
  /** Publicaciones con stock (de la categoría elegida, si hay una). */
  productos: number;
  tiendas: number;
  /** Es la galería de tu tienda: «Estás aquí». */
  mia: boolean;
  /** «a 3 min caminando» desde tu galería; nulo sin la posición de alguna de las dos. */
  minutos: number | null;
}

/** «Tiendas por piso» de la galería elegida. Sin sesión no se nombran. */
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
  seguidas: Array<{ id: string; nombre: string; nuevo_hoy: boolean }>;
  novedades: NovedadSeguida[];
  /** «Te pueden interesar»: activas que no sigues, con el porqué. */
  sugeridas: Array<{
    id: string;
    nombre: string;
    lugar: string;
    vende: string | null;
    /** El promedio de sus estrellas; nulo sin opiniones. */
    estrellas: number | null;
    por: string;
  }>;
}
