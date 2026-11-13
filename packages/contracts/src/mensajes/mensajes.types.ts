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
    /** La ruta del logo (`urlFoto`); nula sin logo o con la tienda reservada. */
    logo: string | null;
  };
}

/**
 * `PEDIDO_WHATSAPP`: «X te pidió tu WhatsApp» (Aceptar / Ahora no). `WHATSAPP`: «WhatsApp de X ·
 * +51 … · Abrir», el número de la tienda que se compartió a propósito (N01).
 */
export type TipoMensaje = 'TEXTO' | 'FOTO' | 'SISTEMA' | 'PEDIDO_WHATSAPP' | 'WHATSAPP';

export type EstadoPedidoWhatsapp = 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO';

/** Editar y «Eliminar para todos» se pueden hasta 15 minutos después de enviar (N01). */
export const MINUTOS_PARA_CAMBIAR_MENSAJE = 15;

/** El mensaje que otro cita con «Responder»: lo justo para la franjita de arriba. */
export interface MensajeCitado {
  id: string;
  texto: string | null;
  foto: string | null;
  mio: boolean;
  eliminado: boolean;
}

export interface MensajeChat {
  id: string;
  tipo: TipoMensaje;
  texto: string | null;
  /** Ruta de la foto (`/media/<ruta>`), solo en los mensajes con foto. */
  foto: string | null;
  /** Lo escribió quien recibe esta respuesta. Los mensajes del sistema nunca son «míos». */
  mio: boolean;
  creado_en: string;
  /** «editado ·» (N01). */
  editado: boolean;
  /** Eliminado para todos: sin texto ni foto («Eliminaste este mensaje» / «Se eliminó este mensaje»). */
  eliminado: boolean;
  /**
   * Hasta cuándo quien lo escribió puede editarlo o eliminarlo para todos («quedan 11 min»).
   * Nulo si no es tuyo, ya pasó el plazo o es de una venta cerrada.
   */
  cambiable_hasta: string | null;
  /** «17:20 · Luis»: quién lo escribió, cuando su tienda tiene asesores (N12). */
  autor: string | null;
  /** «Responder»: el mensaje que cita. */
  responde_a: MensajeCitado | null;
  /** En qué quedó el pedido de WhatsApp. Solo en `PEDIDO_WHATSAPP`. */
  pedido: EstadoPedidoWhatsapp | null;
  /** El WhatsApp de la tienda que lo compartió (9 dígitos). Solo en `WHATSAPP`. */
  whatsapp: string | null;
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
  /** `en_linea`: el puntito verde (N01): alguien de esa tienda tiene PaseLibre abierto ahora. */
  otro: PersonaChat & { en_linea: boolean };
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
  /**
   * La otra tienda se eliminó para siempre (doc 19 §9): sale «Tienda eliminada», se leen tus
   * mensajes y ya no se puede escribir.
   */
  otra_eliminada: boolean;
}

export type FiltroConversacion = 'todas' | 'no_leidas' | 'pases' | 'archivadas';

export interface RespuestaConversaciones {
  conversaciones: ConversacionEnLista[];
  conteos: Record<FiltroConversacion, number>;
}

/** `GET /v1/conversaciones/:id`: lo de la lista más el producto fijo arriba y el estado del hilo. */
export interface DetalleConversacion extends Omit<ConversacionEnLista, 'otro' | 'oferta'> {
  otro: PersonaChat & {
    /** Alguien de su tienda está conectado ahora («● Activo ahora», N01). */
    en_linea: boolean;
    /** La última vez que alguien de su tienda estuvo conectado, para «Activo hace 2 min». */
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
    /**
     * «Deshacer» junto a «Vendido» (N02): quien vendió, hasta 48 h y mientras quien compró no
     * haya calificado.
     */
    puede_deshacer: boolean;
  } | null;
  /** «Pedir WhatsApp» y «Compartir mi WhatsApp» (N01). Nadie ve un número que no se aceptó. */
  whatsapp: {
    /** El número que la otra tienda te compartió en este chat, o nulo. */
    suyo: string | null;
    /** Ya le pediste el suyo y todavía no responde. */
    pedido_pendiente: boolean;
    /** Puedes pedirle el suyo (no a una tienda reservada, ni si ya te lo dio). */
    puedes_pedir: boolean;
    /** Puedes compartir el tuyo (nunca desde una publicación reservada tuya). */
    puedes_compartir: boolean;
  };
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
  /** Hasta cuándo le llegaron los mensajes al otro (dos checks grises, N01). */
  recibido_hasta: string | null;
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

/** `POST /v1/conversaciones/:id/whatsapp/pedido/:mensajeId`: Aceptar o «Ahora no». */
export interface RespuestaPedidoWhatsapp {
  pedido: MensajeChat;
  /** «WhatsApp de X»: solo si aceptó. */
  compartido: MensajeChat | null;
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

/**
 * El papel de una respuesta rápida (N11), igual que el `rol` de la conversación: `vendedor` es
 * «Cuando te escriben» y `comprador`, «Cuando tú preguntas». En cada chat salen las de su rol.
 */
export type PapelRespuesta = 'vendedor' | 'comprador';

export interface RespuestaRapida {
  id: string;
  /** Con `{tienda}` donde va el nombre de la otra tienda («Nombre de la tienda»). */
  texto: string;
  papel: PapelRespuesta;
}

/** La ficha «Nombre de la tienda» dentro de una respuesta rápida. */
export const FICHA_TIENDA = '{tienda}';

/**
 * Una respuesta rápida lista para la caja del chat: «Hola, {tienda}, ¿qué tal?» → «Hola,
 * Pegasus5000, ¿qué tal?». Sin nombre (tienda reservada), la ficha se va con su coma.
 */
export function conNombreDeTienda(texto: string, tienda: string | null): string {
  if (tienda) return texto.split(FICHA_TIENDA).join(tienda);
  return texto
    .split(FICHA_TIENDA)
    .join('')
    .replace(/\s*,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

/** «SUGERENCIAS · TOCA PARA AGREGAR» (N11), por papel. */
export const SUGERENCIAS_RESPUESTAS: Record<PapelRespuesta, readonly string[]> = {
  vendedor: [
    'Un momento, {tienda}, lo verifico y te aviso.',
    '¿Para cuándo lo necesitas?',
    '¿Pasas por el stand o te lo envío?',
    'Gracias, {tienda}, cualquier cosa me escribes.',
  ],
  comprador: [
    'Hola, {tienda}, ¿lo tienes disponible?',
    '¿Tienes más de una unidad?',
    '¿Hasta qué hora estás en el stand?',
    'Gracias, {tienda}.',
  ],
};

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
  /** Se editó o se eliminó un mensaje, o cambió un pedido de WhatsApp (N01). */
  mensajeCambio: 'mensaje:cambio',
  /** Le llegaron los mensajes al otro: dos checks grises (N01). */
  mensajeRecibido: 'mensaje:recibido',
  /** Una tienda con la que hablas se conectó o se desconectó (el puntito verde, N01). */
  presencia: 'presencia:cambio',
  /**
   * Hay un mensaje nuevo en el chat de una tienda con el Equipo. Va a la tienda y a todo el
   * Equipo, siempre: «No molestar» calla el aviso, nunca el chat abierto (doc 19, A3).
   */
  mensajeEquipo: 'equipo:mensaje',
} as const;

export interface EventoMensajeEquipo {
  tienda_id: string;
}

export interface EventoMensajeNuevo {
  conversacion_id: string;
  mensaje: MensajeChat;
}

export interface EventoMensajeVisto {
  conversacion_id: string;
  visto_hasta: string;
}

/** `mensaje:cambio`: el mensaje como queda; nulo si quien escucha lo eliminó para sí. */
export interface EventoMensajeCambio {
  conversacion_id: string;
  mensaje_id: string;
  mensaje: MensajeChat | null;
}

export interface EventoMensajeRecibido {
  conversacion_id: string;
  recibido_hasta: string;
}

/**
 * `presencia:cambio`: solo a las tiendas que hablan con ella y la conocen (nunca por una
 * publicación reservada). Al desconectarse se esperan 30 s por si solo recargó la página.
 */
export interface EventoPresencia {
  tienda_id: string;
  en_linea: boolean;
  ultima_conexion: string | null;
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
