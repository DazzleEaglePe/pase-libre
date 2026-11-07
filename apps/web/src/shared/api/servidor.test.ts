import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `server-only` falla a propósito fuera de un servidor de Next, y `cache` de React solo existe
// allí: en las pruebas se reemplazan por lo mínimo.
vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: <T>(funcion: T) => funcion }));

const entrada = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({ toString: () => 'pl_sesion=abc123' }),
  headers: async () => entrada,
}));

const { consultarApi, consultarApiCompartida } = await import('./servidor');

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado });
}

describe('llamadas de la web a la API', () => {
  const fetchFalso = vi.fn(async () => respuestaJson([]));

  beforeEach(() => {
    fetchFalso.mockClear();
    vi.stubGlobal('fetch', fetchFalso);
    for (const clave of [...entrada.keys()]) entrada.delete(clave);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const cabecerasDeLaLlamada = () =>
    (fetchFalso.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<
      string,
      string
    >;

  it('reenvía la cookie y la IP del visitante (la API limita por IP)', async () => {
    entrada.set('x-forwarded-for', '203.0.113.7');
    await consultarApi('/buscar');
    expect(cabecerasDeLaLlamada()).toEqual({
      cookie: 'pl_sesion=abc123',
      'x-forwarded-for': '203.0.113.7',
    });
  });

  it('sin proxy delante no inventa ninguna IP', async () => {
    await consultarApi('/buscar');
    expect(cabecerasDeLaLlamada()).toEqual({ cookie: 'pl_sesion=abc123' });
  });

  it('lo compartido va sin cookie ni IP y con caché', async () => {
    entrada.set('x-forwarded-for', '203.0.113.7');
    const r = await consultarApiCompartida<unknown[]>('/categorias', 30);
    const [url, opciones] = fetchFalso.mock.calls[0] as unknown as [
      string,
      RequestInit & { next?: { revalidate: number } },
    ];
    expect(url).toMatch(/\/v1\/categorias$/);
    expect(opciones.headers).toBeUndefined();
    expect(opciones.next).toEqual({ revalidate: 30 });
    expect(r).toEqual({ estado: 200, cuerpo: [] });
  });

  it('si la API no responde, devuelve estado 0 en vez de lanzar', async () => {
    fetchFalso.mockRejectedValueOnce(new Error('caída'));
    expect(await consultarApiCompartida('/galerias')).toEqual({ estado: 0, cuerpo: null });
  });
});
