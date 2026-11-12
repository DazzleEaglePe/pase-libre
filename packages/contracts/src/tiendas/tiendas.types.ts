import type { Condicion } from '../catalogo/catalogo.types.js';
import type { Precio } from '../comun/dinero.js';
import type { TramoHorario } from './horario.js';
import type { NivelReputacion } from './reputacion.js';
import type { AVISOS_SEGUIMIENTO } from './tiendas.schemas.js';

export type AvisosSeguimiento = (typeof AVISOS_SEGUIMIENTO)[number];

/** «4,8 (63 ventas)»: el promedio de estrellas, cuántas opiniones y cuántas ventas marcadas. */
export interface Reputacion {
  /** Nulo sin opiniones todavía. */
  promedio: number | null;
  opiniones: number;
  ventas: number;
}

/**
 * La reputación completa (N03, N04): el nivel que junta estrellas, pases cerrados y rapidez, y
 * los tres datos que se muestran. Sale de `ReputacionService` en la API.
 */
export interface ReputacionDetallada extends Reputacion {
  /** Nulo con menos de 5 opiniones: «🌱 Nueva en PaseLibre». */
  nivel: NivelReputacion | null;
  /** «18 pases cerrados en 60 días». */
  pases_60: number;
  /** «~10 min para responder»: nulo con menos de 3 chats contestados. */
  responde_en: number | null;
  /** «96 % chats respondidos» en 60 días: nulo sin chats. */
  respondidos: number | null;
}

/** Un producto en el perfil de una tienda: solo lo que publica con su nombre a la vista. */
export interface ProductoDeTienda {
  oferta_id: string;
  producto: {
    slug: string;
    titulo: string;
    foto: string | null;
    categoria: { slug: string; nombre: string };
  };
  condicion: Condicion;
  stock: number;
  /** Nulo si está al interno (salvo para la propia tienda y el equipo). */
  precio: Precio | null;
  /** El precio que ves es de socia (con descuento o de «Solo mis socios»): burbujita «Socio». */
  precio_socio: boolean;
  /** Pase que se puede conversar: burbujita «Negociable». */
  negociable: boolean;
}

/**
 * `GET /v1/tiendas/:id` (SG_Web): el perfil de otra tienda. Solo con sesión. Lo que la tienda
 * publica como «Tienda reservada» no sale aquí: el perfil la delataría.
 */
/** La portada que subió la tienda (COR1). Sin ella, la web arma la automática. */
export interface PortadaTienda {
  ruta: string;
  ancho: number | null;
  alto: number | null;
  /** Qué parte se ve, de arriba (0) a abajo (100): «Acomodar». */
  posicion: number;
}

export interface PerfilTienda {
  id: string;
  nombre: string;
  /** «CS» para el avatar. */
  iniciales: string;
  galeria: string | null;
  stand: string | null;
  horario: string | null;
  descripcion: string | null;
  /** El horario por días (Configuración · Datos de la tienda), o leído del escrito; nulo si no se entiende. */
  horario_tramos: TramoHorario[] | null;
  /** «Cómo llegar: escalera central, 2.º pasillo a la derecha». */
  indicaciones: string | null;
  /** Ruta del logo (`/media/<ruta>`), o nulo: van sus iniciales. */
  logo: string | null;
  /** «En PaseLibre desde nov 2026». */
  desde: string;
  reputacion: ReputacionDetallada;
  seguidores: number;
  /** Nulo si tu tienda no la sigue. */
  siguiendo: { avisos: AvisosSeguimiento } | null;
  /** «¿Quieres seguir a…?» sale solo la primera vez que sigues a una tienda. */
  explicar_seguir: boolean;
  /** Es tu tienda: sin «Seguir» ni «Escribir». */
  propia: boolean;
  /** Las cuentas del equipo miran, pero no siguen. */
  puede_seguir: boolean;
  /** La bloqueaste: «Bloqueaste a … · Desbloquear» y sin sus productos. */
  bloqueada: boolean;
  total_productos: number;
  productos: ProductoDeTienda[];
  /** La portada subida, o nula: entonces va la automática (COR1). */
  portada: PortadaTienda | null;
  /** Lo que más publica, para la portada automática: «Tarjetas de video · Procesadores». */
  categorias_principales: string[];
}

export interface RespuestaSeguir {
  siguiendo: { avisos: AvisosSeguimiento } | null;
  seguidores: number;
}

/** Una tienda que sigues (SEG_Web, «De tiendas que sigues»). */
export interface TiendaSeguida {
  id: string;
  nombre: string;
  iniciales: string;
  galeria: string | null;
  stand: string | null;
  avisos: AvisosSeguimiento;
  reputacion: Reputacion;
  /** Publicaciones vigentes con su nombre a la vista. */
  productos: number;
  /** Publicadas en los últimos 7 días. */
  nuevos_semana: number;
}

export interface OpinionPublica {
  id: string;
  autor: { nombre: string; iniciales: string; galeria: string | null };
  estrellas: number;
  aspectos: string[];
  /** «MSI RTX 3070 Ventus 3X»; nulo si la venta fue de una publicación con la tienda reservada. */
  producto: string | null;
  texto: string | null;
  respuesta: string | null;
  creada_en: string;
  /**
   * Opinión baja (2 estrellas o menos): el comentario y la respuesta solo los ven la tienda
   * calificada, quien la escribió y el Equipo. Para los demás, `texto` y `respuesta` van nulos.
   */
  privada: boolean;
  /** Solo para la tienda calificada: si pidió revisión al Equipo, el código del reporte. */
  revision: { codigo: string; resuelta: boolean } | null;
}

/** «Lo que dicen las tiendas»: qué tanto se marcó cada cosa, sobre 100. */
export interface AspectoOpinado {
  aspecto: string;
  porcentaje: number;
}

/** `GET /v1/tiendas/:id/opiniones` (SG_WebOpiniones). */
export interface RespuestaOpiniones {
  reputacion: Reputacion;
  /** De 5 a 1 estrellas. */
  distribucion: Array<{ estrellas: number; cantidad: number }>;
  aspectos: AspectoOpinado[];
  opiniones: OpinionPublica[];
  /** Es tu tienda: puedes responder las que no tienen respuesta. */
  puede_responder: boolean;
}

/** Una tienda en «Tus socios» o en el buscador para agregarla. */
/**
 * `GET /v1/tiendas/:id/compartida` (COR3, sin sesión): solo el nombre, para «Te compartieron
 * Dark Alien Planeta» en Iniciar sesión. Ni galería, ni stand, ni lo que publica.
 */
export interface RespuestaTiendaCompartida {
  nombre: string;
}

export interface TiendaBreve {
  id: string;
  nombre: string;
  iniciales: string;
  galeria: string | null;
  stand: string | null;
}

/** `GET /v1/socios` (PS_SociosWeb): a quiénes les das tu precio socio y quiénes te lo dan. */
export interface RespuestaSocios {
  mis_socios: Array<TiendaBreve & { desde: string }>;
  /** Con el descuento que te dan por defecto, si lo pusieron. */
  me_tienen: Array<
    TiendaBreve & { desde: string; descuento: { PEN: Precio | null; USD: Precio | null } }
  >;
  /** Tu «Descuento por defecto», por moneda. */
  descuento_defecto: { PEN: Precio | null; USD: Precio | null };
}
