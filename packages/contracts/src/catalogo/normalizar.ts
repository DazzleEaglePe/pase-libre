/**
 * Normalización única para buscar y para guardar (docs/05 §7, RNF-26).
 *
 * Minúsculas, sin tildes, sin signos y con letras y números separados, para que
 * «RTX3070», «rtx 3070» y «RTX-3070» den lo mismo. Se aplica igual al texto del
 * catálogo y a lo que escribe el usuario, así las palabras siempre coinciden.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Clave de una etiqueta: dos etiquetas con la misma clave son la misma. */
export function claveEtiqueta(nombre: string): string {
  return normalizarTexto(nombre);
}

/** Slug legible para las rutas `/p/:producto`. */
export function slugDe(texto: string): string {
  return normalizarTexto(texto).replace(/ /g, '-');
}
