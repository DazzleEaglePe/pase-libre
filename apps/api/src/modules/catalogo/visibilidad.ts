import { precioDe, TIENDA_RESERVADA, type Precio } from '@paselibre/contracts';
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

/**
 * La tienda de una oferta tal como la ve quien mira: con la tienda reservada, las demás
 * tiendas reciben «Tienda reservada», sin id, ni stand, ni logo (el logo la delataría). La
 * dueña y el equipo la ven igual.
 */
export function tiendaPara(
  oferta: { tiendaVisible: boolean; tiendaId: string },
  tienda: { id: string; nombre: string; stand: string | null; logo?: string | null },
  mirada: Mirada,
): { id: string; nombre: string; stand: string | null; logo: string | null } {
  if (oferta.tiendaVisible || veOculto(mirada, oferta.tiendaId)) {
    return { id: tienda.id, nombre: tienda.nombre, stand: tienda.stand, logo: tienda.logo ?? null };
  }
  return { id: '', nombre: TIENDA_RESERVADA, stand: null, logo: null };
}

/** Lo que hace falta de una oferta para saber qué precios ve cada quien (PS_Precio). */
export interface OfertaConPrecios {
  precioCentimos: bigint | null;
  precioFacturadoCentimos: bigint | null;
  descuentoSocioCentimos: bigint | null;
  moneda: Moneda;
  precioVisible: boolean;
  soloSocios: boolean;
  tiendaId: string;
}

/**
 * Los precios que ve quien mira, con los socios (PS_Precio): `socios` son las tiendas que
 * tienen a quien mira como socia. Ve el precio si es público, o si es «Solo mis socios» y es
 * socia; si es socia y hay precio socio, el de pase le sale con el descuento. La dueña y el
 * equipo ven siempre los precios tal cual.
 */
export function preciosPara(
  oferta: OfertaConPrecios,
  mirada: Mirada,
  socios: ReadonlySet<string>,
): { precio: Precio | null; facturado: Precio | null; socio: boolean; descuento: Precio | null } {
  const nada = { precio: null, facturado: null, socio: false, descuento: null };
  if (!conSesion(mirada)) return nada;
  const monto = (centimos: bigint | null) =>
    centimos === null ? null : precioDe(Number(centimos), oferta.moneda);
  if (veOculto(mirada, oferta.tiendaId)) {
    return {
      precio: monto(oferta.precioCentimos),
      facturado: monto(oferta.precioFacturadoCentimos),
      socio: false,
      descuento: null,
    };
  }
  const esSocia = socios.has(oferta.tiendaId);
  if (!oferta.precioVisible && !(oferta.soloSocios && esSocia)) return nada;
  const descuento = esSocia ? oferta.descuentoSocioCentimos : null;
  // El descuento baja el pase y el facturado, sin pasar de cero (PS_Precio).
  const menos = (centimos: bigint | null) =>
    centimos === null || descuento === null || descuento >= centimos
      ? centimos
      : centimos - descuento;
  const conDescuento =
    descuento !== null &&
    ((oferta.precioCentimos !== null && descuento < oferta.precioCentimos) ||
      (oferta.precioFacturadoCentimos !== null && descuento < oferta.precioFacturadoCentimos));
  return {
    precio: monto(conDescuento ? menos(oferta.precioCentimos) : oferta.precioCentimos),
    facturado: monto(
      conDescuento ? menos(oferta.precioFacturadoCentimos) : oferta.precioFacturadoCentimos,
    ),
    socio: conDescuento,
    descuento: conDescuento ? monto(descuento) : null,
  };
}
