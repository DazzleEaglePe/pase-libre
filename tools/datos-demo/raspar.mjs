#!/usr/bin/env node
/**
 * Raspa datos de producto de Infotec (tienda peruana de componentes de PC) para llenar el
 * catálogo de prueba de PaseLibre con casos realistas.
 *
 * Reglas de este raspador:
 *  - Lee el robots.txt de la tienda y no pide ninguna ruta que prohíba.
 *  - Se identifica con un User-Agent propio, pide de a uno y espera entre pedidos.
 *  - Guarda en caché lo que baja: repetirlo no vuelve a pedirlo.
 *  - Se queda con datos (marca, modelo, SKU, precio de referencia, especificaciones). No
 *    copia las descripciones de marketing: la carga escribe las suyas.
 *  - Las fotos se bajan solo para ver el diseño en local: van a `datos/` (fuera de git) y
 *    no son nuestras. En producción cada tienda sube las suyas.
 *
 * Uso: node tools/datos-demo/raspar.mjs [--espera=1500] [--sin-fotos] [--escala=1]
 * Salida: tools/datos-demo/datos/productos.json y datos/fotos/<id>.jpg
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://infotec.com.pe';
const UA = 'PaseLibreDemo/0.1 (prueba local de un catalogo entre tiendas)';
const AQUI = new URL('.', import.meta.url);
const CACHE = new URL('cache/', AQUI);
const DATOS = new URL('datos/', AQUI);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const ESPERA = Number(args.espera ?? 1500);
const ESCALA = Number(args.escala ?? 1);
const SIN_FOTOS = args['sin-fotos'] === 'true';

/** Qué listado alimenta a qué categoría de PaseLibre y cuántos productos se toman. */
const LISTADOS = [
  { categoria: 'graficas', ruta: '/34-tarjetas-de-video-tarjeta-grafica', max: 18 },
  { categoria: 'procesadores', ruta: '/31-procesadores', max: 14, maxPorMarca: 7 },
  { categoria: 'placas', ruta: '/30-placa-madre', max: 14 },
  { categoria: 'ram', ruta: '/32-memoria-ram', max: 14 },
  { categoria: 'cases', ruta: '/136-case-y-gabinete', max: 12 },
  { categoria: 'monitores', ruta: '/631-monitores-gamer', max: 14 },
  { categoria: 'perifericos', ruta: '/100-mouse-gamer', max: 6 },
  { categoria: 'perifericos', ruta: '/103-teclados-gamer', max: 6 },
  { categoria: 'perifericos', ruta: '/101-audifonos-gamer', max: 6 },
];
const MAX_POR_MARCA = 4; // por defecto; un listado con pocas marcas (CPU) sube el tope

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- robots.txt
async function cargarReglas() {
  const respuesta = await fetch(`${BASE}/robots.txt`, { headers: { 'user-agent': UA } });
  const grupos = [];
  let actual = null;
  let leyendoAgentes = false;
  for (const linea of (await respuesta.text()).split('\n')) {
    const limpia = linea.split('#')[0].trim();
    if (!limpia) continue;
    const [clave, ...resto] = limpia.split(':');
    const valor = resto.join(':').trim();
    if (clave.trim().toLowerCase() === 'user-agent') {
      if (!leyendoAgentes) {
        actual = { agentes: [], prohibe: [] };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      leyendoAgentes = true;
      continue;
    }
    leyendoAgentes = false;
    if (actual && clave.trim().toLowerCase() === 'disallow' && valor) actual.prohibe.push(valor);
  }
  return grupos.filter((g) => g.agentes.includes('*')).flatMap((g) => g.prohibe);
}
let REGLAS = [];
function permitido(url) {
  const { pathname, search } = new URL(url);
  const ruta = pathname + search;
  return !REGLAS.some((regla) =>
    new RegExp('^' + regla.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')).test(ruta),
  );
}

// ---------------------------------------------------------------- pedidos con caché
async function traer(url, { binario = false } = {}) {
  if (!permitido(url)) throw new Error(`robots.txt no permite ${url}`);
  const clave = createHash('sha1').update(url).digest('hex');
  const archivo = new URL(clave + (binario ? '.bin' : '.html'), CACHE);
  if (existsSync(archivo)) return binario ? readFile(archivo) : readFile(archivo, 'utf8');
  await dormir(ESPERA);
  const respuesta = await fetch(url, {
    headers: { 'user-agent': UA, accept: '*/*' },
    redirect: 'follow',
  });
  if (!respuesta.ok) throw new Error(`${respuesta.status} en ${url}`);
  const contenido = binario ? Buffer.from(await respuesta.arrayBuffer()) : await respuesta.text();
  await writeFile(archivo, contenido);
  return contenido;
}

// ---------------------------------------------------------------- lectura del HTML
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodificar = (texto) =>
  texto
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nombre) => ENTIDADES[nombre.toLowerCase()] ?? m);
const sinEtiquetas = (html) =>
  decodificar(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
const primero = (texto, regex) => regex.exec(texto)?.[1] ?? null;

function leerTarjetas(html) {
  const tarjetas = html.match(/<article[^>]*product-miniature[^>]*>[\s\S]*?<\/article>/g) ?? [];
  return tarjetas
    .map((t) => {
      const id = primero(t, /data-id-product="(\d+)"/);
      const url = primero(t, /product-title">\s*<a href="([^"]+)"/);
      const titulo = primero(t, /product-title">\s*<a [^>]*>([^<]+)</);
      const marca = primero(t, /product-brand[^>]*>\s*<a [^>]*>([^<]+)</);
      const sku = primero(t, /product-reference[^>]*>\s*<a [^>]*>([^<]+)</);
      const precio = Number(primero(t, /class="product-price"[^>]*content="([\d.]+)"/) ?? NaN);
      const regular = Number(
        (primero(t, /regular-price[^>]*>\s*S\/\.?\s*([\d.,]+)/) ?? '').replace(/,/g, ''),
      );
      const foto = primero(t, /data-full-size-image-url="([^"]+)"/);
      const agotado = /agotado|out_of_stock/i.test(t);
      if (!id || !url || !titulo || !(precio > 0)) return null;
      return {
        id,
        url,
        titulo: decodificar(titulo).trim(),
        marca: marca ? decodificar(marca).trim() : null,
        sku: sku ? decodificar(sku).trim() : null,
        precio_pen: precio,
        precio_regular_pen: regular > precio ? regular : null,
        foto_url: foto,
        agotado,
      };
    })
    .filter(Boolean);
}

function leerCaracteristicas(html) {
  const seccion = html.match(/<section[^>]*product-features[^>]*>[\s\S]*?<\/section>/)?.[0] ?? '';
  const pares = [...seccion.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g)];
  const salida = {};
  for (const [, clave, valor] of pares) {
    const nombre = sinEtiquetas(clave);
    const texto = sinEtiquetas(valor);
    if (!nombre || !texto || /^(marca|producto)$/i.test(nombre)) continue;
    if (Object.keys(salida).length < 8 && texto.length <= 90) salida[nombre] = texto;
  }
  return salida;
}

/**
 * Hasta `max` productos repartidos por precio (de la gama de entrada a la alta, como en una
 * galería de verdad) y como mucho MAX_POR_MARCA de la misma marca.
 */
function elegir(tarjetas, max, maxPorMarca = MAX_POR_MARCA) {
  const unicas = new Map(tarjetas.map((t) => [t.id, t])); // la 2.ª página repite algunas de la 1.ª
  const lista = [...unicas.values()]
    .filter((t) => !t.agotado && t.marca)
    .sort((a, b) => a.precio_pen - b.precio_pen);
  const usados = new Set();
  const porMarca = new Map();
  const elegidas = [];
  for (let i = 0; i < Math.min(max, lista.length); i++) {
    const objetivo = Math.round(
      (i * (lista.length - 1)) / Math.max(1, Math.min(max, lista.length) - 1),
    );
    // El más cercano al objetivo que no se haya usado ni pase del tope de su marca.
    for (let salto = 0; salto < lista.length; salto++) {
      const candidato = [objetivo + salto, objetivo - salto].find(
        (k) =>
          k >= 0 &&
          k < lista.length &&
          !usados.has(k) &&
          (porMarca.get(lista[k].marca) ?? 0) < maxPorMarca,
      );
      if (candidato === undefined) continue;
      usados.add(candidato);
      porMarca.set(lista[candidato].marca, (porMarca.get(lista[candidato].marca) ?? 0) + 1);
      elegidas.push(lista[candidato]);
      break;
    }
  }
  return elegidas;
}

// ---------------------------------------------------------------- principal
await mkdir(CACHE, { recursive: true });
await mkdir(new URL('fotos/', DATOS), { recursive: true });
REGLAS = await cargarReglas();
console.log(`robots.txt: ${REGLAS.length} reglas para «*». Pausa entre pedidos: ${ESPERA} ms.`);

const vistos = new Set();
const productos = [];
for (const listado of LISTADOS) {
  const url = BASE + listado.ruta;
  let tarjetas = leerTarjetas(await traer(url));
  if (tarjetas.length >= 30) {
    // Con la segunda página hay más gamas para elegir.
    try {
      tarjetas = tarjetas.concat(leerTarjetas(await traer(`${url}?page=2`)));
    } catch {
      // Si no hay segunda página, con la primera alcanza.
    }
  }
  const nuevas = elegir(
    tarjetas.filter((t) => !vistos.has(t.id)),
    Math.max(1, Math.round(listado.max * ESCALA)),
    listado.maxPorMarca,
  );
  console.log(
    `${listado.categoria.padEnd(13)} ${listado.ruta.padEnd(42)} ${tarjetas.length} leídas → ${nuevas.length}`,
  );
  for (const t of nuevas) {
    vistos.add(t.id);
    productos.push({ fuente: 'infotec', categoria: listado.categoria, ...t, caracteristicas: {} });
  }
}

let n = 0;
for (const producto of productos) {
  n += 1;
  try {
    producto.caracteristicas = leerCaracteristicas(await traer(producto.url));
  } catch (error) {
    console.log(`  ! ${producto.id}: ${error.message}`);
  }
  if (!SIN_FOTOS && producto.foto_url) {
    try {
      const archivo = new URL(`fotos/${producto.id}.jpg`, DATOS);
      if (!existsSync(archivo))
        await writeFile(archivo, await traer(producto.foto_url, { binario: true }));
      producto.foto = `fotos/${producto.id}.jpg`;
    } catch (error) {
      console.log(`  ! foto ${producto.id}: ${error.message}`);
    }
  }
  if (n % 10 === 0) console.log(`  ${n}/${productos.length} fichas`);
}

await writeFile(new URL('productos.json', DATOS), JSON.stringify(productos, null, 2));
const porCategoria = Object.entries(Object.groupBy(productos, (p) => p.categoria)).map(
  ([c, l]) => `${c}:${l.length}`,
);
console.log(
  `Listo: ${productos.length} productos (${porCategoria.join(' ')}). Con fotos: ${productos.filter((p) => p.foto).length}.`,
);
