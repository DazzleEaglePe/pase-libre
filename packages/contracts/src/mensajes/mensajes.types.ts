import type { Precio } from '../comun/dinero.js';
import type { Condicion } from '../catalogo/catalogo.types.js';
import type { EnVivoEnChat } from '../en-vivo/en-vivo.types.js';
import type { TipoTienda } from '../sesion/sesion.types.js';

/** La otra persona de una conversación: siempre con su tienda (A-11, bandeja por persona). */
export interface PersonaChat {
  id: string;
  nombre: string;
  tienda: {
    id: string;
    nombre: string;
    tipo: TipoTienda;
    galeria: string | null;
    stand: string | null;
  };
}

export type TipoMensaje = 'TEXTO' | 'FOTO' | 'SISTEMA';

export interface MensajeChat {
  id: string;
  tipo: TipoMensaje;
  texto: string | null;
  /** Ruta de la foto (`/media/<ruta>`), solo en los mensajes con foto. */
  foto: string | null;
  /** Lo escribió quien recibe esta respuesta. Los mensajes del sistema nunca son «míos». */
  mio: boolean;
  creado_en: string;
}

export interface OfertaDeConversacion {
  id: string;
  condicion: Condicion;
  producto: {
    slug: string;
    titulo: string;
    foto: string | null;
    categoria: { slug: string; nombre: string };
  };
}

/** Un renglón de la lista de Mensajes (C_Mensajes). */
export interface ConversacionEnLista {
  id: string;
  /** `vendedor` si la oferta es de quien mira, `comprador` si preguntó por ella. */
  rol: 'comprador' | 'vendedor';
  otro: PersonaChat;
  oferta: OfertaDeConversacion;
  ultimo_mensaje: MensajeChat | null;
  no_leidos: number;
  /** Marcada a mano como no leída (RF-57). */
  no_leida: boolean;
  silenciada: boolean;
  archivada: boolean;
  /** El hilo nació de un «¡Lo tengo!» o un «¡Lo quiero!» (Pedidos en vivo). */
  pase_del_dia: boolean;
  actualizada_en: string;
}

export type FiltroConversacion = 'todas' | 'no_leidas' | 'pases' | 'archivadas';

export interface RespuestaConversaciones {
  conversaciones: ConversacionEnLista[];
  conteos: Record<FiltroConversacion, number>;
}

/** `GET /v1/conversaciones/:id`: lo de la lista más el producto fijo arriba y el estado del hilo. */
export interface DetalleConversacion extends Omit<ConversacionEnLista, 'otro' | 'oferta'> {
  otro: PersonaChat & {
    en_linea: boolean;
    /** Última vez que estuvo conectado, para «Activo hace 2 h». */
    ultima_conexion: string | null;
  };
  oferta: OfertaDeConversacion & {
    stock: number;
    estado: 'ACTIVA' | 'PAUSADA' | 'ELIMINADA';
    /** Como lo ve quien mira: nulo si está al interno para él. */
    precio: Precio | null;
    precio_visible: boolean;
  };
  /** Quien mira bloqueó a la tienda del otro: no puede escribir hasta desbloquear. */
  bloqueaste: boolean;
  /** Es el vendedor, la oferta sigue publicada y tiene stock: puede marcar «Vendido». */
  puede_vender: boolean;
  /** El busco o la oferta flash de la que nació el hilo (D-53). */
  en_vivo?: EnVivoEnChat | null;
  /**
   * «Hablan de» (PCH_WebTienda): los productos de los que hablas con esa tienda, este primero.
   * Cada uno es su propio hilo; con la tienda reservada, solo este.
   */
  hablan_de: Array<{
    conversacion_id: string;
    titulo: string;
    foto: string | null;
    categoria: string;
    precio: Precio | null;
    actualizada_en: string;
  }>;
  /** La última venta marcada en este hilo: «Venta cerrada» y «¿Cómo te fue?». */
  venta: {
    id: string;
    precio: Precio | null;
    fecha: string;
    mi_lado: 'comprador' | 'vendedor';
    /** Ya diste tu opinión de la otra tienda por esta venta. */
    calificaste: boolean;
    /** «¿No fue así? Avísanos (48 h)»: hasta cuándo quien compró puede reclamar. */
    reclamo_hasta: string;
  } | null;
  /** «Cómo llegar» y la reputación de la otra tienda; nulo con la tienda reservada. */
  sobre_tienda: {
    galeria: string | null;
    piso: string | null;
    stand: string | null;
    horario: string | null;
    indicaciones: string | null;
    estrellas: number | null;
    opiniones: number;
  } | null;
}

export interface RespuestaMensajes {
  /** Del más antiguo al más nuevo. */
  mensajes: MensajeChat[];
  hay_mas: boolean;
  /** Hasta cuándo leyó el otro, si los dos tienen el «Visto» activado (RF-57). */
  visto_hasta: string | null;
}

export type RespuestaContacto =
  { canal: 'CHAT'; conversacion_id: string } | { canal: 'WHATSAPP'; enlace: string };

/** Quien escribió por una oferta, para elegir a quién se le vendió (RF-47). */
export interface InteresadoOferta {
  conversacion_id: string;
  persona: PersonaChat;
  ultimo_mensaje_en: string;
}

export interface RespuestaVendido {
  stock_antes: number;
  stock_despues: number;
  mensaje: MensajeChat;
}

export type TipoAviso =
  | 'MENSAJE'
  | 'SEGURIDAD'
  | 'RECORDATORIO'
  | 'SISTEMA'
  | 'EN_VIVO'
  | 'EN_VIVO_RESPUESTA'
  | 'VENTA'
  | 'CALIFICACION'
  | 'REPORTE'
  | 'SEGUIDA'
  | 'ALERTA'
  | 'EQUIPO';

/** Los filtros de la campanita y de «Avisos» (AV_Web). */
export type CategoriaAviso = 'EN_VIVO' | 'VENTAS' | 'MENSAJES' | 'PUBLICACIONES' | 'CUENTA';

export const CATEGORIA_DE_AVISO: Record<TipoAviso, CategoriaAviso> = {
  MENSAJE: 'MENSAJES',
  EN_VIVO: 'EN_VIVO',
  EN_VIVO_RESPUESTA: 'EN_VIVO',
  VENTA: 'VENTAS',
  CALIFICACION: 'VENTAS',
  RECORDATORIO: 'PUBLICACIONES',
  SEGUIDA: 'PUBLICACIONES',
  ALERTA: 'PUBLICACIONES',
  SEGURIDAD: 'CUENTA',
  SISTEMA: 'CUENTA',
  REPORTE: 'CUENTA',
  EQUIPO: 'CUENTA',
};

/**
 * El botón de un aviso (AV_Web): abrir algo («Ver su oferta», «Ver sus productos») o
 * responder un busco («¡Lo tengo!», en naranja).
 */
export type AccionAviso =
  { tipo: 'ABRIR'; texto: string; enlace: string } | { tipo: 'LO_TENGO'; enlace: string };

/** Un aviso de la campanita (RF-40). Uno por conversación con mensajes sin leer. */
export interface AvisoCampanita {
  id: string;
  tipo: TipoAviso;
  categoria: CategoriaAviso;
  titulo: string;
  extracto: string | null;
  enlace: string | null;
  accion: AccionAviso | null;
  leido: boolean;
  actualizado_en: string;
}

export interface RespuestaAvisos {
  avisos: AvisoCampanita[];
  sin_leer: number;
  /** Sin leer de cada filtro: «En vivo · 2». */
  sin_leer_por_categoria: Record<CategoriaAviso, number>;
}

/** `GET /v1/contadores`: lo que muestran las insignias de Mensajes y la campanita. */
export interface Contadores {
  /** Conversaciones con algo sin leer. */
  mensajes: number;
  avisos: number;
}

export interface RespuestaRapida {
  id: string;
  texto: string;
}

/**
 * Tiempo real (docs/05 §6.3). El socket va en `/tiempo-real` con la cookie de sesión y
 * cada persona escucha su sala. Si se cae, al volver se piden de nuevo los datos.
 */
export const RUTA_TIEMPO_REAL = '/tiempo-real';

export const EVENTOS = {
  /** El servidor ya unió el socket a sus salas: desde aquí no se pierde nada. */
  listo: 'tiempo-real:listo',
  /** La cookie no sirve (sesión cerrada o vencida): el servidor corta el socket. */
  sinSesion: 'tiempo-real:sin-sesion',
  mensajeNuevo: 'mensaje:nuevo',
  mensajeVisto: 'mensaje:visto',
  avisoNuevo: 'aviso:nuevo',
  ofertaStock: 'oferta:stock',
  /** Cambió algo que mueve los contadores (se leyó un hilo en otra pestaña, por ejemplo). */
  contadores: 'contadores:cambio',
  /** Hay un busco o una oferta flash nueva, cambió o se cerró (a todos los sockets, D-53). */
  enVivoCambio: 'en-vivo:cambio',
} as const;

export interface EventoMensajeNuevo {
  conversacion_id: string;
  mensaje: MensajeChat;
}

export interface EventoMensajeVisto {
  conversacion_id: string;
  visto_hasta: string;
}

export interface EventoOfertaStock {
  oferta_id: string;
  stock: number;
}

export type MotivoDenuncia = 'ESTAFA' | 'DESCRITO' | 'TRATO';

/** «Ya nos llegó tu reporte R-1042» (REP_WebEnviado). */
export interface RespuestaDenuncia {
  codigo: string;
  /** Además bloqueaste a la tienda. */
  bloqueada: boolean;
  /** Una persona del equipo lo revisa antes de esta hora (3 horas). */
  revisar_antes_de: string;
}

/** Una fila de «Mis reportes» (REP_WebMisReportes). */
export interface MiReporte {
  codigo: string;
  /** El nombre de la tienda, o «Tienda reservada» si se reportó una publicación reservada. */
  tienda: string;
  /** Nulo en los reportes de antes, que solo tenían texto. */
  tipo: MotivoDenuncia | null;
  estado: 'ENVIADO' | 'EN_REVISION' | 'RESUELTO';
  creada_en: string;
  revisar_antes_de: string;
  /** Lo que hizo el equipo, cuando está resuelto. */
  resolucion: string | null;
}
