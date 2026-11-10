import { z } from 'zod';

/** «¿Qué hacemos?» con un reporte (REP_WebEquipo). */
export const ACCIONES_REPORTE = ['ESCRIBIR', 'ADVERTIR', 'SUSPENDER', 'NADA'] as const;
export type AccionReporte = (typeof ACCIONES_REPORTE)[number];

export const decisionReporteSchema = z.strictObject({
  accion: z.enum(ACCIONES_REPORTE, 'Elige qué hacer.'),
  /** Lo que se le escribe a la tienda (con «Escribirle» o la advertencia). */
  texto: z.string().trim().max(1000, 'Escribe hasta 1000 letras.').optional(),
});
export type DecisionReporte = z.output<typeof decisionReporteSchema>;

export const advertenciaSchema = z.strictObject({
  motivo: z
    .string()
    .trim()
    .min(3, 'Escribe por qué la advertencia.')
    .max(200, 'Escribe hasta 200 letras.'),
});
export type AdvertenciaDatos = z.output<typeof advertenciaSchema>;

export const suspensionSchema = z.strictObject({
  suspender: z.boolean(),
  motivo: z.string().trim().max(200, 'Escribe hasta 200 letras.').optional(),
});
export type SuspensionDatos = z.output<typeof suspensionSchema>;

/** `POST /v1/equipo/comunicados` (ADM_WebComunicados): sin `galeria`, a todas las tiendas. */
export const comunicadoSchema = z.strictObject({
  galeria: z.string().trim().max(80).optional(),
  titulo: z
    .string()
    .trim()
    .min(3, 'Escribe el título.')
    .max(120, 'El título llega hasta 120 letras.'),
  texto: z
    .string()
    .trim()
    .min(3, 'Escribe el mensaje.')
    .max(600, 'El mensaje llega hasta 600 letras.'),
});
export type ComunicadoDatos = z.output<typeof comunicadoSchema>;

export const FILTROS_TIENDAS_PANEL = ['todas', 'activas', 'advertidas', 'suspendidas'] as const;
export const tiendasPanelSchema = z.object({
  q: z.string().trim().max(80).default(''),
  filtro: z.enum(FILTROS_TIENDAS_PANEL).default('todas'),
});
export type TiendasPanelConsulta = z.output<typeof tiendasPanelSchema>;

/** `GET /v1/equipo/inicio` (ADM_Web): lo de hoy, los números del piloto y lo último. */
export interface RespuestaInicioEquipo {
  por_revisar: number;
  reportes: {
    abiertos: number;
    urgentes: number;
    /** «1 urgente: estafa · Computer Shock · quedan 2 h 41 min». */
    primero: { motivo: string; tienda: string | null; vence_en: string } | null;
  };
  solicitudes: number;
  /** Hilos con el equipo cuyo último mensaje es de la tienda. */
  chats: number;
  numeros: {
    tiendas: number;
    tiendas_semana: number;
    publicaciones: number;
    publicaciones_semana: number;
    en_vivo_hoy: number;
    en_vivo_respondidos: number;
    ventas_semana: number;
    ventas_semana_anterior: number;
  };
  actividad: Array<{ id: string; autor: string; accion: string; fecha: string }>;
}

/** Un reporte en «Por revisar · urgentes primero». */
export interface ReporteEnCola {
  id: string;
  codigo: string;
  motivo: string;
  /** Estafa: se revisa primero, en 3 horas. */
  urgente: boolean;
  tienda: string | null;
  estado: 'ABIERTA' | 'EN_REVISION' | 'REVISADA' | 'DESCARTADA';
  /** Hasta cuándo hay que revisarlo: 3 h una estafa, 24 h lo demás. */
  vence_en: string;
}

export interface DetalleReporte extends ReporteEnCola {
  denunciante: { nombre: string; tienda: string | null };
  texto: string | null;
  /** Qué se reportó: «Chat · Tienda A», «Publicación · RTX 3070». */
  sobre: string;
  /** El chat adjunto; nulo si no lo adjuntó. */
  chat: Array<{
    id: string;
    texto: string | null;
    de_reportada: boolean;
    creado_en: string;
  }> | null;
  tienda_reportada: {
    id: string;
    nombre: string;
    con_ruc: boolean;
    estrellas: number | null;
    ventas: number;
    advertencias: number;
    suspendida: boolean;
    reportes_antes: Array<{ motivo: string; estado: string; fecha: string }>;
    desde: string;
  } | null;
  resolucion: string | null;
}

/** Una tienda en «Tiendas» del panel (ADM_WebTiendas). */
export interface TiendaEnPanel {
  id: string;
  nombre: string;
  galeria: string | null;
  stand: string | null;
  suspendida: boolean;
  con_ruc: boolean;
  reportes: number;
  advertencias: number;
  ventas: number;
  desde: string;
}

export interface DetalleTiendaPanel extends TiendaEnPanel {
  piso: string | null;
  horario: string | null;
  whatsapp: string;
  cuentas: number;
  publicaciones: number;
  historial: Array<{ tipo: 'ADVERTENCIA' | 'REPORTE'; texto: string; fecha: string }>;
}

export interface ComunicadoEnviado {
  id: string;
  para: string;
  titulo: string;
  texto: string;
  enviados: number;
  autor: string;
  fecha: string;
}
