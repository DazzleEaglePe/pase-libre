import 'server-only';

import type { RespuestaYo } from '@paselibre/contracts';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

const API_INTERNA = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/**
 * Llamada desde el servidor de Next a la API con la cookie de quien pidió la página.
 * Con sesión, la respuesta nunca se guarda en caché (A-09).
 *
 * También le pasa la IP de quien pidió la página (la que puso nginx en `X-Forwarded-For`):
 * la API limita los pedidos por IP y, sin esto, todos los visitantes llegarían con la del
 * servidor web y compartirían un solo contador. La API solo cree esa cabecera si viene de
 * un proxy de confianza (`PROXIES_DE_CONFIANZA`), y nginx pone siempre la IP real al final.
 */
async function llamarApiServidor(
  ruta: string,
  redireccion: RequestRedirect = 'follow',
): Promise<Response> {
  const [almacen, entrada] = await Promise.all([cookies(), headers()]);
  const cabeceras: Record<string, string> = { cookie: almacen.toString() };
  const ip = entrada.get('x-forwarded-for');
  if (ip) cabeceras['x-forwarded-for'] = ip;
  return fetch(`${API_INTERNA}/v1${ruta}`, {
    headers: cabeceras,
    cache: 'no-store',
    redirect: redireccion,
  });
}

/**
 * Lo que es igual para todos y casi no cambia, como las categorías y las galerías de la
 * barra: sin cookie y con caché de `segundos`. Así cada página no gasta pedidos de los 120
 * por minuto que la API le da a quien la mira. Como `consultarApi`, no lanza nunca.
 */
export async function consultarApiCompartida<T>(
  ruta: string,
  segundos = 60,
): Promise<{ estado: number; cuerpo: T | null }> {
  try {
    const respuesta = await fetch(`${API_INTERNA}/v1${ruta}`, { next: { revalidate: segundos } });
    const cuerpo = (await respuesta.json().catch(() => null)) as T | null;
    return { estado: respuesta.status, cuerpo };
  } catch {
    return { estado: 0, cuerpo: null };
  }
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

/**
 * Para lo que no depende de quién mira, como el sitemap: sin cookie, igual que un visitante.
 * Si falla, lanza.
 */
export async function cargarApiPublica<T>(ruta: string): Promise<T> {
  const respuesta = await fetch(`${API_INTERNA}/v1${ruta}`, { cache: 'no-store' });
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${ruta} (${respuesta.status})`);
  return (await respuesta.json()) as T;
}

/** Como `consultarApi`, para lo que tiene que existir: si falla, la página muestra su error. */
export async function cargarApi<T>(ruta: string): Promise<T> {
  const { estado, cuerpo } = await consultarApi<T>(ruta);
  if (estado !== 200 || cuerpo === null) throw new Error(`No se pudo cargar ${ruta} (${estado})`);
  return cuerpo;
}
