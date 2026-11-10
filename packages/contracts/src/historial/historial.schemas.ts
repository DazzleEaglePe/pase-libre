import { z } from 'zod';

/** `GET /v1/historial` (HI_A2_Web): ventas o compras de un mes, y con quién. */
export const historialVentasSchema = z.object({
  lado: z.enum(['ventas', 'compras']).default('ventas'),
  /** «2026-11»; sin él, el mes de hoy en Lima. */
  mes: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El mes va como 2026-11.')
    .optional(),
  tienda: z.uuid('Esa tienda no existe.').optional(),
});
export type HistorialConsulta = z.output<typeof historialVentasSchema>;
