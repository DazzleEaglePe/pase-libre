/** Un corredor de pruebas mínimo (sin dependencias) y el cliente HTTP de la verificación. */

export const resultados = [];
let grupoActual = '';
const ICONO = { ok: '✓', falla: '✗', aviso: '!' };

export function grupo(nombre) {
  grupoActual = nombre;
  console.log(`\n▸ ${nombre}`);
}

/**
 * Corre una prueba. La función puede devolver un texto (detalle de lo que pasó bien) o
 * `{ aviso }` (pasó, pero hay algo que mirar). Si lanza, la prueba falla; con `soloAviso`
 * el fallo se cuenta como aviso.
 */
export async function prueba(nombre, fn, { soloAviso = false } = {}) {
  const inicio = Date.now();
  let estado = 'ok';
  let detalle = '';
  try {
    const r = await fn();
    if (typeof r === 'string') detalle = r;
    else if (r?.aviso) {
      estado = 'aviso';
      detalle = r.aviso;
    }
  } catch (error) {
    estado = soloAviso ? 'aviso' : 'falla';
    detalle = error.message;
  }
  resultados.push({ grupo: grupoActual, nombre, estado, detalle, ms: Date.now() - inicio });
  const linea = detalle.length > 230 ? detalle.slice(0, 230) + '…' : detalle;
  console.log(`  ${ICONO[estado]} ${nombre}${linea ? ` — ${linea}` : ''}`);
}

export function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(typeof mensaje === 'function' ? mensaje() : mensaje);
}

/** Corre `fn` sobre cada elemento, `n` a la vez. */
export async function enLotes(lista, n, fn) {
  const salida = new Array(lista.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, lista.length) }, async () => {
      while (siguiente < lista.length) {
        const i = siguiente++;
        salida[i] = await fn(lista[i], i);
      }
    }),
  );
  return salida;
}

/** Las búsquedas que hizo la verificación: al final se borran de «Lo más buscado». */
export const consultasHechas = new Set();

/**
 * Ritmo de los pedidos. La API limita por IP (600 por minuto) y por persona (120 por minuto,
 * contada por sesión o, sin sesión, por IP), y cada contador es **por ruta**: `/buscar` tiene
 * el suyo, `/productos/:slug` otro. La verificación va más despacio que eso para medir el
 * producto y no los límites: cada cliente tiene su tope y todos juntos otro.
 */
const GLOBAL_POR_MINUTO = Number(process.env.QA_PEDIDOS_POR_MINUTO ?? 420);
/**
 * Las rutas con un límite propio más bajo que el general (docs/08 §4): la búsqueda admite 60
 * por minuto por persona. La verificación se queda en 50 para no rozarlo.
 */
const TOPE_POR_RUTA = { '/buscar': 50 };
const ventanasGlobales = new Map();
export const estadisticas = { pedidos: 0, reintentos429: 0 };

async function turno(marcas, limite) {
  for (;;) {
    const ahora = Date.now();
    while (marcas.length > 0 && ahora - marcas[0] > 60_000) marcas.shift();
    if (marcas.length < limite) {
      marcas.push(ahora);
      return;
    }
    await new Promise((r) => setTimeout(r, marcas[0] + 60_000 - ahora + 25));
  }
}

/**
 * Cliente de la API (o de la web): `pedir(ruta, opciones)` devuelve
 * `{ estado, json, texto, cabeceras, ms }`. Con `cookie` actúa como esa sesión. `porMinuto`
 * es el tope de ese cliente en total (100 por defecto, bajo el 120 por persona y por ruta de la API). Si la API
 * contesta 429 espera y repite, y queda anotado en `estadisticas`.
 */
export function cliente(base, cookie = null, { porMinuto = 100 } = {}) {
  const propias = [];
  const porRuta = new Map();
  const origen = new URL(base).origin;
  if (!ventanasGlobales.has(origen)) ventanasGlobales.set(origen, []);
  return async function pedir(
    ruta,
    { metodo = 'GET', cuerpo, cabeceras = {}, sinCookie = false, formulario } = {},
  ) {
    const sinConsulta = ruta.split('?')[0];
    const topeDeLaRuta = TOPE_POR_RUTA[sinConsulta];
    for (let intento = 0; ; intento++) {
      await turno(propias, porMinuto);
      if (topeDeLaRuta) {
        if (!porRuta.has(sinConsulta)) porRuta.set(sinConsulta, []);
        await turno(porRuta.get(sinConsulta), topeDeLaRuta);
      }
      await turno(ventanasGlobales.get(origen), GLOBAL_POR_MINUTO);
      estadisticas.pedidos += 1;
      const r = await pedirUna(ruta, { metodo, cuerpo, cabeceras, sinCookie, formulario });
      if (r.estado === 429 && intento < 3) {
        estadisticas.reintentos429 += 1;
        await new Promise((res) =>
          setTimeout(res, Number(r.cabeceras.get('retry-after') ?? 8) * 1000 + 500),
        );
        continue;
      }
      return r;
    }
  };

  async function pedirUna(ruta, { metodo, cuerpo, cabeceras, sinCookie, formulario }) {
    const h = { accept: '*/*', ...cabeceras };
    if (cookie && !sinCookie) h.cookie = cookie;
    if (metodo !== 'GET' && h['x-paselibre'] === undefined) h['x-paselibre'] = '1';
    let body;
    if (formulario) body = formulario;
    else if (cuerpo !== undefined) {
      body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
      h['content-type'] ??= 'application/json';
    }
    if (ruta.includes('q=')) {
      const q = new URL(base + ruta).searchParams.get('q');
      if (q) consultasHechas.add(q.slice(0, 200));
    }
    const t0 = performance.now();
    const r = await fetch(base + ruta, { method: metodo, headers: h, body, redirect: 'manual' });
    const texto = await r.text();
    let json = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* no era JSON */
    }
    return {
      estado: r.status,
      json,
      texto,
      cabeceras: r.headers,
      ms: performance.now() - t0,
      setCookie: r.headers.getSetCookie?.() ?? [],
    };
  }
}

export async function ingresar(api, usuario, clave) {
  const r = await cliente(api)('/sesion', {
    metodo: 'POST',
    cuerpo: { usuario, clave, recordar: false },
  });
  if (r.estado !== 200) throw new Error(`${usuario}: ingreso ${r.estado}`);
  const cookie = r.setCookie.find((c) => c.startsWith('pl_sesion='))?.split(';')[0];
  if (!cookie) throw new Error(`${usuario}: sin cookie de sesión`);
  return { cookie, yo: r.json };
}

export const percentil = (valores, p) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))] ?? 0;
};
