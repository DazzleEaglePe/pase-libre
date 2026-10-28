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

/**
 * Título de un producto nuevo: la marca y el modelo, sin repetir la marca si el modelo ya
 * la trae («Zotac» + «Gaming GeForce RTX 3070 AMP Holo 8 GB»). Lo usan la API y la vista
 * previa de Publicar, para que el vendedor vea el mismo título que se guarda.
 */
export function tituloDeProducto(marca: string, modelo: string): string {
  const marcaLimpia = marca.trim();
  const modeloLimpio = modelo.trim();
  if (!marcaLimpia) return modeloLimpio;
  const conMarca = `${normalizarTexto(modeloLimpio)} `.startsWith(
    `${normalizarTexto(marcaLimpia)} `,
  );
  return conMarca ? modeloLimpio : `${marcaLimpia} ${modeloLimpio}`.trim();
}
