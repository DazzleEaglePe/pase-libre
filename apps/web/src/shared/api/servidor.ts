import 'server-only';

import type { RespuestaYo } from '@paselibre/contracts';
import { cookies } from 'next/headers';
import { cache } from 'react';

const API_INTERNA = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/**
 * Llamada desde el servidor de Next a la API con la cookie de quien pidió la página.
 * Con sesión, la respuesta nunca se guarda en caché (A-09).
 */
async function llamarApiServidor(
  ruta: string,
  redireccion: RequestRedirect = 'follow',
): Promise<Response> {
  const almacen = await cookies();
  return fetch(`${API_INTERNA}/v1${ruta}`, {
    headers: { cookie: almacen.toString() },
    cache: 'no-store',
    redirect: redireccion,
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

/**
 * Consulta del catálogo desde una página: el estado y el cuerpo ya leído, sin lanzar nunca.
 * El estado 0 quiere decir que la API no responde. No sigue las redirecciones: la ficha de
 * un producto unido a otro llega como 301 y la página manda al visitante a la dirección nueva.
 */
export async function consultarApi<T>(ruta: string): Promise<{ estado: number; cuerpo: T | null }> {
  try {
    const respuesta = await llamarApiServidor(ruta, 'manual');
    const cuerpo = (await respuesta.json().catch(() => null)) as T | null;
    return { estado: respuesta.status, cuerpo };
  } catch {
    return { estado: 0, cuerpo: null };
  }
}

/** Como `consultarApi`, para lo que tiene que existir: si falla, la página muestra su error. */
export async function cargarApi<T>(ruta: string): Promise<T> {
  const { estado, cuerpo } = await consultarApi<T>(ruta);
  if (estado !== 200 || cuerpo === null) throw new Error(`No se pudo cargar ${ruta} (${estado})`);
  return cuerpo;
}
