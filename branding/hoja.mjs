import { COLOR } from './geometria.mjs';

/**
 * La hoja de marca: una página HTML sola, con los logos dentro, que se abre en cualquier
 * navegador. Los colores y la escala tipográfica son los de `packages/ui`.
 */

const luminancia = (hex) => {
  const canales = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
};

const contraste = (a, b) => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

const coma = (numero) => numero.toFixed(1).replace('.', ',');

const nivel = (razon) =>
  razon >= 7
    ? 'AAA'
    : razon >= 4.5
      ? 'AA'
      : razon >= 3
        ? 'Solo texto grande'
        : 'No sirve para texto';

/** Un SVG del generador, listo para ir dentro de la página (sin ids repetidos). */
const enLinea = (svg, { alto, ancho, etiqueta = 'PaseLibre', estilo = '' } = {}) => {
  const medidas = [alto && `height:${alto}px`, ancho && `width:${ancho}px`, estilo]
    .filter(Boolean)
    .join(';');
  return svg
    .replace(/ width="[\d.]+" height="[\d.]+"/, '')
    .replace(
      / role="img" aria-labelledby="titulo"><title id="titulo">[^<]*<\/title>/,
      ` role="img" aria-label="${etiqueta}"${medidas ? ` style="${medidas}"` : ''}>`,
    )
    .trim();
};

const PALETA = [
  ['Azul noche', COLOR.tinta, 'Texto, fondos oscuros y avatares.'],
  [
    'Azul pase',
    COLOR.pase,
    'Actuar: el botón principal, el símbolo y los contadores. Un botón principal por pantalla.',
  ],
  ['Azul suave', '#EAF0FF', 'Fondo de lo elegido o resaltado.'],
  ['Acento', COLOR.acento, 'El símbolo y los subrayados sobre fondos oscuros.'],
  ['Superficie', '#F2F4F8', 'Fondos de tarjetas, campos y fichas.'],
  ['Línea', '#E3E7EF', 'Separadores y bordes suaves.'],
  ['Borde', COLOR.borde, 'Bordes de tarjetas e interruptores apagados.'],
  ['Borde de control', '#66728F', 'Bordes de campos y botones: 3 : 1 como mínimo.'],
  ['Secundario', '#2E3A5A', 'Texto de apoyo.'],
  ['Detalle', '#5A6785', 'Notas, fechas y ayudas.'],
];

const ESTADOS = [
  ['OK', '#0B6B4A', '#DDF4EA', 'Confirmado, visible'],
  ['Aviso', '#8A3F00', '#FFF0E3', 'Para revisar'],
  ['Error', '#8A1C12', '#FDECEA', 'Algo falló'],
];

const PAREJAS = [
  ['Azul noche sobre blanco', COLOR.tinta, '#FFFFFF'],
  ['Blanco sobre azul pase', '#FFFFFF', COLOR.pase],
  ['Azul pase sobre blanco', COLOR.pase, '#FFFFFF'],
  ['Blanco sobre azul noche', '#FFFFFF', COLOR.tinta],
  ['Acento sobre azul noche', COLOR.acento, COLOR.tinta],
  ['Secundario sobre blanco', '#2E3A5A', '#FFFFFF'],
  ['Detalle sobre blanco', '#5A6785', '#FFFFFF'],
  ['Acento sobre blanco', COLOR.acento, '#FFFFFF'],
];

const ESCALA = [
  ['Título', 28, 36, 600, 'Mis publicaciones'],
  ['Sección', 20, 28, 600, '1. Producto'],
  ['Tarjeta', 16, 24, 600, 'MSI GeForce RTX 3070 Ventus 3X OC 8 GB'],
  ['Precio', 18, 24, 600, 'US$ 250'],
  ['Cuerpo', 15, 22, 400, 'Si ya está en PaseLibre, usas sus fotos y datos y solo pones lo tuyo.'],
  ['Apoyo', 14, 20, 400, 'Tienda A · Maxiplaza · Stand 212'],
  ['Nota', 13, 18, 400, 'Actualizado hace 9 días'],
];

const ICONOS = [
  ['Buscar', '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'],
  [
    'Avisos',
    '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  ],
  ['Foto', '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'],
  ['Reloj', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
  [
    'Con sesión',
    '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  ],
  ['Listo', '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'],
  ['Enviar', '<path d="M4 12l16-8-6 16-2.5-6.5z"/>'],
  ['Pase', '<path d="M5 12h14M13 6l6 6-6 6"/>'],
];

const VOZ = [
  [
    'Botones',
    'Verbo primero, corto y sin punto.',
    ['Publicar', 'Guardar cambios', 'Crear producto nuevo'],
    ['OK', 'Enviar datos', 'Haz clic aquí'],
  ],
  [
    'Errores',
    'Qué pasó y qué hacer, en una frase.',
    ['Esa cuenta está suspendida. Reactívala o elige otra.'],
    ['Error 409: operación no permitida'],
  ],
  [
    'Cuando no hay nada',
    'Una invitación, no una disculpa.',
    [
      'Todavía no publicas nada. Busca tu producto en el catálogo y publícalo en un par de minutos.',
    ],
    ['No hay datos'],
  ],
  [
    'Confirmaciones',
    'Lo que pasó, sin celebrar.',
    ['Cambios guardados.', 'Listo: 8 publicaciones pasaron a Kevin S.'],
    ['¡Operación realizada exitosamente!'],
  ],
];

const CSS = `
:root{--tinta:#0A1633;--pase:#2F5BFF;--superficie:#F2F4F8;--linea:#E3E7EF;--borde:#C8CFDD;--secundario:#2E3A5A;--detalle:#5A6785;--ok:#0B6B4A;--error:#8A1C12}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--tinta);font:400 15px/22px Figtree,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:1120px;margin:0 auto;padding:40px 24px 96px}
header.portada{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:24px;padding-bottom:32px;border-bottom:1px solid var(--linea)}
h1{margin:16px 0 4px;font-size:28px;line-height:36px;font-weight:600;letter-spacing:-.01em}
h2{margin:0 0 4px;font-size:20px;line-height:28px;font-weight:600}
h3{margin:0;font-size:15px;line-height:22px;font-weight:600}
p{margin:0}
section{padding:48px 0 8px;border-bottom:1px solid var(--linea)}
section:last-of-type{border-bottom:0}
.apoyo{color:var(--secundario)}.nota{font-size:13px;line-height:18px;color:var(--detalle)}
.cuadricula{display:grid;gap:16px;margin-top:24px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.tarjeta{border:1px solid var(--linea);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;min-width:0}
.lienzo{display:flex;align-items:center;justify-content:center;min-height:120px;border-radius:12px;padding:16px}
.claro{background:#fff;border:1px solid var(--linea)}.oscuro{background:var(--tinta)}.azul{background:var(--pase)}.gris{background:var(--superficie)}
code{font:500 12px/16px ui-monospace,Menlo,monospace;background:var(--superficie);border-radius:6px;padding:2px 6px;color:var(--secundario)}
.muestra{height:72px;border-radius:12px;border:1px solid rgba(10,22,51,.08)}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--linea)}th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--detalle);font-weight:600}
.etiqueta{display:inline-block;border-radius:999px;padding:0 10px;font-size:12px;line-height:22px;font-weight:600}
.si{background:#DDF4EA;color:var(--ok)}.no{background:#FDECEA;color:var(--error)}
.iconos{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:12px;margin-top:24px}
.icono{display:flex;flex-direction:column;align-items:center;gap:8px;border:1px solid var(--linea);border-radius:12px;padding:16px 8px;font-size:13px;color:var(--secundario)}
.icono svg{width:28px;height:28px;fill:none;stroke:var(--tinta);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.frase{border-radius:12px;padding:10px 14px;font-size:14px;line-height:20px}
.pestana{display:flex;align-items:center;gap:8px;background:#fff;border-radius:10px 10px 0 0;padding:8px 14px;font-size:12px;color:var(--secundario);width:max-content;max-width:100%}
.barra{display:flex;flex-wrap:wrap;align-items:center;gap:8px 28px;padding:12px 20px;border-radius:12px}
.barra a{font-size:14px;font-weight:500;color:inherit;text-decoration:none}
@media (max-width:560px){main{padding:24px 16px 64px}}
`;

export function hojaDeMarca({ svgs }) {
  const logo = (nombre, opciones) => enLinea(svgs[nombre], opciones);

  const versiones = [
    [
      'Principal',
      'horizontal.svg',
      'claro',
      'Sobre blanco o claro. Es la que se usa por defecto.',
      44,
    ],
    ['Sobre oscuro', 'horizontal-oscuro.svg', 'oscuro', 'Sobre azul noche o fotos oscuras.', 44],
    [
      'Un color · azul noche',
      'horizontal-tinta.svg',
      'claro',
      'Sellos, facturas y una sola tinta.',
      36,
    ],
    [
      'Un color · blanco',
      'horizontal-blanco.svg',
      'oscuro',
      'Una sola tinta sobre fondos oscuros.',
      36,
    ],
    ['Vertical', 'vertical.svg', 'claro', 'Para espacios altos: afiches y portadas.', 96],
    ['Vertical oscuro', 'vertical-oscuro.svg', 'oscuro', 'Lo mismo, sobre oscuro.', 96],
    ['Ícono', 'icono.svg', 'gris', 'La app y el perfil: cuando el nombre ya está cerca.', 72],
    ['Ícono oscuro', 'icono-tinta.svg', 'gris', 'Para el modo oscuro de los celulares.', 72],
    [
      'Símbolo',
      'simbolo.svg',
      'claro',
      'Solo la entrada, en azul pase, azul noche, blanco o acento.',
      44,
    ],
    ['Pequeño', 'favicon.svg', 'gris', 'De 16 a 32 px: muescas hondas y flecha gruesa.', 48],
  ];

  const evitar = [
    ['No lo estires', 'transform:scaleX(1.4)', 'claro'],
    ['No cambies los colores', 'filter:hue-rotate(200deg) saturate(1.5)', 'claro'],
    ['No lo gires', 'transform:rotate(-10deg)', 'claro'],
    ['No le pongas sombra', 'filter:drop-shadow(4px 5px 3px rgba(0,0,0,.45))', 'claro'],
  ];

  const pesos = (hex) => `${coma(contraste(hex[0], hex[1]))} : 1`;

  return `<!doctype html>
<html lang="es-PE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PaseLibre · Hoja de marca</title>
<link rel="icon" href="logo/favicon.svg" type="image/svg+xml">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<main>
<header class="portada">
  <div>${logo('horizontal.svg', { alto: 56 })}<h1>Hoja de marca</h1><p class="apoyo">Cómo se ve y cómo suena PaseLibre. Versión 1.0 · 27/10/2026.</p></div>
  <p class="nota" style="max-width:340px">Todo sale de <code>branding/</code>. Para regenerar los archivos: <code>cd branding &amp;&amp; npm install &amp;&amp; npm run generar</code>.</p>
</header>

<section>
  <h2>La marca</h2>
  <p class="apoyo" style="max-width:680px">Una entrada que apunta hacia adelante. El símbolo es un pase: una entrada con una muesca a cada lado y, vaciada en el centro, una flecha. Dice lo que hace PaseLibre, que un producto pase de una tienda a otra, y de paso que el catálogo se ve con sesión, como un acceso.</p>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="tarjeta"><div class="lienzo gris" style="min-height:200px">${logo('icono.svg', { alto: 140 })}</div><p class="nota">Una sola figura con la flecha vaciada: funciona en cualquier color y sobre cualquier fondo.</p></div>
    <div class="tarjeta"><div class="lienzo claro" style="min-height:200px">${logo('horizontal.svg', { ancho: 300 })}</div><p class="nota">En el logo, el nombre va en minúscula: «pase» en seminegrita y «libre» en normal. En un texto corrido se escribe PaseLibre.</p></div>
  </div>
</section>

<section>
  <h2>Versiones</h2>
  <p class="apoyo">Siempre se usan los archivos de <code>branding/logo</code>; no se vuelven a dibujar ni a escribir con la fuente.</p>
  <div class="cuadricula">
    ${versiones
      .map(
        ([nombre, archivo, fondo, uso, alto]) =>
          `<div class="tarjeta"><div class="lienzo ${fondo}">${logo(archivo, { alto, etiqueta: nombre })}</div><div><h3>${nombre}</h3><p class="nota">${uso}</p><p class="nota"><code>${archivo}</code></p></div></div>`,
      )
      .join('\n    ')}
  </div>
</section>

<section>
  <h2>Espacio y tamaño mínimo</h2>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="tarjeta">
      <div class="lienzo claro" style="min-height:220px">
        <svg viewBox="0 0 108 88" style="height:180px" role="img" aria-label="Espacio libre alrededor del símbolo: la mitad de su alto, en cada lado">
          <rect x=".5" y=".5" width="107" height="87" rx="6" fill="none" stroke="#66728F" stroke-width="1" stroke-dasharray="3 3"/>
          <rect x="22" y="22" width="64" height="44" fill="none" stroke="#C8CFDD" stroke-width=".8"/>
          <g transform="translate(22 22)">${svgs['simbolo.svg'].replace(/^[\s\S]*?<path/, '<path').replace(/<\/svg>\s*$/, '')}</g>
          <g fill="#8FA9FF" stroke="#0A1633" stroke-width=".8"><rect x="0" y="33" width="22" height="22"/><rect x="86" y="33" width="22" height="22"/><rect x="43" y="0" width="22" height="22"/><rect x="43" y="66" width="22" height="22"/></g>
          <g font-family="Figtree,sans-serif" font-size="9" font-weight="600" fill="#0A1633" text-anchor="middle"><text x="11" y="47">x</text><text x="97" y="47">x</text><text x="54" y="15">x</text><text x="54" y="81">x</text></g>
        </svg>
      </div>
      <p class="nota"><b>x</b> es la mitad del alto del símbolo. Alrededor del logo queda libre al menos ese espacio: sin textos, bordes ni imágenes encima.</p>
    </div>
    <div class="tarjeta">
      <table style="margin:0">
        <tr><th>Pieza</th><th>Mínimo</th></tr>
        <tr><td>Logo horizontal</td><td>96 px de ancho · 25 mm</td></tr>
        <tr><td>Logo vertical</td><td>64 px de ancho · 18 mm</td></tr>
        <tr><td>Símbolo</td><td>32 px de ancho · 8 mm</td></tr>
        <tr><td>Ícono</td><td>32 px; de 16 a 32 usa «Pequeño»</td></tr>
      </table>
      <div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap">
        ${[16, 24, 32].map((px) => `<div style="text-align:center">${logo('favicon.svg', { alto: px, ancho: px })}<p class="nota">${px} px</p></div>`).join('')}
        ${[48, 64].map((px) => `<div style="text-align:center">${logo('icono.svg', { alto: px, ancho: px })}<p class="nota">${px} px</p></div>`).join('')}
      </div>
    </div>
  </div>
  <h3 style="margin-top:32px">Qué evitar</h3>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:12px">
    ${evitar
      .map(
        ([texto, estilo, fondo]) =>
          `<div class="tarjeta"><div class="lienzo ${fondo}" style="overflow:hidden;min-height:96px">${logo('horizontal.svg', { alto: 30, estilo })}</div><p class="nota">${texto}</p></div>`,
      )
      .join('\n    ')}
    <div class="tarjeta"><div class="lienzo claro" style="min-height:96px"><span style="font-size:22px;font-weight:600;color:${COLOR.acento}">Publicar</span></div><p class="nota">No uses el acento como texto sobre blanco: se pierde (${coma(contraste(COLOR.acento, '#FFFFFF'))} : 1).</p></div>
  </div>
</section>

<section>
  <h2>Color</h2>
  <p class="apoyo" style="max-width:680px">Poco color: azul noche y blanco hacen casi todo, y el azul pase aparece solo para actuar. Los valores son los de <code>packages/ui</code>.</p>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    ${PALETA.map(
      ([nombre, hex, uso]) =>
        `<div class="tarjeta" style="padding:12px;gap:8px"><div class="muestra" style="background:${hex}"></div><div><h3>${nombre}</h3><p class="nota"><code>${hex}</code></p><p class="nota">${uso}</p></div></div>`,
    ).join('\n    ')}
  </div>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
    ${ESTADOS.map(
      ([nombre, texto, fondo, uso]) =>
        `<div class="tarjeta" style="padding:12px;gap:8px"><div class="muestra" style="background:${fondo};color:${texto};display:flex;align-items:center;padding:0 14px;font-weight:600">${nombre}</div><p class="nota"><code>${texto}</code> sobre <code>${fondo}</code> · ${uso}</p></div>`,
    ).join('\n    ')}
  </div>
  <table>
    <tr><th>Pareja</th><th>Contraste</th><th>Para texto</th></tr>
    ${PAREJAS.map(([nombre, texto, fondo]) => {
      const razon = contraste(texto, fondo);
      return `<tr><td>${nombre}</td><td>${pesos([texto, fondo])}</td><td><span class="etiqueta ${razon >= 4.5 ? 'si' : 'no'}">${nivel(razon)}</span></td></tr>`;
    }).join('\n    ')}
  </table>
</section>

<section>
  <h2>Tipografía</h2>
  <p class="apoyo" style="max-width:680px">Una sola familia, Figtree, con una sola escala. La interfaz usa 400, 500 y 600. El logo usa 600 y 400, ya convertidos en trazos: no hace falta tener la fuente para usarlo.</p>
  <table>
    <tr><th>Nivel</th><th>Tamaño</th><th>Ejemplo</th></tr>
    ${ESCALA.map(
      ([nombre, tamano, alto, peso, ejemplo]) =>
        `<tr><td>${nombre}</td><td class="nota">${tamano}/${alto} · ${peso}</td><td style="font-size:${tamano}px;line-height:${alto}px;font-weight:${peso}">${ejemplo}</td></tr>`,
    ).join('\n    ')}
    <tr><td>Etiqueta</td><td class="nota">12/16 · 600</td><td style="font-size:12px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--detalle)">Ya está en PaseLibre</td></tr>
  </table>
  <p class="nota" style="margin-top:12px">Figtree es de código abierto (licencia SIL OFL), así que se puede usar y mantener sin costo.</p>
</section>

<section>
  <h2>Íconos</h2>
  <p class="apoyo" style="max-width:680px">De línea, sobre una rejilla de 24: trazo de 1,5, extremos y uniones redondeados, sin relleno y en azul noche. Nunca dentro de un cuadrado de color: el color es del azul pase, y el azul pase es para actuar.</p>
  <div class="iconos">
    ${ICONOS.map(([nombre, trazo]) => `<div class="icono"><svg viewBox="0 0 24 24" aria-hidden="true">${trazo}</svg>${nombre}</div>`).join('\n    ')}
  </div>
</section>

<section>
  <h2>Voz</h2>
  <p class="apoyo" style="max-width:680px">Hablamos como una tienda de galería con otra: de tú, directo y sin adornos. Las frases en verde son reales: están en el producto. Las rojas son lo que evitamos.</p>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
    ${VOZ.map(
      ([titulo, regla, si, no]) =>
        `<div class="tarjeta"><div><h3>${titulo}</h3><p class="nota">${regla}</p></div>${si
          .map((f) => `<div class="frase si"><b>Sí ·</b> ${f}</div>`)
          .join(
            '',
          )}${no.map((f) => `<div class="frase no"><b>No ·</b> ${f}</div>`).join('')}</div>`,
    ).join('\n    ')}
  </div>
  <table>
    <tr><th>Palabra</th><th>Quiere decir</th></tr>
    <tr><td><b>pase</b></td><td>El trato entre dos tiendas. PaseLibre no interviene en la venta.</td></tr>
    <tr><td><b>producto</b></td><td>El modelo del catálogo, una sola vez: marca, modelo y fotos base.</td></tr>
    <tr><td><b>publicación</b> / <b>oferta</b></td><td>Lo que una tienda tiene de un producto: «publicación» en su lista, «oferta» en la ficha del producto.</td></tr>
    <tr><td><b>Al interno</b></td><td>El precio que no se muestra. Quien quiere saberlo consulta por mensaje o WhatsApp.</td></tr>
    <tr><td><b>tienda</b></td><td>También quien vende sin galería. Las personas son «vendedores».</td></tr>
  </table>
  <ul class="apoyo" style="margin:16px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:4px">
    <li>Mayúscula solo al empezar: «Mis publicaciones», no «Mis Publicaciones».</li>
    <li>Sin «por favor», sin «exitosamente» y sin signos de exclamación; el único es el saludo «¡Hola, Tienda A!».</li>
    <li>Precios y fechas como en el catálogo: «US$ 250», «S/ 1,699.99», «Hoy», «Ayer», «Hace 9 días».</li>
  </ul>
</section>

<section>
  <h2>En uso</h2>
  <div class="cuadricula" style="grid-template-columns:1fr">
    <div class="tarjeta" style="gap:16px">
      <div class="barra" style="background:#fff;border:1px solid var(--linea)">${logo('horizontal.svg', { alto: 36 })}<a>Publicar</a><a>Mis publicaciones</a><a>Mensajes</a></div>
      <div class="barra" style="background:var(--tinta);color:#fff">${logo('horizontal-oscuro.svg', { alto: 36 })}<a style="color:var(--borde)">· Equipo</a><a>Cuentas</a></div>
    </div>
  </div>
  <div class="cuadricula" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="tarjeta"><div class="lienzo gris" style="align-items:flex-end;padding-bottom:0"><div class="pestana">${logo('favicon.svg', { alto: 16, ancho: 16 })}Mis publicaciones · PaseLibre</div></div><p class="nota">En la pestaña, <code>favicon.svg</code>, con <code>favicon.ico</code> de respaldo.</p></div>
    <div class="tarjeta"><img src="png/og.png" alt="Vista previa de PaseLibre al compartir un enlace" style="width:100%;border-radius:12px;display:block"><p class="nota">Al compartir un enlace por WhatsApp: <code>png/og.png</code>, 1200 × 630.</p></div>
  </div>
</section>
</main>
</body>
</html>
`;
}
