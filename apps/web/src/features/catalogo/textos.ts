import type { Condicion } from '@paselibre/contracts';

export const textoEstado = (condicion: Condicion): string =>
  condicion === 'NUEVO' ? 'Nuevo' : 'Usado';

export const textoCondiciones = (condiciones: Condicion[]): string =>
  condiciones.length > 1 ? 'Nuevo y usado' : condiciones[0] ? textoEstado(condiciones[0]) : '';

export const textoStock = (stock: number): string =>
  stock === 1 ? '1 disponible' : `${stock} disponibles`;

export const textoOfertas = (cantidad: number): string =>
  cantidad === 1 ? '1 oferta' : `${cantidad} ofertas`;
