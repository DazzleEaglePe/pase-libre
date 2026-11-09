/** Los filtros de `/buscar`, leídos de la dirección y vueltos a escribir en ella. */
export type GrupoFiltro = 'galeria' | 'marca' | 'condicion';
export type OrdenBusqueda = 'recientes' | 'precio_asc' | 'precio_desc';

export interface Filtros {
  q: string;
  categoria: string | null;
  galeria: string[];
  marca: string[];
  condicion: string[];
  /** «Solo con stock» viene prendido: quien busca quiere lo que puede comprar hoy. */
  stock: boolean;
  precioMin: string;
  precioMax: string;
  moneda: 'USD' | 'PEN';
  /** Nulo = el de cada quien: con sesión «Más barato primero», sin sesión «Más recientes». */
  orden: OrdenBusqueda | null;
  pagina: number;
}

type Parametros = Record<string, string | string[] | undefined>;

const uno = (valor: string | string[] | undefined): string =>
  (Array.isArray(valor) ? valor[0] : valor)?.trim() ?? '';

const lista = (valor: string | string[] | undefined): string[] =>
  (Array.isArray(valor) ? valor : (valor ?? '').split(','))
    .map((parte) => parte.trim().toLowerCase())
    .filter(Boolean);

export function leerFiltros(parametros: Parametros): Filtros {
  const orden = uno(parametros.orden);
  return {
    q: uno(parametros.q).slice(0, 100),
    categoria: uno(parametros.categoria).toLowerCase() || null,
    galeria: lista(parametros.galeria),
    marca: lista(parametros.marca),
    condicion: lista(parametros.condicion),
    stock: !['false', '0'].includes(uno(parametros.stock).toLowerCase()),
    precioMin: uno(parametros.precio_min),
    precioMax: uno(parametros.precio_max),
    moneda: uno(parametros.moneda).toUpperCase() === 'PEN' ? 'PEN' : 'USD',
    orden:
      orden === 'precio_asc' || orden === 'precio_desc' || orden === 'recientes' ? orden : null,
    pagina: Math.max(1, Math.min(500, Number.parseInt(uno(parametros.pagina), 10) || 1)),
  };
}

/**
 * `a=1&b=2`, sin lo que está en su valor por defecto. Para los enlaces de la web «Solo con
 * stock» prendido no se escribe; para la API (`paraApi`) sí, porque ella lo trae apagado.
 */
export function textoConsulta(filtros: Filtros, paraApi = false): string {
  const consulta = new URLSearchParams();
  if (filtros.q) consulta.set('q', filtros.q);
  if (filtros.categoria) consulta.set('categoria', filtros.categoria);
  if (filtros.galeria.length) consulta.set('galeria', filtros.galeria.join(','));
  if (filtros.marca.length) consulta.set('marca', filtros.marca.join(','));
  if (filtros.condicion.length) consulta.set('condicion', filtros.condicion.join(','));
  if (filtros.stock && paraApi) consulta.set('stock', 'true');
  if (!filtros.stock && !paraApi) consulta.set('stock', '0');
  if (filtros.precioMin) consulta.set('precio_min', filtros.precioMin);
  if (filtros.precioMax) consulta.set('precio_max', filtros.precioMax);
  if ((filtros.precioMin || filtros.precioMax) && filtros.moneda !== 'USD') {
    consulta.set('moneda', filtros.moneda);
  }
  if (filtros.orden) consulta.set('orden', filtros.orden);
  if (filtros.pagina > 1) consulta.set('pagina', String(filtros.pagina));
  return consulta.toString();
}

export function hrefBuscar(filtros: Filtros): string {
  const texto = textoConsulta(filtros);
  return texto ? `/buscar?${texto}` : '/buscar';
}

/** Cualquier cambio de filtros vuelve a la primera página. */
export const con = (filtros: Filtros, cambios: Partial<Filtros>): Filtros => ({
  ...filtros,
  pagina: 1,
  ...cambios,
});

export function alternar(filtros: Filtros, grupo: GrupoFiltro, valor: string): Filtros {
  const actuales = filtros[grupo];
  return con(filtros, {
    [grupo]: actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor],
  });
}

/** Los que achican los resultados. «Solo con stock» prendido es lo de siempre, no un filtro. */
export const hayFiltros = (filtros: Filtros): boolean =>
  filtros.galeria.length > 0 ||
  filtros.marca.length > 0 ||
  filtros.condicion.length > 0 ||
  Boolean(filtros.precioMin || filtros.precioMax);

/** Cuántos filtros hay puestos, para el número del botón «Filtros». */
export const cuantosFiltros = (filtros: Filtros): number =>
  filtros.galeria.length +
  filtros.marca.length +
  filtros.condicion.length +
  (filtros.precioMin || filtros.precioMax ? 1 : 0);

/** Quita todo menos lo que se buscó; «Solo con stock» vuelve a prenderse. */
export const sinFiltros = (filtros: Filtros): Filtros =>
  con(filtros, {
    galeria: [],
    marca: [],
    condicion: [],
    stock: true,
    precioMin: '',
    precioMax: '',
  });
