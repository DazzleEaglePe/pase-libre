import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  normalizarTexto,
  slugDe,
  tituloDeProducto,
  type AgregarCatalogoDatos,
  type ArchivoSubido,
  type CambioDeDato,
  type CatalogoEquipoConsulta,
  type CrearImportacionDatos,
  type EditarCatalogoDatos,
  type FilaIncompleta,
  type ModoExistentes,
  type MotivoFila,
  type MotivosImportacion,
  type ParecidoImportacion,
  type ProductoDelCatalogo,
  type ProductoQueYaEsta,
  type RespuestaCatalogoEquipo,
  type RespuestaEliminarCatalogo,
  type RespuestaImportacion,
  type RespuestaPorRevisar,
  type ResumenEliminarCatalogo,
  type RevisionImportacion,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { armarListaDeErrores, armarPlantilla, esHojaDeAyuda } from './plantilla-catalogo';

const POR_PAGINA = 50;
/** Un archivo no trae más de 2000 productos: más, en varios. */
const MAX_FILAS = 2000;
const EXTENSIONES_FOTO = /\.(jpe?g|png|webp)$/i;

/** Un problema de una fila (docs/18 §8): el motivo, el texto de «Qué pasa» y la foto buscada. */
interface ErrorDeFila {
  motivo: MotivoFila;
  texto: string;
  foto?: string;
}

/** Una fila del archivo, ya limpia. */
interface FilaLeida {
  /** Única en el archivo: en un Excel de varias pestañas es un correlativo, no la fila de la hoja. */
  fila: number;
  /** «Tarjetas de video · fila 5» en un Excel de varias pestañas; si no, no está. */
  lugar?: string | null;
  categoria: string;
  marca: string;
  modelo: string;
  version: string;
  codigo_parte: string;
  sinonimos: string[];
  caracteristicas: Record<string, string>;
  foto: string;
  /** Los textos de `errores`: con alguno, la fila no se crea. */
  falta: string[];
  /** Las revisiones de antes de docs/18 no lo guardaban. */
  errores?: ErrorDeFila[];
  existe: boolean;
  /** Le faltan categoría, marca o modelo: de uno que ya está, solo se cambia la foto. */
  datosIncompletos?: boolean;
  /** El nombre que tendría (`slugDe` del título), para emparejar las filas sin código. */
  slug?: string;
  /** El producto que ya está: mismo código de parte o, si la fila no tiene, mismo nombre. */
  productoId?: string | null;
  /** Mismo nombre que uno del catálogo con otro código: no se crea (docs/17 §3). */
  parecido?: { titulo: string; codigo_parte: string | null } | null;
  /** Otra fila del archivo ya es este producto. */
  repetida?: boolean;
  /** Con «Reemplazar fotos y datos», algún dato cambia. */
  cambia?: boolean;
  /** La foto del .zip que le toca: clave de `ImportacionCatalogo.fotos`. */
  fotoClave?: string | null;
}

/**
 * Lo que se escribe en «código de parte» cuando todavía no se sabe: no es un código. Como el
 * código es único, tomarlo por uno haría que todas esas filas fueran «el mismo producto».
 */
const SIN_CODIGO =
  /^(por\s+confirmar|pendiente|sin\s+c[oó]digo|no\s+tiene|s\/?[cn]|n\/?[ad]|[-—?x.]+)$/i;
function codigoReal(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim();
  return limpio && !SIN_CODIGO.test(limpio) ? limpio : null;
}

/** Publicaciones que cuentan para «¿Estás seguro?»: las que una tienda tiene a la vista o pausadas. */
const PUBLICACIONES_VIGENTES: Prisma.OfertaWhereInput = { estado: { in: ['ACTIVA', 'PAUSADA'] } };

/** Lo que hace falta de un producto que ya está para comparar y actualizar desde el archivo. */
const SELECT_YA_ESTA = {
  id: true,
  slug: true,
  titulo: true,
  modelo: true,
  version: true,
  codigoParte: true,
  caracteristicas: true,
  fusionadoEnId: true,
  categoria: { select: { slug: true, nombre: true } },
  marca: { select: { nombre: true } },
  etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
  fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
  _count: { select: { ofertas: { where: PUBLICACIONES_VIGENTES } } },
} satisfies Prisma.ProductoSelect;
type ProductoYaEsta = Prisma.ProductoGetPayload<{ select: typeof SELECT_YA_ESTA }>;

/** «Chip: AD104 · Memoria: 12 GB», ordenadas, para comparar y mostrar. */
function textoCaracteristicas(valor: unknown): string {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return '';
  return Object.entries(valor as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .sort()
    .join(' · ');
}

/** Lo que cambiaría en un producto que ya está con «Reemplazar fotos y datos». */
function cambiosDe(
  fila: FilaLeida,
  producto: ProductoYaEsta,
  categoria: { slug: string; nombre: string } | undefined,
): CambioDeDato[] {
  const cambios: CambioDeDato[] = [];
  if (categoria && categoria.slug !== producto.categoria.slug) {
    cambios.push({
      campo: 'Categoría',
      antes: producto.categoria.nombre,
      despues: categoria.nombre,
    });
  }
  const marca = producto.marca?.nombre ?? '';
  if (normalizarTexto(fila.marca) !== normalizarTexto(marca)) {
    cambios.push({ campo: 'Marca', antes: marca || 'sin marca', despues: fila.marca });
  }
  if (fila.modelo !== (producto.modelo ?? '')) {
    cambios.push({ campo: 'Modelo', antes: producto.modelo || 'sin modelo', despues: fila.modelo });
  }
  if (fila.version !== (producto.version ?? '')) {
    cambios.push({
      campo: 'Versión',
      antes: producto.version || 'sin versión',
      despues: fila.version || 'sin versión',
    });
  }
  const codigo = fila.codigo_parte || codigoReal(producto.codigoParte);
  if ((codigo ?? '').toLowerCase() !== (producto.codigoParte ?? '').toLowerCase()) {
    cambios.push({
      campo: 'Código de parte',
      antes: producto.codigoParte ?? 'sin código',
      despues: codigo ?? 'sin código',
    });
  }
  if (fila.sinonimos.length > 0) {
    const antes = producto.etiquetas.map((e) => e.etiqueta.nombre);
    const clave = (lista: string[]) => [...new Set(lista.map(normalizarTexto))].sort().join('|');
    if (clave(antes) !== clave(fila.sinonimos)) {
      cambios.push({
        campo: 'Sinónimos',
        antes: antes.join(', ') || 'ninguno',
        despues: fila.sinonimos.join(', '),
      });
    }
  }
  if (Object.keys(fila.caracteristicas).length > 0) {
    const antes = textoCaracteristicas(producto.caracteristicas);
    const despues = textoCaracteristicas(fila.caracteristicas);
    if (antes !== despues) {
      cambios.push({ campo: 'Características', antes: antes || 'ninguna', despues });
    }
  }
  return cambios;
}

const invalido = (mensaje: string) =>
  new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', mensaje);

/** «Código de parte» → `codigo_de_parte`; así no importa cómo escribieron la cabecera. */
function clave(texto: string): string {
  return normalizarTexto(texto).replace(/\s+/g, '_');
}

const COLUMNAS: Record<
  string,
  'categoria' | 'marca' | 'modelo' | 'version' | 'codigo_parte' | 'sinonimos' | 'foto'
> = {
  categoria: 'categoria',
  marca: 'marca',
  modelo: 'modelo',
  modelo_familia: 'modelo',
  version: 'version',
  serie_version: 'version',
  serie: 'version',
  codigo_parte: 'codigo_parte',
  codigo_de_parte: 'codigo_parte',
  codigo: 'codigo_parte',
  part_number: 'codigo_parte',
  sinonimos: 'sinonimos',
  foto: 'foto',
};

/** «tipo_memoria» → «Tipo de memoria»: las características como las escribe «Agregar uno». */
const CARACTERISTICAS: Record<string, string> = {
  chip: 'Chip',
  memoria: 'Memoria',
  tipo_memoria: 'Tipo de memoria',
  tipo_de_memoria: 'Tipo de memoria',
  memoria_ddr_4_ddr_5: 'Memoria',
};
function nombreCaracteristica(cabecera: string): string {
  const conocida = CARACTERISTICAS[clave(cabecera)];
  if (conocida) return conocida;
  // «VRAM (GB) *» → «VRAM (GB)»: el asterisco de la plantilla solo marca las obligatorias.
  const limpia = cabecera
    .replace(/\s*\*+\s*$/, '')
    .trim()
    .replace(/_/g, ' ');
  return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/** CSV con comas o punto y coma, comillas dobles y saltos de línea dentro de comillas. */
function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, '');
  const primera = limpio.split(/\r?\n/, 1)[0] ?? '';
  const separador =
    (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const letra = limpio[i]!;
    if (comillas) {
      if (letra === '"' && limpio[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (letra === '"') comillas = false;
      else campo += letra;
    } else if (letra === '"') comillas = true;
    else if (letra === separador) {
      fila.push(campo);
      campo = '';
    } else if (letra === '\n' || letra === '\r') {
      if (letra === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += letra;
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

/** Una hoja leída: la cabecera y las filas con su número en la hoja. */
interface Tabla {
  /** El nombre de la pestaña; nulo en un .csv. */
  hoja: string | null;
  cabecera: string[] | undefined;
  filas: Array<{ numero: number; valores: string[] }>;
}

function tablaDeCsv(texto: string): Tabla {
  const [cabecera, ...cuerpo] = leerCsv(texto);
  return { hoja: null, cabecera, filas: cuerpo.map((valores, i) => ({ numero: i + 2, valores })) };
}

/**
 * Las hojas de un .xlsx con productos: todas menos «Cómo llenar» y las escondidas (la de las
 * listas desplegables de la plantilla). `varias` dice si el libro es de varias pestañas: así la
 * categoría sale del nombre de cada una (docs/18 §2).
 */
async function leerXlsx(contenido: Buffer): Promise<{ tablas: Tabla[]; varias: boolean }> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido as unknown as ArrayBuffer);
  const visibles = libro.worksheets.filter((hoja) => hoja.state === 'visible' || !hoja.state);
  const conDatos = visibles.filter((hoja) => !esHojaDeAyuda(hoja.name));
  const varias = conDatos.length > 1 || conDatos.length < visibles.length;
  const tablas = conDatos.map((hoja) => {
    const filas: Array<{ numero: number; valores: string[] }> = [];
    hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
      const valores: string[] = [];
      fila.eachCell({ includeEmpty: true }, (celda, columna) => {
        valores[columna - 1] = celda.text?.trim() ?? '';
      });
      const limpios = Array.from(valores, (valor) => valor ?? '');
      if (limpios.some((valor) => valor !== '')) filas.push({ numero, valores: limpios });
    });
    const [cabecera, ...cuerpo] = filas;
    return { hoja: hoja.name, cabecera: cabecera?.valores, filas: cuerpo };
  });
  return { tablas, varias };
}

/** El texto de «Qué pasa» de cada motivo (docs/18 §8). */
const TEXTO_MOTIVO: Record<Exclude<MotivoFila, 'REPETIDA'>, string> = {
  SIN_FOTO: 'Falta la foto',
  FOTO_NO_ESTA: 'No está la foto en la carpeta',
  FOTO_DANADA: 'La foto está dañada o no es una imagen',
  SIN_CATEGORIA: 'Categoría vacía o mal escrita',
  SIN_MARCA: 'Falta la marca',
  SIN_MODELO: 'Falta el modelo',
};

function anotarError(fila: FilaLeida, error: ErrorDeFila) {
  fila.falta.push(error.foto ? `${error.texto}: ${error.foto}` : error.texto);
  (fila.errores ??= []).push(error);
}

/** Dónde está una fila, para los textos: «Tarjetas de video · fila 5» o «la fila 5». */
function dondeEsta(fila: Pick<FilaLeida, 'fila' | 'lugar'>): string {
  return fila.lugar ?? `la fila ${fila.fila}`;
}

/** Lo que se muestra de una fila que no se crea; las revisiones de antes solo tenían `falta`. */
function errorPrincipal(fila: FilaLeida): ErrorDeFila {
  const primero = fila.errores?.[0];
  if (primero) return primero;
  const texto = fila.falta.join(', ');
  const motivo: MotivoFila = /^repetida/i.test(texto)
    ? 'REPETIDA'
    : /^categor/i.test(texto)
      ? 'SIN_CATEGORIA'
      : /^marca/i.test(texto)
        ? 'SIN_MARCA'
        : /^modelo/i.test(texto)
          ? 'SIN_MODELO'
          : 'SIN_FOTO';
  return { motivo, texto };
}

/** Cuántas por motivo; las tres de foto cuentan juntas. */
function contarMotivos(motivos: MotivoFila[]): MotivosImportacion {
  const cuenta: MotivosImportacion = {
    sin_foto: 0,
    sin_categoria: 0,
    sin_marca: 0,
    sin_modelo: 0,
    repetida: 0,
  };
  for (const motivo of motivos) {
    if (motivo === 'SIN_FOTO' || motivo === 'FOTO_NO_ESTA' || motivo === 'FOTO_DANADA')
      cuenta.sin_foto++;
    else if (motivo === 'SIN_CATEGORIA') cuenta.sin_categoria++;
    else if (motivo === 'SIN_MARCA') cuenta.sin_marca++;
    else if (motivo === 'SIN_MODELO') cuenta.sin_modelo++;
    else cuenta.repetida++;
  }
  return cuenta;
}

/**
 * El catálogo del equipo (COR15 del lienzo final): lo que usa la publicación rápida para llenar
 * todo solo. Productos con búsqueda tolerante, lo que las tiendas publicaron a mano por revisar,
 * agregar uno y subir un archivo (.xlsx, .csv o un .zip con el Excel y la carpeta `fotos/`) que
 * se revisa antes de guardar.
 */
@Injectable()
export class CatalogoEquipoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
  ) {}

  // ── Productos ────────────────────────────────────────────────────────────

  async lista(consulta: CatalogoEquipoConsulta): Promise<RespuestaCatalogoEquipo> {
    const q = normalizarTexto(consulta.q);
    const palabras = q.split(' ').filter(Boolean);
    const categoria = consulta.categoria;
    const desde = (consulta.pagina - 1) * POR_PAGINA;
    // Con texto: las que tienen todas las palabras, o se parecen («gigabte 4060»).
    const filtroTexto = q
      ? Prisma.sql`AND (${Prisma.join(
          palabras.map((p) => Prisma.sql`p.texto_busqueda LIKE ${`%${p}%`}`),
          ' AND ',
        )} OR word_similarity(${q}, p.texto_busqueda) > 0.45)`
      : Prisma.empty;
    const filtroCategoria = categoria ? Prisma.sql`AND c.slug = ${categoria}` : Prisma.empty;
    const orden = q
      ? Prisma.sql`ORDER BY word_similarity(${q}, p.texto_busqueda) DESC, p.titulo ASC`
      : Prisma.sql`ORDER BY p.creado_en DESC`;
    const [ids, [conteo], porRevisar] = await Promise.all([
      this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT p.id FROM producto p JOIN categoria c ON c.id = p.categoria_id
        WHERE p.fusionado_en_id IS NULL ${filtroCategoria} ${filtroTexto}
        ${orden} LIMIT ${POR_PAGINA} OFFSET ${desde}`,
      this.prisma.$queryRaw<Array<{ total: number }>>`
        SELECT count(*)::int AS total FROM producto p JOIN categoria c ON c.id = p.categoria_id
        WHERE p.fusionado_en_id IS NULL ${filtroCategoria} ${filtroTexto}`,
      this.prisma.producto.count({ where: { revisado: false, fusionadoEnId: null } }),
    ]);
    const productos = await this.productosPorId(ids.map((fila) => fila.id));
    const total = conteo?.total ?? 0;
    return {
      total,
      pagina: consulta.pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      por_revisar: porRevisar,
      productos,
    };
  }

  private async productosPorId(ids: string[]): Promise<ProductoDelCatalogo[]> {
    if (ids.length === 0) return [];
    const filas = await this.prisma.producto.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        slug: true,
        titulo: true,
        version: true,
        modelo: true,
        codigoParte: true,
        caracteristicas: true,
        categoria: { select: { slug: true, nombre: true } },
        marca: { select: { nombre: true } },
        etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
        fotos: { select: { ruta: true }, orderBy: { orden: 'asc' } },
        ofertas: {
          where: { estado: 'ACTIVA', tienda: { estado: 'ACTIVA' } },
          select: { tiendaId: true },
          distinct: ['tiendaId'],
        },
        _count: { select: { ofertas: { where: PUBLICACIONES_VIGENTES } } },
      },
    });
    const porId = new Map(filas.map((fila) => [fila.id, fila]));
    return ids.flatMap((id) => {
      const fila = porId.get(id);
      if (!fila) return [];
      const caracteristicas =
        fila.caracteristicas &&
        typeof fila.caracteristicas === 'object' &&
        !Array.isArray(fila.caracteristicas)
          ? Object.fromEntries(
              Object.entries(fila.caracteristicas as Record<string, unknown>).map(([k, v]) => [
                k,
                String(v),
              ]),
            )
          : {};
      return [
        {
          id: fila.id,
          slug: fila.slug,
          titulo: fila.titulo,
          version: fila.version,
          categoria: fila.categoria,
          marca: fila.marca?.nombre ?? null,
          modelo: fila.modelo,
          codigo_parte: fila.codigoParte,
          sinonimos: fila.etiquetas.map((e) => e.etiqueta.nombre),
          caracteristicas,
          foto: fila.fotos[0]?.ruta ?? null,
          fotos: fila.fotos.length,
          rutas_fotos: fila.fotos.map((f) => f.ruta),
          tiendas: fila.ofertas.length,
          publicaciones: fila._count.ofertas,
        },
      ];
    });
  }

  // ── Por revisar ──────────────────────────────────────────────────────────

  async porRevisar(): Promise<RespuestaPorRevisar> {
    const pendientes = await this.prisma.producto.findMany({
      where: { revisado: false, fusionadoEnId: null },
      orderBy: { creadoEn: 'desc' },
      take: 50,
      select: {
        id: true,
        titulo: true,
        modelo: true,
        version: true,
        codigoParte: true,
        textoBusqueda: true,
        creadoEn: true,
        marca: { select: { nombre: true } },
        categoria: { select: { slug: true, nombre: true } },
        creadoPorTienda: { select: { nombre: true } },
      },
    });
    const productos = await Promise.all(
      pendientes.map(async (p) => {
        const mismoCodigo = p.codigoParte
          ? await this.prisma.producto.findFirst({
              where: {
                codigoParte: { equals: p.codigoParte, mode: 'insensitive' },
                id: { not: p.id },
                fusionadoEnId: null,
              },
              select: { id: true, titulo: true, codigoParte: true },
            })
          : null;
        const [parecido] = mismoCodigo
          ? []
          : await this.prisma.$queryRaw<
              Array<{ id: string; titulo: string; codigo_parte: string | null }>
            >`
              SELECT id, titulo, codigo_parte FROM producto
              WHERE id <> ${p.id}::uuid AND fusionado_en_id IS NULL AND revisado = true
                AND similarity(texto_busqueda, ${p.textoBusqueda}) > 0.35
              ORDER BY similarity(texto_busqueda, ${p.textoBusqueda}) DESC LIMIT 1`;
        const sugerido = mismoCodigo
          ? {
              id: mismoCodigo.id,
              titulo: mismoCodigo.titulo,
              codigo_parte: mismoCodigo.codigoParte,
              razon: 'MISMO_CODIGO' as const,
            }
          : parecido
            ? {
                id: parecido.id,
                titulo: parecido.titulo,
                codigo_parte: parecido.codigo_parte,
                razon: 'MUY_PARECIDO' as const,
              }
            : null;
        return {
          id: p.id,
          titulo: p.titulo,
          marca: p.marca?.nombre ?? null,
          modelo: p.modelo,
          version: p.version,
          categoria: p.categoria,
          codigo_parte: p.codigoParte,
          tienda: p.creadoPorTienda?.nombre ?? null,
          creado_en: p.creadoEn.toISOString(),
          sugerido,
        };
      }),
    );
    // Mismo modelo y marca con códigos distintos: versiones que se quedan separadas.
    const duplicados = await this.prisma.$queryRaw<
      Array<{ a_titulo: string; a_codigo: string; b_titulo: string; b_codigo: string }>
    >`
      SELECT a.titulo AS a_titulo, a.codigo_parte AS a_codigo,
             b.titulo AS b_titulo, b.codigo_parte AS b_codigo
      FROM producto a JOIN producto b
        ON a.marca_id = b.marca_id AND lower(a.modelo) = lower(b.modelo) AND a.id < b.id
      WHERE a.fusionado_en_id IS NULL AND b.fusionado_en_id IS NULL
        AND a.codigo_parte IS NOT NULL AND b.codigo_parte IS NOT NULL
        AND a.codigo_parte <> b.codigo_parte
      ORDER BY a.titulo LIMIT 10`;
    return {
      productos,
      duplicados: duplicados.map((fila) => ({
        a: { titulo: fila.a_titulo, codigo_parte: fila.a_codigo },
        b: { titulo: fila.b_titulo, codigo_parte: fila.b_codigo },
      })),
    };
  }

  private anotar(sesion: SesionActiva, accion: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.registroEquipo.create({
      data: { autorId: sesion.usuario.id, accion: accion.slice(0, 240) },
    });
  }

  /** «Es nuevo: agregarlo»: queda en el catálogo tal cual. */
  async aprobar(id: string, sesion: SesionActiva): Promise<void> {
    const producto = await this.prisma.producto.update({
      where: { id },
      data: { revisado: true },
      select: { titulo: true },
    });
    await this.anotar(sesion, `agregó al catálogo «${producto.titulo}»`);
  }

  /** «Unir con este»: sus publicaciones pasan al otro y su dirección redirige allá (RF-54). */
  async unir(id: string, con: string, sesion: SesionActiva): Promise<void> {
    if (id === con) throw invalido('Elige otro producto para unir.');
    await this.prisma.$transaction(async (tx) => {
      const [fuente, destino] = await Promise.all([
        tx.producto.findUnique({ where: { id }, select: { titulo: true, fusionadoEnId: true } }),
        tx.producto.findUnique({
          where: { id: con },
          select: { titulo: true, fusionadoEnId: true },
        }),
      ]);
      if (!fuente || !destino || fuente.fusionadoEnId || destino.fusionadoEnId) {
        throw new ApiHttpException(
          HttpStatus.NOT_FOUND,
          'NO_ENCONTRADO',
          'Ese producto ya no está.',
        );
      }
      const choques = await tx.$queryRaw<Array<{ nombre: string }>>`
        SELECT DISTINCT t.nombre FROM oferta a
        JOIN oferta b ON b.producto_id = ${con}::uuid AND b.tienda_id = a.tienda_id
          AND b.condicion = a.condicion AND b.vigente = true
        JOIN tienda t ON t.id = a.tienda_id
        WHERE a.producto_id = ${id}::uuid AND a.vigente = true`;
      if (choques.length > 0) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          `${choques.map((c) => c.nombre).join(', ')} ya tiene publicados los dos: pídele que quite uno antes de unirlos.`,
        );
      }
      await tx.oferta.updateMany({ where: { productoId: id }, data: { productoId: con } });
      await tx.enVivo.updateMany({ where: { productoId: id }, data: { productoId: con } });
      await tx.precioDiario.deleteMany({ where: { productoId: id } });
      await tx.producto.update({
        where: { id },
        data: { fusionadoEnId: con, revisado: true },
      });
      await this.anotar(sesion, `unió «${fuente.titulo}» con «${destino.titulo}»`, tx);
    });
  }

  private async marcaDe(tx: Prisma.TransactionClient, nombre: string) {
    const slug = slugDe(nombre);
    if (!slug) throw invalido('Escribe la marca.');
    return (
      (await tx.marca.findFirst({ where: { OR: [{ nombre }, { slug }] } })) ??
      (await tx.marca.create({ data: { nombre, slug } }))
    );
  }

  private async categoriaDe(tx: Prisma.TransactionClient, texto: string) {
    const slug = slugDe(texto);
    const todas = await tx.categoria.findMany({ select: { id: true, slug: true, nombre: true } });
    return (
      todas.find((c) => c.slug === texto.trim() || c.slug === slug) ??
      todas.find((c) => normalizarTexto(c.nombre) === normalizarTexto(texto)) ??
      null
    );
  }

  private async guardarSinonimos(
    tx: Prisma.TransactionClient,
    productoId: string,
    nombres: string[],
  ) {
    await tx.productoEtiqueta.deleteMany({ where: { productoId } });
    const vistos = new Set<string>();
    for (const nombre of nombres) {
      const claveEtiqueta = normalizarTexto(nombre);
      if (!claveEtiqueta || vistos.has(claveEtiqueta)) continue;
      vistos.add(claveEtiqueta);
      const etiqueta = await tx.etiqueta.upsert({
        where: { clave: claveEtiqueta },
        update: {},
        create: { clave: claveEtiqueta, nombre },
      });
      await tx.productoEtiqueta.create({ data: { productoId, etiquetaId: etiqueta.id } });
    }
  }

  /** Crea un producto ya revisado. Si el código o el nombre ya están, devuelve `null`. */
  private async crearProducto(
    tx: Prisma.TransactionClient,
    datos: {
      categoriaId: string;
      marca: string;
      modelo: string;
      version: string;
      codigo_parte: string;
      sinonimos: string[];
      caracteristicas: Record<string, string>;
      fotos: Array<{ ruta: string; ancho: number | null; alto: number | null }>;
    },
  ): Promise<string | null> {
    const marca = await this.marcaDe(tx, datos.marca);
    const titulo = tituloDeProducto(
      marca.nombre,
      [datos.modelo, datos.version].filter(Boolean).join(' '),
    );
    const slug = slugDe(titulo);
    const codigo = datos.codigo_parte.trim() || null;
    const existe = await tx.producto.findFirst({
      where: codigo ? { OR: [{ slug }, { codigoParte: codigo }] } : { slug },
      select: { id: true },
    });
    if (existe) return null;
    const textoBusqueda = normalizarTexto(
      [titulo, marca.nombre, datos.modelo, codigo ?? '', ...datos.sinonimos].join(' '),
    );
    const producto = await tx.producto.create({
      data: {
        categoriaId: datos.categoriaId,
        marcaId: marca.id,
        titulo,
        modelo: datos.modelo,
        version: datos.version || null,
        codigoParte: codigo,
        slug,
        textoBusqueda,
        caracteristicas: datos.caracteristicas,
        revisado: true,
        fotos: {
          create: datos.fotos.map((foto, orden) => ({
            ruta: foto.ruta,
            orden,
            ancho: foto.ancho,
            alto: foto.alto,
          })),
        },
      },
      select: { id: true },
    });
    await this.guardarSinonimos(tx, producto.id, datos.sinonimos);
    return producto.id;
  }

  /** «Agregar un producto al catálogo»: uno por cada versión, o uno si no hay versiones. */
  async agregar(datos: AgregarCatalogoDatos, sesion: SesionActiva): Promise<{ creados: number }> {
    return this.prisma.$transaction(async (tx) => {
      const categoria = await this.categoriaDe(tx, datos.categoria);
      if (!categoria) throw invalido('Elige una categoría de la lista.');
      const fotos = await tx.archivo.findMany({
        where: { ruta: { in: datos.fotos }, usuarioId: sesion.usuario.id },
        select: { id: true, ruta: true, ancho: true, alto: true },
      });
      if (fotos.length !== datos.fotos.length)
        throw invalido('Una de las fotos no es válida; súbela de nuevo.');
      await tx.archivo.updateMany({
        where: { id: { in: fotos.map((f) => f.id) } },
        data: { usadoEn: new Date() },
      });
      const versiones = datos.versiones.length
        ? datos.versiones
        : [{ nombre: '', codigo_parte: datos.codigo_parte }];
      let creados = 0;
      for (const version of versiones) {
        const id = await this.crearProducto(tx, {
          categoriaId: categoria.id,
          marca: datos.marca,
          modelo: datos.modelo,
          version: version.nombre,
          codigo_parte: version.codigo_parte,
          sinonimos: datos.sinonimos,
          caracteristicas: datos.caracteristicas,
          fotos: datos.fotos.map((ruta) => {
            const foto = fotos.find((f) => f.ruta === ruta)!;
            return { ruta, ancho: foto.ancho, alto: foto.alto };
          }),
        });
        if (id) creados++;
      }
      if (creados === 0) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese producto ya está en el catálogo (mismo nombre o código de parte).',
        );
      }
      const nombre = tituloDeProducto(datos.marca, datos.modelo);
      await this.anotar(
        sesion,
        creados === 1
          ? `agregó al catálogo «${nombre}»`
          : `agregó al catálogo «${nombre}» en ${creados} versiones`,
        tx,
      );
      return { creados };
    });
  }

  /**
   * «Editar» y «Corregir y agregar»: cambia los datos y lo da por revisado. Con `fotos` también
   * cambia sus fotos y cuál es la principal (docs/17 §2): las publicaciones que usan el producto
   * toman la nueva, salvo las que eligieron su propia portada. Las fotos que quedan sin uso se
   * borran después de guardar.
   */
  async editar(id: string, datos: EditarCatalogoDatos, sesion: SesionActiva): Promise<void> {
    let sinUso: string[] = [];
    try {
      await this.prisma.$transaction(async (tx) => {
        const actual = await tx.producto.findUnique({
          where: { id },
          select: {
            modelo: true,
            version: true,
            codigoParte: true,
            marca: { select: { nombre: true } },
            etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
            fotos: {
              select: { ruta: true, ancho: true, alto: true },
              orderBy: { orden: 'asc' },
            },
          },
        });
        if (!actual) {
          throw new ApiHttpException(
            HttpStatus.NOT_FOUND,
            'NO_ENCONTRADO',
            'Ese producto ya no está.',
          );
        }
        let fotosCambiaron = false;
        if (datos.fotos) {
          const rutas = [...new Set(datos.fotos)];
          const deAntes = new Map(actual.fotos.map((f) => [f.ruta, f]));
          const nuevas = rutas.filter((ruta) => !deAntes.has(ruta));
          const subidas = nuevas.length
            ? await tx.archivo.findMany({
                where: { ruta: { in: nuevas }, usuarioId: sesion.usuario.id },
                select: { ruta: true, ancho: true, alto: true },
              })
            : [];
          if (subidas.length !== nuevas.length) {
            throw invalido('Una de las fotos no es válida; súbela de nuevo.');
          }
          const medidas = new Map([...deAntes, ...subidas.map((s) => [s.ruta, s] as const)]);
          fotosCambiaron = rutas.join('|') !== actual.fotos.map((f) => f.ruta).join('|');
          if (fotosCambiaron) {
            await tx.archivo.updateMany({
              where: { ruta: { in: nuevas } },
              data: { usadoEn: new Date() },
            });
            await tx.productoFoto.deleteMany({ where: { productoId: id } });
            await tx.productoFoto.createMany({
              data: rutas.map((ruta, orden) => ({
                productoId: id,
                ruta,
                orden,
                ancho: medidas.get(ruta)?.ancho ?? null,
                alto: medidas.get(ruta)?.alto ?? null,
              })),
            });
            sinUso = actual.fotos.map((f) => f.ruta).filter((ruta) => !rutas.includes(ruta));
          }
        }
        const marca = datos.marca ? await this.marcaDe(tx, datos.marca) : null;
        const categoria = datos.categoria ? await this.categoriaDe(tx, datos.categoria) : null;
        if (datos.categoria && !categoria) throw invalido('Elige una categoría de la lista.');
        const modelo = datos.modelo ?? actual.modelo ?? '';
        const version = datos.version ?? actual.version ?? '';
        const nombreMarca = marca?.nombre ?? actual.marca?.nombre ?? '';
        const titulo = tituloDeProducto(nombreMarca, [modelo, version].filter(Boolean).join(' '));
        const codigo =
          datos.codigo_parte !== undefined ? datos.codigo_parte || null : actual.codigoParte;
        const sinonimos = datos.sinonimos ?? actual.etiquetas.map((e) => e.etiqueta.nombre);
        await tx.producto.update({
          where: { id },
          data: {
            titulo,
            modelo,
            version: version || null,
            codigoParte: codigo,
            ...(marca ? { marcaId: marca.id } : {}),
            ...(categoria ? { categoriaId: categoria.id } : {}),
            textoBusqueda: normalizarTexto(
              [titulo, nombreMarca, modelo, codigo ?? '', ...sinonimos].join(' '),
            ),
            revisado: true,
          },
        });
        if (datos.sinonimos) await this.guardarSinonimos(tx, id, datos.sinonimos);
        await this.anotar(
          sesion,
          `corrigió en el catálogo «${titulo}»${fotosCambiaron ? ' y cambió sus fotos' : ''}`,
          tx,
        );
      });
      await this.archivos.borrarSinUso(sinUso);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese código de parte ya es de otro producto: únelos en vez de repetirlo.',
        );
      }
      throw error;
    }
  }

  // ── Subir archivo ────────────────────────────────────────────────────────

  /**
   * «Descargar la plantilla» (docs/18 §2): el Excel con «Cómo llenar» y una pestaña por
   * categoría, armado con las categorías y marcas de la base para que no se desactualice.
   */
  async plantilla(): Promise<Buffer> {
    const [categorias, marcas] = await Promise.all([
      this.prisma.categoria.findMany({
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { nombre: true, slug: true },
      }),
      this.prisma.marca.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true } }),
    ]);
    return armarPlantilla(
      categorias,
      marcas.map((m) => m.nombre),
    );
  }

  /** «Descargar la lista en Excel» (docs/18 §8): las filas de una revisión que no se crean. */
  async listaDeErrores(id: string, sesion: SesionActiva): Promise<Buffer> {
    const importacion = await this.prisma.importacionCatalogo.findFirst({
      where: { id, usuarioId: sesion.usuario.id },
      select: { filas: true },
    });
    if (!importacion) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Sube el archivo de nuevo.',
      );
    }
    const filas = (importacion.filas as unknown as FilaLeida[]).filter(
      (f) => !f.parecido && f.falta.length > 0,
    );
    return armarListaDeErrores(
      filas.map((f) => {
        const principal = errorPrincipal(f);
        const textos = f.errores?.length
          ? f.errores.map((e) => (e.foto ? `${e.texto}: ${e.foto}` : e.texto))
          : [principal.texto];
        return {
          fila: f.lugar ?? String(f.fila),
          producto: [f.marca, f.modelo, f.version].filter(Boolean).join(' ') || '(sin nombre)',
          texto: textos.join(' · '),
        };
      }),
    );
  }

  /** Lee el archivo y guarda la revisión. Nada entra al catálogo hasta `crearImportacion`. */
  async importar(
    archivo: { buffer: Buffer; originalname: string },
    sesion: SesionActiva,
  ): Promise<RevisionImportacion> {
    const nombre = archivo.originalname.slice(0, 200) || 'catalogo';
    const extension = nombre.toLowerCase().split('.').pop() ?? '';
    let tablas: Tabla[];
    let varias = false;
    const fotosEnZip = new Map<string, JSZip.JSZipObject>();
    // También por el nombre normalizado: «Antec CX300 ARGB.jpg» = «antec-cx300-argb.jpg».
    const fotosPorNombre = new Map<string, JSZip.JSZipObject>();
    try {
      if (extension === 'zip') {
        const zip = await JSZip.loadAsync(archivo.buffer);
        const planilla = Object.values(zip.files).find(
          (f) => !f.dir && /\.(xlsx|csv)$/i.test(f.name) && !f.name.startsWith('__MACOSX'),
        );
        if (!planilla) throw invalido('El .zip no trae un Excel (.xlsx) ni un .csv.');
        if (planilla.name.toLowerCase().endsWith('.csv')) {
          tablas = [tablaDeCsv(await planilla.async('string'))];
        } else {
          ({ tablas, varias } = await leerXlsx(await planilla.async('nodebuffer')));
        }
        for (const f of Object.values(zip.files)) {
          const partes = f.name.split('/');
          const base = partes[partes.length - 1] ?? '';
          if (
            !f.dir &&
            /(^|\/)fotos\//i.test(f.name) &&
            EXTENSIONES_FOTO.test(base) &&
            !f.name.startsWith('__MACOSX')
          ) {
            const sinExtension = base.replace(EXTENSIONES_FOTO, '');
            fotosEnZip.set(sinExtension.toLowerCase(), f);
            if (slugDe(sinExtension)) fotosPorNombre.set(slugDe(sinExtension), f);
          }
        }
      } else if (extension === 'xlsx') {
        ({ tablas, varias } = await leerXlsx(archivo.buffer));
      } else if (extension === 'csv') {
        tablas = [tablaDeCsv(archivo.buffer.toString('utf8'))];
      } else {
        throw invalido('Sube un archivo .xlsx, .csv o .zip.');
      }
    } catch (error) {
      if (error instanceof ApiHttpException) throw error;
      throw invalido(
        'No pudimos leer el archivo. Revisa que sea la plantilla en .xlsx, .csv o .zip.',
      );
    }

    // Las pestañas vacías (solo los títulos, o nada) se saltan sin aviso (docs/18 §2).
    const conFilas = varias ? tablas.filter((t) => t.cabecera && t.filas.length > 0) : tablas;
    if (conFilas.every((t) => !t.cabecera)) throw invalido('El archivo está vacío.');
    const total = conFilas.reduce((suma, t) => suma + t.filas.length, 0);
    if (total > MAX_FILAS) throw invalido(`Sube hasta ${MAX_FILAS} productos por archivo.`);
    for (const tabla of conFilas) {
      const columnas = (tabla.cabecera ?? []).map((texto) => clave(texto));
      if (!columnas.includes('modelo') && !columnas.includes('modelo_familia')) {
        throw invalido(
          varias && tabla.hoja
            ? `A la pestaña «${tabla.hoja}» le falta la columna «Modelo». Usa la plantilla.`
            : 'Falta la columna «modelo». Usa la plantilla.',
        );
      }
    }

    const categorias = await this.prisma.categoria.findMany({
      select: { slug: true, nombre: true },
    });
    const categoriaValida = (texto: string) =>
      categorias.some(
        (c) =>
          c.slug === texto.trim() ||
          c.slug === slugDe(texto) ||
          normalizarTexto(c.nombre) === normalizarTexto(texto),
      );
    const filas: FilaLeida[] = [];
    for (const tabla of conFilas) {
      const cabecera = tabla.cabecera ?? [];
      const columnas = cabecera.map((texto) => clave(texto));
      // En un Excel de varias pestañas, la categoría es el nombre de la pestaña; una columna
      // «categoría» llena manda (los archivos de antes la traen).
      const deLaHoja = tabla.hoja && categoriaValida(tabla.hoja) ? tabla.hoja : '';
      for (const { numero, valores } of tabla.filas) {
        const fila: FilaLeida = {
          fila: varias ? filas.length + 1 : numero,
          lugar: varias && tabla.hoja ? `${tabla.hoja} · fila ${numero}` : null,
          categoria: '',
          marca: '',
          modelo: '',
          version: '',
          codigo_parte: '',
          sinonimos: [],
          caracteristicas: {},
          foto: '',
          falta: [],
          errores: [],
          existe: false,
        };
        columnas.forEach((columna, j) => {
          const valor = (valores[j] ?? '').trim();
          if (!valor) return;
          const campo = COLUMNAS[columna];
          if (campo === 'sinonimos')
            fila.sinonimos = valor
              .split(/[;,]/)
              .map((s) => s.trim())
              .filter(Boolean);
          else if (campo) fila[campo] = valor;
          else if (columna) fila.caracteristicas[nombreCaracteristica(cabecera[j]!)] = valor;
        });
        if (!fila.categoria) fila.categoria = deLaHoja;
        // «por confirmar» no es un código: esa fila se empareja por el nombre (docs/17 §3).
        fila.codigo_parte = codigoReal(fila.codigo_parte) ?? '';
        if (!fila.categoria || !categoriaValida(fila.categoria)) {
          anotarError(fila, { motivo: 'SIN_CATEGORIA', texto: TEXTO_MOTIVO.SIN_CATEGORIA });
        }
        if (!fila.marca) anotarError(fila, { motivo: 'SIN_MARCA', texto: TEXTO_MOTIVO.SIN_MARCA });
        if (!fila.modelo) {
          anotarError(fila, { motivo: 'SIN_MODELO', texto: TEXTO_MOTIVO.SIN_MODELO });
        }
        fila.datosIncompletos = fila.falta.length > 0;
        if (!fila.datosIncompletos) {
          fila.slug = slugDe(
            tituloDeProducto(fila.marca, [fila.modelo, fila.version].filter(Boolean).join(' ')),
          );
        }
        filas.push(fila);
      }
    }

    // ¿Ya está? Mismo código de parte; si la fila no tiene código, el mismo nombre.
    const yaEstan = await this.emparejar(filas);
    for (const fila of filas) fila.existe = Boolean(fila.productoId);

    // Fotos: por la columna «foto», el código de parte o el nombre (TUF-RTX5070-O12G-GAMING.jpg).
    const fotos: Record<string, ArchivoSubido> = {};
    const fallidas = new Set<string>();
    if (fotosEnZip.size > 0) {
      for (const fila of filas) {
        if (fila.parecido || fila.repetida) continue;
        const nueva = !fila.productoId;
        const clave = [fila.foto, fila.codigo_parte, fila.slug ?? '']
          .flatMap((texto) => {
            const sin = texto.replace(EXTENSIONES_FOTO, '').trim();
            return sin ? [sin.toLowerCase(), slugDe(sin)] : [];
          })
          .find((texto) => texto && (fotosEnZip.has(texto) || fotosPorNombre.has(texto)));
        const entrada = clave ? (fotosEnZip.get(clave) ?? fotosPorNombre.get(clave)) : undefined;
        if (clave && entrada && !fotos[clave] && !fallidas.has(clave)) {
          try {
            fotos[clave] = await this.archivos.subir(await entrada.async('nodebuffer'), {
              id: sesion.usuario.id,
              tiendaId: null,
            });
          } catch {
            fallidas.add(clave);
          }
        }
        fila.fotoClave = clave && fotos[clave] ? clave : null;
        if (nueva && fila.falta.length === 0 && !fila.fotoClave) {
          anotarError(
            fila,
            clave
              ? { motivo: 'FOTO_DANADA', texto: TEXTO_MOTIVO.FOTO_DANADA }
              : fila.foto
                ? { motivo: 'FOTO_NO_ESTA', texto: TEXTO_MOTIVO.FOTO_NO_ESTA, foto: fila.foto }
                : { motivo: 'SIN_FOTO', texto: TEXTO_MOTIVO.SIN_FOTO },
          );
        }
      }
    }

    const categoriaDeTexto = (texto: string) =>
      categorias.find(
        (c) =>
          c.slug === texto.trim() ||
          c.slug === slugDe(texto) ||
          normalizarTexto(c.nombre) === normalizarTexto(texto),
      );
    const ya_estan: ProductoQueYaEsta[] = [];
    for (const fila of filas) {
      const producto = fila.productoId ? yaEstan.get(fila.productoId) : undefined;
      if (!producto) continue;
      const cambios = fila.datosIncompletos
        ? []
        : cambiosDe(fila, producto, categoriaDeTexto(fila.categoria));
      fila.cambia = cambios.length > 0;
      ya_estan.push({
        fila: fila.fila,
        lugar: fila.lugar ?? null,
        id: producto.id,
        titulo: producto.titulo,
        codigo_parte: producto.codigoParte,
        foto_antes: producto.fotos[0]?.ruta ?? null,
        foto_nueva: fila.fotoClave ? (fotos[fila.fotoClave]?.ruta ?? null) : null,
        cambios,
        publicaciones: producto._count.ofertas,
      });
    }

    const importacion = await this.prisma.importacionCatalogo.create({
      data: {
        usuarioId: sesion.usuario.id,
        nombre,
        filas: filas as unknown as Prisma.InputJsonValue,
        fotos: fotos as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    const nombreDe = (f: FilaLeida) =>
      [f.marca, f.modelo, f.version].filter(Boolean).join(' ') || '(sin nombre)';
    const incompletas: FilaIncompleta[] = filas
      .filter((f) => !f.parecido && f.falta.length > 0)
      .map((f) => {
        const [primero, ...otros] = f.errores ?? [];
        return {
          fila: f.fila,
          lugar: f.lugar ?? null,
          producto: nombreDe(f),
          motivo: primero!.motivo,
          texto: [primero!.texto, ...otros.map((e) => e.texto)].join(' · '),
          foto_buscada: primero!.foto ?? null,
        };
      });
    const parecidos: ParecidoImportacion[] = filas.flatMap((f) =>
      f.parecido
        ? [
            {
              fila: f.fila,
              lugar: f.lugar ?? null,
              producto: nombreDe(f),
              codigo_parte: f.codigo_parte,
              con: f.parecido,
            },
          ]
        : [],
    );
    return {
      id: importacion.id,
      nombre,
      filas_leidas: filas.length,
      fotos_encontradas: fotosEnZip.size,
      crear: filas.filter((f) => !f.productoId && !f.parecido && f.falta.length === 0).length,
      existentes: ya_estan.length,
      incompletas,
      motivos: contarMotivos(incompletas.map((f) => f.motivo)),
      ya_estan,
      parecidos,
    };
  }

  /**
   * Marca en cada fila si el producto ya está (`productoId`), si es un parecido con otro código
   * (`parecido`) o si otra fila del archivo ya es ese producto (`repetida`). Devuelve los
   * productos que ya están, por id. Uno unido a otro (RF-54) cuenta como aquel con el que se unió.
   */
  private async emparejar(filas: FilaLeida[]): Promise<Map<string, ProductoYaEsta>> {
    const codigos = [...new Set(filas.map((f) => f.codigo_parte).filter(Boolean))];
    const slugs = [...new Set(filas.flatMap((f) => (f.slug ? [f.slug] : [])))];
    const candidatos =
      codigos.length || slugs.length
        ? await this.prisma.producto.findMany({
            where: {
              OR: [
                ...(codigos.length
                  ? [{ codigoParte: { in: codigos, mode: 'insensitive' as const } }]
                  : []),
                ...(slugs.length ? [{ slug: { in: slugs } }] : []),
              ],
            },
            select: SELECT_YA_ESTA,
          })
        : [];
    const destinos = [
      ...new Set(candidatos.flatMap((c) => (c.fusionadoEnId ? [c.fusionadoEnId] : []))),
    ];
    const unidos = destinos.length
      ? await this.prisma.producto.findMany({
          where: { id: { in: destinos } },
          select: SELECT_YA_ESTA,
        })
      : [];
    const porId = new Map([...candidatos, ...unidos].map((p) => [p.id, p]));
    const final = (p: ProductoYaEsta) => (p.fusionadoEnId ? porId.get(p.fusionadoEnId) : p);
    const porCodigo = new Map<string, ProductoYaEsta>();
    const porSlug = new Map<string, ProductoYaEsta>();
    for (const c of candidatos) {
      if (c.codigoParte) porCodigo.set(c.codigoParte.toLowerCase(), c);
      porSlug.set(c.slug, c);
    }

    const yaEstan = new Map<string, ProductoYaEsta>();
    const vistas = new Map<string, FilaLeida>();
    for (const fila of filas) {
      const mismoCodigo = fila.codigo_parte
        ? porCodigo.get(fila.codigo_parte.toLowerCase())
        : undefined;
      const mismoNombre = !mismoCodigo && fila.slug ? porSlug.get(fila.slug) : undefined;
      if (mismoNombre) {
        const otroCodigo = codigoReal(mismoNombre.codigoParte);
        if (
          fila.codigo_parte &&
          otroCodigo &&
          otroCodigo.toLowerCase() !== fila.codigo_parte.toLowerCase()
        ) {
          fila.parecido = { titulo: mismoNombre.titulo, codigo_parte: mismoNombre.codigoParte };
          continue;
        }
      }
      const encontrado = mismoCodigo ?? mismoNombre;
      const producto = encontrado ? final(encontrado) : undefined;
      // Sin datos completos no se puede crear; solo cuenta si ya está (para cambiarle la foto).
      if (!producto && fila.datosIncompletos) continue;
      const claves = producto
        ? [`p:${producto.id}`]
        : [
            `s:${fila.slug}`,
            ...(fila.codigo_parte ? [`c:${fila.codigo_parte.toLowerCase()}`] : []),
          ];
      const antes = claves.map((k) => vistas.get(k)).find((f) => f !== undefined);
      if (antes !== undefined) {
        fila.repetida = true;
        anotarError(fila, {
          motivo: 'REPETIDA',
          texto: `${fila.codigo_parte ? 'Código repetido' : 'Repetida'}: ya está en ${dondeEsta(antes)}`,
        });
        continue;
      }
      for (const k of claves) vistas.set(k, fila);
      if (producto) {
        fila.productoId = producto.id;
        yaEstan.set(producto.id, producto);
      }
    }
    return yaEstan;
  }

  /**
   * «Guardar: crear 153 y actualizar 149» (docs/17 §3): crea las filas completas que no estaban y,
   * según `existentes`, actualiza las que ya estaban (menos las desmarcadas en `omitir`). Las
   * fotos viejas se borran después de guardar, nunca antes.
   */
  async crearImportacion(
    id: string,
    datos: CrearImportacionDatos,
    sesion: SesionActiva,
  ): Promise<RespuestaImportacion> {
    const importacion = await this.prisma.importacionCatalogo.findFirst({
      where: { id, usuarioId: sesion.usuario.id },
    });
    if (!importacion) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Sube el archivo de nuevo.',
      );
    }
    if (importacion.aplicadaEn) {
      return { creados: importacion.creados, actualizados: importacion.actualizados };
    }
    const filas = importacion.filas as unknown as FilaLeida[];
    const fotos = importacion.fotos as unknown as Record<string, ArchivoSubido>;
    // Las revisiones de antes no guardaban `fotoClave`: la foto iba por el código de parte.
    const fotoDe = (fila: FilaLeida) => {
      const clave =
        fila.fotoClave !== undefined
          ? fila.fotoClave
          : (fila.foto || fila.codigo_parte).replace(EXTENSIONES_FOTO, '').toLowerCase();
      return clave ? fotos[clave] : undefined;
    };
    const omitir = new Set(datos.omitir);
    const sinUso: string[] = [];
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const categorias = await tx.categoria.findMany({
          select: { id: true, slug: true, nombre: true },
        });
        const categoriaDe = (texto: string) =>
          categorias.find(
            (c) =>
              c.slug === texto.trim() ||
              c.slug === slugDe(texto) ||
              normalizarTexto(c.nombre) === normalizarTexto(texto),
          );
        const usadas: string[] = [];
        let creados = 0;
        let actualizados = 0;
        for (const fila of filas) {
          const foto = fotoDe(fila);
          if (fila.productoId) {
            if (datos.existentes === 'DEJAR' || omitir.has(fila.fila)) continue;
            const tocado = await this.actualizarDesdeFila(tx, fila, foto, datos.existentes, {
              categoriaDe,
              sinUso,
            });
            if (tocado) {
              actualizados++;
              if (foto) usadas.push(foto.ruta);
            }
            continue;
          }
          if (fila.existe || fila.parecido || fila.repetida || fila.falta.length > 0) continue;
          const categoria = categoriaDe(fila.categoria);
          if (!categoria) continue;
          const nuevo = await this.crearProducto(tx, {
            categoriaId: categoria.id,
            marca: fila.marca,
            modelo: fila.modelo,
            version: fila.version,
            codigo_parte: fila.codigo_parte,
            sinonimos: fila.sinonimos,
            caracteristicas: fila.caracteristicas,
            fotos: foto ? [foto] : [],
          });
          if (nuevo) {
            creados++;
            if (foto) usadas.push(foto.ruta);
          }
        }
        if (usadas.length) {
          await tx.archivo.updateMany({
            where: { ruta: { in: usadas } },
            data: { usadoEn: new Date() },
          });
        }
        await tx.importacionCatalogo.update({
          where: { id },
          data: { aplicadaEn: new Date(), creados, actualizados },
        });
        const productos = (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
        const accion =
          actualizados === 0
            ? `subió ${productos(creados)} al catálogo`
            : creados === 0
              ? `actualizó ${productos(actualizados)} del catálogo`
              : `subió ${productos(creados)} al catálogo y actualizó ${actualizados}`;
        await this.anotar(sesion, `${accion} (${importacion.nombre})`, tx);
        return { creados, actualizados };
      },
      { timeout: 180_000 },
    );
    await this.archivos.borrarSinUso(sinUso);
    return resultado;
  }

  /** Una fila de un producto que ya está: su foto y, con `FOTOS_Y_DATOS`, sus datos. */
  private async actualizarDesdeFila(
    tx: Prisma.TransactionClient,
    fila: FilaLeida,
    foto: ArchivoSubido | undefined,
    modo: Exclude<ModoExistentes, 'DEJAR'>,
    ayuda: {
      categoriaDe: (texto: string) => { id: string } | undefined;
      sinUso: string[];
    },
  ): Promise<boolean> {
    const producto = await tx.producto.findUnique({
      where: { id: fila.productoId! },
      select: {
        id: true,
        codigoParte: true,
        etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
        fotos: { select: { ruta: true } },
      },
    });
    if (!producto) return false;
    let tocado = false;
    if (foto) {
      ayuda.sinUso.push(...producto.fotos.map((f) => f.ruta).filter((r) => r !== foto.ruta));
      await tx.productoFoto.deleteMany({ where: { productoId: producto.id } });
      await tx.productoFoto.create({
        data: {
          productoId: producto.id,
          ruta: foto.ruta,
          orden: 0,
          ancho: foto.ancho,
          alto: foto.alto,
        },
      });
      tocado = true;
    }
    if (modo === 'FOTOS_Y_DATOS' && fila.cambia && !fila.datosIncompletos) {
      const categoria = ayuda.categoriaDe(fila.categoria);
      const marca = await this.marcaDe(tx, fila.marca);
      const titulo = tituloDeProducto(
        marca.nombre,
        [fila.modelo, fila.version].filter(Boolean).join(' '),
      );
      let codigo = fila.codigo_parte || codigoReal(producto.codigoParte);
      if (codigo && codigo.toLowerCase() !== (producto.codigoParte ?? '').toLowerCase()) {
        const deOtro = await tx.producto.findFirst({
          where: {
            codigoParte: { equals: codigo, mode: 'insensitive' },
            NOT: { id: producto.id },
          },
          select: { id: true },
        });
        if (deOtro) codigo = producto.codigoParte;
      }
      const sinonimos = fila.sinonimos.length
        ? fila.sinonimos
        : producto.etiquetas.map((e) => e.etiqueta.nombre);
      await tx.producto.update({
        where: { id: producto.id },
        data: {
          titulo,
          modelo: fila.modelo,
          version: fila.version || null,
          codigoParte: codigo,
          marcaId: marca.id,
          ...(categoria ? { categoriaId: categoria.id } : {}),
          ...(Object.keys(fila.caracteristicas).length
            ? { caracteristicas: fila.caracteristicas }
            : {}),
          textoBusqueda: normalizarTexto(
            [titulo, marca.nombre, fila.modelo, codigo ?? '', ...sinonimos].join(' '),
          ),
          revisado: true,
        },
      });
      if (fila.sinonimos.length) await this.guardarSinonimos(tx, producto.id, fila.sinonimos);
      tocado = true;
    }
    return tocado;
  }

  // ── Eliminar todos ───────────────────────────────────────────────────────

  /**
   * Los que se pueden borrar (docs/17 §4): ninguna publicación (de ningún estado), ningún pedido
   * en vivo y nadie unido a él. Así ninguna publicación se queda sin producto.
   */
  private static readonly SIN_USO = Prisma.sql`p.fusionado_en_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM oferta o WHERE o.producto_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM en_vivo v WHERE v.producto_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM producto u WHERE u.fusionado_en_id = p.id)`;

  async resumenEliminar(): Promise<ResumenEliminarCatalogo> {
    const [fila] = await this.prisma.$queryRaw<Array<{ total: number; se_eliminan: number }>>`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE ${CatalogoEquipoService.SIN_USO})::int AS se_eliminan
      FROM producto p WHERE p.fusionado_en_id IS NULL`;
    const total = fila?.total ?? 0;
    const seEliminan = fila?.se_eliminan ?? 0;
    return { total, se_eliminan: seEliminan, se_quedan: total - seEliminan };
  }

  /** «Eliminar todos»: borra una tanda; la página llama hasta que no quede ninguno. */
  async eliminarTanda(tanda: number, sesion: SesionActiva): Promise<RespuestaEliminarCatalogo> {
    const sinUso: string[] = [];
    const eliminados = await this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT p.id FROM producto p WHERE ${CatalogoEquipoService.SIN_USO}
        ORDER BY p.creado_en LIMIT ${tanda} FOR UPDATE SKIP LOCKED`;
      const ids = filas.map((f) => f.id);
      if (ids.length === 0) return 0;
      const fotos = await tx.productoFoto.findMany({
        where: { productoId: { in: ids } },
        select: { ruta: true },
      });
      sinUso.push(...fotos.map((f) => f.ruta));
      // Sus fotos, sinónimos y precios se van con él (en cascada).
      const { count } = await tx.producto.deleteMany({ where: { id: { in: ids } } });
      await this.anotar(
        sesion,
        `eliminó ${count} ${count === 1 ? 'producto' : 'productos'} del catálogo («Eliminar todos»)`,
        tx,
      );
      return count;
    });
    await this.archivos.borrarSinUso(sinUso);
    const resumen = await this.resumenEliminar();
    return { eliminados, quedan: resumen.se_eliminan, se_quedan: resumen.se_quedan };
  }
}
