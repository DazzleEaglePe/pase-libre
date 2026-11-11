import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  normalizarTexto,
  slugDe,
  tituloDeProducto,
  type AgregarCatalogoDatos,
  type CatalogoEquipoConsulta,
  type EditarCatalogoDatos,
  type FilaIncompleta,
  type ProductoDelCatalogo,
  type RespuestaCatalogoEquipo,
  type RespuestaImportacion,
  type RespuestaPorRevisar,
  type RevisionImportacion,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import type { SesionActiva } from '../sesion/sesion.types';

const POR_PAGINA = 50;
/** Un archivo no trae más de 2000 productos: más, en varios. */
const MAX_FILAS = 2000;
const EXTENSIONES_FOTO = /\.(jpe?g|png|webp)$/i;

/** Una fila del archivo, ya limpia. */
interface FilaLeida {
  fila: number;
  categoria: string;
  marca: string;
  modelo: string;
  version: string;
  codigo_parte: string;
  sinonimos: string[];
  caracteristicas: Record<string, string>;
  foto: string;
  falta: string[];
  existe: boolean;
}

const invalido = (mensaje: string) =>
  new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', mensaje);

/** «Código de parte» → `codigo_de_parte`; así no importa cómo escribieron la cabecera. */
function clave(texto: string): string {
  return normalizarTexto(texto).replace(/\s+/g, '_');
}

const COLUMNAS: Record<
  string,
  keyof Omit<FilaLeida, 'fila' | 'falta' | 'existe' | 'caracteristicas'>
> = {
  categoria: 'categoria',
  marca: 'marca',
  modelo: 'modelo',
  modelo_familia: 'modelo',
  version: 'version',
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
};
function nombreCaracteristica(cabecera: string): string {
  const conocida = CARACTERISTICAS[clave(cabecera)];
  if (conocida) return conocida;
  const limpia = cabecera.trim().replace(/_/g, ' ');
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

async function leerXlsx(contenido: Buffer): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido as unknown as ArrayBuffer);
  const hoja = libro.worksheets[0];
  if (!hoja) return [];
  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores: string[] = [];
    fila.eachCell({ includeEmpty: true }, (celda, columna) => {
      valores[columna - 1] = celda.text?.trim() ?? '';
    });
    filas.push(Array.from(valores, (valor) => valor ?? ''));
  });
  return filas;
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
          tiendas: fila.ofertas.length,
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

  /** «Editar» y «Corregir y agregar»: cambia los datos y lo da por revisado. */
  async editar(id: string, datos: EditarCatalogoDatos, sesion: SesionActiva): Promise<void> {
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
          },
        });
        if (!actual) {
          throw new ApiHttpException(
            HttpStatus.NOT_FOUND,
            'NO_ENCONTRADO',
            'Ese producto ya no está.',
          );
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
        await this.anotar(sesion, `corrigió en el catálogo «${titulo}»`, tx);
      });
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

  /** Lee el archivo y guarda la revisión. Nada entra al catálogo hasta `crearImportacion`. */
  async importar(
    archivo: { buffer: Buffer; originalname: string },
    sesion: SesionActiva,
  ): Promise<RevisionImportacion> {
    const nombre = archivo.originalname.slice(0, 200) || 'catalogo';
    const extension = nombre.toLowerCase().split('.').pop() ?? '';
    let tabla: string[][];
    const fotosEnZip = new Map<string, JSZip.JSZipObject>();
    try {
      if (extension === 'zip') {
        const zip = await JSZip.loadAsync(archivo.buffer);
        const planilla = Object.values(zip.files).find(
          (f) => !f.dir && /\.(xlsx|csv)$/i.test(f.name) && !f.name.startsWith('__MACOSX'),
        );
        if (!planilla) throw invalido('El .zip no trae un Excel (.xlsx) ni un .csv.');
        tabla = planilla.name.toLowerCase().endsWith('.csv')
          ? leerCsv(await planilla.async('string'))
          : await leerXlsx(await planilla.async('nodebuffer'));
        for (const f of Object.values(zip.files)) {
          const partes = f.name.split('/');
          const base = partes[partes.length - 1] ?? '';
          if (
            !f.dir &&
            /(^|\/)fotos\//i.test(f.name) &&
            EXTENSIONES_FOTO.test(base) &&
            !f.name.startsWith('__MACOSX')
          ) {
            fotosEnZip.set(base.replace(EXTENSIONES_FOTO, '').toLowerCase(), f);
          }
        }
      } else if (extension === 'xlsx') {
        tabla = await leerXlsx(archivo.buffer);
      } else if (extension === 'csv') {
        tabla = leerCsv(archivo.buffer.toString('utf8'));
      } else {
        throw invalido('Sube un archivo .xlsx, .csv o .zip.');
      }
    } catch (error) {
      if (error instanceof ApiHttpException) throw error;
      throw invalido(
        'No pudimos leer el archivo. Revisa que sea la plantilla en .xlsx, .csv o .zip.',
      );
    }

    const [cabecera, ...cuerpo] = tabla;
    if (!cabecera) throw invalido('El archivo está vacío.');
    if (cuerpo.length > MAX_FILAS) throw invalido(`Sube hasta ${MAX_FILAS} productos por archivo.`);
    const columnas = cabecera.map((texto) => clave(texto));
    if (!columnas.includes('modelo') && !columnas.includes('modelo_familia')) {
      throw invalido('Falta la columna «modelo». Usa la plantilla.');
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
    const filas: FilaLeida[] = cuerpo.map((valores, i) => {
      const fila: FilaLeida = {
        fila: i + 2,
        categoria: '',
        marca: '',
        modelo: '',
        version: '',
        codigo_parte: '',
        sinonimos: [],
        caracteristicas: {},
        foto: '',
        falta: [],
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
        else if (campo) (fila[campo] as string) = valor;
        else if (columna) fila.caracteristicas[nombreCaracteristica(cabecera[j]!)] = valor;
      });
      if (!fila.categoria || !categoriaValida(fila.categoria)) fila.falta.push('Categoría');
      if (!fila.marca) fila.falta.push('Marca');
      if (!fila.modelo) fila.falta.push('Modelo');
      if (!fila.codigo_parte) fila.falta.push('Código de parte');
      return fila;
    });

    // Fotos: por la columna «foto» o por el código de parte (TUF-RTX5070-O12G-GAMING.jpg).
    const fotos: Record<string, { ruta: string; ancho: number; alto: number }> = {};
    if (fotosEnZip.size > 0) {
      for (const fila of filas) {
        const buscada = (fila.foto || fila.codigo_parte)
          .replace(EXTENSIONES_FOTO, '')
          .toLowerCase();
        const entrada = buscada ? fotosEnZip.get(buscada) : undefined;
        if (!entrada) {
          if (fila.falta.length === 0) fila.falta.push('Foto (no está en fotos/)');
          continue;
        }
        if (fotos[buscada]) continue;
        try {
          const subida = await this.archivos.subir(await entrada.async('nodebuffer'), {
            id: sesion.usuario.id,
            tiendaId: null,
          });
          fotos[buscada] = subida;
        } catch {
          if (fila.falta.length === 0) fila.falta.push('Foto (no se pudo leer)');
        }
      }
    }

    // Lo que ya está (mismo código de parte) se omite.
    const codigos = filas.map((f) => f.codigo_parte).filter(Boolean);
    const existentes = new Set(
      (
        await this.prisma.producto.findMany({
          where: { codigoParte: { in: codigos, mode: 'insensitive' } },
          select: { codigoParte: true },
        })
      ).map((p) => (p.codigoParte ?? '').toLowerCase()),
    );
    for (const fila of filas) fila.existe = existentes.has(fila.codigo_parte.toLowerCase());

    const importacion = await this.prisma.importacionCatalogo.create({
      data: {
        usuarioId: sesion.usuario.id,
        nombre,
        filas: filas as unknown as Prisma.InputJsonValue,
        fotos,
      },
      select: { id: true },
    });
    const incompletas: FilaIncompleta[] = filas
      .filter((f) => !f.existe && f.falta.length > 0)
      .map((f) => ({
        fila: f.fila,
        producto: [f.marca, f.modelo, f.version].filter(Boolean).join(' ') || '(sin nombre)',
        falta: f.falta.join(', '),
      }));
    return {
      id: importacion.id,
      nombre,
      filas_leidas: filas.length,
      fotos_encontradas: fotosEnZip.size,
      crear: filas.filter((f) => !f.existe && f.falta.length === 0).length,
      existentes: filas.filter((f) => f.existe).length,
      incompletas,
    };
  }

  /** «Crear los 214»: solo las filas completas que no existían. */
  async crearImportacion(id: string, sesion: SesionActiva): Promise<RespuestaImportacion> {
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
    if (importacion.aplicadaEn) return { creados: importacion.creados };
    const filas = importacion.filas as unknown as FilaLeida[];
    const fotos = importacion.fotos as Record<
      string,
      { ruta: string; ancho: number; alto: number }
    >;
    const creados = await this.prisma.$transaction(
      async (tx) => {
        const categorias = await tx.categoria.findMany({
          select: { id: true, slug: true, nombre: true },
        });
        let cuenta = 0;
        for (const fila of filas) {
          if (fila.existe || fila.falta.length > 0) continue;
          const categoria = categorias.find(
            (c) =>
              c.slug === fila.categoria.trim() ||
              c.slug === slugDe(fila.categoria) ||
              normalizarTexto(c.nombre) === normalizarTexto(fila.categoria),
          );
          if (!categoria) continue;
          const foto =
            fotos[(fila.foto || fila.codigo_parte).replace(EXTENSIONES_FOTO, '').toLowerCase()];
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
          if (nuevo) cuenta++;
        }
        await tx.importacionCatalogo.update({
          where: { id },
          data: { aplicadaEn: new Date(), creados: cuenta },
        });
        await this.anotar(
          sesion,
          `subió ${cuenta} ${cuenta === 1 ? 'producto' : 'productos'} al catálogo (${importacion.nombre})`,
          tx,
        );
        return cuenta;
      },
      { timeout: 120_000 },
    );
    return { creados };
  }
}
