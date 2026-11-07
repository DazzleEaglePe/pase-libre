#!/usr/bin/env node
/**
 * Verificación automática de PaseLibre con el catálogo de prueba cargado.
 *
 *   node tools/datos-demo/verificar.mjs [--api=http://localhost:3001/v1] [--web=http://localhost:3000]
 *        [--solo=api|ui] [--rapido] [--sin-limpiar] [--sin-pausa] [--estres]
 *
 * Revisa la API (privacidad, búsqueda, filtros, paginación, fichas, fotos, reglas,
 * validaciones, robustez y rendimiento) y las pantallas (Chrome sin ventana, en celular,
 * tableta y computadora, como visitante y como tienda). Escribe el informe en
 * tools/datos-demo/informes/<fecha>/ y sale con código 1 si algo falla.
 *
 * Solo lee, salvo unos POST que la API debe rechazar. Las búsquedas que hace se registran en
 * «Lo más buscado»; al final se borran de la base (--sin-limpiar lo evita).
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

import { conexionBase, dormir, leerClave, psql } from './comun.mjs';
import { datosParaUi, verificarApi } from './qa/api.mjs';
import { verificarCarga } from './qa/carga.mjs';
import { consultasHechas, estadisticas, resultados } from './qa/corredor.mjs';
import { verificarUi } from './qa/ui.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);
const API = args.api ?? 'http://localhost:3001/v1';
const WEB = args.web ?? 'http://localhost:3000';
const SOLO = args.solo ?? 'todo';
const RAPIDO = args.rapido === 'true';

const inicio = new Date();
const sello = inicio.toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const carpeta = new URL(`informes/${sello}/`, import.meta.url).pathname;
await mkdir(carpeta, { recursive: true });

for (const [nombre, url] of [
  ['la API', `${API}/salud`],
  ['la web', `${WEB}/salud`],
]) {
  try {
    if (!(await fetch(url)).ok) throw new Error('no responde 200');
  } catch (error) {
    console.error(
      `${nombre} no está disponible en ${url} (${error.message}). Levántala o pasa --api / --web.`,
    );
    process.exit(2);
  }
}

const clave = await leerClave();
const archivoManifiesto = new URL('datos/cargados.json', import.meta.url);
const manifiesto = existsSync(archivoManifiesto)
  ? JSON.parse(await readFile(archivoManifiesto, 'utf8'))
  : null;
console.log(
  `PaseLibre · verificación ${inicio.toLocaleString('es-PE')}\nAPI ${API}\nWeb ${WEB}${RAPIDO ? '\nModo rápido' : ''}`,
);

let datos = null;
try {
  datos =
    SOLO === 'ui'
      ? await datosParaUi({ api: API, clave })
      : await verificarApi({ api: API, web: WEB, clave, manifiesto, rapido: RAPIDO });
  if (SOLO !== 'api') {
    if (SOLO !== 'ui' && args['sin-pausa'] !== 'true') {
      console.log(
        '\n… pausa de un minuto: que se despejen los límites de la API antes de abrir las pantallas',
      );
      await dormir(65_000);
    }
    await verificarUi({
      web: WEB,
      api: API,
      clave,
      carpeta,
      datos,
      sesionB: datos.sesionB,
      rapido: RAPIDO,
    });
  }
  if (args.estres === 'true') await verificarCarga({ web: WEB });
} catch (error) {
  console.error(`\nLa verificación se interrumpió: ${error.stack ?? error.message}`);
  resultados.push({
    grupo: 'Ejecución',
    nombre: 'la verificación terminó sin interrumpirse',
    estado: 'falla',
    detalle: error.message,
    ms: 0,
  });
}

// Las búsquedas de la verificación no deben quedar en «Lo más buscado».
let limpieza = 'no se limpiaron las búsquedas (--sin-limpiar)';
if (args['sin-limpiar'] !== 'true' && consultasHechas.size > 0) {
  try {
    const textos = [...consultasHechas].filter((q) => !q.includes('$q$') && !q.includes('\u0000'));
    const lista = textos.map((q) => `$q$${q}$q$`).join(', ');
    psql(
      await conexionBase(),
      `DELETE FROM busqueda WHERE creada_en >= '${inicio.toISOString()}' AND texto IN (${lista});`,
    );
    limpieza = `se borraron de «Lo más buscado» las búsquedas de la verificación (${textos.length} textos)`;
  } catch (error) {
    limpieza = `no pude limpiar las búsquedas: ${error.message}`;
  }
}

// ---------------------------------------------------------------- informe
const cuenta = (estado) => resultados.filter((r) => r.estado === estado).length;
const [ok, falla, aviso] = [cuenta('ok'), cuenta('falla'), cuenta('aviso')];
const segundos = Math.round((Date.now() - inicio.getTime()) / 1000);
const fila = (r) => `- **${r.nombre}** (${r.grupo}) — ${r.detalle || 'sin detalle'}`;
const marca = { ok: '✓', falla: '✗', aviso: '!' };
const grupos = [...new Set(resultados.map((r) => r.grupo))];
const md = [
  '# Informe de verificación de PaseLibre',
  '',
  `${inicio.toLocaleString('es-PE')} · API \`${API}\` · web \`${WEB}\` · ${segundos} s`,
  '',
  `**${resultados.length} pruebas: ${ok} bien · ${falla} fallan · ${aviso} avisos.**`,
  datos
    ? `Catálogo: ${datos.slugs.length} productos visibles, ${datos.fichas.length} fichas revisadas a fondo.`
    : '',
  '',
  falla
    ? `## Fallas\n\n${resultados
        .filter((r) => r.estado === 'falla')
        .map(fila)
        .join('\n')}\n`
    : '## Fallas\n\nNinguna.\n',
  aviso
    ? `## Avisos\n\n${resultados
        .filter((r) => r.estado === 'aviso')
        .map(fila)
        .join('\n')}\n`
    : '',
  '## Por grupo\n',
  '| Grupo | Bien | Fallan | Avisos |',
  '|---|---:|---:|---:|',
  ...grupos.map((g) => {
    const l = resultados.filter((r) => r.grupo === g);
    return `| ${g} | ${l.filter((r) => r.estado === 'ok').length} | ${l.filter((r) => r.estado === 'falla').length} | ${l.filter((r) => r.estado === 'aviso').length} |`;
  }),
  '',
  '## Todas las pruebas\n',
  ...grupos.flatMap((g) => [
    `### ${g}\n`,
    ...resultados
      .filter((r) => r.grupo === g)
      .map((r) => `- ${marca[r.estado]} ${r.nombre}${r.detalle ? ` — ${r.detalle}` : ''}`),
    '',
  ]),
  `---\n${estadisticas.pedidos} pedidos a la API y la web; ${estadisticas.reintentos429} recibieron 429 (límite de la API) y se repitieron.`,
  `${limpieza}. Capturas de pantalla en \`capturas/\`.`,
].join('\n');
await writeFile(`${carpeta}resumen.md`, md);
await writeFile(
  `${carpeta}resultados.json`,
  JSON.stringify({ api: API, web: WEB, inicio, resultados }, null, 2),
);
await copyFile(`${carpeta}resumen.md`, new URL('informes/ultimo.md', import.meta.url).pathname);

console.log(
  `\n${'─'.repeat(70)}\n${resultados.length} pruebas: ${ok} bien · ${falla} fallan · ${aviso} avisos  (${segundos} s)\nInforme: ${carpeta}resumen.md\n${limpieza}`,
);
process.exit(falla > 0 ? 1 : 0);
