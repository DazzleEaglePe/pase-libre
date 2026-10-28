import { readFileSync } from 'node:fs';

import { SIMBOLO, cargarFuente, texto } from '../geometria.mjs';
import { icono, simbolo } from '../piezas.mjs';
import { ACTUAL, PROPUESTAS } from './datos.mjs';

/**
 * La hoja de propuestas: una tabla para compararlas y, debajo, un tablero por propuesta con
 * el logo, los colores, la tipografía, una pantalla de ejemplo, los íconos, las formas y el tono.
 * Todo sale de `datos.mjs`; los logos van con la palabra en contornos, igual que la marca final.
 */

const n = (valor) => String(Math.round(valor * 100) / 100);
const esc = (cadena) =>
  String(cadena).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kebab = (nombre) => nombre.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const porcentaje = (valor) =>
  `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${Math.abs(Math.round(valor * 1000) / 10)} %`;

// ── Color ────────────────────────────────────────────────────────────────────

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

// ── Tipografía ───────────────────────────────────────────────────────────────

const memoria = new Map();
const fuente = (id, peso) => {
  const clave = `${id}-${peso}`;
  if (!memoria.has(clave)) memoria.set(clave, cargarFuente(id, peso));
  return memoria.get(clave);
};

/** Las fuentes de la hoja incrustadas, para que se vea igual en cualquier computadora. */
function cssFuentes() {
  const usadas = new Map([
    ['Inter|400', 'inter'],
    ['Inter|600', 'inter'],
  ]);
  for (const propuesta of PROPUESTAS) {
    for (const f of Object.values(propuesta.fuentes)) {
      for (const peso of f.pesos) usadas.set(`${f.familia}|${peso}`, f.id);
    }
  }
  return [...usadas]
    .map(([clave, id]) => {
      const [familia, peso] = clave.split('|');
      const archivo = readFileSync(
        new URL(
          `../node_modules/@fontsource/${id}/files/${id}-latin-${peso}-normal.woff2`,
          import.meta.url,
        ),
      );
      return `@font-face{font-family:"${familia}";font-weight:${peso};font-style:normal;font-display:block;src:url(data:font/woff2;base64,${archivo.toString('base64')}) format("woff2")}`;
    })
    .join('\n');
}

const familia = (f) => `'${f.familia}',system-ui,sans-serif`;
const tipo = (propuesta, e) =>
  `${e.peso} ${e.px}px/${e.alto}px ${familia(propuesta.fuentes[e.fuente])}`;

// ── Logos ────────────────────────────────────────────────────────────────────

function palabraLogo(logo) {
  const tamano = logo.tamano ?? 40;
  const poner = (cadena, peso, desde = 0) =>
    texto(logo.mayusculas ? cadena.toUpperCase() : cadena, {
      peso,
      tamano,
      seguimiento: logo.seguimiento,
      desde,
      fuente: fuente(logo.id, peso),
    });
  const pase = poner('pase', logo.pase);
  const desde = pase.ancho + logo.seguimiento * tamano;
  const libre = poner('libre', logo.libre, desde);
  return {
    pase: pase.d,
    libre: libre.d,
    ancho: desde + libre.ancho,
    centro: logo.mayusculas ? pase.ascendente : pase.alturaX,
  };
}

const svg = (ancho, alto, cuerpo, clase = '') =>
  `<svg${clase ? ` class="${clase}"` : ''} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(ancho)} ${n(alto)}" aria-hidden="true">${cuerpo}</svg>`;

/** El logo horizontal (símbolo y palabra) con los colores de la propuesta. `modo`: claro u oscuro. */
function logoHorizontal(propuesta, modo) {
  const { logo, tokens } = propuesta;
  const colores = logo[modo];
  const palabra = palabraLogo(logo);
  const x = SIMBOLO.ancho + 16;
  const base = SIMBOLO.alto / 2 + palabra.centro / 2;
  const trazo = (d, color) =>
    `<path transform="translate(${n(x)} ${n(base)})" fill="${tokens[color]}" d="${d}"/>`;
  return svg(
    x + palabra.ancho,
    SIMBOLO.alto,
    simbolo(tokens[colores.simbolo]) +
      trazo(palabra.pase, colores.pase) +
      trazo(palabra.libre, colores.libre),
    'logo',
  );
}

function iconoApp(propuesta, { lado, pequeno = false }) {
  const { logo, tokens } = propuesta;
  const e = logo.icono;
  return svg(
    64,
    64,
    icono({
      fondo: tokens[e.fondo],
      figura: tokens[e.figura],
      esquina: pequeno ? Math.min(e.esquina, 14) : e.esquina,
      escala: pequeno ? 0.88 : 0.8,
      pequeno,
    }),
    'app',
  ).replace('<svg', `<svg width="${lado}" height="${lado}"`);
}

// ── Íconos ───────────────────────────────────────────────────────────────────

const ICONOS = {
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  tienda:
    '<path d="M4 10.5V20h16v-9.5"/><path d="M3 10.5L4.7 4h14.6L21 10.5"/><path d="M9.5 20v-5h5v5"/>',
  pase: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  listo: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  espera: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  caja: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
};

const ico = (propuesta, nombre, lado = 24) =>
  `<svg class="ico" width="${lado}" height="${lado}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${propuesta.forma.trazo}" stroke-linecap="${propuesta.forma.extremo}" stroke-linejoin="${propuesta.forma.union}" aria-hidden="true">${ICONOS[nombre]}</svg>`;

// ── Partes de un tablero ─────────────────────────────────────────────────────

/** El logo que se ve sobre el fondo del tablero: la versión oscura si el tablero es oscuro. */
const modoDelTablero = (propuesta) => (propuesta.logo.claro.fondo ? 'oscuro' : 'claro');

const letraSobre = (fondo) => (luminancia(fondo) > 0.35 ? '#141414' : '#FFFFFF');

function logos(propuesta) {
  const { tokens, logo } = propuesta;
  const fondoClaro = tokens[logo.claro.fondo ?? 'fondo'];
  const fondoOscuro = tokens[logo.oscuro.fondo];
  return `<div class="fila logos">
    <div class="tile" style="background:${fondoClaro};color:${letraSobre(fondoClaro)}">${logoHorizontal(propuesta, 'claro')}<span class="rotulo">Sobre claro</span></div>
    <div class="tile" style="background:${fondoOscuro};color:${letraSobre(fondoOscuro)}">${logoHorizontal(propuesta, 'oscuro')}<span class="rotulo">Sobre oscuro</span></div>
    <div class="tile app">
      ${iconoApp(propuesta, { lado: 72 })}
      <div class="tamanos">
        ${[32, 24, 16].map((lado) => iconoApp(propuesta, { lado, pequeno: true })).join('')}
      </div>
      <span class="rotulo">Ícono de app y pestaña</span>
    </div>
  </div>`;
}

function paleta(propuesta) {
  const { tokens } = propuesta;
  const tarjetas = propuesta.paleta
    .map((e) => {
      const fondo = tokens[e.token];
      const letra = tokens[e.sobre];
      const razon = contraste(fondo, letra);
      return `<div class="color">
        <div class="chapa" style="background:${fondo};color:${letra}"><b>Aa</b><span>${razon.toFixed(1)}:1</span></div>
        <strong>${esc(e.nombre)}</strong><code>${fondo}</code><small>${esc(e.rol)}</small>
      </div>`;
    })
    .join('');
  return `<div><p class="et">Color</p><div class="colores">${tarjetas}</div></div>`;
}

function muestraTipografica(propuesta) {
  const { titulo, texto: cuerpo, cifras } = propuesta.fuentes;
  const lista = [titulo, cuerpo, cifras].filter(
    (f, i, todas) => todas.findIndex((g) => g.familia === f.familia) === i,
  );
  const pesos = (f) =>
    [
      ...new Set(
        Object.values(propuesta.fuentes)
          .filter((g) => g.familia === f.familia)
          .flatMap((g) => g.pesos),
      ),
    ]
      .sort((x, y) => x - y)
      .join(' · ');
  return `<div><p class="et">Tipografía</p>
    <div class="aa" style="font-family:${familia(titulo)};font-weight:${titulo.pesos[titulo.pesos.length - 1]}">Aa</div>
    <ul class="familias">${lista
      .map((f) => {
        const para = ['titulo', 'texto', 'cifras']
          .filter((clave) => propuesta.fuentes[clave].familia === f.familia)
          .map((clave) => ({ titulo: 'títulos', texto: 'texto', cifras: 'cifras' })[clave])
          .join(', ');
        return `<li><strong style="font-family:${familia(f)}">${esc(f.familia)}</strong> <span>${esc(para)} · pesos ${pesos(f)}</span></li>`;
      })
      .join('')}</ul>
    <p class="abecedario" style="font-family:${familia(cuerpo)}">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ<br>abcdefghijklmnñopqrstuvwxyz<br>áéíóú ¿?¡! 0123456789 S/</p>
  </div>`;
}

function escala(propuesta) {
  const filas = propuesta.escala
    .map((e) => {
      const css = `font:${tipo(propuesta, e)};letter-spacing:${e.seguimiento}em;${e.mayusculas ? 'text-transform:uppercase;' : ''}${propuesta.fuentes[e.fuente].tabular ? 'font-variant-numeric:tabular-nums;' : ''}`;
      return `<div class="paso">
        <div class="medidas"><strong>${esc(e.rol)}</strong><small>${e.px} px · peso ${e.peso}<br>interlineado ${e.alto} px · ${porcentaje(e.seguimiento)}${e.mayusculas ? ' · mayúsculas' : ''}</small></div>
        <div class="ejemplo" style="${css}">${esc(e.muestra)}</div>
      </div>`;
    })
    .join('');
  return `<div><p class="et">Escala</p>${filas}</div>`;
}

function celular(propuesta) {
  const foto = svg(
    56,
    56,
    '<rect x="6" y="14" width="44" height="26" rx="3"/><circle cx="20" cy="27" r="6"/><circle cx="36" cy="27" r="6"/><path d="M12 44v4M44 44v4"/>',
    'foto-trazo',
  );
  return `<div><p class="et">Pantalla</p>
    <div class="cel"><div class="cel-in">
      <div class="cel-barra">${logoHorizontal(propuesta, modoDelTablero(propuesta)).replace('class="logo"', 'class="logo chico"')}<span class="avatar">T</span></div>
      <div class="campo">${ico(propuesta, 'buscar', 18)}<span>Busca un componente</span></div>
      <h3>Pases de hoy</h3>
      <article class="tarjeta">
        <div class="producto"><div class="foto">${foto}</div><div><p class="nombre">RTX 4060 Ventus 2X</p><p class="meta">Stand 214 · Piso 2</p></div></div>
        <div class="precio"><span class="cifras">S/ 1,240</span><span class="chip ok">${ico(propuesta, 'listo', 14)}Pase aceptado</span></div>
        <button class="boton" type="button">Pedir pase</button>
      </article>
      <article class="tarjeta compacta">
        <div><p class="nombre">Ryzen 5 5600</p><p class="meta">Stand 118 · Piso 1</p></div>
        <span class="chip aviso">${ico(propuesta, 'espera', 14)}En camino</span>
      </article>
    </div></div>
  </div>`;
}

function detalles(propuesta) {
  const { forma } = propuesta;
  const radio = (valor) => (valor >= 999 ? 'redondo' : `${valor} px`);
  return `<div class="fila detalles">
    <div><p class="et">Íconos</p>
      <div class="iconos">${['tienda', 'caja', 'pase', 'listo', 'espera', 'buscar'].map((nombre) => ico(propuesta, nombre)).join('')}</div>
      <p class="dato">Línea de ${forma.trazo} px en una cuadrícula de 24, extremos ${forma.extremo === 'round' ? 'redondos' : 'rectos'}.</p>
    </div>
    <div><p class="et">Formas</p>
      <div class="formas"><span class="f-tarjeta"></span><span class="f-boton"></span><span class="f-chip"></span></div>
      <p class="dato">Esquinas: tarjeta ${radio(forma.tarjeta)}, botón ${radio(forma.boton)}, etiqueta ${radio(forma.chip)}. Borde de ${forma.borde} px${forma.sombra === 'none' ? ', sin sombras' : ' y sombra de sello'}.</p>
    </div>
    <div><p class="et">Tono</p>
      <p class="voz si"><b>Sí</b>${esc(propuesta.voz.si[0])}</p>
      <p class="voz si"><b>Sí</b>${esc(propuesta.voz.si[1])}</p>
      <p class="voz no"><b>No</b>${esc(propuesta.voz.no)}</p>
    </div>
  </div>`;
}

function tablero(propuesta) {
  const { tokens, fuentes, forma, escala: pasos } = propuesta;
  const variables = [
    ...Object.entries(tokens).map(([nombre, valor]) => `--${kebab(nombre)}:${valor}`),
    `--f-titulo:${familia(fuentes.titulo)}`,
    `--f-texto:${familia(fuentes.texto)}`,
    `--f-cifras:${familia(fuentes.cifras)}`,
    `--r-tarjeta:${forma.tarjeta}px`,
    `--r-boton:${forma.boton}px`,
    `--r-chip:${forma.chip}px`,
    `--borde-g:${forma.borde}px`,
    `--sombra:${forma.sombra}`,
    ...['Título de sección', 'Texto', 'Texto pequeño', 'Botón', 'Precios y códigos'].map(
      (rol, i) => {
        const e = pasos.find((paso) => paso.rol === rol);
        const nombre = ['seccion', 'texto', 'pequeno', 'boton', 'cifras'][i];
        return `--t-${nombre}:${tipo(propuesta, e)};--ls-${nombre}:${e.seguimiento}em;--tt-${nombre}:${e.mayusculas ? 'uppercase' : 'none'}`;
      },
    ),
    `--tab-cifras:${fuentes.cifras.tabular ? 'tabular-nums' : 'normal'}`,
  ].join(';');
  return `<section class="tablero" id="${propuesta.id}" style="${variables}">
    <header><span class="num">${propuesta.numero}</span><h2>${esc(propuesta.nombre)}</h2><p>${esc(propuesta.idea)}</p></header>
    ${logos(propuesta)}
    <div class="fila dos">${paleta(propuesta)}${muestraTipografica(propuesta)}</div>
    <div class="fila dos">${escala(propuesta)}${celular(propuesta)}</div>
    ${detalles(propuesta)}
  </section>`;
}

// ── Comparación ──────────────────────────────────────────────────────────────

function comparacion() {
  const familias = (propuesta) => {
    const { titulo, texto: cuerpo, cifras } = propuesta.fuentes;
    const nombres = [...new Set([titulo.familia, cuerpo.familia, cifras.familia])];
    return nombres.join(' + ');
  };
  const chapas = (hexes) =>
    `<span class="chapas">${hexes.map((h) => `<i style="background:${h}"></i>`).join('')}</span>`;
  const colores = (propuesta) => {
    const { tokens } = propuesta;
    const marca = [...new Set(propuesta.paleta.slice(0, 3).map((e) => tokens[e.token]))];
    return chapas(marca);
  };
  const filas = [
    ['Idea', (p) => esc(p.idea), () => esc(ACTUAL.idea)],
    ['Se siente', (p) => esc(p.siente), () => esc(ACTUAL.siente)],
    ['Colores de marca', colores, () => chapas(ACTUAL.colores.slice(0, 3))],
    ['Tipografía', familias, () => esc(ACTUAL.titulos)],
    [
      'Formas',
      (p) =>
        `Tarjeta ${p.forma.tarjeta} px · botón ${p.forma.boton >= 999 ? 'redondo' : `${p.forma.boton} px`}`,
      () => esc(ACTUAL.radio),
    ],
    ['Íconos', (p) => `Línea de ${p.forma.trazo} px`, () => esc(ACTUAL.iconos)],
  ];
  const cabecera = `<tr><th></th><th>${esc(ACTUAL.nombre)}</th>${PROPUESTAS.map((p) => `<th><a href="#${p.id}">${p.numero} · ${esc(p.nombre)}</a></th>`).join('')}</tr>`;
  const cuerpo = filas
    .map(
      ([titulo, propuesta, actual]) =>
        `<tr><th>${titulo}</th><td>${actual()}</td>${PROPUESTAS.map((p) => `<td>${propuesta(p)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<table class="comparacion"><thead>${cabecera}</thead><tbody>${cuerpo}</tbody></table>`;
}

// ── Hoja ─────────────────────────────────────────────────────────────────────

const ESTILO = `
*{box-sizing:border-box}
body{margin:0;background:#EDEEEF;color:#141414;font:400 15px/1.55 'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.hoja{max-width:1200px;margin:0 auto;padding:72px 24px 120px}
.hoja>header h1{font:600 40px/1.1 'Inter',sans-serif;letter-spacing:-0.03em;margin:0 0 12px}
.hoja>header p{max-width:620px;margin:0;color:#5b5b57}
.comparacion{width:100%;margin:56px 0 24px;border-collapse:collapse;font-size:13px;line-height:1.45;background:#fff;border-radius:16px;overflow:hidden}
.comparacion th,.comparacion td{padding:14px 16px;text-align:left;vertical-align:top;border-bottom:1px solid #ececea}
.comparacion thead th{font-weight:600;background:#fff;border-bottom:1px solid #d9d9d5}
.comparacion tbody th{font-weight:600;color:#6b6b66;width:120px}
.comparacion tr:last-child>*{border-bottom:0}
.comparacion a{color:inherit;text-decoration:none}
.chapas{display:inline-flex}.chapas i{width:22px;height:22px;border-radius:50%;margin-right:-6px;box-shadow:0 0 0 2px #fff,inset 0 0 0 1px rgba(0,0,0,.12)}
.tablero{background:var(--fondo);color:var(--texto);border-radius:24px;padding:56px;margin:48px 0 0;font:var(--t-texto);letter-spacing:var(--ls-texto)}
.tablero header{display:grid;grid-template-columns:auto 1fr;column-gap:20px;align-items:baseline;margin-bottom:48px}
.tablero .num{font:var(--t-cifras);color:var(--suave);font-variant-numeric:tabular-nums}
.tablero h2{margin:0;font-family:var(--f-titulo);font-weight:700;font-size:44px;line-height:1.05;letter-spacing:-0.025em}
.tablero header p{grid-column:2;margin:12px 0 0;max-width:620px;color:var(--suave)}
.et{margin:0 0 20px;font:600 11px/1 'Inter',sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--suave)}
.fila{margin-top:64px}.fila.logos{margin-top:0}
.fila.dos{display:grid;grid-template-columns:1.15fr 1fr;gap:64px;align-items:start}
.fila.logos{display:grid;grid-template-columns:1.4fr 1.4fr 1fr;gap:16px}
.tile{position:relative;min-height:200px;border-radius:var(--r-tarjeta);box-shadow:inset 0 0 0 1px var(--borde);display:flex;align-items:center;justify-content:center;padding:32px}
.tile .logo{height:46px;width:auto;max-width:100%}
.tile .rotulo{position:absolute;left:16px;bottom:14px;font:500 11px/1 'Inter',sans-serif;opacity:.55}
.tile.app{background:var(--superficie);flex-direction:column;gap:20px}
.tile.app .rotulo{color:var(--suave)}
.tamanos{display:flex;gap:14px;align-items:flex-end}
.colores{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:24px 16px}
.color strong{display:block;font:600 13px/1.3 'Inter',sans-serif;margin-top:12px}
.color code{display:block;font:400 12px/1.4 ui-monospace,Menlo,monospace;color:var(--suave);margin-top:2px}
.color small{display:block;font:400 12px/1.4 'Inter',sans-serif;color:var(--suave);margin-top:4px}
.chapa{height:84px;border-radius:var(--r-tarjeta);box-shadow:inset 0 0 0 1px var(--borde);display:flex;align-items:flex-end;justify-content:space-between;padding:10px 12px;font-family:var(--f-texto)}
.chapa b{font:var(--t-boton);letter-spacing:0;font-size:18px}.chapa span{font:500 11px/1 'Inter',sans-serif;opacity:.85}
.aa{font-size:128px;line-height:1;letter-spacing:-0.03em;margin:-8px 0 20px}
.familias{list-style:none;padding:0;margin:0 0 20px;display:grid;gap:6px}
.familias strong{font-size:18px;font-weight:600}.familias span{font:400 12px 'Inter',sans-serif;color:var(--suave);margin-left:8px}
.abecedario{margin:0;color:var(--suave);font-size:13px;line-height:1.7;letter-spacing:.02em}
.paso{display:grid;grid-template-columns:150px 1fr;gap:24px;align-items:baseline;padding:18px 0;border-top:1px solid var(--borde)}
.paso:first-of-type{border-top:0;padding-top:0}
.medidas strong{display:block;font:600 12px/1.3 'Inter',sans-serif}
.medidas small{display:block;margin-top:4px;font:400 11px/1.5 'Inter',sans-serif;color:var(--suave)}
.ejemplo{min-width:0;overflow-wrap:anywhere}
.cel{width:300px;margin:0 auto;padding:10px;border-radius:40px;background:var(--oscuro)}
.cel-in{background:var(--fondo);border-radius:30px;padding:18px 16px 22px;min-height:450px;box-shadow:inset 0 0 0 1px var(--borde)}
.cel-barra{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.logo.chico{height:22px;width:auto}
.avatar{width:28px;height:28px;border-radius:50%;background:var(--superficie);box-shadow:inset 0 0 0 1px var(--borde);display:grid;place-items:center;font:var(--t-pequeno);color:var(--suave)}
.campo{display:flex;align-items:center;gap:8px;background:var(--superficie);border-radius:var(--r-boton);box-shadow:inset 0 0 0 var(--borde-g) var(--borde);padding:10px 12px;color:var(--suave);font:var(--t-pequeno);margin-bottom:22px}
.cel h3{margin:0 0 12px;font:var(--t-seccion);letter-spacing:var(--ls-seccion);text-transform:var(--tt-seccion);font-family:var(--f-titulo);font-size:20px;line-height:26px}
.tarjeta{background:var(--superficie);border-radius:var(--r-tarjeta);box-shadow:inset 0 0 0 var(--borde-g) var(--borde),var(--sombra);padding:14px;margin-bottom:12px}
.tarjeta.compacta{display:flex;justify-content:space-between;align-items:center;gap:8px}
.producto{display:flex;gap:12px;align-items:center}
.foto{width:56px;height:56px;border-radius:calc(var(--r-tarjeta) / 2);background:var(--fondo);box-shadow:inset 0 0 0 1px var(--borde);display:grid;place-items:center;color:var(--suave);flex:none}
.foto-trazo{width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.nombre{margin:0;font:var(--t-texto);font-weight:600;font-size:15px;line-height:20px}
.meta{margin:2px 0 0;font:var(--t-pequeno);letter-spacing:var(--ls-pequeno);text-transform:var(--tt-pequeno);color:var(--suave)}
.precio{display:flex;justify-content:space-between;align-items:center;margin:14px 0}
.cifras{font:var(--t-cifras);letter-spacing:var(--ls-cifras);font-variant-numeric:var(--tab-cifras)}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px 4px 8px;border-radius:var(--r-chip);font:var(--t-pequeno);font-weight:600;white-space:nowrap}
.chip.ok{background:var(--exito);color:var(--sobre-exito)}.chip.aviso{background:var(--alerta);color:var(--sobre-alerta)}
.boton{width:100%;border:0;border-radius:var(--r-boton);padding:12px 16px;background:var(--primario);color:var(--sobre-primario);font:var(--t-boton);letter-spacing:var(--ls-boton);text-transform:var(--tt-boton);cursor:pointer}
.fila.detalles{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:64px;align-items:start}
.iconos{display:grid;grid-template-columns:repeat(6,24px);gap:20px 22px;color:var(--texto)}
.dato{margin:18px 0 0;font:var(--t-pequeno);letter-spacing:var(--ls-pequeno);color:var(--suave);max-width:300px}
.formas{display:flex;gap:16px;align-items:center}
.f-tarjeta{width:76px;height:52px;border-radius:var(--r-tarjeta);background:var(--superficie);box-shadow:inset 0 0 0 var(--borde-g) var(--borde),var(--sombra)}
.f-boton{width:76px;height:36px;border-radius:var(--r-boton);background:var(--primario)}
.f-chip{width:52px;height:24px;border-radius:var(--r-chip);background:var(--alerta)}
.voz{margin:0 0 14px;display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:baseline}
.voz b{font:600 11px/1 'Inter',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.voz.si b{color:var(--exito)}.voz.no{color:var(--suave);text-decoration:line-through;text-decoration-thickness:1px}.voz.no b{color:var(--suave);text-decoration:none;display:inline-block}
@media (max-width:900px){.tablero{padding:28px}.fila.dos,.fila.logos,.fila.detalles{grid-template-columns:1fr;gap:40px}.paso{grid-template-columns:1fr;gap:6px}}
`;

export function hojaDePropuestas() {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PaseLibre · Propuestas de línea gráfica</title>
<style>
${cssFuentes()}
${ESTILO}
</style>
</head>
<body>
<main class="hoja">
  <header>
    <h1>Propuestas de línea gráfica</h1>
    <p>PaseLibre · 27/10/2026. Cuatro direcciones minimalistas con el mismo símbolo: cada una usa tres colores de marca y una sola familia tipográfica. Los tamaños son los de una pantalla de celular de 390 px.</p>
  </header>
  ${comparacion()}
  ${PROPUESTAS.map(tablero).join('\n')}
</main>
<script>document.fonts.ready.then(function(){var d=document.documentElement;d.dataset.alto=d.scrollHeight;d.dataset.tableros=[].map.call(document.querySelectorAll('.tablero'),function(t){return t.id+':'+t.offsetTop+':'+t.offsetHeight}).join(',')})</script>
</body>
</html>
`;
}
