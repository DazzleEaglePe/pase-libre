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

/** Para elegir la tienda de un asesor. */
export interface TiendaParaEquipo {
  id: string;
  nombre: string;
  tipo: TipoTienda;
  galeria: string | null;
  stand: string | null;
}
