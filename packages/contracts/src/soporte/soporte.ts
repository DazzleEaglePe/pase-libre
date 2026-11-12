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
}

/** `GET /v1/equipo-chat`: el chat de tu tienda con el equipo (se marca leído al abrirlo). */
export interface RespuestaChatEquipo {
  mensajes: MensajeChatEquipo[];
  sin_leer: number;
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
  tienda: { id: string; nombre: string; galeria: string | null; stand: string | null };
  ultimo: MensajeChatEquipo | null;
  sin_leer: number;
  actualizado_en: string;
}
