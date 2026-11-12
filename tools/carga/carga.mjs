#!/usr/bin/env node
/**
 * Prueba de carga de la API, sin dependencias (Node 22+). Simula tiendas y visitantes que piden
 * a la vez y mide cuánto tarda cada ruta (p50, p95, p99) y cuántas fallan.
 *
 *   node tools/carga/carga.mjs --escenario=visitante --usuarios=50 --segundos=30
 *   CARGA_CLAVE=… node tools/carga/carga.mjs --escenario=tienda --usuarios=50
 *
 * Escenarios:
 *   visitante  portada, categorías, búsqueda (también con errores de tipeo), sugerencias y fichas.
 *   tienda     lo mismo con sesión, más contadores, avisos, conversaciones y «Mis publicaciones».
 *              Entra con las cuentas `<prefijo>001…` que crea `volumen.sql` (clave en CARGA_CLAVE).
 *   ingreso    solo iniciar sesión, para medir el costo de argon2 con muchas personas a la vez.
 *   limites    una sola IP sin sesión que martilla la portada: debe terminar en 429.
 *
 * Cada usuario virtual llega con su propia IP en `X-Forwarded-For` (la API la cree solo si viene
 * de un proxy de confianza: en local, loopback), así no se frenan entre sí como no se frenan las
 * tiendas de una galería. Por seguridad solo apunta a localhost salvo con --permitir-remoto.
 *
 * Opciones: --api=http://localhost:3001 --usuarios=20 --segundos=20 --prefijo=carga
 *           --pausa=<ms>     lo que «piensa» una persona entre pedidos (al azar entre 0 y el doble).
 *                            Sin pausa cada usuario pide sin parar y choca con el límite por persona.
 *           --ip-por-pedido  una IP nueva en cada pedido: mide el techo del servidor sin los límites
 *                            por IP ni por persona (solo para visitantes; con sesión manda la cookie).
 *           --variar         búsquedas en una página al azar (1 a 40) y sugerencias con letras al azar:
 *                            casi ninguna sale de la memoria de 30 s de la API (lo peor para la base).
 *           --p95-max=<ms> --errores-max=<0..1>   (si se pasan, sale con código 1 al no cumplir)
 */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : 'true'];
  }),
);
const API = (args.api ?? 'http://localhost:3001').replace(/\/$/, '');
const USUARIOS = Number(args.usuarios ?? 20);
const SEGUNDOS = Number(args.segundos ?? 20);
const ESCENARIO = args.escenario ?? 'visitante';
const PREFIJO = args.prefijo ?? 'carga';
const CLAVE = process.env.CARGA_CLAVE;
const PAUSA = Number(args.pausa ?? 0);
const IP_POR_PEDIDO = args['ip-por-pedido'] === 'true';
const VARIAR = args.variar === 'true';
let contadorIp = 1_000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const host = new URL(API).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && args['permitir-remoto'] !== 'true') {
  console.error(
    `No apunto a ${host}: una prueba de carga contra un servidor real lo tumba. Usa --permitir-remoto si de verdad es lo que quieres.`,
  );
  process.exit(2);
}

const ipDe = (n) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
const medidas = new Map(); // etiqueta → { tiempos: [], estados: Map }
function anotar(etiqueta, ms, estado) {
  let m = medidas.get(etiqueta);
  if (!m) medidas.set(etiqueta, (m = { tiempos: [], estados: new Map() }));
  m.tiempos.push(ms);
  m.estados.set(estado, (m.estados.get(estado) ?? 0) + 1);
}

async function pedir(etiqueta, ruta, { ip, cookie, metodo = 'GET', cuerpo } = {}) {
  const inicio = performance.now();
  let estado = 0;
  let respuesta;
  try {
    respuesta = await fetch(API + '/v1' + ruta, {
      method: metodo,
      headers: {
        'x-forwarded-for': ip,
        'x-paselibre': '1',
        ...(cookie ? { cookie } : {}),
        ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    estado = respuesta.status;
    await respuesta.arrayBuffer();
  } catch {
    estado = 'red';
  }
  anotar(etiqueta, performance.now() - inicio, estado);
  return respuesta;
}

const BUSQUEDAS = [
  'rtx 4060',
  'gigabte 4060',
  'ryzen 5 5600',
  'ddr5 32',
  'kingston',
  'monitor 27',
  'ssd 1tb',
  'treinta sesenta',
];
const SUGERENCIAS = ['rt', 'rtx 40', 'kingst', 'ryz', 'gigab'];
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
/** Con --variar: otra página cada vez, para que la búsqueda no salga de la memoria. */
const pagina = () => (VARIAR ? `&pagina=${1 + Math.floor(Math.random() * 40)}` : '');
/** Con --variar: el comienzo de una palabra al azar («gef», «corsa»…). */
const PALABRAS = [
  'ryzen',
  'geforce',
  'radeon',
  'kingston',
  'corsair',
  'samsung',
  'gigabyte',
  'monitor',
  'teclado',
  'vengeance',
  'predator',
  'inalambrico',
];
const sugerencia = () => {
  if (!VARIAR) return azar(SUGERENCIAS);
  const palabra = azar(PALABRAS);
  return palabra.slice(0, 2 + Math.floor(Math.random() * (palabra.length - 1)));
};

async function preparar() {
  const ip = ipDe(999_999);
  const portada = await (
    await fetch(`${API}/v1/portada`, { headers: { 'x-forwarded-for': ip } })
  ).json();
  const categorias = await (
    await fetch(`${API}/v1/categorias`, { headers: { 'x-forwarded-for': ip } })
  ).json();
  const slugs = new Set(
    (portada.recien_publicado ?? []).map((o) => o.producto?.slug ?? o.slug).filter(Boolean),
  );
  for (const q of BUSQUEDAS.slice(0, 4)) {
    const r = await (
      await fetch(`${API}/v1/buscar?q=${encodeURIComponent(q)}`, {
        headers: { 'x-forwarded-for': ip },
      })
    ).json();
    for (const p of r.productos ?? []) if (p.slug) slugs.add(p.slug);
  }
  return { slugs: [...slugs], categorias: (categorias ?? []).map((c) => c.slug).filter(Boolean) };
}

function pasosDeVisitante({ slugs, categorias }) {
  return [
    [3, () => ['GET /portada', '/portada']],
    [1, () => ['GET /categorias', '/categorias']],
    [4, () => ['GET /buscar?q', `/buscar?q=${encodeURIComponent(azar(BUSQUEDAS))}${pagina()}`]],
    [2, () => ['GET /buscar?categoria', `/buscar?categoria=${azar(categorias)}${pagina()}`]],
    [
      2,
      () => [
        'GET /buscar/sugerencias',
        `/buscar/sugerencias?q=${encodeURIComponent(sugerencia())}`,
      ],
    ],
    [4, () => ['GET /productos/:slug', `/productos/${azar(slugs)}`]],
  ];
}

function pasosDeTienda(datos) {
  return [
    ...pasosDeVisitante(datos),
    [3, () => ['GET /contadores', '/contadores']],
    [1, () => ['GET /yo', '/yo']],
    [1, () => ['GET /avisos', '/avisos']],
    [1, () => ['GET /conversaciones', '/conversaciones']],
    [1, () => ['GET /mis-ofertas', '/mis-ofertas']],
    [1, () => ['GET /en-vivo', '/en-vivo']],
  ];
}

function elegir(pasos) {
  const total = pasos.reduce((s, [peso]) => s + peso, 0);
  let x = Math.random() * total;
  for (const [peso, paso] of pasos) if ((x -= peso) < 0) return paso();
  return pasos[0][1]();
}

async function ingresar(n) {
  const usuario = `${PREFIJO}${String(n + 1).padStart(3, '0')}`;
  const r = await pedir('POST /sesion', '/sesion', {
    ip: ipDe(n + 1),
    metodo: 'POST',
    cuerpo: { usuario, clave: CLAVE },
  });
  const cookie = r?.headers.get('set-cookie')?.split(';')[0];
  return cookie?.startsWith('pl_sesion=') ? cookie : null;
}

const fin = Date.now() + SEGUNDOS * 1000;
const inicioPrueba = performance.now();

if (ESCENARIO === 'limites') {
  // Una IP, sin sesión, lo más rápido posible: la API debería cortar con 429.
  await Promise.all(
    Array.from({ length: Math.max(1, USUARIOS) }, async () => {
      while (Date.now() < fin)
        await pedir('GET /portada (una IP)', '/portada', { ip: '10.250.0.1' });
    }),
  );
} else if (ESCENARIO === 'ingreso') {
  if (!CLAVE) throw new Error('Falta CARGA_CLAVE.');
  let n = 0;
  await Promise.all(
    Array.from({ length: USUARIOS }, async () => {
      while (Date.now() < fin) await ingresar(n++ % 150);
    }),
  );
} else {
  const datos = await preparar();
  if (datos.slugs.length === 0)
    throw new Error('La API no devolvió productos: ¿la base tiene datos?');
  let cookies = [];
  if (ESCENARIO === 'tienda') {
    if (!CLAVE) throw new Error('Falta CARGA_CLAVE (la clave de las cuentas de volumen.sql).');
    cookies = await Promise.all(Array.from({ length: USUARIOS }, (_, i) => ingresar(i)));
    const sin = cookies.filter((c) => !c).length;
    if (sin) console.warn(`${sin} de ${USUARIOS} cuentas no pudieron entrar.`);
  }
  const pasos = ESCENARIO === 'tienda' ? pasosDeTienda(datos) : pasosDeVisitante(datos);
  await Promise.all(
    Array.from({ length: USUARIOS }, async (_, i) => {
      const ip = ipDe(i + 1);
      const cookie = cookies[i] ?? undefined;
      // Que no arranquen todos en el mismo milisegundo.
      if (PAUSA) await dormir(Math.random() * PAUSA);
      while (Date.now() < fin) {
        const [etiqueta, ruta] = elegir(pasos);
        await pedir(etiqueta, ruta, { ip: IP_POR_PEDIDO ? ipDe(contadorIp++) : ip, cookie });
        if (PAUSA) await dormir(Math.random() * 2 * PAUSA);
      }
    }),
  );
}

// ── Informe ──────────────────────────────────────────────────────────────────
const duracion = (performance.now() - inicioPrueba) / 1000;
const pct = (orden, p) => orden[Math.min(orden.length - 1, Math.floor((p / 100) * orden.length))];
const filas = [];
let total = 0;
let fallas = 0;
let peorP95 = 0;
for (const [etiqueta, { tiempos, estados }] of [...medidas].sort()) {
  const orden = [...tiempos].sort((a, b) => a - b);
  const malas = [...estados]
    .filter(([e]) => !(typeof e === 'number' && e < 400))
    .reduce((s, [, c]) => s + c, 0);
  total += tiempos.length;
  fallas += malas;
  peorP95 = Math.max(peorP95, pct(orden, 95));
  filas.push({
    ruta: etiqueta,
    pedidos: tiempos.length,
    'por seg': (tiempos.length / duracion).toFixed(1),
    'p50 ms': pct(orden, 50).toFixed(0),
    'p95 ms': pct(orden, 95).toFixed(0),
    'p99 ms': pct(orden, 99).toFixed(0),
    'máx ms': orden[orden.length - 1].toFixed(0),
    estados: [...estados].map(([e, c]) => `${e}×${c}`).join(' '),
  });
}
console.log(
  `\nEscenario «${ESCENARIO}» · ${USUARIOS} usuarios · pausa ${PAUSA} ms${IP_POR_PEDIDO ? ' · IP por pedido' : ''}${VARIAR ? ' · variado' : ''} · ${duracion.toFixed(1)} s · ${API}`,
);
console.table(filas);
console.log(
  `Total: ${total} pedidos, ${(total / duracion).toFixed(1)} por segundo, ${fallas} con error (${((fallas / Math.max(1, total)) * 100).toFixed(2)} %)`,
);

let mal = false;
if (args['p95-max'] && peorP95 > Number(args['p95-max'])) {
  console.error(`✘ El peor p95 (${peorP95.toFixed(0)} ms) pasa de ${args['p95-max']} ms`);
  mal = true;
}
if (
  ESCENARIO !== 'limites' &&
  args['errores-max'] &&
  fallas / Math.max(1, total) > Number(args['errores-max'])
) {
  console.error(`✘ Errores por encima de ${args['errores-max']}`);
  mal = true;
}
process.exit(mal ? 1 : 0);
