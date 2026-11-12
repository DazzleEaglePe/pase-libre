/**
 * Cómo se reconoce cada sesión abierta (Configuración · Seguridad, N10): el navegador y el
 * sistema, y dónde.
 */

/**
 * «Ahora · Lima» (N10). No hay un servicio de ubicación por IP y todas las tiendas de PaseLibre
 * están en Lima: por ahora es siempre Lima.
 */
export const LUGAR_DE_SESION = 'Lima';

/** «Chrome en Android», a partir del navegador. */
export function dispositivoDe(agente: string | null): string {
  if (!agente) return 'Navegador desconocido';
  const navegador = /Edg(e|iOS|A)?\//.test(agente)
    ? 'Edge'
    : /Firefox\/|FxiOS\//.test(agente)
      ? 'Firefox'
      : /OPR\/|Opera/.test(agente)
        ? 'Opera'
        : /Chrome\/|CriOS\//.test(agente)
          ? 'Chrome'
          : /Safari\//.test(agente)
            ? 'Safari'
            : 'Navegador';
  const sistema = /iPhone/.test(agente)
    ? 'iPhone'
    : /iPad/.test(agente)
      ? 'iPad'
      : /Android/.test(agente)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(agente)
          ? 'Mac'
          : /Windows/.test(agente)
            ? 'Windows'
            : /Linux/.test(agente)
              ? 'Linux'
              : '';
  return sistema ? `${navegador} en ${sistema}` : navegador;
}
