import type { EstadoSolicitud, Horario, MetodoSolicitud } from './registro.schemas.js';

export interface RespuestaOpcionesRegistro {
  /** Apagado, la web sigue con «pide tu cuenta» al equipo. */
  activo: boolean;
  galerias: Array<{ slug: string; nombre: string }>;
  categorias: readonly string[];
}

export interface RespuestaCodigo {
  enviado: true;
  /** Segundos hasta que se puede pedir otro código. */
  reenviar_en_s: number;
  /** Solo con los proveedores simulados (local y pruebas): el SMS de verdad no existe. */
  codigo_prueba: string | null;
}

export interface RespuestaVerificacion {
  token_celular: string;
  expira_en: string;
}

export interface DatosRuc {
  razon_social: string;
  estado: string;
  condicion: string;
  domicilio: string;
}

export interface RespuestaRuc {
  encontrado: boolean;
  /** Activo y habido: se aprueba sola. */
  apto: boolean;
  datos: DatosRuc | null;
}

/** Lo que quien se registró puede ver y volver a editar (sin DNI ni clave). */
export interface DatosSolicitudPropios {
  metodo: MetodoSolicitud;
  ruc: string | null;
  recomienda_tienda: string | null;
  nombre_comercial: string;
  categorias: string[];
  galeria: string | null;
  galeria_otra: string | null;
  piso: string | null;
  stand: string;
  referencia: string | null;
  horario: Horario | null;
  encargado: string;
  celular: string;
}

export interface RespuestaSolicitud {
  /** Solo al enviarla: guárdalo, es la forma de volver a ver el estado. */
  consulta: string | null;
  estado: EstadoSolicitud;
  aprobada_sola: boolean;
  vence_en: string | null;
  mensaje_equipo: string | null;
  /** El usuario con el que entra (su celular), cuando ya está aprobada. */
  usuario: string | null;
  datos: DatosSolicitudPropios;
}

export interface SolicitudEquipo {
  id: string;
  estado: EstadoSolicitud;
  metodo: MetodoSolicitud;
  aprobada_sola: boolean;
  nombre_comercial: string;
  celular: string;
  categorias: string[];
  galeria: string | null;
  galeria_otra: string | null;
  piso: string | null;
  stand: string;
  referencia: string | null;
  horario: string;
  encargado: string;
  ruc: string | null;
  ruc_datos: DatosRuc | null;
  /** Se borra al aprobar o rechazar. */
  dni: string | null;
  recomienda_tienda: string | null;
  mensaje_equipo: string | null;
  vence_en: string | null;
  creada_en: string;
  revisada_en: string | null;
  tienda_id: string | null;
}

export interface RespuestaSolicitudesEquipo {
  solicitudes: SolicitudEquipo[];
  resumen: {
    pendientes: number;
    requieren_cambios: number;
    aprobadas: number;
    rechazadas: number;
    /** Pendientes que ya pasaron su plazo. */
    vencidas: number;
  };
}
