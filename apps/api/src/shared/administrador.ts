import type { Rol } from '@prisma/client';

/**
 * Quién es «administrador» en el panel del Equipo (doc 19 §9: «Eliminar definitivamente» solo lo
 * ven ellos). Hoy no hay roles dentro del Equipo: toda cuenta `EQUIPO` (las crea `pnpm
 * cuenta:equipo`) lo es. Cuando haya un rol propio, se cambia solo aquí.
 */
export function esAdministrador(usuario: { rol: Rol }): boolean {
  return usuario.rol === 'EQUIPO';
}
