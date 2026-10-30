import {
  formatearPrecio,
  type EnVivoConVendedor,
  type EstadoEnVivo,
  type EnVivoPublico,
  type TipoEnVivo,
} from '@paselibre/contracts';

export type ItemEnVivo = EnVivoPublico | EnVivoConVendedor;

export const conVendedor = (item: ItemEnVivo): item is EnVivoConVendedor => 'tienda' in item;

/** En la web, el FLASH de la API se lee «Remato»: así le dicen en Wilson. */
export const etiquetaTipo = (tipo: TipoEnVivo) => (tipo === 'BUSCO' ? 'Busco' : 'Remato');
export const textoAccion = (tipo: TipoEnVivo) => (tipo === 'BUSCO' ? '¡Lo tengo!' : '¡Lo quiero!');

/** «Quedan 1 h 40 min», «Quedan 35 min», «Vence en 1 min». `corto` deja «1 h 40 min». */
export function cuantoQueda(venceEn: string, ahora: number, corto = false): string {
  const minutos = Math.ceil((new Date(venceEn).getTime() - ahora) / 60_000);
  if (minutos <= 0) return 'Venció';
  if (minutos <= 1) return corto ? '1 min' : 'Vence en 1 min';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const tiempo =
    minutos < 60 ? `${minutos} min` : resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  return corto ? tiempo : `Quedan ${tiempo}`;
}

/**
 * El dato de la línea de abajo: el presupuesto del busco o el precio de la oferta flash.
 * Sin sesión, lo que se ve al iniciarla (RF-77).
 */
export function datoPrecio(item: ItemEnVivo): string {
  if (!conVendedor(item)) {
    return item.tipo === 'BUSCO' ? 'Presupuesto con sesión' : 'Precio con sesión';
  }
  if (!item.precio) return 'Sin presupuesto';
  const precio = formatearPrecio(item.precio);
  return item.tipo === 'BUSCO' ? `Paga hasta ${precio}` : precio;
}

/** «Maxiplaza · Paga hasta US$ 300», con la tienda cuando hay sesión. */
export function lineaLugar(item: ItemEnVivo): string {
  const lugar = conVendedor(item) ? item.tienda.nombre : (item.galeria ?? 'Independiente');
  return `${lugar} · ${datoPrecio(item)}`;
}

/** «2 unidades · Nuevo» para la ficha completa; vacío si es 1 y acepta cualquiera. */
export function lineaCantidad(item: ItemEnVivo): string {
  const partes = [
    item.cantidad > 1
      ? `${item.cantidad} ${item.tipo === 'BUSCO' ? 'unidades' : 'disponibles'}`
      : null,
    item.condicion === 'NUEVO' ? 'Nuevo' : item.condicion === 'USADO' ? 'Usado' : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/** «Lo consiguió», «Vendido», «Cerrado» o «Venció», para «Cerrados hoy». */
export function textoCierre(item: { estado: EstadoEnVivo }): string {
  if (item.estado === 'CONSEGUIDO') return 'Lo consiguió';
  if (item.estado === 'VENDIDO') return 'Vendido';
  if (item.estado === 'CERRADO') return 'Cerrado';
  return 'Venció';
}
