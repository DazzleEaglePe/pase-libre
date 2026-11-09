import { vi } from 'vitest';

type Respuesta = { estado?: number; cuerpo?: unknown };
type Ruta = (pedido: { metodo: string; ruta: string; cuerpo: unknown }) => Respuesta | undefined;

/**
 * Una API de mentira para las pruebas de componentes: cada pedido a `/v1/...` pasa por `rutas`
 * y lo que devuelvan es la respuesta. Lo que nadie atiende responde 404. Guarda los pedidos.
 */
export function apiFalsa(rutas: Ruta) {
  const pedidos: Array<{ metodo: string; ruta: string; cuerpo: unknown }> = [];
  const fetchFalso = vi.fn(async (url: string, opciones: RequestInit = {}) => {
    const ruta = String(url).replace(/^\/v1/, '');
    const metodo = opciones.method ?? 'GET';
    const cuerpo = typeof opciones.body === 'string' ? JSON.parse(opciones.body) : undefined;
    pedidos.push({ metodo, ruta, cuerpo });
    const r = rutas({ metodo, ruta, cuerpo }) ?? {
      estado: 404,
      cuerpo: { error: { codigo: 'NO_ENCONTRADO', mensaje: 'No existe.' } },
    };
    return new Response(r.cuerpo === undefined ? null : JSON.stringify(r.cuerpo), {
      status: r.estado ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return { pedidos, fetchFalso };
}
