export type Moneda = 'USD' | 'PEN';

/**
 * Un precio tal como viaja por la API. Se guarda en céntimos enteros (US$ 250 → 25000);
 * `monto` es el mismo valor con dos decimales, listo para formatear.
 */
export interface Precio {
  moneda: Moneda;
  centimos: number;
  monto: string;
}

export function precioDe(centimos: number, moneda: Moneda): Precio {
  return { moneda, centimos, monto: (centimos / 100).toFixed(2) };
}

/** Tope de un precio: 9 999 999.99 en cualquiera de las dos monedas. */
export const MAX_CENTIMOS = 999_999_999;

/**
 * Lee un monto escrito a mano y lo devuelve en céntimos, o nulo si no se entiende.
 * Acepta «250», «1699.9», «1,699.90», «1.699,90» y «250,50»: si hay punto y coma, el
 * último es el decimal; si hay un solo separador con 1 o 2 cifras detrás, es el decimal;
 * en otro caso separa miles. Nunca pasa por números con coma flotante.
 */
export function centimosDeMonto(texto: string): number | null {
  const limpio = texto.replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(limpio)) return null;

  const ultimoPunto = limpio.lastIndexOf('.');
  const ultimaComa = limpio.lastIndexOf(',');
  let entero = limpio;
  let decimales = '';
  const separador = Math.max(ultimoPunto, ultimaComa);
  if (separador !== -1) {
    const detras = limpio.slice(separador + 1);
    const ambos = ultimoPunto !== -1 && ultimaComa !== -1;
    const unoSolo = limpio.split(limpio[separador] as string).length === 2;
    if (ambos || (unoSolo && /^\d{1,2}$/.test(detras))) {
      entero = limpio.slice(0, separador);
      decimales = detras;
    }
  }
  entero = entero.replace(/[.,]/g, '');
  if (!/^\d+$/.test(entero) || !/^\d{0,2}$/.test(decimales)) return null;

  const centimos = Number(entero) * 100 + Number(decimales.padEnd(2, '0'));
  return centimos > 0 && centimos <= MAX_CENTIMOS ? centimos : null;
}

/** El monto para volver a ponerlo en un campo: «250» o «1699.90». */
export function montoParaCampo(centimos: number): string {
  return centimos % 100 === 0 ? String(centimos / 100) : (centimos / 100).toFixed(2);
}

/** «US$ 250» o «S/ 1,699.99», como en el lienzo. */
export function formatearPrecio({ moneda, centimos }: Precio): string {
  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const conDecimales = centimos % 100 !== 0;
  const numero = (centimos / 100).toLocaleString('en-US', {
    minimumFractionDigits: conDecimales ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${simbolo} ${numero}`;
}
