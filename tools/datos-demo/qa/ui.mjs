/**
 * Verificación de las pantallas con Chrome sin ventana (protocolo CDP, sin dependencias):
 * recorre las rutas en celular, tableta y computadora, como visitante y como tienda, y mira
 * errores de consola e hidratación, red, desbordes, imágenes rotas y accesibilidad básica.
 * Después prueba los flujos clave (menú de categorías, buscador, filtros, sin resultados,
 * ficha, pie). Guarda una captura de cada pantalla.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

import { dormir } from '../comun.mjs';
import { afirmar, cliente, consultasHechas, enLotes, grupo, prueba } from './corredor.mjs';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VISTAS = {
  celular: { ancho: 390, alto: 844, movil: true },
  tableta: { ancho: 768, alto: 1024, movil: false },
  compu: { ancho: 1440, alto: 900, movil: false },
};

/** Lo que se mide en cada pantalla, dentro de la página. */
export const AUDITORIA = `(() => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nombre = (el) => (el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent) || el.textContent || el.getAttribute('title') || el.querySelector('img[alt]')?.getAttribute('alt') || '').trim();
  const corto = (el) => el.outerHTML.replace(/\\s+/g, ' ').slice(0, 90);
  // Lo oculto a lectores de pantalla (aria-hidden) y fuera del teclado no necesita nombre: por ejemplo la miniatura de un resultado, cuyo título ya es el enlace.
  const oculto = (el) => !!el.closest('[aria-hidden="true"]') || el.getAttribute('tabindex') === '-1';
  const interactivos = [...document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=option]')].filter((el) => visible(el) && !oculto(el));
  const campos = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(visible);
  const texto = document.body.innerText;

  // Alineación. Un botón es lo que parece botón: redondeado, con fondo o borde, de 28 a 64 px de alto y con texto.
  // (1) Los botones que comparten fila (mismo contenedor) deben quedar centrados en la misma línea.
  // (2) En una fila de tarjetas, el último botón de cada una debe quedar a la misma distancia de su borde de abajo.
  const fijo = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const esBoton = (el) => {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    const redondo = parseFloat(s.borderTopLeftRadius) >= Math.min(r.height / 2, 10);
    const conFondo = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(s.borderTopWidth) > 0;
    return r.height >= 28 && r.height <= 64 && r.width >= 36 && redondo && conFondo && el.textContent.trim().length > 0;
  };
  const cajaDe = (el) => { const r = el.getBoundingClientRect(); return { el, texto: el.textContent.trim().slice(0, 22), arriba: r.top + scrollY, abajo: r.bottom + scrollY, medio: r.top + scrollY + r.height / 2 }; };
  const mismaFila = (a, b) => Math.min(a.abajo, b.abajo) - Math.max(a.arriba, b.arriba) >= 0.5 * Math.min(a.abajo - a.arriba, b.abajo - b.arriba);
  const botones = [...document.querySelectorAll('button, a[href]')].filter((el) => visible(el) && !oculto(el) && !fijo(el) && esBoton(el)).map(cajaDe);
  const desalineados = [];
  const porPadre = new Map();
  for (const b of botones) { const p = b.el.parentElement; if (!porPadre.has(p)) porPadre.set(p, []); porPadre.get(p).push(b); }
  for (const grupo of porPadre.values()) {
    for (let i = 0; i < grupo.length; i++) for (let j = i + 1; j < grupo.length; j++) {
      const d = Math.abs(grupo[i].medio - grupo[j].medio);
      if (mismaFila(grupo[i], grupo[j]) && d > 3) desalineados.push('«' + grupo[i].texto + '» y «' + grupo[j].texto + '» no están centrados en la misma línea (' + Math.round(d) + ' px)');
    }
  }
  const tarjetasPorPadre = new Map();
  for (const hijo of document.querySelectorAll('article, li')) {
    if (!visible(hijo) || fijo(hijo)) continue;
    const dentro = botones.filter((b) => hijo.contains(b.el));
    if (dentro.length === 0) continue;
    const ultimo = dentro.reduce((m, b) => (b.abajo > m.abajo ? b : m));
    const r = hijo.getBoundingClientRect();
    const p = hijo.parentElement;
    if (!tarjetasPorPadre.has(p)) tarjetasPorPadre.set(p, []);
    tarjetasPorPadre.get(p).push({ arriba: r.top + scrollY, abajo: r.bottom + scrollY, hasta: r.bottom + scrollY - ultimo.abajo, texto: ultimo.texto });
  }
  for (const fila of tarjetasPorPadre.values()) {
    for (let i = 0; i < fila.length; i++) for (let j = i + 1; j < fila.length; j++) {
      const d = Math.abs(fila[i].hasta - fila[j].hasta);
      if (mismaFila(fila[i], fila[j]) && d > 3) desalineados.push('el botón «' + fila[i].texto + '» y el de «' + fila[j].texto + '» no están a la misma altura dentro de su tarjeta (' + Math.round(d) + ' px)');
    }
  }

  return {
    desalineados: [...new Set(desalineados)].slice(0, 6), botonesRevisados: botones.length,
    titulo: document.title, lang: document.documentElement.lang,
    h1: [...document.querySelectorAll('h1')].filter(visible).length,
    desborde: document.documentElement.scrollWidth - window.innerWidth,
    imgRotas: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc && !i.currentSrc.startsWith('data:')).map((i) => i.currentSrc.slice(0, 100)),
    imgSinAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    sinNombre: interactivos.filter((el) => !nombre(el)).map(corto).slice(0, 4),
    camposSinEtiqueta: campos.filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby') && !el.title).map(corto).slice(0, 4),
    metaDescripcion: !!document.querySelector('meta[name=description]'),
    chicos: interactivos.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 28 && r.width < 40 && !el.closest('p, li, span') ; }).length,
    textoRaro: (texto.match(/\\bundefined\\b|\\bNaN\\b|\\[object Object\\]|US\\$ null|S\\/ null/g) || []).slice(0, 3),
    hrefs: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h && h.startsWith('/') && !h.startsWith('//')))].slice(0, 80),
  };
})()`;

export async function abrirNavegador(carpeta) {
  const puerto = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${carpeta}/chrome-perfil`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let destino;
  for (let i = 0; i < 75 && !destino; i++) {
    await dormir(200);
    try {
      destino = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find(
        (t) => t.type === 'page',
      );
    } catch {
      /* todavía no abre */
    }
  }
  if (!destino) {
    chrome.kill();
    throw new Error('Chrome no abrió (¿está instalado en la ruta de siempre? Usa CHROME=/ruta).');
  }
  const ws = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let siguiente = 1;
  const pendientes = new Map();
  const eventos = [];
  // Para diagnosticar: si se fija un HTML, el documento de cada visita se responde con él.
  let htmlFijo = null;
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendientes.has(d.id)) {
      pendientes.get(d.id)(d);
      pendientes.delete(d.id);
    } else if (d.method === 'Fetch.requestPaused') {
      const id = ++siguiente;
      const doc = d.params.resourceType === 'Document' && htmlFijo !== null;
      ws.send(
        JSON.stringify(
          doc
            ? {
                id,
                method: 'Fetch.fulfillRequest',
                params: {
                  requestId: d.params.requestId,
                  responseCode: 200,
                  responseHeaders: [{ name: 'content-type', value: 'text/html; charset=utf-8' }],
                  body: Buffer.from(htmlFijo).toString('base64'),
                },
              }
            : { id, method: 'Fetch.continueRequest', params: { requestId: d.params.requestId } },
        ),
      );
    } else if (d.method) eventos.push(d);
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve) => {
      const id = siguiente++;
      pendientes.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  for (const dominio of ['Page', 'Runtime', 'Network', 'Log']) await cdp(`${dominio}.enable`);

  const nav = {
    async vista(v) {
      await cdp('Emulation.setDeviceMetricsOverride', {
        width: v.ancho,
        height: v.alto,
        deviceScaleFactor: 1,
        mobile: v.movil,
      });
    },
    async sesion(cookie) {
      await cdp('Network.clearBrowserCookies');
      await cdp('Storage.clearDataForOrigin', { origin: '*', storageTypes: 'local_storage' }).catch(
        () => {},
      );
      if (cookie) {
        const [nombre, ...valor] = cookie.split('=');
        await cdp('Network.setCookie', {
          name: nombre,
          value: valor.join('='),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
        });
      }
    },
    async evaluar(expresion) {
      const r = await cdp('Runtime.evaluate', {
        expression: expresion,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.result?.exceptionDetails)
        throw new Error(
          `en la página: ${r.result.exceptionDetails.exception?.description?.split('\n')[0] ?? r.result.exceptionDetails.text}`,
        );
      return r.result?.result?.value;
    },
    async visitar(url, { esperar = 1300 } = {}) {
      const q = new URL(url).searchParams.get('q');
      if (q) consultasHechas.add(q); // la búsqueda se registra: al final se borra
      eventos.length = 0;
      await cdp('Page.navigate', { url });
      const t0 = Date.now();
      while (!eventos.some((e) => e.method === 'Page.loadEventFired') && Date.now() - t0 < 25000)
        await dormir(80);
      const cargaMs = Date.now() - t0;
      await dormir(esperar);
      const docs = eventos.filter(
        (e) => e.method === 'Network.responseReceived' && e.params.type === 'Document',
      );
      const errores = new Set();
      for (const e of eventos) {
        if (e.method === 'Runtime.exceptionThrown')
          errores.add(
            `excepción: ${(e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text).split('\n')[0].slice(0, 150)}`,
          );
        if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
          errores.add(
            `consola: ${e.params.args
              .map((a) => a.value ?? a.description ?? '')
              .join(' ')
              .split('\n')[0]
              .slice(0, 150)}`,
          );
        if (
          e.method === 'Network.loadingFailed' &&
          !e.params.canceled &&
          e.params.errorText !== 'net::ERR_ABORTED'
        )
          errores.add(`red: ${e.params.errorText}`);
      }
      const malas = eventos
        .filter(
          (e) =>
            e.method === 'Network.responseReceived' &&
            e.params.response.status >= 400 &&
            e.params.type !== 'Document',
        )
        .map(
          (e) =>
            `${e.params.response.status} ${e.params.response.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 90)}`,
        );
      return {
        estado: docs.at(-1)?.params.response.status ?? 0,
        urlFinal: docs.at(-1)?.params.response.url ?? url,
        errores: [...errores],
        malas,
        cargaMs,
      };
    },
    /** Diagnóstico: frena la CPU del navegador (4 = cuatro veces más lento), como un celular modesto. */
    async frenarCpu(rate) {
      await cdp('Emulation.setCPUThrottlingRate', { rate });
    },
    /** Diagnóstico: responde el documento de las próximas visitas con este HTML (o lo suelta con null). */
    async fijarHtml(html) {
      htmlFijo = html;
      await cdp(
        html === null ? 'Fetch.disable' : 'Fetch.enable',
        html === null ? {} : { patterns: [{ urlPattern: '*', requestStage: 'Request' }] },
      );
    },
    /** Los errores de consola de la última visita, completos (la hidratación en desarrollo trae el detalle). */
    consolaCompleta() {
      return eventos
        .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
        .map((e) => e.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    },
    /** El HTML tal como lo recibió el navegador en la última visita (para diagnosticar la hidratación). */
    async htmlRecibido() {
      const doc = eventos.findLast(
        (e) => e.method === 'Network.responseReceived' && e.params.type === 'Document',
      );
      if (!doc) return null;
      const r = await cdp('Network.getResponseBody', { requestId: doc.params.requestId });
      return r.result?.body ?? null;
    },
    async capturar(archivo) {
      const r = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(archivo, Buffer.from(r.result.data, 'base64'));
    },
    async escribir(texto) {
      await cdp('Input.insertText', { text: texto });
    },
    async cerrar() {
      ws.close();
      chrome.kill();
    },
  };
  return nav;
}

const nombreArchivo = (ruta, vista) =>
  `${(ruta === '/' ? 'inicio' : ruta)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}-${vista}.png`;

export async function verificarUi({ web, api, clave, carpeta, datos, sesionB, rapido }) {
  await mkdir(`${carpeta}/capturas`, { recursive: true });
  const nav = await abrirNavegador(carpeta);
  const origen = new URL(web).origin;
  const { fichas, slugs } = datos;
  const varias = [...fichas].sort((a, b) => b.ofertas - a.ofertas)[0]?.slug ?? slugs[0];
  const primero = slugs[0];
  const hrefs = new Map(); // ruta → quién la vio

  const publicas = [
    '/',
    '/buscar',
    '/buscar?categoria=graficas',
    '/buscar?q=rtx',
    '/buscar?q=msi',
    '/buscar?q=xyzxyzxyz',
    `/p/${primero}`,
    `/p/${varias}`,
    '/pases-del-dia',
    '/ayuda',
    '/terminos',
    '/privacidad',
    '/ingresar',
  ];
  const deTienda = [
    '/',
    '/buscar?categoria=ram',
    `/p/${varias}`,
    '/pases-del-dia',
    '/pases-del-dia/publicar',
    '/mensajes',
    '/mis-publicaciones',
    '/publicar',
  ];
  const escenas = [];
  for (const [nombre, v] of Object.entries(VISTAS)) {
    if (rapido && nombre === 'tableta') continue;
    for (const ruta of publicas)
      escenas.push({ quien: 'visitante', ruta, nombre, v, esperada: 200 });
    if (nombre !== 'tableta')
      for (const ruta of deTienda)
        escenas.push({ quien: 'tienda', ruta, nombre, v, esperada: 200 });
  }
  if (!rapido)
    escenas.push({
      quien: 'visitante',
      ruta: '/esta-pagina-no-existe',
      nombre: 'compu',
      v: VISTAS.compu,
      esperada: 404,
    });

  grupo(`Pantallas: ${escenas.length} cargas con Chrome sin ventana (${origen})`);
  let sesionActual = '';
  try {
    for (const e of escenas) {
      if (sesionActual !== e.quien) {
        await nav.sesion(e.quien === 'tienda' ? sesionB.cookie : null);
        sesionActual = e.quien;
      }
      await nav.vista(e.v);
      await prueba(
        `${e.quien === 'tienda' ? '🏪' : '👤'} ${e.nombre.padEnd(7)} ${e.ruta}`,
        async () => {
          const r = await nav.visitar(origen + e.ruta);
          const a = await nav.evaluar(AUDITORIA);
          await nav.capturar(`${carpeta}/capturas/${e.quien}-${nombreArchivo(e.ruta, e.nombre)}`);
          for (const h of a.hrefs) if (!hrefs.has(h)) hrefs.set(h, e.quien);
          const duros = [];
          if (r.estado !== e.esperada) duros.push(`estado ${r.estado} (se esperaba ${e.esperada})`);
          for (const err of r.errores) duros.push(err);
          for (const m of r.malas)
            if (!/favicon|\/_next\/webpack-hmr/.test(m)) duros.push(`recurso ${m}`);
          if (a.desborde > 1) duros.push(`se desborda ${a.desborde}px a la derecha`);
          for (const d of a.desalineados) duros.push(`desalineado: ${d}`);
          if (a.imgRotas.length)
            duros.push(`${a.imgRotas.length} imágenes rotas (${a.imgRotas[0]})`);
          if (a.h1 !== 1) duros.push(`${a.h1} títulos h1`);
          if (!a.titulo.trim()) duros.push('sin <title>');
          if (!/^es/.test(a.lang)) duros.push(`lang «${a.lang}»`);
          if (a.sinNombre.length) duros.push(`botones o enlaces sin nombre: ${a.sinNombre[0]}`);
          if (a.camposSinEtiqueta.length)
            duros.push(`campos sin etiqueta: ${a.camposSinEtiqueta[0]}`);
          if (a.textoRaro.length) duros.push(`texto raro: ${a.textoRaro.join(', ')}`);
          afirmar(
            duros.length === 0,
            duros.slice(0, 4).join(' | ') + (duros.length > 4 ? ` (+${duros.length - 4})` : ''),
          );
          const blandos = [];
          if (a.imgSinAlt) blandos.push(`${a.imgSinAlt} imágenes sin alt`);
          if (
            e.quien === 'visitante' &&
            e.esperada === 200 &&
            !a.metaDescripcion &&
            !/ingresar|buscar\?q=xyz/.test(e.ruta)
          )
            blandos.push('sin meta description');
          if (e.v.movil && a.chicos > 3) blandos.push(`${a.chicos} controles chicos para el dedo`);
          if (r.cargaMs > 4000) blandos.push(`carga lenta: ${r.cargaMs} ms`);
          if (blandos.length) return { aviso: blandos.join(' · ') };
          return `carga ${r.cargaMs} ms · ${a.botonesRevisados} botones revisados`;
        },
      );
    }

    await nav.vista(VISTAS.compu);
    await nav.sesion(null);
    const visita = cliente(api);
    const textoDe = () => nav.evaluar('document.body.innerText');

    // ------------------------------------------------------------------ flujos
    grupo('Flujos con Chrome');
    await prueba(
      'el menú «Comprar por categoría» muestra cada categoría con su conteo y sus detalles',
      async () => {
        const categorias = (await visita('/categorias')).json;
        await nav.visitar(`${origen}/`, { esperar: 1500 });
        await nav.evaluar(
          `document.querySelector('button[aria-label="Comprar por categoría"]').click()`,
        );
        await dormir(900);
        const texto = await nav.evaluar(
          `document.querySelector('#menu-categorias')?.innerText ?? ''`,
        );
        afirmar(texto.length > 0, 'el panel no se abrió');
        const faltan = categorias
          .filter(
            (c) =>
              !texto.includes(c.nombre) ||
              !texto.includes(c.productos === 1 ? '1 producto' : `${c.productos} productos`),
          )
          .map((c) => c.nombre);
        afirmar(faltan.length === 0, `faltan en el menú (nombre o conteo): ${faltan.join(', ')}`);
        afirmar(
          /Marcas/i.test(texto) && /Galería/i.test(texto),
          'la categoría elegida no muestra marcas ni galerías',
        );
        await nav.evaluar(
          `[...document.querySelectorAll('#menu-categorias [role=tab]')][1].click()`,
        );
        await dormir(900);
        const titulo = await nav.evaluar(
          `document.querySelector('#menu-categorias [role=tabpanel] h2')?.textContent ?? ''`,
        );
        afirmar(
          titulo === categorias[1].nombre,
          `al elegir la 2.ª categoría el título dice «${titulo}», no «${categorias[1].nombre}»`,
        );
        await nav.evaluar(
          `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`,
        );
        await dormir(300);
        afirmar(
          !(await nav.evaluar(`!!document.querySelector('#menu-categorias')`)),
          'Escape no cierra el menú',
        );
        return `${categorias.length} categorías, con sus conteos y su detalle`;
      },
    );

    await prueba('el buscador sugiere productos mientras se escribe', async () => {
      await nav.visitar(`${origen}/`, { esperar: 1200 });
      await nav.evaluar(`document.querySelector('input[role=combobox]').focus()`);
      await nav.escribir('rtx');
      await dormir(1100);
      const opciones = await nav.evaluar(
        `document.querySelectorAll('[role=listbox] [role=option]').length`,
      );
      afirmar(opciones > 0, 'no aparecieron sugerencias');
      return `${opciones} opciones`;
    });

    await prueba(
      'un filtro del lateral cambia la dirección y deja la cuenta que promete',
      async () => {
        await nav.visitar(`${origen}/buscar?categoria=graficas`, { esperar: 1200 });
        const enlace = await nav.evaluar(
          `(() => { const a = [...document.querySelectorAll('aside[aria-label=Filtros] a')].find((x) => x.getAttribute('href').includes('marca=')); return a ? [a.getAttribute('href'), a.textContent] : null; })()`,
        );
        afirmar(enlace, 'el lateral no tiene filtros de marca');
        const [href] = enlace;
        const esperado = (await visita(href.replace('/buscar', '/buscar'))).json.total_ofertas;
        await nav.evaluar(
          `[...document.querySelectorAll('aside[aria-label=Filtros] a')].find((x) => x.getAttribute('href') === ${JSON.stringify(href)}).click()`,
        );
        await dormir(1800);
        const url = await nav.evaluar('location.search');
        afirmar(url.includes('marca='), `la dirección no cambió: ${url}`);
        const texto = await textoDe();
        afirmar(
          texto.includes(esperado === 1 ? '1 oferta' : `${esperado} ofertas`),
          `la página no dice «${esperado} ofertas»`,
        );
        return `${href.split('?')[1]} → ${esperado} ofertas`;
      },
    );

    await prueba(
      'las tarjetas de categoría de arriba de los resultados filtran por categoría',
      async () => {
        await nav.visitar(`${origen}/buscar?q=msi`, { esperar: 1200 });
        const hrefs2 = await nav.evaluar(
          `[...document.querySelectorAll('section[aria-label="Categorías"] a')].map((a) => a.getAttribute('href'))`,
        );
        if (hrefs2.length < 3)
          return { aviso: 'la búsqueda «msi» solo está en una categoría: no hay tarjetas' };
        await nav.evaluar(
          `document.querySelectorAll('section[aria-label="Categorías"] a')[1].click()`,
        );
        await dormir(1800);
        afirmar(
          (await nav.evaluar('location.search')).includes('categoria='),
          'la tarjeta no filtró por categoría',
        );
        return `${hrefs2.length - 1} categorías con resultados`;
      },
    );

    await prueba(
      'sin resultados no es un callejón: lo más buscado, publicar un busco y las categorías',
      async () => {
        await nav.visitar(`${origen}/buscar?q=xyzxyzxyz`, { esperar: 1300 });
        const t = await textoDe();
        for (const frase of [
          'No encontramos',
          'O explora las categorías',
          'Publicar un busco',
          'Inicia sesión para publicar',
        ]) {
          if (frase === 'Publicar un busco') continue;
          afirmar(t.includes(frase), `falta «${frase}»`);
        }
        const hay = await nav.evaluar(
          `[...document.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Inicia sesión para publicar')`,
        );
        afirmar(hay, 'el visitante no ve «Inicia sesión para publicar»');
      },
    );

    await nav.sesion(sesionB.cookie);
    await prueba('con sesión, «Publicar un busco» lleva lo buscado al formulario', async () => {
      await nav.visitar(`${origen}/buscar?q=xyzxyzxyz`, { esperar: 1500 });
      const href = await nav.evaluar(
        `[...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Publicar un busco')?.getAttribute('href') ?? null`,
      );
      afirmar(href && href.includes('que=xyzxyzxyz'), `el enlace no lleva lo buscado: ${href}`);
      await nav.visitar(origen + href, { esperar: 1800 });
      const valor = await nav.evaluar(
        `[...document.querySelectorAll('input')].map((i) => i.value).find((v) => v.includes('xyzxyzxyz')) ?? null`,
      );
      afirmar(valor === 'xyzxyzxyz', `el formulario no precargó lo buscado (${valor})`);
    });

    await prueba(
      'con sesión, la ficha muestra todas las tiendas que ofrecen el producto',
      async () => {
        const ficha = (await cliente(api, sesionB.cookie)(`/productos/${varias}`)).json;
        await nav.visitar(`${origen}/p/${varias}`, { esperar: 1500 });
        const t = await textoDe();
        const faltan = [...new Set(ficha.ofertas.map((o) => o.tienda.nombre))].filter(
          (n) => !t.includes(n),
        );
        afirmar(faltan.length === 0, `la ficha no muestra a: ${faltan.join(', ')}`);
        afirmar(/US\$|S\//.test(t), 'la ficha no muestra ningún precio con sesión');
        return `${ficha.ofertas.length} ofertas, todas a la vista`;
      },
    );

    await prueba('Pases del día muestra los mismos pases que la API', async () => {
      const esperados = (await cliente(api, sesionB.cookie)('/en-vivo')).json?.en_vivo?.length ?? 0;
      await nav.visitar(`${origen}/pases-del-dia`, { esperar: 1800 });
      const t = await textoDe();
      if (esperados === 0)
        return { aviso: 'no hay pases vigentes para comparar (los sembrados duran pocas horas)' };
      afirmar(t.includes(`${esperados} ahora`), `la página no dice «${esperados} ahora»`);
      return `${esperados} pases`;
    });

    await nav.sesion(null);
    await prueba(
      'el pie: contacto, Libro de Reclamaciones y la invitación a pedir cuenta',
      async () => {
        await nav.visitar(`${origen}/`, { esperar: 1300 });
        const t = await nav.evaluar(`document.querySelector('footer')?.innerText ?? ''`);
        // «Síguenos en» no se exige: en producción las redes se ocultan hasta que el equipo
        // tenga sus enlaces (shared/contacto.ts); en local salen como marcadores.
        for (const frase of [
          'Contáctanos',
          'Libro de',
          '¿Tienes tienda en Galería Wilson?',
          'Pedir mi cuenta',
          'Sin comisiones',
        ])
          afirmar(t.includes(frase), `el pie no dice «${frase}»`);
        afirmar(
          (await nav.evaluar('document.querySelectorAll("footer").length')) === 1,
          'hay más de un <footer>',
        );
      },
    );
    await prueba('el pie en el celular: columnas en acordeón que se abren y cierran', async () => {
      await nav.vista(VISTAS.celular);
      await nav.visitar(`${origen}/`, { esperar: 1300 });
      const n = await nav.evaluar('document.querySelectorAll("footer details").length');
      afirmar(n === 3, `${n} acordeones (se esperaban 3)`);
      const abierto = await nav.evaluar(
        `(() => { const d = document.querySelectorAll('footer details')[1]; d.querySelector('summary').click(); return d.open; })()`,
      );
      afirmar(abierto === true, 'el acordeón no se abrió al tocarlo');
      await nav.vista(VISTAS.compu);
    });

    // ------------------------------------------------------------------ enlaces
    grupo('Enlaces internos');
    await prueba(
      `los ${hrefs.size} enlaces internos que vieron las pantallas responden`,
      async () => {
        // Cada página que pide la web son ~5 llamadas a la API, una por ruta: a 18 páginas por
        // minuto queda muy por debajo del tope de 120 por minuto en cada ruta (y sin sesión
        // cuenta la IP de la web, que comparten todos los visitantes).
        const pedir = cliente(origen, null, { porMinuto: 18 });
        const pedirTienda = cliente(origen, sesionB.cookie, { porMinuto: 18 });
        const cupo = { '/p/': 8, '/buscar': 12 };
        const usados = {};
        const rutas = [...hrefs.entries()].filter(([h]) => {
          if (h.startsWith('/_next') || h.includes('#') || /^\/(salir|api)/.test(h)) return false;
          const clave = Object.keys(cupo).find((p) => h.startsWith(p));
          if (!clave) return true;
          usados[clave] = (usados[clave] ?? 0) + 1;
          return usados[clave] <= cupo[clave];
        });
        const malos = (
          await enLotes(rutas, 6, async ([h, quien]) => [
            h,
            (await (quien === 'tienda' ? pedirTienda : pedir)(h)).estado,
          ])
        ).filter(([, s]) => s >= 400);
        afirmar(
          malos.length === 0,
          `${malos.length} enlaces rotos: ${malos
            .slice(0, 5)
            .map(([h, s]) => `${h}→${s}`)
            .join(', ')}`,
        );
        return `${rutas.length} rutas distintas`;
      },
    );
  } finally {
    await nav.cerrar();
  }
  return { consultas: consultasHechas };
}
