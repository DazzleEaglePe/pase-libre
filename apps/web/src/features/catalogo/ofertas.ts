import type { Condicion, Foto, Precio, RespuestaFicha } from '@paselibre/contracts';

/** Una oferta de la ficha, igual para quien ve precios y tiendas y para quien no. */
export interface OfertaVista {
  id: string;
  condicion: Condicion;
  stock: number;
  galeria: string | null;
  descripcion: string | null;
  fotos: Foto[];
  actualizadaEn: string;
  /** Solo con sesión. */
  /** `id` vacío con la tienda reservada (no se puede abrir su perfil). */
  tienda: { id: string; nombre: string; stand: string | null } | null;
  precio: Precio | null;
  precioVisible: boolean;
  /** Falso: las demás tiendas la ven como «Tienda reservada» (y sin WhatsApp). */
  tiendaVisible: boolean;
  /** «Responde en ~10 min»: minutos, o nulo si no hay datos (o la tienda es reservada). */
  respondeEnMin: number | null;
  propia: boolean;
}

export function ofertasVista(ficha: RespuestaFicha): OfertaVista[] {
  if (ficha.audiencia === 'visitante') {
    return ficha.ofertas.map((oferta) => ({
      id: oferta.id,
      condicion: oferta.condicion,
      stock: oferta.stock,
      galeria: oferta.galeria,
      descripcion: oferta.descripcion,
      fotos: oferta.fotos,
      actualizadaEn: oferta.actualizada_en,
      tienda: null,
      precio: null,
      precioVisible: false,
      tiendaVisible: true,
      respondeEnMin: null,
      propia: false,
    }));
  }
  return ficha.ofertas.map((oferta) => ({
    id: oferta.id,
    condicion: oferta.condicion,
    stock: oferta.stock,
    galeria: oferta.galeria,
    descripcion: oferta.descripcion,
    fotos: oferta.fotos,
    actualizadaEn: oferta.actualizada_en,
    tienda: { id: oferta.tienda.id, nombre: oferta.tienda.nombre, stand: oferta.tienda.stand },
    precio: oferta.precio,
    precioVisible: oferta.precio_visible,
    tiendaVisible: oferta.tienda_visible,
    respondeEnMin: oferta.responde_en_min,
    propia: oferta.propia,
  }));
}
