/**
 * Verificación de la API con el catálogo cargado: privacidad del visitante, calidad de la
 * búsqueda, coherencia de filtros y conteos, paginación, fichas, fotos, reglas de negocio,
 * validaciones y robustez. Solo lee (GET) y manda unos POST que deben ser rechazados.
 */
import { afirmar, cliente, enLotes, grupo, ingresar, percentil, prueba } from './corredor.mjs';

const unir = (base, extra) => (base ? `${base}&${extra}` : `?${extra}`);
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const porcentaje = (a, b) => (b === 0 ? 100 : Math.round((a / b) * 1000) / 10);
const nombreMarca = (m) => (m && typeof m === 'object' ? m.nombre : m) ?? '';

/** Todas las claves de un JSON, para buscar campos que un visitante no debe recibir. */
function claves(nodo, salida = new Set()) {
  if (Array.isArray(nodo)) nodo.forEach((n) => claves(n, salida));
  else if (nodo && typeof nodo === 'object') {
    for (const [k, v] of Object.entries(nodo)) {
      salida.add(k);
      claves(v, salida);
    }
  }
  return salida;
}

async function recorrer(pedir, base = '') {
  const primera = await pedir(`/buscar${base}`);
  afirmar(primera.estado === 200, `/buscar${base} → ${primera.estado}`);
  const tarjetas = [...primera.json.productos];
  for (let p = 2; p <= primera.json.paginas; p++) {
    const r = await pedir(`/buscar${unir(base, `pagina=${p}`)}`);
    afirmar(r.estado === 200, `página ${p} → ${r.estado}`);
    tarjetas.push(...r.json.productos);
  }
  return { primera: primera.json, tarjetas };
}

/** Lo mínimo que necesitan las pantallas (--solo=ui): los productos, algunas fichas y una sesión. */
export async function datosParaUi({ api, clave }) {
  const sesionB = await ingresar(api, 'tiendab', clave);
  const slugs = (await cliente(api)('/mapa-del-sitio')).json.productos.map((p) => p.slug);
  const vendedor = cliente(api, sesionB.cookie);
  const fichas = [];
  for (const slug of slugs.slice(0, 40)) {
    const r = await vendedor(`/productos/${slug}`);
    if (r.estado === 200) {
      fichas.push({ slug, titulo: r.json.producto.titulo, ofertas: r.json.ofertas.length });
    }
  }
  return { slugs, fichas, sesionB };
}

export async function verificarApi({ api, web, clave, manifiesto, rapido }) {
  const visita = cliente(api);
  const origenApi = new URL(api).origin;
  // Cuatro tiendas de prueba: cada sesión tiene su propio tope por minuto en la API, así que
  // las pruebas que no dependen de quién mira las reparten entre ellas.
  const sesiones = await Promise.all(
    ['tiendab', 'tiendaa', 'tiendac', 'tiendae'].map((u) => ingresar(api, u, clave)),
  );
  const sesionB = sesiones[0];
  const pool = sesiones.map((s) => cliente(api, s.cookie));
  const vendedor = pool[0];
  let giro = 0;
  const cualquiera = (ruta, opciones) => pool[giro++ % pool.length](ruta, opciones);
  const topeProductos = rapido ? 40 : 120;

  // ------------------------------------------------------------------ datos
  grupo('Datos: lo que hay cargado');
  let slugs = [];
  let tarjetas = new Map();
  let total = { productos: 0, ofertas: 0 };

  await prueba('la API responde y el catálogo no está vacío', async () => {
    afirmar((await visita('/salud')).estado === 200, '/salud no responde 200');
    const p = await visita('/portada');
    afirmar(p.estado === 200, `/portada → ${p.estado}`);
    afirmar(p.json.totales.productos > 0, 'no hay productos');
    return `${p.json.totales.productos} productos · ${p.json.totales.tiendas} tiendas · ${p.json.totales.galerias} galerías`;
  });

  await prueba('el mapa del sitio y la búsqueda ven los mismos productos', async () => {
    const mapa = await visita('/mapa-del-sitio');
    afirmar(mapa.estado === 200, `/mapa-del-sitio → ${mapa.estado}`);
    slugs = mapa.json.productos.map((p) => p.slug);
    const { primera, tarjetas: todas } = await recorrer(visita);
    tarjetas = new Map(todas.map((t) => [t.slug, t]));
    total = { productos: primera.total_productos, ofertas: primera.total_ofertas };
    const enMapa = new Set(slugs);
    const faltan = todas.filter((t) => !enMapa.has(t.slug)).map((t) => t.slug);
    const sobran = slugs.filter((s) => !tarjetas.has(s));
    afirmar(
      faltan.length === 0 && sobran.length === 0,
      `en la búsqueda y no en el mapa: [${faltan.slice(0, 3)}]; en el mapa y no en la búsqueda: [${sobran.slice(0, 3)}]`,
    );
    return `${slugs.length} productos · ${total.ofertas} ofertas`;
  });

  await prueba('el conteo de cada categoría coincide con lo que devuelve su búsqueda', async () => {
    const categorias = (await visita('/categorias')).json;
    const malas = [];
    for (const c of categorias) {
      const r = await visita(`/buscar?categoria=${c.slug}`);
      if (r.json.total_productos !== c.productos)
        malas.push(`${c.slug}: ${c.productos} ≠ ${r.json.total_productos}`);
    }
    afirmar(malas.length === 0, malas.join('; '));
    return categorias.map((c) => `${c.slug} ${c.productos}`).join(' · ');
  });

  // ------------------------------------------------------------------ privacidad
  grupo('Privacidad: lo que ve un visitante');
  let prohibidos = [];
  const muestra = slugs.slice(0, rapido ? 15 : 50);

  await prueba('hay tiendas, stands y precios que ocultar (los ve un vendedor)', async () => {
    const fichas = await enLotes(muestra, 6, (s) => vendedor(`/productos/${s}`));
    const textos = new Set();
    let conPrecio = 0;
    for (const f of fichas) {
      for (const o of f.json?.ofertas ?? []) {
        if (o.tienda?.nombre) textos.add(o.tienda.nombre);
        if (o.tienda?.stand) textos.add(o.tienda.stand);
        if (o.tienda?.id) textos.add(o.tienda.id);
        if (o.precio) conPrecio += 1;
      }
    }
    // Solo textos con letras y de 4 o más: un stand «118» aparece de verdad en un título
    // («RTX 4060 118 W»). Que el visitante no vea el campo `stand` lo cubre la prueba de claves.
    prohibidos = [...textos].filter((t) => t.length >= 4 && /[a-z]/i.test(t));
    afirmar(prohibidos.length > 0, 'un vendedor no ve ninguna tienda: no hay qué comparar');
    afirmar(conPrecio > 0, 'un vendedor no ve ningún precio');
    return `${prohibidos.length} textos prohibidos para el visitante, ${conPrecio} ofertas con precio`;
  });

  await prueba(
    'un visitante nunca recibe tiendas, stands, precios ni campos de vendedor',
    async () => {
      const rutas = [
        '/portada',
        '/buscar',
        '/buscar?categoria=graficas',
        '/buscar?categoria=ram',
        '/buscar?q=rtx',
        '/buscar?pagina=2',
        '/buscar/sugerencias?q=rtx',
        '/categorias',
        '/galerias',
        '/en-vivo',
        '/mapa-del-sitio',
        ...muestra.map((s) => `/productos/${s}`),
      ];
      const respuestas = await enLotes(rutas, 6, async (ruta) => [ruta, await visita(ruta)]);
      const vedados = new Set([
        'precio',
        'precios_desde',
        'precio_visible',
        'al_interno',
        'tienda',
        'stand',
        'whatsapp',
        'propia',
        'responsable',
      ]);
      const fugas = [];
      for (const [ruta, r] of respuestas) {
        if (r.estado !== 200) {
          if (!(ruta.startsWith('/en-vivo') && r.estado === 404))
            fugas.push(`${ruta} → ${r.estado}`);
          continue;
        }
        for (const texto of prohibidos)
          if (r.texto.includes(texto)) fugas.push(`${ruta} trae «${texto}»`);
        for (const k of claves(r.json))
          if (vedados.has(k)) fugas.push(`${ruta} trae el campo «${k}»`);
      }
      afirmar(
        fugas.length === 0,
        `${fugas.length} fugas: ${[...new Set(fugas)].slice(0, 4).join(' | ')}`,
      );
      return `${rutas.length} respuestas revisadas, sin fugas`;
    },
  );

  await prueba('el visitante no puede deducir precios con filtros ni con el orden', async () => {
    const normal = await visita('/buscar');
    const filtrado = await visita('/buscar?precio_min=0&precio_max=1');
    const ordenado = await visita('/buscar?orden=precio_asc');
    afirmar(
      filtrado.json.total_productos === normal.json.total_productos,
      'el filtro de precio le cambió los resultados',
    );
    const slugsDe = (r) => r.json.productos.map((p) => p.slug).join(',');
    afirmar(slugsDe(ordenado) === slugsDe(normal), 'el orden por precio le cambió el orden');
  });

  await prueba('con sesión sí hay precios y tiendas', async () => {
    const r = await vendedor('/buscar');
    const conPrecios = r.json.productos.filter((p) => p.ofertas.precios_desde?.length > 0).length;
    afirmar(r.json.audiencia === 'vendedor', `audiencia ${r.json.audiencia}`);
    afirmar(conPrecios > 0, 'ningún producto trae «desde»');
    return `${conPrecios} de ${r.json.productos.length} productos de la primera página traen precio`;
  });

  await prueba('las respuestas con sesión no se guardan en caché compartida', async () => {
    const v = (await visita('/buscar')).cabeceras.get('cache-control') ?? '';
    const s = (await vendedor('/buscar')).cabeceras.get('cache-control') ?? '';
    afirmar(/public/.test(v), `visitante: «${v}»`);
    afirmar(!/public/.test(s) && /(private|no-store)/.test(s), `con sesión: «${s}»`);
    return `visitante «${v}» · con sesión «${s}»`;
  });

  // ------------------------------------------------------------------ búsqueda
  grupo('Búsqueda: calidad con los productos cargados');
  const fichas = [];
  await prueba('cada ficha trae título, categoría y al menos una oferta', async () => {
    const respuestas = await enLotes(slugs.slice(0, topeProductos), 4, async (s) => [
      s,
      await cualquiera(`/productos/${s}`),
    ]);
    const malas = [];
    for (const [s, r] of respuestas) {
      const p = r.json?.producto;
      if (r.estado !== 200 || !p?.titulo || !p?.categoria || !(r.json.ofertas?.length > 0))
        malas.push(`${s} → ${r.estado}`);
      else
        fichas.push({
          slug: s,
          titulo: p.titulo,
          marca: nombreMarca(p.marca),
          categoria: p.categoria.slug,
          ofertas: r.json.ofertas.length,
        });
    }
    afirmar(malas.length === 0, `${malas.length} fichas mal: ${malas.slice(0, 3).join(', ')}`);
    return `${fichas.length} fichas revisadas`;
  });

  const variantes = {
    exacta: (f) => f.titulo,
    'marca + modelo': (f) => {
      const tokens = f.titulo.split(/\s+/);
      const i = tokens.findIndex((t) => /\d/.test(t));
      return i > 0 ? `${f.marca} ${tokens.slice(Math.max(0, i - 1), i + 1).join(' ')}` : null;
    },
    'sin espacios': (f) => {
      const tokens = f.titulo.split(/\s+/);
      const i = tokens.findIndex(
        (t, k) => k > 0 && /^\d{3,}[a-z]*$/i.test(t) && /^[a-z]{2,}$/i.test(tokens[k - 1]),
      );
      return i > 0 ? `${tokens[i - 1]}${tokens[i]}` : null;
    },
    'MAYÚSCULAS y sin tildes': (f) => sinTildes(f.titulo).toUpperCase(),
    'número mal escrito': (f) => {
      const tokens = f.titulo.split(/\s+/);
      const i = tokens.findIndex((t) => /^\d{3,}$/.test(t));
      if (i < 0) return null;
      const n = tokens[i];
      const malo = n.slice(0, -1) + ((Number(n.slice(-1)) + 1) % 10);
      return `${f.marca} ${tokens[i - 1] ?? ''} ${malo}`.replace(/\s+/g, ' ').trim();
    },
    'letra de menos': (f) => {
      const palabra = f.titulo
        .split(/\s+/)
        .filter(
          (t) => /^[a-záéíóúñ]{6,}$/i.test(t) && t.toLowerCase() !== f.marca.toLowerCase(),
        )[0];
      if (!palabra) return null;
      const numero = f.titulo.split(/\s+/).find((t) => /\d/.test(t)) ?? '';
      return `${f.marca} ${palabra.slice(0, 3)}${palabra.slice(4)} ${numero}`
        .replace(/\s+/g, ' ')
        .trim();
    },
  };
  const umbrales = {
    exacta: 100,
    'marca + modelo': 95,
    'sin espacios': 90,
    'MAYÚSCULAS y sin tildes': 100,
    'número mal escrito': 70,
    'letra de menos': 70,
  };
  const blandas = new Set(['número mal escrito', 'letra de menos']);

  for (const [nombre, armar] of Object.entries(variantes)) {
    await prueba(`encuentra el producto: ${nombre}`, async () => {
      const casos = fichas.map((f) => ({ f, q: armar(f) })).filter((c) => c.q);
      if (casos.length === 0) return { aviso: 'ningún producto sirve para esta variante' };
      const falló = [];
      const errores = [];
      await enLotes(casos, 4, async ({ f, q }) => {
        const r = await cualquiera(`/buscar?q=${encodeURIComponent(q)}`);
        if (r.estado !== 200) errores.push(`«${q}» → ${r.estado}`);
        else if (!r.json.productos.some((p) => p.slug === f.slug)) falló.push(`«${q}»`);
      });
      // Una respuesta que no es 200 no es «no encontró»: es un fallo aparte y siempre grave.
      afirmar(
        errores.length === 0,
        `${errores.length} búsquedas no respondieron 200: ${errores.slice(0, 3).join(', ')}`,
      );
      const acierto = porcentaje(casos.length - falló.length, casos.length);
      const detalle =
        `${acierto}% de ${casos.length}` +
        (falló.length ? ` · no halló: ${falló.slice(0, 4).join(', ')}` : '');
      if (acierto < umbrales[nombre]) {
        const mensaje = `${detalle} (se pide ≥ ${umbrales[nombre]}%)`;
        if (blandas.has(nombre)) return { aviso: mensaje };
        throw new Error(mensaje);
      }
      return detalle;
    });
  }

  await prueba(
    'las palabras que usa la gente llevan a la categoría correcta',
    async () => {
      const casos = [
        ['tarjeta grafica', 'graficas'],
        ['tarjeta de video', 'graficas'],
        ['gpu', 'graficas'],
        ['procesador', 'procesadores'],
        ['cpu', 'procesadores'],
        ['placa madre', 'placas'],
        ['motherboard', 'placas'],
        ['memoria ram', 'ram'],
        ['gabinete', 'cases'],
        ['case', 'cases'],
        ['monitor', 'monitores'],
        ['teclado', 'perifericos'],
        ['mouse', 'perifericos'],
        ['audifonos', 'perifericos'],
      ];
      const malas = [];
      for (const [q, categoria] of casos) {
        if (!fichas.some((f) => f.categoria === categoria)) continue;
        const r = await cualquiera(`/buscar?q=${encodeURIComponent(q)}`);
        const aciertos = (r.json?.productos ?? []).filter(
          (p) => p.categoria.slug === categoria,
        ).length;
        if (aciertos === 0) malas.push(`«${q}» no trae ${categoria}`);
      }
      afirmar(malas.length === 0, malas.join('; '));
    },
    { soloAviso: true },
  );

  await prueba('lo que no existe da una lista vacía, no un error', async () => {
    const r = await visita('/buscar?q=zzzzqqqxxyy');
    afirmar(
      r.estado === 200 && r.json.total_productos === 0 && r.json.productos.length === 0,
      `estado ${r.estado}, ${r.json?.total_productos} productos`,
    );
  });

  // ------------------------------------------------------------------ filtros
  grupo('Filtros y conteos');
  const bases = ['', '?q=rtx', '?q=memoria', '?categoria=graficas', '?categoria=perifericos'];
  for (const [quien, pedir, basesDe] of [
    ['visitante', visita, bases.slice(0, 2)],
    ['vendedor', vendedor, bases],
  ]) {
    await prueba(`cada conteo del lateral coincide con filtrar por él (${quien})`, async () => {
      const malas = [];
      let revisados = 0;
      for (const base of basesDe) {
        const r = await pedir(`/buscar${base}`);
        const f = r.json.facetas;
        const casos = [
          ...f.galerias.map((x) => [`galeria=${x.slug}`, x.cantidad, x.nombre]),
          ...f.marcas.slice(0, 6).map((x) => [`marca=${x.slug}`, x.cantidad, x.nombre]),
          ...f.condiciones.map((x) => [`condicion=${x.slug}`, x.cantidad, x.nombre]),
          ['stock=true', f.con_stock, 'con stock'],
        ];
        for (const [param, esperado, nombre] of casos) {
          const x = await pedir(`/buscar${unir(base, param)}`);
          revisados += 1;
          if (x.estado !== 200) malas.push(`${base || '(todo)'} ${nombre}: respondió ${x.estado}`);
          else if (x.json.total_ofertas !== esperado)
            malas.push(
              `${base || '(todo)'} ${nombre}: lateral ${esperado} ≠ ${x.json.total_ofertas}`,
            );
        }
        const suma = f.categorias.reduce((s, c) => s + c.cantidad, 0);
        if (!base.includes('categoria') && suma !== r.json.total_productos)
          malas.push(
            `${base || '(todo)'}: las categorías suman ${suma} ≠ ${r.json.total_productos} productos`,
          );
      }
      afirmar(malas.length === 0, `${malas.length} diferencias: ${malas.slice(0, 3).join(' | ')}`);
      return `${revisados} filtros comparados`;
    });
  }

  await prueba('combinar filtros nunca da más que cada uno por separado', async () => {
    const r = await visita('/buscar');
    const g = r.json.facetas.galerias[0];
    const c = r.json.facetas.condiciones[0];
    if (!g || !c) return { aviso: 'no hay galerías o condiciones para combinar' };
    const ambas = await visita(`/buscar?galeria=${g.slug}&condicion=${c.slug}&stock=true`);
    afirmar(
      ambas.json.total_ofertas <= Math.min(g.cantidad, c.cantidad),
      `${ambas.json.total_ofertas} > min(${g.cantidad}, ${c.cantidad})`,
    );
    return `${g.nombre} + ${c.nombre} + con stock = ${ambas.json.total_ofertas} ofertas`;
  });

  await prueba('con sesión, ordenar por precio ordena de verdad', async () => {
    // Los montos llegan como texto («1031.00»): se comparan como números.
    const usd = (p) => {
      const monto = Number(p.ofertas.precios_desde?.find((x) => x.moneda === 'USD')?.monto);
      return Number.isFinite(monto) ? monto : null;
    };
    for (const [orden, cmp] of [
      ['precio_asc', (a, b) => a <= b],
      ['precio_desc', (a, b) => a >= b],
    ]) {
      const r = await vendedor(`/buscar?orden=${orden}`);
      const valores = r.json.productos.map(usd).filter((v) => v !== null);
      for (let i = 1; i < valores.length; i++)
        afirmar(
          cmp(valores[i - 1], valores[i]),
          `${orden}: ${valores[i - 1]} antes de ${valores[i]}`,
        );
    }
  });

  await prueba('con sesión, el rango de precio deja solo precios dentro del rango', async () => {
    const r = await vendedor('/buscar?precio_min=100&precio_max=300&moneda=USD');
    afirmar(r.estado === 200, `→ ${r.estado}`);
    const fuera = [];
    for (const p of r.json.productos) {
      const usd = p.ofertas.precios_desde?.find((x) => x.moneda === 'USD');
      if (usd && (Number(usd.monto) < 100 || Number(usd.monto) > 300))
        fuera.push(`${p.slug} US$ ${usd.monto}`);
    }
    afirmar(fuera.length === 0, `fuera de rango: ${fuera.slice(0, 3).join(', ')}`);
    return `${r.json.total_productos} productos entre US$ 100 y 300`;
  });

  grupo('Paginación');
  await prueba('recorrer todas las páginas da cada producto una sola vez', async () => {
    const { primera, tarjetas: todas } = await recorrer(visita);
    const unicos = new Set(todas.map((t) => t.slug));
    afirmar(
      unicos.size === todas.length,
      `${todas.length - unicos.size} productos repetidos entre páginas`,
    );
    afirmar(
      todas.length === primera.total_productos,
      `${todas.length} recorridos ≠ ${primera.total_productos} del total`,
    );
    afirmar(todas.length <= primera.paginas * 24, 'más productos que 24 por página');
    return `${primera.paginas} páginas · ${todas.length} productos`;
  });
  await prueba('pedir una página que no existe no rompe nada', async () => {
    for (const p of ['9999', '0', '-1', 'abc', '1.5']) {
      const r = await visita(`/buscar?pagina=${p}`);
      afirmar(r.estado < 500, `pagina=${p} → ${r.estado}`);
    }
  });

  // ------------------------------------------------------------------ fotos
  grupo('Fichas y fotos');
  await prueba('cada producto del catálogo abre su ficha, y un slug inventado da 404', async () => {
    const malas = (
      await enLotes(slugs, 4, async (s) => [s, (await cualquiera(`/productos/${s}`)).estado])
    ).filter(([, e]) => e !== 200);
    afirmar(
      malas.length === 0,
      `${malas.length} fichas no abren: ${malas
        .slice(0, 3)
        .map((m) => m.join('→'))
        .join(', ')}`,
    );
    const nada = await visita('/productos/este-producto-no-existe-123');
    afirmar(nada.estado === 404, `slug inventado → ${nada.estado}`);
    return `${slugs.length} fichas abren`;
  });
  await prueba('el número de ofertas de cada ficha coincide con el de su tarjeta', async () => {
    const malas = [];
    for (const f of fichas) {
      const t = tarjetas.get(f.slug);
      if (t && t.ofertas.cantidad !== f.ofertas)
        malas.push(`${f.slug}: tarjeta ${t.ofertas.cantidad} ≠ ficha ${f.ofertas}`);
    }
    afirmar(malas.length === 0, malas.slice(0, 3).join(' | '));
  });
  await prueba('las fotos existen, son webp y no pesan de más', async () => {
    const rutas = [...new Set([...tarjetas.values()].map((t) => t.foto).filter(Boolean))].slice(
      0,
      200,
    );
    const conFoto = porcentaje([...tarjetas.values()].filter((t) => t.foto).length, tarjetas.size);
    if (rutas.length === 0)
      return { aviso: 'ningún producto tiene foto (se usan los dibujos de categoría)' };
    const malas = [];
    const pesadas = [];
    await enLotes(rutas, 8, async (ruta) => {
      const r = await fetch(`${origenApi}/media/${ruta}`);
      const bytes = (await r.arrayBuffer()).byteLength;
      if (
        r.status !== 200 ||
        !/image\/webp/.test(r.headers.get('content-type') ?? '') ||
        bytes === 0
      )
        malas.push(`${ruta} → ${r.status}`);
      else if (bytes > 400_000) pesadas.push(`${ruta} ${Math.round(bytes / 1024)} KB`);
    });
    afirmar(malas.length === 0, `${malas.length} fotos mal: ${malas.slice(0, 3).join(', ')}`);
    if (pesadas.length > 0)
      return { aviso: `${pesadas.length} fotos pesan más de 400 KB (ej. ${pesadas[0]})` };
    return `${rutas.length} fotos revisadas · ${conFoto}% de los productos tienen foto`;
  });

  // ------------------------------------------------------------------ reglas con los datos cargados
  grupo('Reglas de negocio con lo cargado');
  if (!manifiesto) {
    await prueba('comparar con lo que se cargó', async () => ({
      aviso: 'no hay datos/cargados.json: corre cargar.mjs primero',
    }));
  } else {
    const nuevos = Object.entries(manifiesto.productos).filter(([, e]) => e.slug && e.nuevo);
    await prueba(
      'stock, ofertas y condiciones de cada producto coinciden con lo publicado',
      async () => {
        const malas = [];
        for (const [clavePro, e] of nuevos) {
          const activas = e.ofertas.filter((o) => o.estado === 'ACTIVA');
          const t = tarjetas.get(e.slug);
          if (activas.length === 0) {
            if (t) malas.push(`${clavePro}: todas sus ofertas están pausadas y aun así aparece`);
            continue;
          }
          if (!t) {
            malas.push(`${clavePro}: tiene ${activas.length} ofertas activas y no aparece`);
            continue;
          }
          const stock = activas.reduce((s, o) => s + o.stock, 0);
          const conds = [...new Set(activas.map((o) => o.condicion))].sort().join(',');
          if (t.ofertas.cantidad !== activas.length)
            malas.push(`${clavePro}: ${t.ofertas.cantidad} ofertas ≠ ${activas.length}`);
          else if (t.ofertas.stock_total !== stock)
            malas.push(`${clavePro}: stock ${t.ofertas.stock_total} ≠ ${stock}`);
          else if ([...t.ofertas.condiciones].sort().join(',') !== conds)
            malas.push(`${clavePro}: condiciones ${t.ofertas.condiciones} ≠ ${conds}`);
        }
        afirmar(
          malas.length === 0,
          `${malas.length} diferencias: ${malas.slice(0, 3).join(' | ')}`,
        );
        const pausadas = nuevos
          .flatMap(([, e]) => e.ofertas)
          .filter((o) => o.estado === 'PAUSADA').length;
        const sinStock = nuevos.flatMap(([, e]) => e.ofertas).filter((o) => o.stock === 0).length;
        return `${nuevos.length} productos comparados · ${pausadas} ofertas pausadas y ${sinStock} sin stock contempladas`;
      },
    );
  }

  // ------------------------------------------------------------------ mutaciones
  grupo('Validaciones y permisos al publicar');
  const uuid = '00000000-0000-4000-8000-000000000001';
  const sinPermiso = [
    [
      'sin la cabecera X-PaseLibre da 403',
      () =>
        vendedor('/ofertas', {
          metodo: 'POST',
          cuerpo: { producto_id: uuid, condicion: 'NUEVO', stock: 1 },
          cabeceras: { 'x-paselibre': '' },
        }),
      403,
    ],
    [
      'un visitante no puede publicar (401)',
      () =>
        visita('/ofertas', {
          metodo: 'POST',
          cuerpo: { producto_id: uuid, condicion: 'NUEVO', stock: 1 },
        }),
      401,
    ],
    ['un visitante no ve «mis ofertas» (401)', () => visita('/mis-ofertas'), 401],
  ];
  for (const [nombre, accion, esperado] of sinPermiso) {
    await prueba(nombre, async () => {
      const r = await accion();
      afirmar(r.estado === esperado, `→ ${r.estado}`);
    });
  }
  const invalidos = [
    ['producto que no es un id', { producto_id: 'no-es-uuid', condicion: 'NUEVO', stock: 1 }],
    ['stock 0', { producto_id: uuid, condicion: 'NUEVO', stock: 0 }],
    ['stock de 10 000', { producto_id: uuid, condicion: 'NUEVO', stock: 10000 }],
    ['precio con letras', { producto_id: uuid, condicion: 'NUEVO', stock: 1, precio: 'abc' }],
    [
      'descripción de 600 letras',
      { producto_id: uuid, condicion: 'NUEVO', stock: 1, descripcion: 'x'.repeat(600) },
    ],
    ['un campo que no existe', { producto_id: uuid, condicion: 'NUEVO', stock: 1, admin: true }],
    [
      'producto existente y nuevo a la vez',
      {
        producto_id: uuid,
        producto_nuevo: { categoria: 'ram', marca: 'X', modelo: 'Y1' },
        condicion: 'NUEVO',
        stock: 1,
      },
    ],
    [
      'mostrar precio sin monto',
      { producto_id: uuid, condicion: 'NUEVO', stock: 1, precio_visible: true },
    ],
    ['condición inventada', { producto_id: uuid, condicion: 'REGULAR', stock: 1 }],
  ];
  await prueba('los datos inválidos se rechazan con 400 y un mensaje en español', async () => {
    const malas = [];
    for (const [nombre, cuerpo] of invalidos) {
      const r = await vendedor('/ofertas', { metodo: 'POST', cuerpo });
      const mensaje = JSON.stringify(r.json ?? '');
      if (r.estado !== 400) malas.push(`${nombre} → ${r.estado}`);
      else if (!/[a-záéíóúñ]{4,}/i.test(mensaje) || /undefined|\[object/.test(mensaje))
        malas.push(`${nombre}: mensaje raro`);
    }
    afirmar(malas.length === 0, malas.join('; '));
    return `${invalidos.length} casos rechazados`;
  });
  await prueba(
    'publicar dos veces lo mismo (misma tienda, producto y condición) da 409',
    async () => {
      const e =
        manifiesto &&
        Object.values(manifiesto.productos).find(
          (x) => x.producto_id && x.ofertas.some((o) => o.estado === 'ACTIVA'),
        );
      if (!e) return { aviso: 'no hay una oferta cargada para repetir' };
      const o = e.ofertas.find((x) => x.estado === 'ACTIVA');
      const dueña = cliente(api, (await ingresar(api, o.tienda, clave)).cookie);
      const r = await dueña('/ofertas', {
        metodo: 'POST',
        cuerpo: { producto_id: e.producto_id, condicion: o.condicion, stock: 1 },
      });
      afirmar(r.estado === 409, `→ ${r.estado}`);
    },
  );

  // ------------------------------------------------------------------ robustez
  grupo('Robustez ante entradas raras');
  const hostiles = [
    "'; DROP TABLE producto; --",
    "' OR '1'='1",
    '%',
    '_',
    '%00',
    '\u0000',
    '${7*7}',
    '{{7*7}}',
    '<script>alert(1)</script>',
    '../../etc/passwd',
    'x'.repeat(5000),
    'ñandú 日本語 🔥 مرحبا',
    '   ',
    'a'.repeat(101),
    '\\',
    '"',
    '(',
    '[',
    '*',
    'rtx AND 1=1',
    'rtx\nOR\n1=1',
  ];
  await prueba(
    'búsquedas con texto hostil nunca dan error de servidor ni tardan de más',
    async () => {
      const malas = [];
      for (const q of hostiles) {
        const r = await visita(`/buscar?q=${encodeURIComponent(q)}`);
        const s = await visita(`/buscar/sugerencias?q=${encodeURIComponent(q)}`);
        for (const [donde, x] of [
          ['buscar', r],
          ['sugerencias', s],
        ]) {
          if (x.estado >= 500) malas.push(`${donde} «${q.slice(0, 20)}» → ${x.estado}`);
          else if (x.ms > 3000)
            malas.push(`${donde} «${q.slice(0, 20)}» tardó ${Math.round(x.ms)} ms`);
          else if (x.estado === 200 && x.json === null)
            malas.push(`${donde} «${q.slice(0, 20)}» no es JSON`);
        }
      }
      afirmar(malas.length === 0, malas.slice(0, 4).join(' | '));
      return `${hostiles.length} textos × 2 rutas`;
    },
  );
  await prueba('parámetros manipulados nunca dan error de servidor', async () => {
    const rutas = [
      '/buscar?orden=zzz',
      '/buscar?precio_min=NaN',
      '/buscar?precio_min=-5',
      '/buscar?precio_max=1e9',
      '/buscar?moneda=EUR',
      '/buscar?stock=quizas',
      '/buscar?galeria[]=x',
      '/buscar?marca=' + 'a,'.repeat(40),
      '/buscar?categoria=' + 'z'.repeat(300),
      '/buscar?condicion=roto',
      '/portada?galeria=%27',
      '/productos/%00',
      '/productos/' + 'a'.repeat(400),
      '/productos/..%2f..%2fetc',
      '/buscar/populares?categoria=%27--',
    ];
    const malas = [];
    for (const ruta of rutas) {
      const r = await visita(ruta);
      if (r.estado >= 500) malas.push(`${ruta.slice(0, 50)} → ${r.estado}`);
    }
    afirmar(malas.length === 0, malas.join(' | '));
    return `${rutas.length} rutas`;
  });
  await prueba('el texto buscado no se refleja sin escapar en la página web', async () => {
    const r = await cliente(web)(`/buscar?q=${encodeURIComponent('<script>alert(1)</script>')}`);
    afirmar(r.estado === 200, `/buscar → ${r.estado}`);
    afirmar(
      !r.texto.includes('<script>alert(1)</script>'),
      'la página devuelve el <script> tal cual',
    );
  });
  await prueba('cabeceras de seguridad', async () => {
    const a = (await visita('/salud')).cabeceras;
    const w = (await cliente(web)('/')).cabeceras;
    const faltas = [];
    if (a.get('x-content-type-options') !== 'nosniff')
      faltas.push('API sin x-content-type-options');
    if (!a.get('content-security-policy')) faltas.push('API sin CSP');
    if (w.get('x-content-type-options') !== 'nosniff')
      faltas.push('web sin x-content-type-options');
    if (!w.get('content-security-policy')) faltas.push('web sin CSP (ya conocido: docs/08)');
    if (!w.get('referrer-policy')) faltas.push('web sin referrer-policy');
    if (faltas.length > 0) return { aviso: faltas.join(' · ') };
  });

  // ------------------------------------------------------------------ rendimiento
  grupo('Rendimiento (en esta máquina, con el catálogo cargado)');
  for (const [nombre, ruta, tope] of [
    ['búsqueda', '/buscar?q=rtx', 500],
    ['búsqueda con corrección', '/buscar?q=rtx%203370', 700],
    ['portada', '/portada', 600],
    ['ficha', `/productos/${slugs[0] ?? 'x'}`, 400],
    ['sugerencias', '/buscar/sugerencias?q=ram', 400],
  ]) {
    await prueba(`${nombre}: p95 bajo ${tope} ms`, async () => {
      const tiempos = [];
      for (let i = 0; i < 15; i++) tiempos.push((await visita(ruta)).ms);
      const p95 = Math.round(percentil(tiempos, 95));
      const p50 = Math.round(percentil(tiempos, 50));
      if (p95 > tope) return { aviso: `p50 ${p50} ms · p95 ${p95} ms (pasa de ${tope})` };
      return `p50 ${p50} ms · p95 ${p95} ms`;
    });
  }

  return { slugs, fichas, tarjetas, sesionB };
}
