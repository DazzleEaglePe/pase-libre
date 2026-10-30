import { z } from 'zod';

const commaSeparatedList = (value: unknown): unknown =>
  typeof value === 'string'
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : value;

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    DATABASE_URL: z
      .string()
      .default('postgresql://paselibre:paselibre_dev@localhost:5435/paselibre'),
    WEB_URL: z.url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('debug'),
    /** En producción la cookie de sesión solo viaja por HTTPS. */
    SESION_COOKIE_SEGURA: z.stringbool().optional(),
    /**
     * Carpeta de las fotos subidas. En local, `apps/api/media` (fuera de git); en producción,
     * un volumen que nginx sirve en `/media` y que se copia a B2 cada noche (docs/05 §10).
     */
    MEDIA_DIR: z.string().min(1).default('media'),
    /**
     * Saltos de proxy cuya `X-Forwarded-For` se acepta para saber la IP real
     * (límites por IP). Solo `loopback` o IPs del nginx propio.
     */
    PROXIES_DE_CONFIANZA: z.preprocess(
      commaSeparatedList,
      z.array(z.string()).default(['loopback']),
    ),
    /**
     * En vivo: busco y ofertas flash (D-53). Apagado, sus rutas responden 404 y la web no
     * muestra nada. Se enciende en local para construirlo y en producción cuando se decida.
     */
    EN_VIVO: z.stringbool().default(false),
  })
  .transform((entorno) => ({
    ...entorno,
    SESION_COOKIE_SEGURA: entorno.SESION_COOKIE_SEGURA ?? entorno.NODE_ENV === 'production',
  }))
  .superRefine((entorno, context) => {
    if (entorno.NODE_ENV !== 'production') return;

    if (!entorno.SESION_COOKIE_SEGURA) {
      context.addIssue({
        code: 'custom',
        path: ['SESION_COOKIE_SEGURA'],
        message: 'En producción la cookie de sesión debe ser segura (HTTPS).',
      });
    }
    if (entorno.LOG_LEVEL === 'debug' || entorno.LOG_LEVEL === 'trace') {
      context.addIssue({
        code: 'custom',
        path: ['LOG_LEVEL'],
        message: 'LOG_LEVEL debe ser info, warn, error o fatal en producción.',
      });
    }
  });

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Configuración inválida: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
