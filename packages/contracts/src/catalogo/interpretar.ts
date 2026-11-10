import { normalizarTexto } from './normalizar.js';

/**
 * «Escribe como te salga» (BUS_Web, sección 6 del lienzo final): antes de buscar se entienden
 * los números dichos en palabras («treinta sesenta» → 3060), los modelos partidos («30 60» →
 * 3060) y las palabras que nombran una categoría («gráfica gigabyte» → Gigabyte en Tarjetas de
 * video). Lo demás (las letras cambiadas) lo corrige la búsqueda contra el catálogo.
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

/** Las palabras que solo dicen la categoría: se quitan del texto y la eligen. */
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
  disco: 'almacenamiento',
  discos: 'almacenamiento',
  almacenamiento: 'almacenamiento',
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
  raton: 'mouse',
  teclado: 'teclados',
  teclados: 'teclados',
  audifono: 'audio',
  audifonos: 'audio',
  auriculares: 'audio',
};

/** Las que acompañan a la categoría y no aportan nada: «tarjeta de video», «placa madre». */
const RELLENO = new Set(['de', 'para', 'tarjeta', 'tarjetas', 'madre', 'poder', 'duro', 'solido']);

/** Cómo se escribe en el catálogo lo que se dice de otra forma. */
const SINONIMOS: Record<string, string> = {
  giga: 'gigabyte',
  gigabait: 'gigabyte',
  nvidia: 'rtx',
  radeon: 'rx',
};

export interface BusquedaInterpretada {
  /** El texto como se busca: «gigabyte 3060». */
  texto: string;
  /** El slug de la categoría que se nombró, si se nombró una. */
  categoria: string | null;
  /** Si cambió algo respecto de lo escrito. */
  cambio: boolean;
}

export function interpretarBusqueda(q: string): BusquedaInterpretada {
  const palabras = normalizarTexto(q).split(' ').filter(Boolean);
  if (palabras.length === 0) return { texto: '', categoria: null, cambio: false };

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

  // 3 · Categorías y sinónimos: primero se ve si se nombró una; después se quitan sus palabras.
  const categoria = juntos.map((palabra) => CATEGORIA_DE[palabra]).find(Boolean) ?? null;
  const finales = juntos
    .filter((palabra) => !CATEGORIA_DE[palabra] && !(categoria && RELLENO.has(palabra)))
    .map((palabra) => SINONIMOS[palabra] ?? palabra);

  // Si todo era la categoría («tarjetas de video»), se busca la categoría entera.
  const texto = finales.join(' ');
  return { texto, categoria, cambio: texto !== palabras.join(' ') || categoria !== null };
}
