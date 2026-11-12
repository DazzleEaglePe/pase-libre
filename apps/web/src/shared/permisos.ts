import type { PermisoAsesor, RespuestaYo } from '@paselibre/contracts';

/**
 * Lo que el dueño le dejó hacer al asesor (N12). La API lo hace cumplir; la web solo esconde lo
 * que no puede hacer. Sin la lista (una sesión vieja en caché), se muestra todo y decide la API.
 */
export function puede(
  permisos: readonly PermisoAsesor[] | undefined,
  permiso: PermisoAsesor,
): boolean {
  return !permisos || permisos.includes(permiso);
}

export function sesionPuede(sesion: RespuestaYo | null, permiso: PermisoAsesor): boolean {
  return puede(sesion?.usuario.permisos, permiso);
}
