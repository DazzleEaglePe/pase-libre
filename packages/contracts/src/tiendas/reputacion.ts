/**
 * La reputación de una tienda (N03_ReputacionWeb, N04_Bordes): un nivel de «Baja» a «Excelente»
 * que junta estrellas, pases cerrados y rapidez para responder. Funciones puras: las usa el
 * servidor para calcular y la web para escribir el nivel.
 *
 * Reglas del lienzo:
 * - Con menos de 5 opiniones no hay nivel: «🌱 Nueva en PaseLibre · 1 de 5».
 * - Lo reciente pesa más: una opinión pierde la mitad de su peso cada 90 días (sin bajar de 0,2).
 * - Un solo 5 no te pone arriba ni un solo 1 te hunde: las estrellas se promedian junto con 3
 *   opiniones «de arranque» de 3,5 estrellas (promedio bayesiano), así pocas opiniones no
 *   llevan el promedio a los extremos.
 */

export const NIVELES_REPUTACION = ['BAJA', 'REGULAR', 'BUENA', 'MUY_BUENA', 'EXCELENTE'] as const;
export type NivelReputacion = (typeof NIVELES_REPUTACION)[number];

export const TEXTO_NIVEL: Record<NivelReputacion, string> = {
  BAJA: 'Baja',
  REGULAR: 'Regular',
  BUENA: 'Buena',
  MUY_BUENA: 'Muy buena',
  EXCELENTE: 'Excelente',
};

/** Opiniones que hacen falta para tener nivel. */
export const OPINIONES_PARA_NIVEL = 5;

/**
 * Una opinión «baja» (N03, «Calificación baja: comentario privado»): de 2 estrellas o menos. Su
 * comentario solo lo ven la tienda calificada y el Equipo; las estrellas sí cuentan.
 */
export const ESTRELLAS_OPINION_BAJA = 2;
export const opinionBaja = (estrellas: number): boolean => estrellas <= ESTRELLAS_OPINION_BAJA;

const DIA = 86_400_000;
const VIDA_MEDIA_DIAS = 90;
const PESO_MINIMO = 0.2;
const ESTRELLAS_DE_ARRANQUE = 3.5;
const OPINIONES_DE_ARRANQUE = 3;
/** Cuánto pesa cada parte del puntaje (suman 1). */
const PESOS = { estrellas: 0.6, pases: 0.2, rapidez: 0.2 } as const;
/** Desde qué puntaje (0 a 1) empieza cada nivel; por debajo del último, «Baja». */
const UMBRALES: ReadonlyArray<readonly [NivelReputacion, number]> = [
  ['EXCELENTE', 0.9],
  ['MUY_BUENA', 0.75],
  ['BUENA', 0.6],
  ['REGULAR', 0.45],
];

export interface DatosReputacion {
  opiniones: ReadonlyArray<{ estrellas: number; creada_en: Date | string }>;
  /** Ventas que marcó como vendedora en los últimos 60 días. */
  pases_60: number;
  /** Minutos que tarda en contestar (la mediana); nulo sin datos. */
  responde_en: number | null;
  /** Porcentaje de chats que contestó (0 a 100); nulo sin chats. */
  respondidos: number | null;
  ahora?: Date;
}

export interface ResultadoReputacion {
  /** Nulo con menos de 5 opiniones. */
  nivel: NivelReputacion | null;
  /** De 0 a 1; nulo con menos de 5 opiniones. */
  puntaje: number | null;
}

/** El peso de una opinión según cuántos días tiene: 1 hoy, 0,5 a los 90 días, nunca menos de 0,2. */
export function pesoPorAntiguedad(dias: number): number {
  return Math.max(PESO_MINIMO, 0.5 ** (Math.max(0, dias) / VIDA_MEDIA_DIAS));
}

/** El promedio de estrellas con lo reciente pesando más y las 3 opiniones de arranque. */
export function estrellasPonderadas(
  opiniones: DatosReputacion['opiniones'],
  ahora: Date = new Date(),
): number {
  let suma = ESTRELLAS_DE_ARRANQUE * OPINIONES_DE_ARRANQUE;
  let pesos = OPINIONES_DE_ARRANQUE;
  for (const opinion of opiniones) {
    const dias = (ahora.getTime() - new Date(opinion.creada_en).getTime()) / DIA;
    const peso = pesoPorAntiguedad(dias);
    suma += peso * opinion.estrellas;
    pesos += peso;
  }
  return suma / pesos;
}

/** Los pases cerrados en 60 días, de 0 a 1: 15 ya son 0,63 y 40 pasan de 0,9. */
export function puntajePases(pases: number): number {
  return 1 - Math.exp(-Math.max(0, pases) / 15);
}

/**
 * La rapidez, de 0 a 1: responder en 10 minutos o menos es 1 y en 3 horas o más es 0 (en medio,
 * en escala logarítmica); se junta con el porcentaje de chats respondidos. Nulo sin datos.
 */
export function puntajeRapidez(
  respondeEn: number | null,
  respondidos: number | null,
): number | null {
  const velocidad =
    respondeEn === null
      ? null
      : respondeEn <= 10
        ? 1
        : respondeEn >= 180
          ? 0
          : 1 - Math.log(respondeEn / 10) / Math.log(18);
  const contestados = respondidos === null ? null : Math.min(100, Math.max(0, respondidos)) / 100;
  if (velocidad === null) return contestados;
  if (contestados === null) return velocidad;
  return 0.6 * velocidad + 0.4 * contestados;
}

/** El nivel que corresponde a un puntaje de 0 a 1. */
export function nivelDePuntaje(puntaje: number): NivelReputacion {
  return UMBRALES.find(([, desde]) => puntaje >= desde)?.[0] ?? 'BAJA';
}

/**
 * El nivel de una tienda: 60 % estrellas, 20 % pases cerrados y 20 % rapidez. Si no hay datos de
 * rapidez, lo demás se reparte su peso. Con menos de 5 opiniones, sin nivel.
 */
export function calcularReputacion(datos: DatosReputacion): ResultadoReputacion {
  if (datos.opiniones.length < OPINIONES_PARA_NIVEL) return { nivel: null, puntaje: null };
  const estrellas = (estrellasPonderadas(datos.opiniones, datos.ahora) - 1) / 4;
  const pases = puntajePases(datos.pases_60);
  const rapidez = puntajeRapidez(datos.responde_en, datos.respondidos);
  const partes: Array<[number, number]> = [
    [PESOS.estrellas, estrellas],
    [PESOS.pases, pases],
    ...(rapidez === null ? [] : [[PESOS.rapidez, rapidez] as [number, number]]),
  ];
  const total = partes.reduce((suma, [peso]) => suma + peso, 0);
  const puntaje = partes.reduce((suma, [peso, valor]) => suma + peso * valor, 0) / total;
  const redondeado = Math.round(puntaje * 1000) / 1000;
  return { nivel: nivelDePuntaje(redondeado), puntaje: redondeado };
}

/** Las insignias del mes por ventas (N03 · Historial, N04 · «Tu mes»). */
export const INSIGNIAS = [
  { nombre: 'plata', emoji: '🥈', ventas: 10 },
  { nombre: 'oro', emoji: '🥇', ventas: 20 },
] as const;

export interface SiguienteInsignia {
  nombre: (typeof INSIGNIAS)[number]['nombre'];
  emoji: (typeof INSIGNIAS)[number]['emoji'];
  /** Ventas del mes que pide. */
  meta: number;
  faltan: number;
}

/** «Te faltan 9 ventas para tu insignia de plata 🥈»; nulo si ya tiene la de oro este mes. */
export function siguienteInsignia(ventasDelMes: number): SiguienteInsignia | null {
  const insignia = INSIGNIAS.find((una) => ventasDelMes < una.ventas);
  if (!insignia) return null;
  return {
    nombre: insignia.nombre,
    emoji: insignia.emoji,
    meta: insignia.ventas,
    faltan: insignia.ventas - ventasDelMes,
  };
}
