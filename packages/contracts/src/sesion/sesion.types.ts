export type Rol = 'DUENO' | 'ASESOR' | 'EQUIPO';
export type TipoTienda = 'TIENDA' | 'INDEPENDIENTE';

export interface TiendaDeSesion {
  id: string;
  nombre: string;
  tipo: TipoTienda;
  galeria: string | null;
  stand: string | null;
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
