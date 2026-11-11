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
  /** «3 Por revisar en Catálogo · Publicados a mano» (COR18). */
  catalogo_por_revisar: number;
  /** «Destacadas ahora · 1 de 3 · CGS · 35 min» (COR18). */
  destacadas: {
    activas: number;
    maximo: number;
    primera: { tienda: string; hasta: string } | null;
  };
}

/** `PUT /v1/equipo/preferencias` (COR18): el modo claro u oscuro se guarda en tu cuenta. */
export const preferenciasEquipoSchema = z.strictObject({ tema_oscuro: z.boolean() });
export type PreferenciasEquipo = z.output<typeof preferenciasEquipoSchema>;

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
  /** Sus publicaciones vigentes, para elegir cuáles destacar (COR16). */
  para_destacar: Array<{ oferta_id: string; titulo: string; precio: string | null }>;
  /** Si está destacada ahora (solo lo ve el equipo). */
  destacado: DestacadoActivo | null;
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

// ── Destacar en silencio (COR16) ────────────────────────────────────────────

/** Hasta 3 tiendas destacadas a la vez. */
export const MAX_DESTACADAS = 3;
export const DURACIONES_DESTACADO = ['1h', '3h', 'dia'] as const;
export type DuracionDestacado = (typeof DURACIONES_DESTACADO)[number];

/** `POST /v1/equipo/tiendas/:id/destacar`. Sin `ofertas`, todas sus publicaciones. */
export const destacarSchema = z.strictObject({
  duracion: z.enum(DURACIONES_DESTACADO, 'Elige por cuánto tiempo.'),
  ofertas: z.array(z.uuid()).max(3, 'Elige hasta 3 publicaciones.').default([]),
  avisar: z.boolean().default(true),
});
export type DestacarDatos = z.output<typeof destacarSchema>;

export interface DestacadoActivo {
  id: string;
  tienda: { id: string; nombre: string; iniciales: string };
  /** Cuántas publicaciones salen arriba (todas, o las elegidas). */
  publicaciones: number;
  todas: boolean;
  hasta: string;
  por: string;
  avisada: boolean;
}

/** `GET /v1/equipo/destacados`: las destacadas ahora (solo las ve el equipo). */
export interface RespuestaDestacados {
  maximo: number;
  activas: DestacadoActivo[];
}

// ── Catálogo del equipo (COR15) ─────────────────────────────────────────────

export const catalogoEquipoSchema = z.object({
  q: z.string().trim().max(120).default(''),
  categoria: z.string().trim().max(80).default(''),
  pagina: z.coerce.number().int().min(1).max(500).default(1),
});
export type CatalogoEquipoConsulta = z.output<typeof catalogoEquipoSchema>;

export interface ProductoDelCatalogo {
  id: string;
  slug: string;
  titulo: string;
  /** «OC», «Normal»: la píldora junto al nombre. */
  version: string | null;
  categoria: { slug: string; nombre: string };
  marca: string | null;
  modelo: string | null;
  codigo_parte: string | null;
  sinonimos: string[];
  caracteristicas: Record<string, string>;
  foto: string | null;
  fotos: number;
  /** Tiendas con una publicación vigente. */
  tiendas: number;
}

/** `GET /v1/equipo/catalogo`. */
export interface RespuestaCatalogoEquipo {
  total: number;
  pagina: number;
  paginas: number;
  por_revisar: number;
  productos: ProductoDelCatalogo[];
}

/** Un producto que una tienda publicó a mano y el equipo todavía no revisó. */
export interface ProductoPorRevisar {
  id: string;
  /** «Gigabite rtx 4060 eagle oc»: lo que escribió. */
  titulo: string;
  marca: string | null;
  modelo: string | null;
  version: string | null;
  categoria: { slug: string; nombre: string };
  codigo_parte: string | null;
  tienda: string | null;
  creado_en: string;
  /** «¿Es este?»: el del catálogo que más se parece. */
  sugerido: {
    id: string;
    titulo: string;
    codigo_parte: string | null;
    razon: 'MISMO_CODIGO' | 'MUY_PARECIDO';
  } | null;
}

/** `GET /v1/equipo/catalogo/por-revisar`. */
export interface RespuestaPorRevisar {
  productos: ProductoPorRevisar[];
  /** Mismo modelo, códigos distintos: versiones distintas que se quedan separadas. */
  duplicados: Array<{
    a: { titulo: string; codigo_parte: string | null };
    b: { titulo: string; codigo_parte: string | null };
  }>;
}

const textoCatalogo = (maximo: number, mensaje: string) => z.string().trim().max(maximo, mensaje);

/** Una versión del producto: «OC» con su código de parte. */
export const versionCatalogoSchema = z.strictObject({
  nombre: textoCatalogo(40, 'La versión llega hasta 40 letras.'),
  codigo_parte: textoCatalogo(60, 'El código llega hasta 60 letras.'),
});

/**
 * `POST /v1/equipo/catalogo` («Agregar uno»): un producto por cada versión, o uno solo si no hay
 * versiones. Chip, memoria y lo demás van en `caracteristicas`.
 */
export const agregarCatalogoSchema = z.strictObject({
  categoria: z.string().trim().min(1, 'Elige la categoría.').max(80),
  marca: z.string().trim().min(1, 'Escribe la marca.').max(60),
  modelo: z.string().trim().min(2, 'Escribe el modelo.').max(120),
  versiones: z.array(versionCatalogoSchema).max(8, 'Hasta 8 versiones.').default([]),
  codigo_parte: textoCatalogo(60, 'El código llega hasta 60 letras.').default(''),
  caracteristicas: z.record(z.string().trim().max(40), z.string().trim().max(120)).default({}),
  sinonimos: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  fotos: z.array(z.string().max(300)).max(8).default([]),
});
export type AgregarCatalogoDatos = z.output<typeof agregarCatalogoSchema>;

/** `PATCH /v1/equipo/catalogo/:id` («Editar», «Corregir y agregar»): también lo da por revisado. */
export const editarCatalogoSchema = z.strictObject({
  categoria: z.string().trim().min(1).max(80).optional(),
  marca: z.string().trim().min(1).max(60).optional(),
  modelo: z.string().trim().min(2).max(120).optional(),
  version: textoCatalogo(40, 'La versión llega hasta 40 letras.').optional(),
  codigo_parte: textoCatalogo(60, 'El código llega hasta 60 letras.').optional(),
  sinonimos: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});
export type EditarCatalogoDatos = z.output<typeof editarCatalogoSchema>;

/** `POST /v1/equipo/catalogo/:id/unir`: «Unir con este». */
export const unirCatalogoSchema = z.strictObject({ con: z.uuid('Elige el producto.') });
export type UnirCatalogoDatos = z.output<typeof unirCatalogoSchema>;

/** Una fila del archivo que no se puede crear todavía. */
export interface FilaIncompleta {
  fila: number;
  producto: string;
  falta: string;
}

/** `POST /v1/equipo/catalogo/importar`: lo leído, para revisar antes de guardar. */
export interface RevisionImportacion {
  id: string;
  nombre: string;
  filas_leidas: number;
  fotos_encontradas: number;
  crear: number;
  existentes: number;
  incompletas: FilaIncompleta[];
}

/** `POST /v1/equipo/catalogo/importar/:id/crear`. */
export interface RespuestaImportacion {
  creados: number;
}
