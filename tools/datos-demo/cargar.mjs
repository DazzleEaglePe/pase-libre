#!/usr/bin/env node
/**
 * Carga el catálogo de prueba (datos/productos.json, de raspar.mjs) en PaseLibre usando la
 * API de verdad: cada oferta la publica una tienda de prueba con su sesión, así se ejercita
 * el mismo camino que seguirá una tienda real (publicar, «publicar uno igual», fotos).
 *
 * Qué hace:
 *  - Reparte cada producto entre 1 y 3 tiendas, con precios, condición y stock distintos.
 *  - La primera tienda lo crea (con su foto); las otras publican «uno igual».
 *  - Deja un poco de todo para probar: precios «al interno», usados, sin stock, pausadas,
 *    ofertas de distintos días y características del producto.
 *  - Con --pases, publica algunos busco y remates de Pases del día.
 *  - Guarda datos/cargados.json: con eso, repetirlo no duplica y --limpiar lo deshace.
 *
 * Uso: node tools/datos-demo/cargar.mjs [--api=http://localhost:3001/v1] [--semilla=7]
 *        [--solo=N] [--sin-fotos] [--pases] [--limpiar]
 * La clave de las cuentas demo sale de CLAVE_DEMO o de apps/api/prisma/semilla.ts; no se imprime.
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

import { conexionBase, leerClave, psql } from './comun.mjs';

const AQUI = new URL('.', import.meta.url);
const DATOS = new URL('datos/', AQUI);
const MANIFIESTO = new URL('cargados.json', DATOS);

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const API = args.api ?? 'http://localhost:3001/v1';
const SEMILLA = Number(args.semilla ?? 7);
const SOLO = args.solo ? Number(args.solo) : Infinity;
const SIN_FOTOS = args['sin-fotos'] === 'true';
const USUARIOS = ['tiendaa', 'tiendab', 'tiendac', 'tiendae'];
const TIPO_CAMBIO = 3.75;

// ---------------------------------------------------------------- azar con semilla
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const azar = mulberry32(SEMILLA);
const entre = (a, b) => a + azar() * (b - a);
const uno = (lista) => lista[Math.floor(azar() * lista.length)];
function ponderado(pares) {
  const total = pares.reduce((s, [, peso]) => s + peso, 0);
  let punto = azar() * total;
  for (const [valor, peso] of pares) {
    punto -= peso;
    if (punto <= 0) return valor;
  }
  return pares.at(-1)[0];
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- una tienda con su sesión
class Tienda {
  constructor(usuario) {
    this.usuario = usuario;
    this.cookie = null;
    this.yo = null;
    this.subidas = 0;
    this.sinFotos = false;
  }

  async ingresar(clave) {
    const r = await this.llamar(
      'POST',
      '/sesion',
      { usuario: this.usuario, clave, recordar: false },
      { sinCookie: true },
    );
    if (r.estado !== 200) throw new Error(`${this.usuario}: ingreso ${r.estado}`);
    if (r.cuerpo.usuario.debe_cambiar_clave)
      throw new Error(`${this.usuario} debe cambiar su clave`);
    this.yo = r.cuerpo;
    return this;
  }

  get nombre() {
    return this.yo.tienda.nombre;
  }

  async llamar(metodo, ruta, cuerpo, { sinCookie = false, formulario = null } = {}) {
    for (let intento = 0; intento < 4; intento++) {
      const cabeceras = { 'x-paselibre': '1', accept: 'application/json' };
      if (this.cookie && !sinCookie) cabeceras.cookie = this.cookie;
      if (cuerpo !== undefined) cabeceras['content-type'] = 'application/json';
      const r = await fetch(API + ruta, {
        method: metodo,
        headers: cabeceras,
        body: formulario ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
      });
      const nueva = r.headers.getSetCookie?.().find((c) => c.startsWith('pl_sesion='));
      if (nueva) this.cookie = nueva.split(';')[0];
      const texto = await r.text();
      let json = null;
      try {
        json = texto ? JSON.parse(texto) : null;
      } catch {
        json = { texto };
      }
      if (r.status === 429 && intento < 3) {
        await dormir(Number(r.headers.get('retry-after') ?? 4) * 1000 + 500);
        continue;
      }
      return { estado: r.status, cuerpo: json };
    }
  }

  async subirFoto(ruta) {
    if (SIN_FOTOS || this.sinFotos || this.subidas >= 28) return null;
    if (!existsSync(new URL(ruta, DATOS))) return null;
    const buffer = await readFile(new URL(ruta, DATOS));
    const form = new FormData();
    form.append('foto', new Blob([buffer], { type: 'image/jpeg' }), 'foto.jpg');
    const r = await this.llamar('POST', '/archivos', undefined, { formulario: form });
    if (r.estado === 201 || r.estado === 200) {
      this.subidas += 1;
      return r.cuerpo.ruta;
    }
    if (r.estado === 429) this.sinFotos = true;
    return null;
  }
}

// ---------------------------------------------------------------- limpiar el título
const GENERICOS = {
  graficas: /^(tarjeta de video|tarjeta grafica|tarjeta gráfica)\s+/i,
  procesadores: /^procesador\s+/i,
  placas: /^(placa madre|placa|motherboard|mainboard)\s+/i,
  ram: /^(memoria ram|memoria)\s+/i,
  monitores: /^monitor( gamer)?\s+/i,
  cases: /^(gabinete|case)\s+/i,
};
const SIGLAS = new Set(
  'RTX GTX GT RX DDR3 DDR4 DDR5 GDDR5 GDDR6 GDDR6X GDDR7 PCIE USB RGB ARGB LED SSD HDD ATX MATX ITX LGA AM4 AM5 IPS VA TN HDMI DP AMD CPU GPU RAM LCD QHD FHD UHD OC LP TUF ROG OLED HDR WIFI BT SP KB GB TB MB RPM XL DPI MS FPS'.split(
    ' ',
  ),
);
const ESPECIALES = {
  GEFORCE: 'GeForce',
  RADEON: 'Radeon',
  RYZEN: 'Ryzen',
  NVIDIA: 'NVIDIA',
  I3: 'i3',
  I5: 'i5',
  I7: 'i7',
  I9: 'i9',
  AUDIFONO: 'Audífono',
  AUDIFONOS: 'Audífonos',
  DE: 'de',
  OF: 'of',
  Y: 'y',
  EN: 'en',
  CON: 'con',
  SIN: 'sin',
  PARA: 'para',
  MECANICO: 'Mecánico',
};
const MARCAS = { redragon: 'Redragon', 'logitech g': 'Logitech', aula: 'Aula' };

function casearParte(parte) {
  const mayus = parte.toUpperCase();
  if (ESPECIALES[mayus]) return ESPECIALES[mayus];
  if (SIGLAS.has(mayus)) return mayus;
  // Con números va en mayúsculas, salvo la unidad: «144HZ» → «144Hz», «2.50GHZ» → «2.50GHz».
  if (/\d/.test(parte)) return mayus.replace(/(\d|M|G)HZ/g, '$1Hz');
  if (parte.length <= 2) return mayus; // MK, LG…
  return parte[0].toUpperCase() + parte.slice(1).toLowerCase();
}
const casear = (token) => token.split('-').map(casearParte).join('-');

function arreglarMarca(marca) {
  const fija = MARCAS[marca.toLowerCase()];
  if (fija) return fija;
  return marca === marca.toUpperCase() && marca.length > 4 && !/\d/.test(marca)
    ? marca[0] + marca.slice(1).toLowerCase()
    : marca;
}
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function armarModelo(p) {
  const marca = arreglarMarca(p.marca);
  let t = p.titulo.replace(/\([^)]*\)/g, ' ').replace(/\|/g, ' · ');
  t = t.replace(GENERICOS[p.categoria] ?? /^$/, '');
  for (const nombre of new Set([p.marca, marca]))
    t = t.replace(new RegExp(`\\b${escapar(nombre)}\\b`, 'i'), ' ');
  const palabras = t
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w === '·' ? w : casear(w.replace(/-+$/, ''))));
  let modelo = palabras
    .join(' ')
    .replace(/S\/\s*fuente/i, 'sin fuente')
    .replace(/\s+/g, ' ');
  modelo = modelo.replace(/^[\s·\-]+|[\s·\-]+$/g, '');
  if (modelo.length > 64)
    modelo = modelo
      .slice(0, 64)
      .replace(/\s+\S*$/, '')
      .replace(/[\s·\-]+$/g, '');
  if (modelo.length < 2) modelo = casear(p.sku ?? p.id);
  return { marca, modelo };
}

function etiquetasDe(p) {
  const base = {
    graficas: ['tarjeta de video', 'tarjeta grafica', 'gpu'],
    procesadores: ['cpu', 'procesador'],
    placas: ['placa madre', 'motherboard', 'mainboard'],
    ram: ['memoria ram', 'ram'],
    cases: ['gabinete', 'case', 'caja'],
    monitores: ['monitor', 'pantalla', 'gamer'],
    perifericos: [],
  }[p.categoria];
  const extra = [];
  const t = p.titulo.toLowerCase();
  if (p.categoria === 'perifericos') {
    if (/mouse/.test(t)) extra.push('mouse', 'raton');
    if (/teclado/.test(t)) extra.push('teclado', 'keyboard');
    if (/audifono/.test(t)) extra.push('audifonos', 'auriculares', 'headset');
  }
  if (/gamer|gaming/.test(t)) extra.push('gamer');
  for (const d of t.match(/ddr[345]/g) ?? []) extra.push(d);
  return [...new Set([...base, ...extra])].slice(0, 12);
}

// ---------------------------------------------------------------- precios y textos de cada oferta
const FRASES_NUEVO = [
  'Nuevo, sellado. Con factura.',
  'Nuevo en caja, con garantía de la tienda.',
  'Nuevo. Se entrega en el stand o por delivery en Lima.',
  'En stock, con boleta o factura.',
];
const FRASES_USADO = [
  'Usado, probado y funcionando. Sin caja.',
  'Usado en buen estado, con 1 mes de garantía.',
  'Usado y revisado en tienda. Se prueba en el stand.',
];

function ofertaDe(p, tienda) {
  const condicion = ponderado([
    ['NUEVO', ['ram', 'cases'].includes(p.categoria) ? 92 : 84],
    ['USADO', ['ram', 'cases'].includes(p.categoria) ? 8 : 16],
  ]);
  const factor = condicion === 'USADO' ? entre(0.62, 0.85) : entre(0.94, 1.09);
  const moneda = azar() < 0.7 ? tienda.yo.tienda.moneda_defecto : uno(['USD', 'PEN']);
  const base = p.precio_pen * factor;
  const monto =
    moneda === 'PEN'
      ? Math.max(5, Math.round(base / 5) * 5)
      : Math.max(5, Math.round(base / TIPO_CAMBIO));
  const alInterno = azar() < 0.15;
  const sinMonto = alInterno && azar() < 0.4;
  const descripcion =
    azar() < 0.6 ? uno(condicion === 'USADO' ? FRASES_USADO : FRASES_NUEVO) : null;
  return {
    condicion,
    stock: ponderado([
      [1, 30],
      [2, 25],
      [3, 15],
      [4, 10],
      [5, 8],
      [6, 5],
      [8, 4],
      [10, 3],
    ]),
    moneda,
    precio: sinMonto ? '' : String(monto),
    precio_visible: !alInterno,
    descripcion: descripcion ?? '',
  };
}

// ---------------------------------------------------------------- manifiesto
async function leerManifiesto() {
  if (!existsSync(MANIFIESTO))
    return { api: API, creado_en: new Date().toISOString(), productos: {}, pases: [] };
  return JSON.parse(await readFile(MANIFIESTO, 'utf8'));
}
const guardar = (m) => writeFile(MANIFIESTO, JSON.stringify(m, null, 2));

function productoDelConflicto(cuerpo) {
  const buscar = (nodo) => {
    if (!nodo || typeof nodo !== 'object') return null;
    if (nodo.producto && nodo.producto.id) return nodo.producto;
    for (const valor of Object.values(nodo)) {
      const r = buscar(valor);
      if (r) return r;
    }
    return null;
  };
  return buscar(cuerpo);
}

// ---------------------------------------------------------------- principal
if (args['ver-titulos'] === 'true') {
  const lista = JSON.parse(await readFile(new URL('productos.json', DATOS), 'utf8'));
  for (const p of lista) {
    const { marca, modelo } = armarModelo(p);
    console.log(`${p.categoria.padEnd(12)} ${marca} · ${modelo}   ←  ${p.titulo}`);
  }
  process.exit(0);
}
const clave = await leerClave();
const tiendas = [];
for (const usuario of USUARIOS) {
  try {
    tiendas.push(await new Tienda(usuario).ingresar(clave));
  } catch (error) {
    console.log(`! ${error.message}: la salto`);
  }
}
if (tiendas.length === 0) throw new Error('Ninguna tienda pudo ingresar.');
console.log(`Tiendas: ${tiendas.map((t) => t.nombre).join(', ')}`);
const manifiesto = await leerManifiesto();
const porNombre = new Map(tiendas.map((t) => [t.usuario, t]));

// ---- --limpiar
if (args.limpiar === 'true') {
  let quitadas = 0;
  for (const entrada of Object.values(manifiesto.productos)) {
    for (const oferta of entrada.ofertas) {
      const tienda = porNombre.get(oferta.tienda);
      if (!tienda) continue;
      const r = await tienda.llamar('DELETE', `/ofertas/${oferta.id}`);
      if (r.estado < 300 || r.estado === 404) quitadas += 1;
      await dormir(80);
    }
  }
  for (const pase of manifiesto.pases) {
    const tienda = porNombre.get(pase.tienda);
    if (tienda) await tienda.llamar('PATCH', `/en-vivo/${pase.id}`, { accion: 'cerrar' });
  }
  await writeFile(
    MANIFIESTO,
    JSON.stringify(
      { api: API, creado_en: new Date().toISOString(), productos: {}, pases: [] },
      null,
      2,
    ),
  );
  console.log(
    `Limpio: ${quitadas} ofertas eliminadas. Los productos quedan ocultos (sin ofertas vigentes).`,
  );
  process.exit(0);
}

// ---- --sincronizar: vuelve a leer de la API el estado y el stock de cada oferta cargada
if (args.sincronizar === 'true') {
  let cambiadas = 0;
  for (const entrada of Object.values(manifiesto.productos)) {
    for (const oferta of entrada.ofertas) {
      const tienda = porNombre.get(oferta.tienda);
      if (!tienda) continue;
      const r = await tienda.llamar('GET', `/ofertas/${oferta.id}`);
      const estado = r.estado === 200 ? r.cuerpo.estado : 'ELIMINADA';
      const stock = r.estado === 200 ? r.cuerpo.stock : 0;
      if (estado !== oferta.estado || stock !== oferta.stock) {
        oferta.estado = estado;
        oferta.stock = stock;
        cambiadas += 1;
      }
      await dormir(60);
    }
  }
  await guardar(manifiesto);
  console.log(`Manifiesto al día con la API: ${cambiadas} ofertas distintas a lo anotado.`);
  process.exit(0);
}

// ---- cargar productos
const productos = JSON.parse(await readFile(new URL('productos.json', DATOS), 'utf8'));
const pendientes = productos
  .filter((p) => !manifiesto.productos[`${p.fuente}:${p.id}`])
  .slice(0, SOLO);
console.log(`${productos.length} productos raspados; ${pendientes.length} por cargar.`);

const fallos = [];
let creados = 0;
let ofertas = 0;
for (const [i, p] of pendientes.entries()) {
  const clavePro = `${p.fuente}:${p.id}`;
  const cuantas = ponderado([
    [1, 45],
    [2, 35],
    [3, 20],
  ]);
  const mezcladas = [...tiendas]
    .sort(() => azar() - 0.5)
    .slice(0, Math.min(cuantas, tiendas.length));
  // Crea el producto (y sube su foto) la que menos fotos lleva: la API tolera 30 por hora y persona.
  mezcladas.sort((x, y) => x.subidas - y.subidas);
  const { marca, modelo } = armarModelo(p);
  const entrada = {
    producto_id: null,
    slug: null,
    titulo: `${marca} ${modelo}`,
    categoria: p.categoria,
    precio_pen_ref: p.precio_pen,
    ofertas: [],
  };
  let productoId = null;

  for (const tienda of mezcladas) {
    const datos = ofertaDe(p, tienda);
    const base = {
      condicion: datos.condicion,
      stock: datos.stock,
      moneda: datos.moneda,
      precio: datos.precio,
      precio_visible: datos.precio_visible,
      descripcion: datos.descripcion,
    };
    let r;
    if (productoId) {
      r = await tienda.llamar('POST', '/ofertas', { producto_id: productoId, ...base });
    } else {
      const foto = p.foto ? await tienda.subirFoto(p.foto) : null;
      r = await tienda.llamar('POST', '/ofertas', {
        producto_nuevo: {
          categoria: p.categoria,
          marca,
          modelo,
          etiquetas: etiquetasDe(p),
          fotos: foto ? [foto] : [],
        },
        ...base,
      });
      if (r.estado === 409) {
        // Otro producto limpio al mismo título: se publica «uno igual» sobre ese.
        const existente = productoDelConflicto(r.cuerpo);
        if (existente)
          r = await tienda.llamar('POST', '/ofertas', { producto_id: existente.id, ...base });
      }
    }
    if (r.estado !== 201 && r.estado !== 200) {
      fallos.push({
        producto: clavePro,
        tienda: tienda.usuario,
        estado: r.estado,
        cuerpo: JSON.stringify(r.cuerpo).slice(0, 220),
      });
      continue;
    }
    const oferta = r.cuerpo.oferta;
    productoId ??= oferta.producto.id;
    entrada.producto_id = productoId;
    entrada.slug = oferta.producto.slug ?? entrada.slug;
    if (r.cuerpo.producto_nuevo) {
      creados += 1;
      entrada.nuevo = true;
    }
    entrada.ofertas.push({
      tienda: tienda.usuario,
      id: oferta.id,
      condicion: datos.condicion,
      stock: datos.stock,
      estado: 'ACTIVA',
    });
    ofertas += 1;
    await dormir(120);
  }
  if (entrada.ofertas.length > 0) manifiesto.productos[clavePro] = entrada;
  if ((i + 1) % 10 === 0 || i === pendientes.length - 1) {
    await guardar(manifiesto);
    console.log(
      `  ${i + 1}/${pendientes.length} productos · ${ofertas} ofertas · ${fallos.length} fallos`,
    );
  }
}

// ---- casos límite: sin stock y pausadas
// `todas` guarda cada oferta tal cual está en el manifiesto (sin copiarla) y su producto: lo que
// se cambie en `o` queda anotado en el manifiesto, que es con lo que luego compara la verificación.
const todas = Object.values(manifiesto.productos).flatMap((e) => e.ofertas.map((o) => ({ o, e })));
const candidatas = todas.filter(({ o }) => o.estado === 'ACTIVA' && o.stock > 0 && !o.marcada);
for (const { o } of candidatas) {
  const dado = azar();
  const tienda = porNombre.get(o.tienda);
  if (!tienda || dado > 0.09) continue;
  const cambio = dado < 0.05 ? { stock: 0 } : { estado: 'PAUSADA' };
  const r = await tienda.llamar('PATCH', `/ofertas/${o.id}`, cambio);
  if (r.estado === 200) {
    if (cambio.stock === 0) o.stock = 0;
    if (cambio.estado) o.estado = 'PAUSADA';
    o.marcada = true;
  }
  await dormir(60);
}
await guardar(manifiesto);

// ---- características del producto y fechas de las ofertas (directo en la base de prueba)
const conexion = await conexionBase();
const porId = new Map(productos.map((p) => [`${p.fuente}:${p.id}`, p]));
let sql = 'BEGIN;\n';
for (const [clavePro, entrada] of Object.entries(manifiesto.productos)) {
  const p = porId.get(clavePro);
  if (!p || !entrada.producto_id) continue;
  const caracteristicas = { ...p.caracteristicas };
  delete caracteristicas.Modelo; // el modelo ya se muestra aparte
  if (Object.keys(caracteristicas).length > 0) {
    sql += `UPDATE producto SET caracteristicas = $c$${JSON.stringify(caracteristicas)}$c$::jsonb WHERE id = '${entrada.producto_id}' AND caracteristicas = '{}'::jsonb;\n`;
  }
  for (const o of entrada.ofertas) {
    if (o.fecha) continue;
    const dias = Math.floor(azar() ** 2 * 24);
    sql += `UPDATE oferta SET actualizada_en = now() - interval '${dias} days ${Math.floor(entre(1, 20))} hours', creada_en = now() - interval '${dias + Math.floor(entre(0, 6))} days' WHERE id = '${o.id}';\n`;
    o.fecha = dias;
  }
}
sql += 'COMMIT;\n';
psql(conexion, sql);
await guardar(manifiesto);

// ---- Pases del día
if (args.pases === 'true') {
  const activas = Object.values(manifiesto.productos).filter((e) =>
    e.ofertas.some((o) => o.estado === 'ACTIVA' && o.stock > 0),
  );
  const publicar = async (tienda, cuerpo) => {
    const r = await tienda.llamar('POST', '/en-vivo', cuerpo);
    if (r.estado === 201 || r.estado === 200)
      manifiesto.pases.push({ tienda: tienda.usuario, id: r.cuerpo.id });
    else
      fallos.push({
        producto: 'pase',
        tienda: tienda.usuario,
        estado: r.estado,
        cuerpo: JSON.stringify(r.cuerpo).slice(0, 200),
      });
  };
  const busco = [...activas].sort(() => azar() - 0.5).slice(0, 4);
  for (const [i, e] of busco.entries()) {
    const tienda = tiendas[i % tiendas.length];
    await publicar(tienda, {
      tipo: 'BUSCO',
      producto: e.producto_id,
      cantidad: ponderado([
        [1, 70],
        [2, 20],
        [3, 10],
      ]),
      condicion: null,
      moneda: 'USD',
      presupuesto: String(Math.round((e.precio_pen_ref / TIPO_CAMBIO) * 1.05)),
      duracion: uno(['3h', '3h', 'cierre']),
      nota: uno(['Cliente esperando en el stand.', 'Con factura.', 'Para hoy, si se puede.', '']),
    });
  }
  const conStock = todas.filter(({ o }) => o.estado === 'ACTIVA' && o.stock > 1);
  for (const { o, e } of [...conStock].sort(() => azar() - 0.5).slice(0, 3)) {
    const tienda = porNombre.get(o.tienda);
    if (!tienda) continue;
    await publicar(tienda, {
      tipo: 'FLASH',
      oferta: o.id,
      precio: String(Math.max(5, Math.round((e.precio_pen_ref / TIPO_CAMBIO) * 0.9))),
      moneda: 'USD',
      cantidad: Math.min(2, o.stock),
      duracion: uno(['3h', 'cierre']),
      nota: uno(['Últimas unidades.', 'Hasta agotar stock.', '']),
    });
  }
  await guardar(manifiesto);
  console.log(`Pases del día: ${manifiesto.pases.length} publicados.`);
}

const total = Object.values(manifiesto.productos);
console.log(
  `Listo: ${creados} productos nuevos en esta corrida · ${total.length} en el manifiesto · ${total.reduce((s, e) => s + e.ofertas.length, 0)} ofertas.`,
);
if (fallos.length > 0) {
  console.log(`Fallos (${fallos.length}), los primeros:`);
  for (const f of fallos.slice(0, 6))
    console.log(`  ${f.producto} ${f.tienda} → ${f.estado} ${f.cuerpo}`);
}
