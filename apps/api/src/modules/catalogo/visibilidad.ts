import { precioDe, type Precio } from '@paselibre/contracts';
import type { Moneda } from '@prisma/client';

import type { Mirada } from '../../shared/guards/sesion-opcional.guard';

/**
 * Reglas de «Quién ve qué» (docs/05 §5) en un solo lugar.
 *
 * Las consultas de visitante ni siquiera piden las columnas de precio ni de tienda:
 * estas funciones solo se usan con lo que devolvieron las consultas con sesión.
 */
export function conSesion(mirada: Mirada): boolean {
  return mirada.audiencia !== 'visitante';
}

/** El equipo y la tienda dueña ven también el precio oculto. */
export function veOculto(mirada: Mirada, tiendaId: string): boolean {
  return mirada.audiencia === 'equipo' || mirada.tiendaId === tiendaId;
}

export function precioPara(
  oferta: {
    precioCentimos: bigint | null;
    moneda: Moneda;
    precioVisible: boolean;
    tiendaId: string;
  },
  mirada: Mirada,
): Precio | null {
  if (!conSesion(mirada) || oferta.precioCentimos === null) return null;
  if (!oferta.precioVisible && !veOculto(mirada, oferta.tiendaId)) return null;
  return precioDe(Number(oferta.precioCentimos), oferta.moneda);
}
