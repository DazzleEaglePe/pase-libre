import { createHash } from 'node:crypto';

import type { ThrottlerOptions } from '@nestjs/throttler';

import { COOKIE_SESION } from '../modules/sesion/sesion.types';

/**
 * Límites de peticiones (docs/05 §9, RNF-19). Hay dos y cada petición pasa por ambos:
 *
 * - `ip`: el techo de una IP. En una galería muchas tiendas salen a internet con la misma
 *   IP, así que es alto; frena a quien martilla la API desde un solo lugar.
 * - `persona`: lo normal de una persona. Con sesión se cuenta por su cookie (sin ir a la
 *   base) y sin sesión, por IP. Una cookie inventada solo cambia este contador; el de IP
 *   sigue mandando.
 *
 * Las rutas sensibles ajustan el que les corresponde con `@Throttle({ ip: … })` o
 * `@Throttle({ persona: … })`.
 */
export const LIMITE_IP = 'ip';
export const LIMITE_PERSONA = 'persona';

export function rastreadorPorPersona(solicitud: Record<string, unknown>): string {
  const cookies = solicitud.cookies as Record<string, unknown> | undefined;
  const token = cookies?.[COOKIE_SESION];
  if (typeof token === 'string' && token) {
    return `sesion:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`;
  }
  return `ip:${String(solicitud.ip)}`;
}

export const LIMITES: ThrottlerOptions[] = [
  { name: LIMITE_IP, limit: 600, ttl: 60_000 },
  { name: LIMITE_PERSONA, limit: 120, ttl: 60_000, getTracker: rastreadorPorPersona },
];

/** Para `@SkipThrottle(…)`: la salud la revisa un monitor externo cada minuto. */
export const SIN_LIMITES = { [LIMITE_IP]: true, [LIMITE_PERSONA]: true };
