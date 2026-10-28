import type { TipoTienda } from '../sesion/sesion.types.js';

/**
 * Estado que ve el equipo (RF-49):
 * - `SIN_PRIMER_INGRESO`: nunca entró ni cambió la clave temporal.
 * - `ACTIVA`: ya entró al menos una vez.
 * - `SUSPENDIDA`: no puede entrar.
 */
export type EstadoCuenta = 'ACTIVA' | 'SIN_PRIMER_INGRESO' | 'SUSPENDIDA';

export interface CuentaEquipo {
  id: string;
  usuario: string;
  nombre: string;
  correo: string | null;
  whatsapp: string | null;
  rol: 'DUENO' | 'ASESOR';
  estado: EstadoCuenta;
  /** Ya entró antes, pero el equipo le dio una clave temporal nueva que aún no cambia. */
  clave_temporal_pendiente: boolean;
  tienda: {
    id: string;
    nombre: string;
    tipo: TipoTienda;
    galeria: string | null;
    stand: string | null;
    /** Cuentas de la tienda, contando esta: con una sola no hay a quién traspasar. */
    cuentas: number;
  };
  /** Lo que está a su nombre: si se suspende, conviene traspasarlo (RF-71). */
  a_cargo: {
    /** Publicaciones no eliminadas de las que es responsable. */
    publicaciones: number;
    /** Conversaciones con mensajes, como vendedor o como comprador. */
    conversaciones: number;
  };
  ultimo_ingreso_en: string | null;
  creada_en: string;
}

/** `GET /v1/equipo/cuentas`. */
export interface RespuestaCuentas {
  cuentas: CuentaEquipo[];
  resumen: { total: number; activas: number; sin_primer_ingreso: number; suspendidas: number };
}

/**
 * Al crear una cuenta o darle una clave temporal nueva. La clave solo viaja en esta
 * respuesta (en la base queda su hash): el equipo la envía por WhatsApp con `mensaje`.
 */
export interface RespuestaAcceso {
  cuenta: CuentaEquipo;
  clave_temporal: string;
  mensaje: string;
  /** `wa.me` con el mensaje armado, o nulo si la cuenta no tiene WhatsApp. */
  enlace_whatsapp: string | null;
}

/** `POST /v1/equipo/cuentas/:id/traspasar`. */
export interface RespuestaTraspaso {
  publicaciones: number;
  conversaciones: number;
  /**
   * Conversaciones en las que preguntó como comprador y que no se pudieron pasar porque la
   * cuenta que recibe ya tenía una por la misma publicación. Siguen a nombre de quien entrega.
   */
  omitidas: number;
  desde: CuentaEquipo;
  hacia: CuentaEquipo;
}

/** Para elegir la tienda de un asesor. */
export interface TiendaParaEquipo {
  id: string;
  nombre: string;
  tipo: TipoTienda;
  galeria: string | null;
  stand: string | null;
}
