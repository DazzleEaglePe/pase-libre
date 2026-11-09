import { createHash } from 'node:crypto';

import type { ThrottlerOptions } from '@nestjs/throttler';

import { COOKIE_SESION } from '../modules/sesion/sesion.types';
import { claveDeIp } from './ip';
import { esSesionValidaReciente } from './sesiones-validas';

/**
 * Límites de peticiones (docs/05 §9, RNF-19). Hay dos y cada petición pasa por ambos:
 *
 * - `ip`: el techo de una IP. En una galería muchas tiendas salen a internet con la misma
 *   IP: 200 tiendas a unos 10 pedidos por minuto son 2 000, así que el techo es de 3 000.
 *   Frena a quien martilla la API desde un solo lugar. Una IPv6 cuenta por su /64.
 * - `persona`: lo normal de una persona. Con una sesión que la API ya validó se cuenta por
 *   su cookie (sin ir a la base, ver sesiones-validas.ts); con una cookie desconocida o sin
 *   sesión, por IP. Así una cookie inventada en cada pedido no estrena contadores.
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
    const hash = createHash('sha256').update(token).digest('hex');
    if (esSesionValidaReciente(hash)) return `sesion:${hash.slice(0, 32)}`;
  }
  return `ip:${claveDeIp(solicitud.ip as string | undefined)}`;
}

export function rastreadorPorIp(solicitud: Record<string, unknown>): string {
  return claveDeIp(solicitud.ip as string | undefined);
}

export const LIMITES: ThrottlerOptions[] = [
  { name: LIMITE_IP, limit: 3000, ttl: 60_000, getTracker: rastreadorPorIp },
  { name: LIMITE_PERSONA, limit: 120, ttl: 60_000, getTracker: rastreadorPorPersona },
];

/** Para `@SkipThrottle(…)`: la salud la revisa un monitor externo cada minuto. */
export const SIN_LIMITES = { [LIMITE_IP]: true, [LIMITE_PERSONA]: true };
