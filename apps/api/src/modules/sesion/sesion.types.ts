import type { Galeria, Tienda, Usuario } from '@prisma/client';

export type UsuarioConTienda = Usuario & {
  tienda: (Tienda & { galeria: Galeria | null }) | null;
};

/** Lo que el guard deja en `request.sesion` para los controladores. */
export interface SesionActiva {
  sesionId: string;
  usuario: UsuarioConTienda;
}

export interface DatosDeSolicitud {
  agente?: string;
  ip?: string;
}

export const COOKIE_SESION = 'pl_sesion';
export const DURACION_SESION_MS = 12 * 60 * 60 * 1000;
export const DURACION_RECORDAR_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_INTENTOS_FALLIDOS = 5;
export const VENTANA_INTENTOS_MS = 15 * 60 * 1000;
