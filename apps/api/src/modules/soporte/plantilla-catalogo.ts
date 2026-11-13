import { normalizarTexto } from '@paselibre/contracts';
import ExcelJS from 'exceljs';

/**
 * La plantilla del catálogo en Excel (docs/18 §2): «Cómo llenar» y una pestaña por categoría,
 * con el nombre exacto de la categoría. El importador lee todas las pestañas y saca la
 * categoría del nombre de cada una.
 */

/** La primera pestaña: no trae productos, el importador se la salta. */
export const HOJA_COMO_LLENAR = 'Cómo llenar';
/** La pestaña escondida con las marcas para la lista desplegable. */
export const HOJA_LISTAS = 'Listas';

/** «Cómo llenar» o «Listas», escritas como sea: no son de productos. */
export function esHojaDeAyuda(nombre: string): boolean {
  const clave = normalizarTexto(nombre);
  return clave === normalizarTexto(HOJA_COMO_LLENAR) || clave === normalizarTexto(HOJA_LISTAS);
}

interface Columna {
  titulo: string;
  obligatoria?: boolean;
  /** Las opciones de la lista desplegable. */
  opciones?: string[];
  ancho?: number;
}

const TIPOS_GDDR = ['GDDR5', 'GDDR6', 'GDDR6X', 'GDDR7'];
const DDR = ['DDR4', 'DDR5'];
/** «Perfil de memoria» (docs/19 §13): con él, «¿Para qué procesador es?» viene marcado al publicar. */
export const PERFILES_DE_MEMORIA = ['Intel XMP', 'EXPO Ryzen', 'Los dos'];
const PANELES = ['IPS', 'VA', 'TN', 'OLED', 'Mini LED'];
const CONEXIONES = ['Cableada', 'Inalámbrica', 'Bluetooth', 'Inalámbrica + Bluetooth'];
const CERTIFICACIONES = [
  'Sin certificación',
  '80 Plus',
  '80 Plus Bronze',
  '80 Plus Silver',
  '80 Plus Gold',
  '80 Plus Platinum',
  '80 Plus Titanium',
];

/** Las columnas propias de cada categoría, por su slug; se guardan como características. */
const PROPIAS: Record<string, Columna[]> = {
  procesadores: [
    { titulo: 'Núcleos / hilos' },
    { titulo: 'Socket' },
    { titulo: 'Frecuencia máx.' },
    { titulo: 'Caché' },
  ],
  graficas: [
    { titulo: 'VRAM (GB)', obligatoria: true },
    { titulo: 'Tipo de memoria', opciones: TIPOS_GDDR },
    { titulo: 'Bus' },
    { titulo: 'Boost' },
  ],
  placas: [
    { titulo: 'Socket', obligatoria: true },
    { titulo: 'Chipset' },
    { titulo: 'Memoria (DDR4 / DDR5)', opciones: DDR, ancho: 22 },
    { titulo: 'Formato' },
    { titulo: 'Red' },
  ],
  ram: [
    { titulo: 'Tipo', obligatoria: true },
    { titulo: 'Capacidad', obligatoria: true },
    { titulo: 'Velocidad' },
    { titulo: 'Latencia' },
    { titulo: 'Formato' },
    { titulo: 'Perfil de memoria', opciones: PERFILES_DE_MEMORIA, ancho: 18 },
  ],
  almacenamiento: [
    { titulo: 'Tipo', obligatoria: true },
    { titulo: 'Capacidad', obligatoria: true },
    { titulo: 'Interfaz' },
    { titulo: 'Lectura' },
  ],
  fuentes: [
    { titulo: 'Potencia', obligatoria: true },
    { titulo: 'Certificación', opciones: CERTIFICACIONES, ancho: 18 },
    { titulo: 'Cables' },
    { titulo: 'Norma' },
  ],
  cases: [
    { titulo: 'Formato' },
    { titulo: 'Ventiladores incluidos', ancho: 22 },
    { titulo: 'Fuente' },
  ],
  refrigeracion: [
    { titulo: 'Tipo', obligatoria: true },
    { titulo: 'Radiador' },
    { titulo: 'Iluminación' },
  ],
  monitores: [
    { titulo: 'Tamaño', obligatoria: true },
    { titulo: 'Resolución' },
    { titulo: 'Frecuencia' },
    { titulo: 'Panel', opciones: PANELES },
  ],
  teclados: [{ titulo: 'Tipo' }, { titulo: 'Conexión', opciones: CONEXIONES, ancho: 22 }],
  mouse: [{ titulo: 'Tipo' }, { titulo: 'Conexión', opciones: CONEXIONES, ancho: 22 }],
  audio: [{ titulo: 'Tipo' }],
  energia: [{ titulo: 'Potencia' }, { titulo: 'Capacidad' }, { titulo: 'Tomas' }],
};

/** Las columnas de todas las pestañas; las propias van antes de «Foto». */
function columnasDe(slug: string): Columna[] {
  return [
    { titulo: 'Marca', obligatoria: true, ancho: 16 },
    { titulo: 'Modelo', obligatoria: true, ancho: 28 },
    { titulo: 'Serie / versión', ancho: 16 },
    { titulo: 'Código de parte', ancho: 22 },
    { titulo: 'Sinónimos', ancho: 22 },
    ...(PROPIAS[slug] ?? []),
    { titulo: 'Foto', obligatoria: true, ancho: 22 },
  ];
}

const VERDE = 'FF006B47';
const VERDE_GRIS = 'FF5B8F77';
/** Hasta qué fila llegan las listas desplegables. */
const FILAS_CON_LISTA = 1000;

function pintarTitulo(celda: ExcelJS.Cell, obligatoria: boolean) {
  celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  celda.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: obligatoria ? VERDE : VERDE_GRIS },
  };
  celda.alignment = { vertical: 'middle' };
}

/** `dataValidations` existe en exceljs 4, pero no está en sus tipos. */
function agregarLista(hoja: ExcelJS.Worksheet, rango: string, formula: string, aviso: string) {
  (
    hoja as unknown as {
      dataValidations: { add(rango: string, validacion: ExcelJS.DataValidation): void };
    }
  ).dataValidations.add(rango, {
    type: 'list',
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: 'warning',
    errorTitle: 'No está en la lista',
    error: aviso,
  });
}

/** Excel no deja `\ / ? * [ ] :` en el nombre de una pestaña, ni más de 31 letras. */
function nombreDeHoja(nombre: string): string {
  return nombre
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31);
}

export async function armarPlantilla(
  categorias: Array<{ nombre: string; slug: string }>,
  marcas: string[],
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'PaseLibre';

  // ── «Cómo llenar» ───────────────────────────────────────────────────────
  const ayuda = libro.addWorksheet(HOJA_COMO_LLENAR, {
    properties: { tabColor: { argb: VERDE } },
  });
  ayuda.getColumn(1).width = 110;
  const hayAccesorios = categorias.some((c) => normalizarTexto(c.nombre) === 'accesorios');
  const pasos = [
    `Busca la pestaña de tu categoría (abajo).${hayAccesorios ? ' Si tu producto no tiene una, usa «Accesorios».' : ''}`,
    'Una fila por producto. Las columnas con * son obligatorias.',
    'En «Foto» escribe el nombre del archivo tal cual está en tu carpeta «fotos» (por ejemplo tuf-5070.webp).',
    'No cambies los títulos de la fila 1 ni el nombre de las pestañas.',
    'Mete este Excel y la carpeta «fotos» en un ZIP y súbelo en Equipo › Catálogo › Subir archivo.',
  ];
  const titulo = ayuda.addRow(['Cómo subir tu catálogo a PaseLibre']);
  titulo.font = { bold: true, size: 14, color: { argb: VERDE } };
  for (const [i, paso] of pasos.entries()) ayuda.addRow([`${i + 1}. ${paso}`]);
  ayuda.addRow(['Las pestañas que dejes vacías no pasan nada.']).font = {
    italic: true,
    color: { argb: 'FF777777' },
  };
  ayuda.addRow([]);
  ayuda.addRow([
    'Ejemplo, en la pestaña «Tarjetas de video» (aquí solo de muestra: no se sube):',
  ]).font = { bold: true };

  // La fila de ejemplo, con las mismas columnas que la pestaña de tarjetas de video.
  const ejemplo = columnasDe('graficas');
  const valores: Record<string, string> = {
    Marca: 'ASUS',
    Modelo: 'TUF RTX 5070',
    'Serie / versión': 'OC',
    'Código de parte': '90YV0MA0-M0NA00',
    Sinónimos: 'tuf 5070, 5070 asus',
    'VRAM (GB)': '12',
    'Tipo de memoria': 'GDDR7',
    Bus: '192 bits',
    Boost: '2610 MHz',
    Foto: 'tuf-5070.webp',
  };
  const filaTitulos = ayuda.getRow(ayuda.rowCount + 1);
  const filaEjemplo = ayuda.getRow(ayuda.rowCount + 2);
  ejemplo.forEach((columna, i) => {
    const celda = filaTitulos.getCell(i + 1);
    celda.value = columna.obligatoria ? `${columna.titulo} *` : columna.titulo;
    pintarTitulo(celda, Boolean(columna.obligatoria));
    filaEjemplo.getCell(i + 1).value = valores[columna.titulo] ?? '';
  });
  for (let i = 2; i <= ejemplo.length; i++) ayuda.getColumn(i).width = 16;

  // ── Las marcas, en una pestaña escondida ────────────────────────────────
  const listas = libro.addWorksheet(HOJA_LISTAS, { state: 'veryHidden' });
  for (const marca of marcas) listas.addRow([marca]);

  // ── Una pestaña por categoría ───────────────────────────────────────────
  const usadas = new Set<string>([normalizarTexto(HOJA_COMO_LLENAR), normalizarTexto(HOJA_LISTAS)]);
  for (const categoria of categorias) {
    const nombre = nombreDeHoja(categoria.nombre);
    if (!nombre || usadas.has(normalizarTexto(nombre))) continue;
    usadas.add(normalizarTexto(nombre));
    const columnas = columnasDe(categoria.slug);
    const hoja = libro.addWorksheet(nombre, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    hoja.columns = columnas.map((c) => ({ width: c.ancho ?? 16 }));
    const fila = hoja.getRow(1);
    columnas.forEach((columna, i) => {
      const celda = fila.getCell(i + 1);
      celda.value = columna.obligatoria ? `${columna.titulo} *` : columna.titulo;
      pintarTitulo(celda, Boolean(columna.obligatoria));
    });
    fila.height = 20;
    columnas.forEach((columna, i) => {
      const letra = hoja.getColumn(i + 1).letter;
      const rango = `${letra}2:${letra}${FILAS_CON_LISTA + 1}`;
      if (columna.titulo === 'Marca' && marcas.length > 0) {
        agregarLista(
          hoja,
          rango,
          `${HOJA_LISTAS}!$A$1:$A$${marcas.length}`,
          'Esa marca todavía no está en PaseLibre. Si está bien escrita, se crea al subir el archivo.',
        );
      } else if (columna.opciones) {
        agregarLista(
          hoja,
          rango,
          `"${columna.opciones.join(',')}"`,
          `Elige una de la lista: ${columna.opciones.join(', ')}.`,
        );
      }
    });
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** «La lista en Excel» de las filas que no se crean (docs/18 §8): fila, producto y qué pasa. */
export async function armarListaDeErrores(
  filas: Array<{ fila: string; producto: string; texto: string }>,
): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'PaseLibre';
  const hoja = libro.addWorksheet('No se crean', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [{ width: 28 }, { width: 40 }, { width: 60 }];
  const titulos = hoja.addRow(['Fila', 'Producto', 'Qué pasa']);
  titulos.eachCell((celda) => pintarTitulo(celda, true));
  for (const fila of filas) hoja.addRow([fila.fila, fila.producto, fila.texto]);
  return Buffer.from(await libro.xlsx.writeBuffer());
}
