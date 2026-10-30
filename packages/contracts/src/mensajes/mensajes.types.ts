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
  actualizada_en: string;
}

export type FiltroConversacion = 'todas' | 'no_leidas' | 'archivadas';

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

export type TipoAviso = 'MENSAJE' | 'SEGURIDAD' | 'RECORDATORIO' | 'SISTEMA' | 'EN_VIVO';

/** Un aviso de la campanita (RF-40). Uno por conversación con mensajes sin leer. */
export interface AvisoCampanita {
  id: string;
  tipo: TipoAviso;
  titulo: string;
  extracto: string | null;
  enlace: string | null;
  leido: boolean;
  actualizado_en: string;
}

export interface RespuestaAvisos {
  avisos: AvisoCampanita[];
  sin_leer: number;
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
