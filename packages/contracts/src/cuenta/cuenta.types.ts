import type { Moneda } from '../comun/dinero.js';
import type { Rol, TipoTienda } from '../sesion/sesion.types.js';

/** `GET /v1/cuenta` y `PATCH /v1/cuenta`: Configuración · Datos, Privacidad y Preferencias. */
export interface RespuestaCuenta {
  usuario: {
    usuario: string;
    nombre: string;
    correo: string | null;
    /** El de la persona; nulo si usa el de la tienda. */
    whatsapp: string | null;
    rol: Rol;
    mostrar_visto: boolean;
  };
  tienda: {
    nombre: string;
    tipo: TipoTienda;
    galeria: string | null;
    stand: string | null;
    whatsapp: string;
    horario: string | null;
    descripcion: string | null;
    /** Ruta del logo (`/media/<ruta>`), o nulo. */
    logo: string | null;
    precio_visible_defecto: boolean;
    moneda_defecto: Moneda;
  } | null;
}

/** `GET/PUT /v1/cuenta/avisos` (RF-59). Las horas van como «22:00», hora de Lima. */
export interface RespuestaAvisosCuenta {
  campanita: { MENSAJE: boolean };
  no_molestar: { desde: string; hasta: string } | null;
}

/** Una sesión abierta, para «Cerrar todas las demás» (Configuración · Seguridad). */
export interface SesionAbierta {
  id: string;
  /** «Chrome en Android», a partir del navegador. */
  dispositivo: string;
  ultimo_uso: string;
  actual: boolean;
}

/** Una tienda bloqueada, para desbloquearla desde Configuración · Privacidad. */
export interface TiendaBloqueada {
  tienda: { id: string; nombre: string; galeria: string | null };
  desde: string;
}
