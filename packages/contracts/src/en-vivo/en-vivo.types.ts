import type { Condicion } from '../catalogo/catalogo.types.js';
import type { Precio } from '../comun/dinero.js';

/** Busco: una tienda necesita algo hoy. Oferta flash: una tienda remata hoy (D-53). */
export type TipoEnVivo = 'BUSCO' | 'FLASH';

/** «Venció» no se guarda: lo calcula la API cuando `vence_en` ya pasó. */
export type EstadoEnVivo = 'VIVO' | 'CONSEGUIDO' | 'VENDIDO' | 'CERRADO' | 'VENCIDO';

/** Lo que ve cualquiera (RF-77): ni tienda, ni precio, ni presupuesto, ni la nota. */
export interface EnVivoPublico {
  id: string;
  tipo: TipoEnVivo;
  titulo: string;
  categoria: { slug: string; nombre: string };
  /** Nulo en un busco escrito como texto libre. */
  producto: { slug: string; foto: string | null } | null;
  cantidad: number;
  /** Nula en un busco que acepta nuevo o usado. */
  condicion: Condicion | null;
  galeria: string | null;
  vence_en: string;
  creado_en: string;
  estado: EstadoEnVivo;
  cerrado_en: string | null;
}

export interface EnVivoConVendedor extends EnVivoPublico {
  tienda: { nombre: string; stand: string | null };
  /** El precio de pase de la oferta flash, o el presupuesto del busco (nulo si no lo puso). */
  precio: Precio | null;
  nota: string | null;
  /** Es de tu tienda: no se le responde. */
  propio: boolean;
  /** Lo publicaste tú: puedes sumarle una hora o cerrarlo. */
  mio: boolean;
  /** Tu tienda ya respondió (una respuesta por tienda). */
  respondiste: boolean;
  /** El chat de tu respuesta, si respondiste tú. */
  conversacion_id: string | null;
  respuestas: number;
}

/** `GET /v1/en-vivo`: lo vigente, lo que vence primero arriba, y lo cerrado hoy. */
export type RespuestaEnVivo =
  | { audiencia: 'visitante'; en_vivo: EnVivoPublico[]; cerrados_hoy: EnVivoPublico[] }
  | {
      audiencia: 'vendedor' | 'equipo';
      en_vivo: EnVivoConVendedor[];
      cerrados_hoy: EnVivoConVendedor[];
    };

/** Una respuesta a lo tuyo, para abrir su chat desde «Lo tuyo en vivo». */
export interface RespuestaRecibida {
  tienda: string;
  conversacion_id: string;
  creada_en: string;
}

export interface EnVivoPropio extends EnVivoConVendedor {
  /** A cuántas tiendas les llegó el aviso del busco. */
  avisadas: number;
  /** Unidades vendidas de la oferta flash. */
  vendidas: number;
  respuestas_recibidas: RespuestaRecibida[];
}

/** `GET /v1/en-vivo/mios` (RF-75): «Lo tuyo en vivo». */
export interface RespuestaMisEnVivo {
  en_vivo: EnVivoPropio[];
  cerrados_hoy: EnVivoPropio[];
  /** Cuántos más puedes publicar ahora. */
  disponibles: number;
}

/** Una publicación tuya que sirve para responder «¡Lo tengo!» a un busco. */
export interface OpcionRespuestaEnVivo {
  oferta_id: string;
  titulo: string;
  condicion: Condicion;
  stock: number;
  /** Tu precio, aunque esté al interno: lo ves porque es tuyo. */
  precio: Precio | null;
  /** Si está al interno, el mensaje sugerido no lo menciona. */
  precio_visible: boolean;
  foto: string | null;
}

/** `GET /v1/en-vivo/:id/opciones`: tus publicaciones que coinciden con el busco. */
export interface RespuestaOpcionesEnVivo {
  ofertas: OpcionRespuestaEnVivo[];
}

/** `GET /v1/en-vivo/alcance`: la vista previa de Publicar («Les avisamos a 3 tiendas»). */
export interface RespuestaAlcanceEnVivo {
  tiendas: number;
}

export interface RespuestaResponderEnVivo {
  conversacion_id: string;
}

/** La tarjeta fija arriba del chat cuando el hilo nació de un busco o una oferta flash. */
export interface EnVivoEnChat {
  id: string;
  tipo: TipoEnVivo;
  titulo: string;
  estado: EstadoEnVivo;
  vence_en: string;
  cantidad: number;
  precio: Precio | null;
  /** Quien mira lo publicó y sigue en vivo: «Ya lo conseguí» o «Cerrar oferta». */
  puede_cerrar: boolean;
}

/** `en-vivo:cambio` (a todos los sockets): hay uno nuevo, cambió o se cerró. */
export interface EventoEnVivoCambio {
  id: string;
}
