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
  tienda: { nombre: string; stand: string | null } | null;
  precio: Precio | null;
  precioVisible: boolean;
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
    tienda: { nombre: oferta.tienda.nombre, stand: oferta.tienda.stand },
    precio: oferta.precio,
    precioVisible: oferta.precio_visible,
    propia: oferta.propia,
  }));
}
