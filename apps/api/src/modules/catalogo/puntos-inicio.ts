import type { ChapitaInicio, FuerzaDestacado } from '@paselibre/contracts';

/**
 * El orden del Inicio por puntos (doc 20, punto 4b). Cada publicación vigente suma o resta según
 * esta tabla; todo está aquí, en constantes, para ajustarlo sin buscar en el código.
 */

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

/** Novedad, por `creadaEn`: 20 min o menos +40 · hasta 6 h +25 · hasta 24 h +15 · hasta 3 días +5. */
export const PUNTOS_NOVEDAD: ReadonlyArray<{ hasta: number; puntos: number }> = [
  { hasta: 20 * MINUTO, puntos: 40 },
  { hasta: 6 * HORA, puntos: 25 },
  { hasta: 24 * HORA, puntos: 15 },
  { hasta: 3 * DIA, puntos: 5 },
];
/** «Más barato de la galería». */
export const PUNTOS_MAS_BARATO = 15;
/** «Muy buscado hoy». */
export const PUNTOS_MUY_BUSCADO = 10;
/** «Bajó de precio» en las últimas 48 h. */
export const PUNTOS_BAJO_DE_PRECIO = 8;
/** Reseñas de la tienda: de 0 a +10 con su puntaje (`reputacion-corta.ts`). */
export const PUNTOS_RESENAS_MAXIMO = 10;
/** «Responde rápido»: la tienda contesta en menos de 15 min. */
export const PUNTOS_RESPONDE_RAPIDO = 5;
export const RESPONDE_RAPIDO_MINUTOS = 15;
/** El día destacado de una tienda fundadora (punto 7), todo ese día en hora de Lima. */
export const PUNTOS_DIA_FUNDADORA = 25;
/** «Destacar» del Equipo, mientras dure. */
export const PUNTOS_DESTACAR: Readonly<Record<FuerzaDestacado, number>> = {
  SUAVE: 20,
  MEDIA: 40,
  FUERTE: 70,
};
/** Por cada reporte abierto de esa publicación. */
export const PUNTOS_POR_REPORTE = -15;
/** «Vieja»: no se actualizó en 14 días. */
export const PUNTOS_VIEJA = -10;
export const VIEJA_DESDE = 14 * DIA;

/** «Recién publicado» (la chapita): 20 minutos o menos. */
export const RECIEN_PUBLICADO = 20 * MINUTO;
/** «Bajó de precio»: en las últimas 48 h. */
export const BAJO_DE_PRECIO = 48 * HORA;

/** «Muy buscado hoy»: los 10 productos con más puntos hoy, con al menos 3. */
export const MUY_BUSCADO_CUANTOS = 10;
export const MUY_BUSCADO_MINIMO = 3;
/** Cada pedido en vivo de hoy de ese producto vale 3 vistas. */
export const MUY_BUSCADO_POR_PEDIDO = 3;

/** Qué entra al orden: lo vigente de los últimos 30 días, como mucho las 600 más nuevas. */
export const VENTANA_INICIO = 30 * DIA;
export const MAXIMO_INICIO = 600;
/** El orden se guarda 60 s, igual para todos. */
export const ORDEN_INICIO_MS = 60_000;

/** Lo que se sabe de una publicación para darle sus puntos y su chapita. */
export interface DatosDePuntos {
  creadaEn: Date;
  actualizadaEn: Date;
  masBarato: boolean;
  muyBuscado: boolean;
  /** Bajó de precio en las últimas 48 h, con el precio a la vista. */
  bajo: boolean;
  /** De 0 a 10 (ver `puntosDeResenas`). */
  resenas: number;
  respondeRapido: boolean;
  diaFundadora: boolean;
  /** La fuerza con que la destacó el Equipo, o nula. */
  destacada: FuerzaDestacado | null;
  reportesAbiertos: number;
}

/** Los puntos de novedad según cuánto hace que se publicó. */
export function puntosDeNovedad(creadaEn: Date, ahora: Date): number {
  const edad = ahora.getTime() - creadaEn.getTime();
  return PUNTOS_NOVEDAD.find((tramo) => edad <= tramo.hasta)?.puntos ?? 0;
}

/**
 * Las reseñas, de 0 a 10: sin opiniones, 0; con opiniones, el puntaje suavizado de
 * `reputacion-corta.ts` (de 1 a 5 estrellas) llevado a 0–10.
 */
export function puntosDeResenas(opiniones: number, puntaje: number): number {
  if (opiniones <= 0) return 0;
  const proporcion = (puntaje - 1) / 4;
  return Math.round(Math.min(1, Math.max(0, proporcion)) * PUNTOS_RESENAS_MAXIMO);
}

/** Todos los puntos de una publicación. */
export function puntosDe(datos: DatosDePuntos, ahora: Date): number {
  let puntos = puntosDeNovedad(datos.creadaEn, ahora);
  if (datos.masBarato) puntos += PUNTOS_MAS_BARATO;
  if (datos.muyBuscado) puntos += PUNTOS_MUY_BUSCADO;
  if (datos.bajo) puntos += PUNTOS_BAJO_DE_PRECIO;
  puntos += Math.min(PUNTOS_RESENAS_MAXIMO, Math.max(0, datos.resenas));
  if (datos.respondeRapido) puntos += PUNTOS_RESPONDE_RAPIDO;
  if (datos.diaFundadora) puntos += PUNTOS_DIA_FUNDADORA;
  if (datos.destacada) puntos += PUNTOS_DESTACAR[datos.destacada];
  puntos += PUNTOS_POR_REPORTE * datos.reportesAbiertos;
  if (ahora.getTime() - datos.actualizadaEn.getTime() > VIEJA_DESDE) puntos += PUNTOS_VIEJA;
  return puntos;
}

/**
 * La chapita de la tarjeta (doc 20, punto 22): una sola, en este orden de prioridad. Recién
 * publicado, Más barato de la galería, Muy buscado hoy y Bajó de precio.
 */
export function chapitaDe(
  datos: Pick<DatosDePuntos, 'creadaEn' | 'masBarato' | 'muyBuscado' | 'bajo'>,
  ahora: Date,
): ChapitaInicio | null {
  if (ahora.getTime() - datos.creadaEn.getTime() <= RECIEN_PUBLICADO) return 'RECIEN';
  if (datos.masBarato) return 'MAS_BARATO';
  if (datos.muyBuscado) return 'MUY_BUSCADO';
  if (datos.bajo) return 'BAJO';
  return null;
}

/** Empates: lo más nuevo primero (`creadaEn` desc) y después el `id`. */
export function compararPorPuntos(
  a: { puntos: number; creadaEn: Date; id: string },
  b: { puntos: number; creadaEn: Date; id: string },
): number {
  return (
    b.puntos - a.puntos ||
    b.creadaEn.getTime() - a.creadaEn.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Cuántas de la misma tienda caben en una fila de 5, según cuántas tiendas tienen publicaciones
 * vigentes: 4 o menos, 3; de 5 a 14, 2; 15 o más, 1.
 */
export function topePorFila(tiendas: number): number {
  if (tiendas <= 4) return 3;
  if (tiendas <= 14) return 2;
  return 1;
}

/**
 * «Mezclado por tienda: nunca salen dos seguidos de la misma» (N15). Va en el orden que trae y, si
 * la siguiente es de la misma tienda que la anterior, adelanta la primera de otra tienda. Solo se
 * repite si ya no quedan de otras. En el Inicio se usa dentro de cada fila.
 */
export function mezclarSinRepetir<T extends { tiendaId: string }>(lista: T[]): T[] {
  const pendientes = [...lista];
  const resultado: T[] = [];
  while (pendientes.length > 0) {
    const anterior = resultado[resultado.length - 1]?.tiendaId;
    const indice = Math.max(
      0,
      pendientes.findIndex((item) => item.tiendaId !== anterior),
    );
    resultado.push(...pendientes.splice(indice, 1));
  }
  return resultado;
}

/**
 * El tope por tienda en cada fila (doc 20, punto 4b). Se llena fila por fila con el orden de
 * puntos: si la siguiente pasa el tope de su tienda en esa fila, se salta y queda primera para la
 * fila siguiente. Nunca quedan huecos: si ya no hay de otras tiendas, la fila se completa con lo
 * que queda. Dentro de la fila, `mezclarSinRepetir` separa las de la misma tienda.
 */
export function ordenarConTope<T extends { tiendaId: string }>(
  lista: readonly T[],
  porFila: number,
  tope = topePorFila(new Set(lista.map((item) => item.tiendaId)).size),
): T[] {
  const pendientes = [...lista];
  const resultado: T[] = [];
  while (pendientes.length > 0) {
    const fila: T[] = [];
    const enLaFila = new Map<string, number>();
    for (let i = 0; i < pendientes.length && fila.length < porFila;) {
      const item = pendientes[i] as T;
      const cuantas = enLaFila.get(item.tiendaId) ?? 0;
      if (cuantas < tope) {
        fila.push(item);
        enLaFila.set(item.tiendaId, cuantas + 1);
        pendientes.splice(i, 1);
      } else {
        i += 1;
      }
    }
    // Sin huecos: ya no quedan de otras tiendas, así que entra lo que sigue.
    while (fila.length < porFila && pendientes.length > 0) {
      fila.push(pendientes.shift() as T);
    }
    resultado.push(...mezclarSinRepetir(fila));
  }
  return resultado;
}

/** 1 = lunes … 7 = domingo, en hora de Lima. */
const DIA_DE_LA_SEMANA_LIMA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Lima',
  weekday: 'short',
});
const NUMERO_DEL_DIA: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/** El día de la semana en Lima: 1 = lunes … 6 = sábado, 7 = domingo. */
export function diaDeLaSemanaEnLima(ahora: Date): number {
  return NUMERO_DEL_DIA[DIA_DE_LA_SEMANA_LIMA.format(ahora)] ?? 7;
}
