/** Las iniciales del círculo: «Computer Shock» → «CS», «Tienda B» → «TB». */
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const letras =
    palabras.length > 1 ? `${palabras[0]?.[0] ?? ''}${palabras[1]?.[0] ?? ''}` : nombre.slice(0, 2);
  return letras.toUpperCase();
}
