/**
 * Ninguna consulta de la API pasa de 8 s (docs/16 §4.4): una mala no acapara los núcleos de la
 * base ni deja a las demás esperando turno. Las más pesadas de hoy (buscar sin texto con 60 mil
 * productos, el mapa del sitio) tardan menos de medio segundo.
 */
export const TIEMPO_MAXIMO_CONSULTA_MS = 8_000;

/**
 * La dirección de la base con lo que la API le pide a cada conexión: `statement_timeout` y sin
 * JIT (compilar cada consulta costaba más que ejecutarla: ~1,2 s de CPU en una búsqueda de 1,6 s;
 * las consultas de la API son cortas). Solo la usa la API: las migraciones y la semilla leen la
 * misma DATABASE_URL tal cual, sin tiempo máximo. Si la dirección ya trae alguno de los dos en
 * `options`, se respeta (así se puede cambiar sin tocar el código).
 */
export function conOpcionesDeLaApi(url: string): string {
  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    return url;
  }
  const actuales = direccion.searchParams.get('options') ?? '';
  const agregar = [
    /statement_timeout/.test(actuales) ? null : `-c statement_timeout=${TIEMPO_MAXIMO_CONSULTA_MS}`,
    /(^|\s|-c\s*)jit\s*=/.test(actuales) ? null : '-c jit=off',
  ].filter((opcion): opcion is string => opcion !== null);
  if (agregar.length === 0) return url;
  direccion.searchParams.set('options', [actuales, ...agregar].filter(Boolean).join(' '));
  return direccion.toString();
}
