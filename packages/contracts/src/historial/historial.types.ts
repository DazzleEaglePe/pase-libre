import type { Precio } from '../comun/dinero.js';
import type { ModoVenta } from '../ofertas/ofertas.types.js';

/** Una venta o una compra en «Mis ventas y compras» (HI_A2_Web). Cada una es una unidad. */
export interface VentaEnHistorial {
  id: string;
  fecha: string;
  producto: {
    titulo: string;
    slug: string;
    foto: string | null;
    categoria: { slug: string; nombre: string };
  };
  /** A quién le vendiste o a quién le compraste; con la tienda reservada, sin id ni nombre real. */
  otra_tienda: { id: string; nombre: string };
  modo: ModoVenta;
  precio: Precio | null;
  conversacion_id: string | null;
  /** En ventas, cómo te calificó; en compras, cómo calificaste tú. */
  calificacion: number | null;
  /** Compra sin tu opinión todavía. */
  puede_calificar: boolean;
  /** Venta que aún no te califica y a la que no le recordaste. */
  puede_recordar: boolean;
}

export interface RespuestaHistorial {
  lado: 'ventas' | 'compras';
  mes: string;
  /** Los meses con algo, del más reciente al más antiguo (hasta 6). */
  meses: Array<{ mes: string; etiqueta: string }>;
  /** Del mes elegido. */
  conteos: { ventas: number; compras: number };
  /**
   * Ventas por mes en los tres meses anteriores al elegido, desde el de tu primera venta: «vas
   * 57 % por encima de tu promedio (14 items al mes)». Nulo si antes no vendiste nada.
   */
  promedio_ventas: number | null;
  /** «Lo que más vendiste» o compraste, por categoría. */
  por_categoria: Array<{ categoria: string; items: number }>;
  /** Con quiénes, para el filtro «Tienda». */
  tiendas: Array<{ id: string; nombre: string }>;
  lista: VentaEnHistorial[];
}
