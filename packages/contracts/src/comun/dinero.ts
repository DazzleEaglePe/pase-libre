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
