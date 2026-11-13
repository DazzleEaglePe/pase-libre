import { z } from 'zod';

/**
 * «Tiendas fundadoras» (doc 20, punto 7): reemplaza al «piloto». Son 15 como máximo (doc 20b) y cada una
 * tiene su día destacado (de lunes a sábado), el sello en su perfil y la prioridad en el chat.
 */
export const MAX_FUNDADORAS = 15;

/** Su día destacado: 1 = lunes … 6 = sábado (hora de Lima). El domingo no hay. */
export const DIAS_FUNDADORA = [
  { dia: 1, corto: 'Lun', nombre: 'lunes' },
  { dia: 2, corto: 'Mar', nombre: 'martes' },
  { dia: 3, corto: 'Mié', nombre: 'miércoles' },
  { dia: 4, corto: 'Jue', nombre: 'jueves' },
  { dia: 5, corto: 'Vie', nombre: 'viernes' },
  { dia: 6, corto: 'Sáb', nombre: 'sábado' },
] as const;

const diaFundadora = z
  .number('Elige su día destacado.')
  .int('Elige su día destacado.')
  .min(1, 'Elige de lunes a sábado.')
  .max(6, 'Elige de lunes a sábado.');

/** Una fila de Equipo › Tiendas › Fundadoras. */
export interface FundadoraEnPanel {
  tienda_id: string;
  nombre: string;
  galeria: string | null;
  stand: string | null;
  /** 1 = lunes … 6 = sábado; nulo, sin día todavía. */
  dia: number | null;
  sello: boolean;
  prioridad: boolean;
  desde: string;
}

/** `GET /v1/equipo/fundadoras`: «★ Fundadoras · 7 de 15». */
export interface RespuestaFundadoras {
  maximo: number;
  fundadoras: FundadoraEnPanel[];
}

/**
 * `POST /v1/equipo/fundadoras`: «+ Agregar fundadora». Sin `dia`, le toca el que tenga menos
 * fundadoras.
 */
export const agregarFundadoraSchema = z.strictObject({
  tienda_id: z.uuid('Elige una tienda.'),
  dia: diaFundadora.optional(),
});
export type AgregarFundadoraDatos = z.output<typeof agregarFundadoraSchema>;

/** `PATCH /v1/equipo/fundadoras/:tienda`: su día, el sello o la prioridad en el chat. */
export const cambiarFundadoraSchema = z
  .strictObject({
    dia: diaFundadora.optional(),
    sello: z.boolean().optional(),
    prioridad: z.boolean().optional(),
  })
  .refine(
    (datos) =>
      datos.dia !== undefined || datos.sello !== undefined || datos.prioridad !== undefined,
    'No hay nada que cambiar.',
  );
export type CambiarFundadoraDatos = z.output<typeof cambiarFundadoraSchema>;
