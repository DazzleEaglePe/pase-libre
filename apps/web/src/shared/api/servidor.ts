import 'server-only';

import type { RespuestaYo } from '@paselibre/contracts';
import { cookies } from 'next/headers';
import { cache } from 'react';

const API_INTERNA = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/**
 * Llamada desde el servidor de Next a la API con la cookie de quien pidió la página.
 * Con sesión, la respuesta nunca se guarda en caché (A-09).
 */
async function llamarApiServidor(ruta: string): Promise<Response> {
  const almacen = await cookies();
  return fetch(`${API_INTERNA}/v1${ruta}`, {
    headers: { cookie: almacen.toString() },
    cache: 'no-store',
  });
}

/**
 * La sesión de quien mira la página, o nula si es visitante (o la API no responde).
 * Se pide una sola vez por página aunque la usen el layout y la página.
 */
export const obtenerSesion = cache(async (): Promise<RespuestaYo | null> => {
  try {
    const respuesta = await llamarApiServidor('/yo');
    return respuesta.ok ? ((await respuesta.json()) as RespuestaYo) : null;
  } catch {
    return null;
  }
});
