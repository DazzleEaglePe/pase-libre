import { MAX_DESCRIPCION } from '@paselibre/contracts';

/**
 * Los botones de «Detalles (opcional)» que no son una casilla de la oferta (N06): se escriben
 * en el texto que ven las demás tiendas.
 */
export const DETALLES_EN_TEXTO = ['Accesorios completos', 'Entrega inmediata'] as const;

const patronDe = (frase: string) => new RegExp(`(^|[\\s.,;])${frase}\\.?(?=$|[\\s,;])`, 'i');

/** Si lo escrito ya dice «Accesorios completos». */
export function tieneEnTexto(texto: string, frase: string): boolean {
  return patronDe(frase).test(texto);
}

/**
 * Agrega «Accesorios completos.» al final de lo escrito o lo quita si ya estaba, sin tocar lo
 * demás. Nunca pasa del máximo de la descripción.
 */
export function alternarEnTexto(texto: string, frase: string): string {
  if (tieneEnTexto(texto, frase)) {
    return texto
      .replace(patronDe(frase), '$1')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s.]+/, '')
      .trim();
  }
  const limpio = texto.trim();
  const punto = limpio && !/[.!?]$/.test(limpio) ? '.' : '';
  return `${limpio}${punto}${limpio ? ' ' : ''}${frase}.`.slice(0, MAX_DESCRIPCION);
}
