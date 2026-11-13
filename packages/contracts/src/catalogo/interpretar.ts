import { normalizarTexto } from './normalizar.js';

/**
 * «Escribe como te salga» (BUS_Web, sección 6 del lienzo final): antes de buscar se entienden
 * los números dichos en palabras («treinta sesenta» → 3060), los modelos partidos («30 60» →
 * 3060) y las palabras que nombran una categoría («gráfica gigabyte» → Gigabyte en Tarjetas de
 * video). Lo demás (las letras cambiadas) lo corrige la búsqueda contra el catálogo.
 *
 * Es el único «entender» de PaseLibre (doc 20 §11): lo usan la barra de arriba, Publicar, Pedir
 * en vivo, Mis publicaciones y el Catálogo del panel. Entiende además la categoría con su marca y
 * su tipo («ram gskill», «m.2 1tb», «sata 480»), las marcas escritas de otra forma, las palabras
 * de relleno y el perfil de las memorias («ram expo»).
 */

const NUMEROS: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  mil: 1000,
};

/**
 * Las palabras que solo dicen la categoría: se quitan del texto y la eligen. «m.2» llega como
 * «m 2» y se junta en `m2` antes de mirar aquí; «ddr 4» y «ddr 5», en `ddr4` y `ddr5`.
 */
const CATEGORIA_DE: Record<string, string> = {
  grafica: 'graficas',
  graficas: 'graficas',
  video: 'graficas',
  gpu: 'graficas',
  vga: 'graficas',
  procesador: 'procesadores',
  procesadores: 'procesadores',
  cpu: 'procesadores',
  memoria: 'ram',
  memorias: 'ram',
  ram: 'ram',
  ddr4: 'ram',
  ddr5: 'ram',
  disco: 'almacenamiento',
  discos: 'almacenamiento',
  almacenamiento: 'almacenamiento',
  ssd: 'almacenamiento',
  nvme: 'almacenamiento',
  hdd: 'almacenamiento',
  m2: 'almacenamiento',
  sata: 'almacenamiento',
  fuente: 'fuentes',
  fuentes: 'fuentes',
  psu: 'fuentes',
  placa: 'placas',
  placas: 'placas',
  mainboard: 'placas',
  motherboard: 'placas',
  monitor: 'monitores',
  monitores: 'monitores',
  pantalla: 'monitores',
  case: 'cases',
  cases: 'cases',
  gabinete: 'cases',
  gabinetes: 'cases',
  chasis: 'cases',
  torre: 'cases',
  pad: 'mouse-pads',
  mousepad: 'mouse-pads',
  alfombrilla: 'mouse-pads',
  cooler: 'refrigeracion',
  disipador: 'refrigeracion',
  liquida: 'refrigeracion',
  aio: 'refrigeracion',
  enfriamiento: 'refrigeracion',
  refrigeracion: 'refrigeracion',
  mouse: 'mouse',
  mause: 'mouse',
  raton: 'mouse',
  teclado: 'teclados',
  teclados: 'teclados',
  audio: 'audio',
  headset: 'audio',
  diadema: 'audio',
  audifono: 'audio',
  audifonos: 'audio',
  auriculares: 'audio',
};

/** Las de dos palabras: se miran antes que las de una («mouse pad» no es «mouse»). */
const CATEGORIA_DE_DOS: Record<string, string> = {
  'mouse pad': 'mouse-pads',
  'disco duro': 'almacenamiento',
};

/**
 * Los tipos: eligen la categoría y además se buscan en el nombre, los sinónimos o las
 * características del producto («m.2 1tb» → Almacenamiento con «M.2» y «1 TB»). El valor es
 * cómo quedan después de `normalizarTexto`, que es como están guardados.
 */
const TIPO: Record<string, string> = {
  ssd: 'ssd',
  nvme: 'nvme',
  m2: 'm 2',
  sata: 'sata',
  hdd: 'hdd',
  ddr4: 'ddr 4',
  ddr5: 'ddr 5',
};

/** Las que acompañan a la categoría y no aportan nada: «tarjeta de video», «placa madre». */
const RELLENO = new Set(['tarjeta', 'tarjetas', 'madre', 'poder', 'duro', 'solido']);

/**
 * Las que no suman nunca, se haya nombrado una categoría o no: así se puede pegar un nombre
 * largo del Excel («Memoria RAM … nuevo sellado»).
 */
const RELLENO_SIEMPRE = new Set([
  'de',
  'para',
  'con',
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'y',
  'o',
  'en',
  'nuevo',
  'nueva',
  'original',
  'sellado',
  'gamer',
  'gaming',
  'pc',
  'color',
]);

/** Cómo se escribe en el catálogo lo que se dice de otra forma (marcas incluidas). */
const SINONIMOS: Record<string, string> = {
  giga: 'gigabyte',
  gigabait: 'gigabyte',
  nvidia: 'rtx',
  radeon: 'rx',
  gskill: 'g skill',
  wd: 'western digital',
  westerndigital: 'western digital',
  tforce: 'teamgroup',
  team: 'teamgroup',
  hyperx: 'hyperx',
  coolermaster: 'cooler master',
  cm: 'cooler master',
  tplink: 'tp link',
  adata: 'adata',
  xpg: 'xpg',
};

/**
 * Las marcas de dos palabras («G.Skill» llega como «g skill»): van juntas, como un solo término,
 * y se miran antes que las palabras de categoría («cooler master» es la marca, no Refrigeración).
 */
const SINONIMOS_DE_DOS: Record<string, string> = {
  'g skill': 'g skill',
  'western digital': 'western digital',
  'cooler master': 'cooler master',
  'tp link': 'tp link',
  'team group': 'teamgroup',
};

/** El perfil de una memoria RAM (docs/19 §13) que se puede pedir escribiendo. */
export type PerfilBuscado = 'XMP' | 'EXPO';

export interface BusquedaInterpretada {
  /** El texto como se busca: «gigabyte 3060». */
  texto: string;
  /** El slug de la categoría que se nombró, si se nombró una. */
  categoria: string | null;
  /** Si cambió algo respecto de lo escrito. */
  cambio: boolean;
  /**
   * Lo que tiene que estar en el producto, sin repetir. Una marca de dos palabras o un tipo
   * («g skill», «m 2») es un solo término: sus palabras van juntas.
   */
  terminos: string[];
  /** Los términos que son un tipo (`ssd`, `m 2`, `ddr 5`…): también valen en las características. */
  tipos: string[];
  /** «expo», o «xmp» / «intel» en RAM: el perfil de memoria que se pidió. */
  perfil: PerfilBuscado | null;
}

/** Junta «m 2» → `m2` y «ddr 4» / «ddr 5» → `ddr4` / `ddr5`, para reconocerlos como tipos. */
function juntarTipos(palabras: string[]): string[] {
  const juntas: string[] = [];
  for (let i = 0; i < palabras.length; i++) {
    const a = palabras[i] ?? '';
    const b = palabras[i + 1];
    if ((a === 'm' && b === '2') || (a === 'ddr' && (b === '4' || b === '5'))) {
      juntas.push(`${a}${b}`);
      i++;
    } else {
      juntas.push(a);
    }
  }
  return juntas;
}

/** Una palabra (o dos que van juntas) de lo escrito, con lo que dice. */
interface Pieza {
  palabra: string;
  /** La categoría que nombra. */
  categoria?: string;
  /** Una marca de dos palabras: cómo se busca. */
  termino?: string;
}

export function interpretarBusqueda(q: string): BusquedaInterpretada {
  const palabras = normalizarTexto(q).split(' ').filter(Boolean);
  if (palabras.length === 0) {
    return { texto: '', categoria: null, cambio: false, terminos: [], tipos: [], perfil: null };
  }

  // 1 · Números en palabras: «treinta y cinco» → 35, «dos mil» → 2000.
  const conNumeros: string[] = [];
  let acumulado: number | null = null;
  let miles = false;
  const soltar = () => {
    if (acumulado !== null) conNumeros.push(String(acumulado));
    acumulado = null;
    miles = false;
  };
  for (const palabra of palabras) {
    if (palabra === 'y' && acumulado !== null) continue;
    const valor = NUMEROS[palabra];
    if (valor === undefined) {
      soltar();
      conNumeros.push(palabra);
      continue;
    }
    if (valor === 1000) {
      acumulado = (acumulado ?? 1) * 1000;
      miles = true;
    } else if (
      acumulado !== null &&
      (miles || (acumulado % 10 === 0 && acumulado < 100 && valor < 10))
    ) {
      acumulado += valor;
    } else {
      soltar();
      acumulado = valor;
    }
  }
  soltar();

  // 2 · Un modelo partido en dos: «30 60» → 3060, «40 70» → 4070 (series de 10 en 10).
  const juntos: string[] = [];
  for (let i = 0; i < conNumeros.length; i++) {
    const a = conNumeros[i] ?? '';
    const b = conNumeros[i + 1];
    if (
      b !== undefined &&
      /^(10|20|30|40|50|60|70|90)$/.test(a) &&
      /^\d0$/.test(b) &&
      Number(b) >= 10
    ) {
      juntos.push(`${a}${b}`);
      i++;
    } else {
      juntos.push(a);
    }
  }

  // 3 · Lo de dos palabras primero (marcas y categorías); después cada palabra sola.
  const piezas: Pieza[] = [];
  const sueltas = juntarTipos(juntos);
  for (let i = 0; i < sueltas.length; i++) {
    const palabra = sueltas[i] ?? '';
    const dos = `${palabra} ${sueltas[i + 1] ?? ''}`;
    const marca = SINONIMOS_DE_DOS[dos];
    const categoriaDeDos = CATEGORIA_DE_DOS[dos];
    if (marca) {
      piezas.push({ palabra: dos, termino: marca });
      i++;
    } else if (categoriaDeDos) {
      piezas.push({ palabra: dos, categoria: categoriaDeDos });
      i++;
    } else {
      piezas.push({ palabra, categoria: CATEGORIA_DE[palabra] });
    }
  }

  // 4 · Primero se ve si se nombró una categoría; después se quitan sus palabras y el relleno.
  // Un tipo («ssd», «m.2») elige la categoría y además se busca.
  let categoria = piezas.map((pieza) => pieza.categoria).find(Boolean) ?? null;
  let perfil: PerfilBuscado | null = null;
  const terminos: string[] = [];
  const tipos: string[] = [];
  const sumar = (termino: string) => {
    if (!terminos.includes(termino)) terminos.push(termino);
  };
  for (const pieza of piezas) {
    const tipo = TIPO[pieza.palabra];
    if (tipo) {
      sumar(tipo);
      if (!tipos.includes(tipo)) tipos.push(tipo);
      continue;
    }
    if (pieza.categoria) continue;
    if (pieza.termino) {
      sumar(pieza.termino);
      continue;
    }
    const palabra = pieza.palabra;
    if (RELLENO_SIEMPRE.has(palabra) || (categoria && RELLENO.has(palabra))) continue;
    if (palabra === 'expo' || palabra === 'xmp' || (palabra === 'intel' && categoria === 'ram')) {
      perfil = palabra === 'expo' ? 'EXPO' : 'XMP';
      continue;
    }
    sumar(SINONIMOS[palabra] ?? palabra);
  }
  // El perfil solo existe en las memorias RAM: «expo» sola ya dice la categoría.
  if (perfil && !categoria) categoria = 'ram';

  // Si todo era la categoría («tarjetas de video»), se busca la categoría entera.
  const texto = terminos.join(' ');
  return {
    texto,
    categoria,
    cambio: texto !== palabras.join(' ') || categoria !== null || perfil !== null,
    terminos,
    tipos,
    perfil,
  };
}
