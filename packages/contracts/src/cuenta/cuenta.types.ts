import type { TipoTienda } from '../sesion/sesion.types.js';

export type Moneda = 'USD' | 'PEN';

/** `GET /v1/cuenta`: Configuración · Datos de la cuenta (RF-58). */
export interface RespuestaCuenta {
  usuario: {
    usuario: string;
    nombre: string;
    correo: string | null;
    whatsapp: string | null;
  };
  tienda: {
    nombre: string;
    tipo: TipoTienda;
    galeria: string | null;
    stand: string | null;
    whatsapp: string;
    horario: string | null;
    descripcion: string | null;
    precio_visible_defecto: boolean;
    moneda_defecto: Moneda;
  } | null;
}
