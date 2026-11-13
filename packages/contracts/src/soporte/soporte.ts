import { z } from 'zod';

/** `POST /v1/equipo-chat/mensajes` y `POST /v1/equipo/chats/:tienda/mensajes`. */
export const escribirEquipoSchema = z.strictObject({
  texto: z
    .string()
    .trim()
    .min(1, 'Escribe tu mensaje.')
    .max(2000, 'El mensaje llega hasta 2000 letras.'),
  /** El reporte del que se habla («Caso R-1031»). Solo lo pone el equipo. */
  denuncia: z.uuid().optional(),
});
export type EscribirEquipoDatos = z.output<typeof escribirEquipoSchema>;

/**
 * Los checks de tus mensajes en el chat con el Equipo (doc 19, punto 18), con las mismas reglas
 * que entre tiendas: ✓ gris enviado, ✓✓ gris le llegó, ✓✓ verde lo leyó.
 */
export type EstadoMensajeEquipo = 'enviado' | 'recibido' | 'visto';

/** Un mensaje del chat oficial con el equipo (REP_WebChatEquipo). */
export interface MensajeChatEquipo {
  id: string;
  texto: string;
  de_equipo: boolean;
  /** «Fabrizio»: quien lo escribió. */
  autor: string;
  /** Lo escribió quien mira. */
  mio: boolean;
  creado_en: string;
  /** «Caso R-1031 · No cumplió con lo descrito · Abierto». */
  caso: { codigo: string; motivo: string; estado: string } | null;
  /** La respuesta automática del equipo (N14). */
  automatica: boolean;
  /**
   * Solo cuando es `mio`. Del lado de la tienda, «visto» quiere decir que alguien del Equipo lo
   * abrió; del lado del Equipo, nunca es verde si la tienda apagó el «Visto» en Privacidad.
   */
  estado?: EstadoMensajeEquipo;
}

/** `GET /v1/equipo-chat`: el chat de tu tienda con el equipo (se marca leído al abrirlo). */
export interface RespuestaChatEquipo {
  mensajes: MensajeChatEquipo[];
  sin_leer: number;
  /**
   * Del lado del Equipo: hasta cuándo leyó la tienda, para «Visto por {tienda} a las 00:51»
   * (doc 19, punto 18). Nulo si no leyó nada o apagó el «Visto».
   */
  visto_hasta?: string | null;
  /**
   * Del lado de la tienda: «Recibiste 1 advertencia de 3» (N14). Cuenta las advertencias que dio
   * el equipo, no los reportes. Nulo si no tiene.
   */
  advertencias?: {
    total: number;
    maximo: number;
    ultima: { motivo: string; caso: string | null; fecha: string };
  } | null;
}

/** Un renglón de los chats del panel del equipo. */
export interface HiloEquipoEnLista {
  /** `logo`: la ruta (`urlFoto`); sin él, las iniciales. */
  tienda: {
    id: string;
    nombre: string;
    logo: string | null;
    galeria: string | null;
    stand: string | null;
  };
  ultimo: MensajeChatEquipo | null;
  sin_leer: number;
  actualizado_en: string;
}
