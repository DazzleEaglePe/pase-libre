import type { Moneda } from '../comun/dinero.js';

export type Rol = 'DUENO' | 'ASESOR' | 'EQUIPO';

/**
 * Lo que el dueño le deja hacer a cada asesor (N12). Chatear y responder siempre se puede;
 * agregar asesores y la seguridad de la tienda son solo del dueño. El dueño tiene todos.
 */
export const PERMISOS_ASESOR = [
  'COMPRAR_VENDER',
  'MARCAR_VENDIDO',
  'EN_VIVO',
  'PUBLICAR',
  'DATOS_TIENDA',
  'HISTORIAL',
] as const;
export type PermisoAsesor = (typeof PERMISOS_ASESOR)[number];

/** Los que vienen marcados al crear un asesor. */
export const PERMISOS_INICIALES: readonly PermisoAsesor[] = [
  'COMPRAR_VENDER',
  'MARCAR_VENDIDO',
  'EN_VIVO',
];

/** Una sesión abierta en la ventana «Ya tienes 2 sesiones abiertas» (N10). */
export interface SesionParaCerrar {
  id: string;
  /** «Chrome en Windows». */
  dispositivo: string;
  /** «Lima». */
  lugar: string;
  ultimo_uso: string;
}

/** `detalles` del error `LIMITE_DISPOSITIVOS` al ingresar (solo con la contraseña correcta). */
export interface DetallesLimiteDispositivos {
  limite: number;
  sesiones: SesionParaCerrar[];
}
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
    /** Con tienda y sin haber visto todavía la bienvenida del primer ingreso (OB_WebB). */
    ver_bienvenida: boolean;
    /** El panel del equipo en oscuro (COR18). */
    tema_oscuro: boolean;
    /** Lo que puede hacer en su tienda (N12): el dueño, todo; el asesor, lo que le dieron. */
    permisos: PermisoAsesor[];
  };
  /** Nula para las cuentas del equipo, que no pertenecen a ninguna tienda. */
  tienda: TiendaDeSesion | null;
  /**
   * «Ayudar como la tienda» (N14): alguien del equipo ve PaseLibre como el dueño. La franja de
   * arriba dice a quién ayuda y cuánto queda.
   */
  soporte: {
    tienda_id: string;
    tienda: string;
    /** Nombre de pila de quien ayuda. */
    equipo: string;
    vence_en: string;
  } | null;
}
