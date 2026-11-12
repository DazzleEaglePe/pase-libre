import type { MotivosImportacion } from '@paselibre/contracts';

/** Lo más que deja pasar nginx (docs/17): más pesado, se avisa antes de subir. */
export const MAX_BYTES_SUBIDA = 40 * 1024 * 1024;
const MEGA = 1024 * 1024;

/** «35,7 MB»; lo de menos de 1 MB, en KB. */
export function peso(bytes: number): string {
  if (bytes < MEGA) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  // Con coma, como en el lienzo: «35,7 MB».
  return `${String(Math.round((bytes / MEGA) * 10) / 10).replace('.', ',')} MB`;
}

/**
 * «Este ZIP pesa 52 MB, el máximo es 40 MB. Pártelo en dos.» (docs/18 §7). Nulo si se puede
 * subir. Se redondea hacia arriba para que nunca diga «pesa 40 MB» de uno que se pasa.
 */
export function avisoDePeso(nombre: string, bytes: number): string | null {
  if (bytes <= MAX_BYTES_SUBIDA) return null;
  const tipo = /\.zip$/i.test(nombre) ? 'Este ZIP' : 'Este archivo';
  return `${tipo} pesa ${Math.ceil(bytes / MEGA)} MB, el máximo es ${MAX_BYTES_SUBIDA / MEGA} MB. Pártelo en dos.`;
}

/** 0 a 100, sin pasarse. */
export function porcentaje(cargado: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((cargado / total) * 100)));
}

/**
 * «faltan unos 20 s» con lo que va subiendo por segundo. Nulo al empezar (todavía no se sabe) o
 * si ya terminó. Los segundos se redondean a 5 para que no salte a cada rato.
 */
export function faltanUnos(cargado: number, total: number, msDesdeInicio: number): string | null {
  if (cargado <= 0 || cargado >= total || msDesdeInicio < 1000) return null;
  const porSegundo = cargado / (msDesdeInicio / 1000);
  const segundos = (total - cargado) / porSegundo;
  if (segundos < 60) return `faltan unos ${Math.max(5, Math.round(segundos / 5) * 5)} s`;
  const minutos = Math.round(segundos / 60);
  return minutos === 1 ? 'falta como 1 min' : `faltan unos ${minutos} min`;
}

/** Una línea por motivo para el recuadro naranja: «28 sin foto», «1 código repetido»… */
export function lineasDeMotivos(motivos: MotivosImportacion): string[] {
  const lineas: Array<[number, string, string]> = [
    [motivos.sin_foto, 'sin foto', 'sin foto'],
    [motivos.sin_categoria, 'sin categoría', 'sin categoría'],
    [motivos.sin_marca, 'sin marca', 'sin marca'],
    [motivos.sin_modelo, 'sin modelo', 'sin modelo'],
    [motivos.repetida, 'código repetido', 'códigos repetidos'],
  ];
  return lineas.filter(([n]) => n > 0).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`);
}
