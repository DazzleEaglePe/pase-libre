import { ORDENES_DIRECTORIO, type OrdenDirectorio } from '@paselibre/contracts';

/** Los filtros de la pestaña «Tiendas» (N13), tal como van en la dirección. */
export interface ConsultaDirectorio {
  q: string;
  galeria: string;
  piso: string;
  vende: string;
  orden: OrdenDirectorio;
}

export const ORDEN_POR_DEFECTO: OrdenDirectorio = 'reputacion';

/** «Ordenar: Mejor reputación ▾» y las demás. */
export const TEXTO_ORDEN: Record<OrdenDirectorio, string> = {
  reputacion: 'Mejor reputación',
  productos: 'Más productos',
  recientes: 'Recién llegadas',
  nombre: 'Nombre (A-Z)',
};

type Parametros = Record<string, string | string[] | undefined>;

function texto(valor: string | string[] | undefined, largo: number): string {
  const uno = Array.isArray(valor) ? valor[0] : valor;
  return (uno ?? '').trim().slice(0, largo);
}

/** Lee la dirección sin confiar en ella: lo que no sirve queda vacío o por defecto. */
export function leerConsultaDirectorio(parametros: Parametros): ConsultaDirectorio {
  const orden = texto(parametros.orden, 20);
  return {
    q: texto(parametros.q, 60),
    galeria: texto(parametros.galeria, 80),
    piso: texto(parametros.piso, 20),
    vende: texto(parametros.vende, 80),
    orden: (ORDENES_DIRECTORIO as readonly string[]).includes(orden)
      ? (orden as OrdenDirectorio)
      : ORDEN_POR_DEFECTO,
  };
}

/** Lo que se manda a `GET /v1/wilson/tiendas`, sin lo vacío ni el orden por defecto. */
export function parametrosDirectorio(consulta: ConsultaDirectorio, pagina = 1): URLSearchParams {
  const parametros = new URLSearchParams();
  for (const clave of ['q', 'galeria', 'piso', 'vende'] as const) {
    if (consulta[clave]) parametros.set(clave, consulta[clave]);
  }
  if (consulta.orden !== ORDEN_POR_DEFECTO) parametros.set('orden', consulta.orden);
  if (pagina > 1) parametros.set('pagina', String(pagina));
  return parametros;
}

/** La dirección de la pestaña «Tiendas» con estos filtros. */
export function hrefDirectorio(
  consulta: ConsultaDirectorio,
  cambios: Partial<ConsultaDirectorio> = {},
): string {
  const nueva = { ...consulta, ...cambios };
  // Otra galería tiene otros pisos.
  if (cambios.galeria !== undefined && cambios.galeria !== consulta.galeria) nueva.piso = '';
  const parametros = parametrosDirectorio(nueva);
  const resto = parametros.toString();
  return `/wilson-en-vivo?pestana=tiendas${resto ? `&${resto}` : ''}`;
}

export const SIN_FILTROS: ConsultaDirectorio = {
  q: '',
  galeria: '',
  piso: '',
  vende: '',
  orden: ORDEN_POR_DEFECTO,
};
