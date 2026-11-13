import type {
  Condicion,
  DetalleOferta,
  Foto,
  ModoVenta,
  Precio,
  RespuestaFicha,
} from '@paselibre/contracts';

/** Una oferta de la ficha, igual para quien ve precios y tiendas y para quien no. */
export interface OfertaVista {
  id: string;
  condicion: Condicion;
  detalle: DetalleOferta;
  stock: number;
  galeria: string | null;
  descripcion: string | null;
  fotos: Foto[];
  /** La portada que eligió la tienda (una de `fotos`), o nula: la primera miniatura (doc 20 · 23). */
  portada: string | null;
  actualizadaEn: string;
  /** Solo con sesión. */
  /** `id` vacío y sin logo con la tienda reservada (no se puede abrir su perfil). */
  tienda: { id: string; nombre: string; stand: string | null; logo: string | null } | null;
  precio: Precio | null;
  precioVisible: boolean;
  modoVenta: ModoVenta;
  precioFacturado: Precio | null;
  /** El precio que se ve es el de socio; `descuento` es cuánto menos. */
  precioSocio: boolean;
  descuentoSocio: Precio | null;
  /** Solo lo ven sus socios: para las demás, «Precio por chat». */
  soloSocios: boolean;
  aceptaOfertas: boolean;
  /** «Negociable» al lado del precio (N06). */
  negociable: boolean;
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
      detalle: oferta.detalle,
      stock: oferta.stock,
      galeria: oferta.galeria,
      descripcion: oferta.descripcion,
      fotos: oferta.fotos,
      portada: oferta.portada,
      actualizadaEn: oferta.actualizada_en,
      tienda: null,
      precio: null,
      precioVisible: false,
      modoVenta: 'PASE',
      precioFacturado: null,
      precioSocio: false,
      descuentoSocio: null,
      soloSocios: false,
      aceptaOfertas: false,
      negociable: false,
      tiendaVisible: true,
      respondeEnMin: null,
      propia: false,
    }));
  }
  return ficha.ofertas.map((oferta) => ({
    id: oferta.id,
    condicion: oferta.condicion,
    detalle: oferta.detalle,
    stock: oferta.stock,
    galeria: oferta.galeria,
    descripcion: oferta.descripcion,
    fotos: oferta.fotos,
    portada: oferta.portada,
    actualizadaEn: oferta.actualizada_en,
    tienda: {
      id: oferta.tienda.id,
      nombre: oferta.tienda.nombre,
      stand: oferta.tienda.stand,
      logo: oferta.tienda.logo ?? null,
    },
    precio: oferta.precio,
    precioVisible: oferta.precio_visible,
    modoVenta: oferta.modo_venta,
    precioFacturado: oferta.precio_facturado,
    precioSocio: oferta.precio_socio,
    descuentoSocio: oferta.descuento_socio,
    soloSocios: oferta.solo_socios,
    aceptaOfertas: oferta.acepta_ofertas,
    negociable: oferta.negociable,
    tiendaVisible: oferta.tienda_visible,
    respondeEnMin: oferta.responde_en_min,
    propia: oferta.propia,
  }));
}
