import type { Moneda } from '../comun/dinero.js';

export type Rol = 'DUENO' | 'ASESOR' | 'EQUIPO';
export type TipoTienda = 'TIENDA' | 'INDEPENDIENTE';

export interface TiendaDeSesion {
  id: string;
  nombre: string;
  tipo: TipoTienda;
  galeria: string | null;
  stand: string | null;
  /** Valores por defecto al publicar (D-37, RF-48): por ahora, precio oculto y en US$. */
  precio_visible_defecto: boolean;
  moneda_defecto: Moneda;
}

/** Respuesta de `GET /v1/yo` y de `POST /v1/sesion`. */
export interface RespuestaYo {
  usuario: {
    id: string;
    usuario: string;
    nombre: string;
    correo: string | null;
    rol: Rol;
    debe_cambiar_clave: boolean;
  };
  /** Nula para las cuentas del equipo, que no pertenecen a ninguna tienda. */
  tienda: TiendaDeSesion | null;
}
