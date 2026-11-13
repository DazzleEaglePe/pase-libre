import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  condicionDeEstado,
  formatearPrecio,
  normalizarTexto,
  PORTADA_AJENA,
  preguntasDeCategoria,
  precioDe,
  slugDe,
  tituloDeProducto,
  type ConfirmarOfertas,
  type EditarOfertaDatos,
  type EliminarOfertasDatos,
  type MisOfertasConsulta,
  type OfertaPropia,
  type PestanaMisOfertas,
  type ProductoNuevoDatos,
  type ProductoResumen,
  type PublicarDatos,
  type RespuestaConfirmar,
  type RespuestaEliminarOfertas,
  type RespuestaMisOfertas,
  type RespuestaPublicar,
  type RespuestaSugerencias,
  type SugerenciaProducto,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { FOTO_DEL_PRODUCTO } from '../../shared/portada';
import { ArchivosService } from '../archivos/archivos.service';
import { AvisosService } from '../mensajes/avisos.service';
import { detalleDe } from '../catalogo/catalogo.service';
import {
  buscarConMotor,
  condicionesDeIntento,
  ordenDeParecido,
  palabrasDe,
  type Intento,
} from '../catalogo/motor-busqueda';
import { tiendaDeSesion } from '../sesion/sesion.service';
import type { UsuarioConTienda } from '../sesion/sesion.types';

/**
 * Lo del lienzo final que llega al publicar o editar (PUB_WebProducto), en columnas. Solo
 * lo que vino: al editar, lo que no llega se queda como estaba.
 */
function columnasDeDetalle(datos: Partial<EditarOfertaDatos>): Prisma.OfertaUpdateInput {
  const columnas: Prisma.OfertaUpdateInput = {};
  if (datos.estado_detalle) {
    columnas.estadoDetalle = datos.estado_detalle;
    columnas.condicion = condicionDeEstado(datos.estado_detalle);
  }
  if (datos.con_caja !== undefined) columnas.conCaja = datos.con_caja;
  if (datos.con_factura !== undefined) columnas.conFactura = datos.con_factura;
  if (datos.probado !== undefined) columnas.probado = datos.probado;
  if (datos.garantia !== undefined) columnas.garantia = datos.garantia;
  if (datos.estado_otro !== undefined) columnas.estadoOtro = datos.estado_otro;
  if (datos.garantia_otra !== undefined) columnas.garantiaOtra = datos.garantia_otra;
  if (datos.en_almacen !== undefined) columnas.enAlmacen = datos.en_almacen;
  if (datos.modo_venta) columnas.modoVenta = datos.modo_venta;
  if (datos.precio_facturado !== undefined) {
    columnas.precioFacturadoCentimos =
      datos.precio_facturado === null ? null : BigInt(datos.precio_facturado);
  }
  if (datos.descuento_socio !== undefined) {
    columnas.descuentoSocioCentimos =
      datos.descuento_socio === null ? null : BigInt(datos.descuento_socio);
  }
  if (datos.quien_ve_precio) {
    columnas.precioVisible = datos.quien_ve_precio === 'TODOS';
    columnas.soloSocios = datos.quien_ve_precio === 'SOCIOS';
  }
  if (datos.acepta_ofertas !== undefined) columnas.aceptaOfertas = datos.acepta_ofertas;
  if (datos.negociable !== undefined) columnas.negociable = datos.negociable;
  if (datos.perfil_memoria !== undefined) columnas.perfilMemoria = datos.perfil_memoria;
  if (datos.empaque !== undefined) columnas.empaque = datos.empaque;
  if (datos.oc !== undefined) columnas.oc = datos.oc;
  return columnas;
}

/**
 * Lo que la categoría no pregunta al publicar (docs/19 §13) se guarda nulo: así una memoria no
 * queda «OC» ni una tarjeta de video «para Intel», aunque la web lo mande.
 */
function sinLoQueNoPregunta(
  categoria: string,
  columnas: Prisma.OfertaUpdateInput,
): Prisma.OfertaUpdateInput {
  const preguntas = preguntasDeCategoria(categoria);
  return {
    ...columnas,
    ...(preguntas.procesador || columnas.perfilMemoria === undefined
      ? {}
      : { perfilMemoria: null }),
    ...(preguntas.empaque || columnas.empaque === undefined ? {} : { empaque: null }),
    ...(preguntas.oc || columnas.oc === undefined ? {} : { oc: null }),
  };
}

/** RF-10: una oferta activa sin cambios hace más de 7 días pide «Revísala». */
export const DIAS_PARA_REVISAR = 7;
const POR_PAGINA = 50;
const MAX_SUGERENCIAS = 6;

const SELECT_PRODUCTO_RESUMEN = {
  id: true,
  slug: true,
  titulo: true,
  categoria: { select: { slug: true, nombre: true } },
  marca: { select: { nombre: true } },
  etiquetas: { select: { etiqueta: { select: { nombre: true } } }, take: 4 },
  perfilMemoria: true,
  ...FOTO_DEL_PRODUCTO,
} satisfies Prisma.ProductoSelect;

const SELECT_OFERTA_PROPIA = {
  id: true,
  condicion: true,
  estadoDetalle: true,
  conCaja: true,
  conFactura: true,
  probado: true,
  garantia: true,
  estadoOtro: true,
  garantiaOtra: true,
  enAlmacen: true,
  modoVenta: true,
  precioFacturadoCentimos: true,
  descuentoSocioCentimos: true,
  soloSocios: true,
  aceptaOfertas: true,
  negociable: true,
  perfilMemoria: true,
  empaque: true,
  oc: true,
  razonPausa: true,
  stock: true,
  precioCentimos: true,
  moneda: true,
  precioVisible: true,
  tiendaVisible: true,
  descripcion: true,
  estado: true,
  actualizadaEn: true,
  fotos: { select: { ruta: true, ancho: true, alto: true }, orderBy: { orden: 'asc' } },
  portadaRuta: true,
  responsable: { select: { id: true, nombre: true } },
  producto: {
    select: { ...SELECT_PRODUCTO_RESUMEN, _count: { select: { fotos: true } } },
  },
} satisfies Prisma.OfertaSelect;

type ProductoResumenFila = Prisma.ProductoGetPayload<{
  select: typeof SELECT_PRODUCTO_RESUMEN & { _count: { select: { fotos: true } } };
}>;
type OfertaPropiaFila = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA_PROPIA }>;

/** Las pestañas de Mis publicaciones (F_MisPublicaciones). «Sin stock» sale de `stock = 0`. */
const PESTANAS: Record<PestanaMisOfertas, Prisma.OfertaWhereInput> = {
  activas: { estado: 'ACTIVA', stock: { gt: 0 } },
  vigentes: { estado: 'ACTIVA' },
  sin_stock: { estado: 'ACTIVA', stock: 0 },
  pausadas: { estado: 'PAUSADA' },
  todas: {},
};

const CONDICION_TEXTO = { NUEVO: 'nuevo', USADO: 'usado' } as const;

const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/** Siete días atrás contando hoy, para las vistas (que se guardan por día). */
function haceUnaSemana(): Date {
  const hoy = new Date(`${DIA_LIMA.format(new Date())}T00:00:00Z`);
  return new Date(hoy.getTime() - 6 * 86_400_000);
}

function limiteRevision(): Date {
  return new Date(Date.now() - DIAS_PARA_REVISAR * 24 * 60 * 60 * 1000);
}

function productoResumen(p: ProductoResumenFila): ProductoResumen {
  return {
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    categoria: p.categoria,
    marca: p.marca?.nombre ?? null,
    etiquetas: p.etiquetas.map((e) => e.etiqueta.nombre),
    foto: p.fotos[0]?.ruta ?? null,
    fotos: p._count.fotos,
    perfil_memoria: p.perfilMemoria,
  };
}

function esUnicoRepetido(error: unknown, indice: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  const objetivo = error.meta?.target;
  return Array.isArray(objetivo)
    ? objetivo.join(',').includes(indice)
    : String(objetivo).includes(indice);
}

const noExiste = () =>
  new ApiHttpException(
    HttpStatus.NOT_FOUND,
    'NO_ENCONTRADO',
    'Esa publicación no existe o ya se eliminó.',
  );

/**
 * La portada que se guarda (docs/17 §5): una de las fotos de la oferta, o nula para la de
 * siempre. Cualquier otra ruta (del catálogo, de otra oferta, inventada) es un error.
 */
function portadaEntre(portada: string | null | undefined, fotos: readonly string[]): string | null {
  if (portada == null) return null;
  if (!fotos.includes(portada)) {
    throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', PORTADA_AJENA);
  }
  return portada;
}

/**
 * Publicar y Mis publicaciones (RF-05 a RF-10, RF-51 a RF-53). Todo se hace sobre la
 * tienda de la sesión: el dueño y sus asesores ven y cambian las mismas ofertas, y quien
 * publica queda como responsable de los mensajes de esa oferta (A-11).
 */
@Injectable()
export class OfertasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  // ── «Ya está en PaseLibre» ────────────────────────────────────────────────

  /**
   * Con `q`, los productos que coinciden con la misma búsqueda tolerante del catálogo
   * (RT-04: así se evitan duplicados). Con `producto`, ese producto solo, para «Publicar
   * uno igual» desde la ficha. Incluye productos sin ofertas vigentes: siguen existiendo.
   */
  async sugerencias(
    consulta: { q: string; producto?: string },
    tiendaId: string,
  ): Promise<RespuestaSugerencias> {
    if (consulta.producto) {
      const producto = await this.prisma.producto.findUnique({
        where: { slug: consulta.producto.toLowerCase() },
        select: { id: true, fusionadoEnId: true },
      });
      if (!producto) {
        throw new ApiHttpException(
          HttpStatus.NOT_FOUND,
          'NO_ENCONTRADO',
          'Este producto no existe en PaseLibre.',
        );
      }
      return {
        correccion: null,
        lo_mas_parecido: false,
        productos: await this.resumenes([producto.fusionadoEnId ?? producto.id], tiendaId),
      };
    }

    // El mismo buscador que la barra de arriba (doc 20 §11): «ram», «m.2 1tb», «case deepcool».
    if (palabrasDe(consulta.q).length === 0) {
      return { correccion: null, lo_mas_parecido: false, productos: [] };
    }
    const { resultado: ids, intento } = await buscarConMotor(
      this.prisma,
      consulta.q,
      {},
      (i) => this.idsQueCoinciden(i),
      (encontrados) => encontrados.length > 0,
    );
    return {
      correccion: intento.correccion,
      lo_mas_parecido: intento.lo_mas_parecido,
      productos: await this.resumenes(ids, tiendaId),
    };
  }

  private async idsQueCoinciden(intento: Intento): Promise<string[]> {
    const condiciones = [
      Prisma.sql`p.fusionado_en_id IS NULL`,
      ...condicionesDeIntento(intento, { sobre: 'producto' }),
    ];
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id::text AS id
      FROM producto p
      WHERE ${Prisma.join(condiciones, ' AND ')}
      ORDER BY ${ordenDeParecido(intento)}(
          SELECT count(*) FROM oferta o JOIN tienda t ON t.id = o.tienda_id
          WHERE o.producto_id = p.id AND o.estado = 'ACTIVA' AND t.estado = 'ACTIVA'
        ) DESC,
        similarity(p.texto_busqueda, ${intento.filtro.terminos.join(' ')}) DESC,
        p.titulo
      LIMIT ${MAX_SUGERENCIAS}`;
    return filas.map((f) => f.id);
  }

  private async resumenes(ids: string[], tiendaId: string): Promise<SugerenciaProducto[]> {
    if (ids.length === 0) return [];
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: ids } },
      select: {
        ...SELECT_PRODUCTO_RESUMEN,
        _count: {
          select: {
            fotos: true,
            ofertas: { where: { estado: 'ACTIVA', tienda: { estado: 'ACTIVA' } } },
          },
        },
        ofertas: {
          where: { tiendaId, estado: { not: 'ELIMINADA' } },
          select: { id: true, condicion: true, estado: true },
          orderBy: { condicion: 'asc' },
        },
      },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));
    return ids.flatMap((id) => {
      const p = porId.get(id);
      if (!p) return [];
      return [
        {
          ...productoResumen(p),
          ofertas: p._count.ofertas,
          propias: p.ofertas.map((o) => ({
            id: o.id,
            condicion: o.condicion,
            estado: o.estado as 'ACTIVA' | 'PAUSADA',
          })),
        },
      ];
    });
  }

  // ── Publicar ──────────────────────────────────────────────────────────────

  async publicar(datos: PublicarDatos, usuario: UsuarioConTienda): Promise<RespuestaPublicar> {
    const tienda = usuario.tienda;
    if (!tienda)
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');

    try {
      const publicada = await this.prisma.$transaction(async (tx) => {
        const productoNuevo = Boolean(datos.producto_nuevo);
        const productoId = datos.producto_nuevo
          ? await this.crearProducto(tx, datos.producto_nuevo, tienda.id)
          : await this.productoExistente(tx, datos.producto_id ?? '');
        const { categoria } = await tx.producto.findUniqueOrThrow({
          where: { id: productoId },
          select: { categoria: { select: { slug: true } } },
        });

        const condicion = datos.condicion ?? condicionDeEstado(datos.estado_detalle ?? 'SELLADO');
        const repetida = await tx.oferta.findFirst({
          where: { productoId, tiendaId: tienda.id, condicion, vigente: true },
          select: { id: true, estado: true },
        });
        if (repetida) throw this.ofertaRepetida(condicion, repetida);
        const portadaRuta = portadaEntre(datos.portada, datos.fotos);

        const fotos = await this.archivos.reclamar(tx, datos.fotos, tienda.id);
        const oferta = await tx.oferta.create({
          data: {
            ...(sinLoQueNoPregunta(
              categoria.slug,
              columnasDeDetalle({ ...datos, estado_detalle: undefined }),
            ) as Omit<
              Prisma.OfertaUncheckedCreateInput,
              'productoId' | 'tiendaId' | 'responsableId'
            >),
            productoId,
            tiendaId: tienda.id,
            responsableId: usuario.id,
            condicion,
            estadoDetalle: datos.estado_detalle ?? (condicion === 'NUEVO' ? 'SELLADO' : 'USADO'),
            stock: datos.stock,
            precioCentimos: datos.precio === null ? null : BigInt(datos.precio),
            moneda: datos.moneda ?? tienda.monedaDefecto,
            // Sin monto no hay precio que mostrar; si no se eligió, manda la tienda (D-37).
            precioVisible: datos.quien_ve_precio
              ? datos.quien_ve_precio === 'TODOS' &&
                (datos.precio !== null || (datos.precio_facturado ?? null) !== null)
              : datos.precio !== null && (datos.precio_visible ?? tienda.precioVisibleDefecto),
            tiendaVisible: datos.tienda_visible ?? true,
            descripcion: datos.descripcion,
            fotos: {
              create: datos.fotos.map((ruta, orden) => ({ ruta, orden, ...fotos.get(ruta) })),
            },
            portadaRuta,
          },
          select: SELECT_OFERTA_PROPIA,
        });
        const otras = await tx.oferta.count({
          where: {
            productoId,
            estado: 'ACTIVA',
            tienda: { estado: 'ACTIVA' },
            id: { not: oferta.id },
          },
        });
        return {
          oferta: this.ofertaPropia(oferta),
          otras_ofertas: otras,
          producto_nuevo: productoNuevo,
        };
      });
      await this.avisarSeguidores(
        tienda,
        publicada.oferta.producto.titulo,
        datos.tienda_visible ?? true,
      );
      await this.avisarAlertas(publicada.oferta.id, tienda.id);
      return publicada;
    } catch (error) {
      if (esUnicoRepetido(error, 'oferta_vigente_key')) {
        throw this.ofertaRepetida(
          datos.condicion ?? condicionDeEstado(datos.estado_detalle ?? 'SELLADO'),
          null,
        );
      }
      if (esUnicoRepetido(error, 'slug')) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese producto ya está en PaseLibre: búscalo y publica uno igual.',
        );
      }
      throw error;
    }
  }

  /**
   * Las tiendas que siguen a esta (SG_Web): con «Todo lo que publique», un aviso por producto;
   * con «Solo lo importante», uno al día como mucho. Lo publicado como tienda reservada no avisa:
   * diría de quién es.
   */
  private async avisarSeguidores(
    tienda: { id: string; nombre: string },
    titulo: string,
    tiendaVisible: boolean,
  ): Promise<void> {
    if (!tiendaVisible) return;
    const haceUnDia = new Date(Date.now() - 24 * 3_600_000);
    const seguimientos = await this.prisma.seguimiento.findMany({
      where: {
        seguidaId: tienda.id,
        OR: [
          { avisos: 'TODO' },
          { avisos: 'IMPORTANTE', OR: [{ avisadoEn: null }, { avisadoEn: { lt: haceUnDia } }] },
        ],
      },
      select: { id: true, tiendaId: true },
    });
    if (seguimientos.length === 0) return;
    await this.prisma.seguimiento.updateMany({
      where: { id: { in: seguimientos.map((fila) => fila.id) } },
      data: { avisadoEn: new Date() },
    });
    const personas = await this.prisma.usuario.findMany({
      where: { tiendaId: { in: seguimientos.map((fila) => fila.tiendaId) }, estado: 'ACTIVO' },
      select: { id: true },
    });
    await this.avisos.crear(
      personas.map((persona) => persona.id),
      {
        tipo: 'SEGUIDA',
        titulo: `${tienda.nombre} publicó ${titulo}`,
        extracto: 'Una tienda que sigues',
        enlace: `/tiendas/${tienda.id}`,
        accion: { tipo: 'ABRIR', texto: 'Ver sus productos', enlace: `/tiendas/${tienda.id}` },
      },
    );
  }

  /**
   * «Avísame cuando alguien la publique» (EV_WebRes): las alertas cuyas palabras están todas en
   * el producto recién publicado. No se avisa a la propia tienda.
   */
  private async avisarAlertas(ofertaId: string, tiendaId: string): Promise<void> {
    const oferta = await this.prisma.oferta.findUniqueOrThrow({
      where: { id: ofertaId },
      select: {
        condicion: true,
        precioCentimos: true,
        moneda: true,
        precioVisible: true,
        tienda: { select: { galeria: { select: { nombre: true } } } },
        producto: { select: { slug: true, titulo: true, textoBusqueda: true } },
      },
    });
    const filas = await this.prisma.$queryRaw<Array<{ id: string; usuario_id: string }>>`
      SELECT a.id::text, a.usuario_id::text
      FROM alerta_busqueda a
      JOIN usuario u ON u.id = a.usuario_id
      WHERE u.tienda_id IS DISTINCT FROM ${tiendaId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM unnest(string_to_array(a.palabras, ' ')) AS w(palabra)
          WHERE (' ' || ${oferta.producto.textoBusqueda}) NOT LIKE ('% ' || w.palabra || '%')
        )`;
    if (filas.length === 0) return;
    await this.prisma.alertaBusqueda.updateMany({
      where: { id: { in: filas.map((fila) => fila.id) } },
      data: { avisadaEn: new Date() },
    });
    const precio =
      oferta.precioVisible && oferta.precioCentimos !== null
        ? ` a ${formatearPrecio(precioDe(Number(oferta.precioCentimos), oferta.moneda))}`
        : '';
    await this.avisos.crear(
      filas.map((fila) => fila.usuario_id),
      {
        tipo: 'ALERTA',
        titulo: `Nueva ${oferta.producto.titulo}${precio}`,
        extracto: [
          'Tu alerta de búsqueda',
          oferta.tienda.galeria?.nombre,
          oferta.condicion === 'NUEVO' ? 'Nuevo' : 'Usado',
        ]
          .filter(Boolean)
          .join(' · '),
        enlace: `/p/${oferta.producto.slug}`,
        accion: { tipo: 'ABRIR', texto: 'Verla', enlace: `/p/${oferta.producto.slug}` },
      },
    );
  }

  /** «Publicar uno igual»: si el equipo unió el producto a otro, se publica en el que quedó (RF-54). */
  private async productoExistente(tx: Prisma.TransactionClient, id: string): Promise<string> {
    const producto = await tx.producto.findUnique({
      where: { id },
      select: { id: true, fusionadoEnId: true },
    });
    if (!producto) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Ese producto ya no está en PaseLibre. Búscalo de nuevo.',
      );
    }
    return producto.fusionadoEnId ?? producto.id;
  }

  private ofertaRepetida(
    condicion: 'NUEVO' | 'USADO',
    existente: { id: string; estado: string } | null,
  ): ApiHttpException {
    const pausada = existente?.estado === 'PAUSADA';
    return new ApiHttpException(
      HttpStatus.CONFLICT,
      'CONFLICTO',
      pausada
        ? `Tu tienda ya tiene este producto como ${CONDICION_TEXTO[condicion]}, pausado. Reactívalo desde Mis publicaciones.`
        : `Tu tienda ya publicó este producto como ${CONDICION_TEXTO[condicion]}. Cambia el stock o el precio desde Mis publicaciones.`,
      existente ? { oferta_id: existente.id } : undefined,
    );
  }

  /**
   * Producto nuevo (RF-05): queda en el catálogo al momento y marcado para que el equipo
   * revise si estaba repetido (RF-54). Su texto de búsqueda y sus palabras entran al
   * corrector igual que los de la semilla.
   */
  private async crearProducto(
    tx: Prisma.TransactionClient,
    datos: ProductoNuevoDatos,
    tiendaId: string,
  ): Promise<string> {
    const categoria = await tx.categoria.findUnique({ where: { slug: datos.categoria } });
    if (!categoria) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Elige una categoría de la lista.',
      );
    }
    const slugMarca = slugDe(datos.marca);
    if (!slugMarca) {
      throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Escribe la marca.');
    }
    const marca =
      (await tx.marca.findFirst({
        where: { OR: [{ nombre: datos.marca }, { slug: slugMarca }] },
      })) ?? (await tx.marca.create({ data: { nombre: datos.marca, slug: slugMarca } }));

    const titulo = tituloDeProducto(
      marca.nombre,
      [datos.modelo, datos.version].filter(Boolean).join(' '),
    );
    const slug = slugDe(titulo);
    // El mismo código de parte es el mismo producto, aunque lo hayan escrito distinto (COR15).
    const existente = await tx.producto.findFirst({
      where: datos.codigo_parte
        ? { OR: [{ slug }, { codigoParte: datos.codigo_parte }] }
        : { slug },
      select: {
        id: true,
        slug: true,
        titulo: true,
        fusionadoEn: { select: { id: true, slug: true, titulo: true } },
      },
    });
    if (existente) {
      const { fusionadoEn, ...propio } = existente;
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Ese producto ya está en PaseLibre: publica uno igual.',
        { producto: fusionadoEn ?? propio },
      );
    }

    const etiquetas = new Map<string, string>();
    for (const nombre of datos.etiquetas) {
      const clave = normalizarTexto(nombre);
      if (clave && !etiquetas.has(clave)) etiquetas.set(clave, nombre);
    }
    const textoBusqueda = normalizarTexto(
      [titulo, marca.nombre, datos.modelo, datos.codigo_parte ?? '', ...etiquetas.values()].join(
        ' ',
      ),
    );
    const fotos = await this.archivos.reclamar(tx, datos.fotos, tiendaId);

    const producto = await tx.producto.create({
      data: {
        categoriaId: categoria.id,
        marcaId: marca.id,
        titulo,
        modelo: datos.modelo,
        version: datos.version,
        codigoParte: datos.codigo_parte,
        slug,
        textoBusqueda,
        revisado: false,
        creadoPorTiendaId: tiendaId,
        fotos: {
          create: datos.fotos.map((ruta, orden) => ({ ruta, orden, ...fotos.get(ruta) })),
        },
      },
      select: { id: true },
    });
    for (const [clave, nombre] of etiquetas) {
      const etiqueta = await tx.etiqueta.upsert({
        where: { clave },
        update: {},
        create: { clave, nombre },
      });
      await tx.productoEtiqueta.create({
        data: { productoId: producto.id, etiquetaId: etiqueta.id },
      });
    }
    for (const palabra of new Set(textoBusqueda.split(' '))) {
      await tx.termino.upsert({
        where: { palabra },
        update: { veces: { increment: 1 } },
        create: { palabra, veces: 1 },
      });
    }
    return producto.id;
  }

  // ── Mis publicaciones ─────────────────────────────────────────────────────

  async misOfertas(
    consulta: MisOfertasConsulta,
    usuario: UsuarioConTienda,
  ): Promise<RespuestaMisOfertas> {
    const tienda = usuario.tienda;
    if (!tienda)
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');

    // El mismo buscador que la barra de arriba (doc 20 §11), con el corrector de letras
    // cambiadas, sobre las publicaciones de la tienda (sin mirar la pestaña).
    const busqueda =
      palabrasDe(consulta.q).length > 0
        ? await buscarConMotor(
            this.prisma,
            consulta.q,
            {},
            (i) => this.propiasQueCoinciden(tienda.id, i),
            (ids) => ids.length > 0,
          )
        : null;
    const where: Prisma.OfertaWhereInput = {
      AND: [
        { tiendaId: tienda.id, estado: { not: 'ELIMINADA' } },
        PESTANAS[consulta.estado],
        busqueda ? { id: { in: busqueda.resultado } } : {},
      ],
    };
    const desde = (consulta.pagina - 1) * POR_PAGINA;

    const [ofertas, total, [conteos], porRevisar, vistasSemana] = await Promise.all([
      busqueda?.intento.lo_mas_parecido
        ? this.paginaDeLoMasParecido(where, busqueda.resultado, desde)
        : this.prisma.oferta.findMany({
            where,
            // Por fecha de publicación: así una fila no salta al cambiarle el stock.
            orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
            skip: desde,
            take: POR_PAGINA,
            select: SELECT_OFERTA_PROPIA,
          }),
      this.prisma.oferta.count({ where }),
      this.prisma.$queryRaw<Array<Record<PestanaMisOfertas, number>>>`
        SELECT count(*) FILTER (WHERE estado = 'ACTIVA' AND stock > 0)::int AS activas,
               count(*) FILTER (WHERE estado = 'ACTIVA')::int AS vigentes,
               count(*) FILTER (WHERE estado = 'ACTIVA' AND stock = 0)::int AS sin_stock,
               count(*) FILTER (WHERE estado = 'PAUSADA')::int AS pausadas,
               count(*)::int AS todas
        FROM oferta
        WHERE tienda_id = ${tienda.id}::uuid AND estado <> 'ELIMINADA'`,
      this.prisma.oferta.count({
        where: { tiendaId: tienda.id, estado: 'ACTIVA', actualizadaEn: { lt: limiteRevision() } },
      }),
      this.prisma.vistaOferta.count({
        where: { oferta: { tiendaId: tienda.id, estado: 'ACTIVA' }, dia: { gte: haceUnaSemana() } },
      }),
    ]);

    return {
      tienda: tiendaDeSesion(tienda),
      conteos: conteos ?? { activas: 0, vigentes: 0, sin_stock: 0, pausadas: 0, todas: 0 },
      por_revisar: porRevisar,
      vistas_semana: vistasSemana,
      ofertas: await this.conImpulso(
        tienda.id,
        await this.conLaSemana(ofertas.map((o) => this.ofertaPropia(o))),
      ),
      pagina: consulta.pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      correccion: busqueda?.intento.correccion ?? null,
      lo_mas_parecido: busqueda?.intento.lo_mas_parecido ?? false,
    };
  }

  /**
   * Las publicaciones de la tienda (`o`, sin las eliminadas) que coinciden con un intento del
   * buscador. Con «Lo más parecido», de las que tienen más términos a las que tienen menos.
   */
  private async propiasQueCoinciden(tiendaId: string, intento: Intento): Promise<string[]> {
    const condiciones = [
      Prisma.sql`o.tienda_id = ${tiendaId}::uuid`,
      Prisma.sql`o.estado <> 'ELIMINADA'`,
      ...condicionesDeIntento(intento, { sobre: 'oferta' }),
    ];
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o.id::text AS id
      FROM oferta o
      JOIN producto p ON p.id = o.producto_id
      WHERE ${Prisma.join(condiciones, ' AND ')}
      ORDER BY ${ordenDeParecido(intento)}o.creada_en DESC, o.id`;
    return filas.map((f) => f.id);
  }

  /** Una página de «Lo más parecido»: en el orden de `ordenados`, solo las de la pestaña. */
  private async paginaDeLoMasParecido(
    where: Prisma.OfertaWhereInput,
    ordenados: string[],
    desde: number,
  ) {
    const enLaPestana = new Set(
      (await this.prisma.oferta.findMany({ where, select: { id: true } })).map((o) => o.id),
    );
    const ids = ordenados.filter((id) => enLaPestana.has(id)).slice(desde, desde + POR_PAGINA);
    const filas = await this.prisma.oferta.findMany({
      where: { id: { in: ids } },
      select: SELECT_OFERTA_PROPIA,
    });
    const porId = new Map(filas.map((fila) => [fila.id, fila]));
    return ids.flatMap((id) => porId.get(id) ?? []);
  }

  async una(id: string, tiendaId: string): Promise<OfertaPropia> {
    const oferta = await this.prisma.oferta.findFirst({
      where: { id, tiendaId, estado: { not: 'ELIMINADA' } },
      select: SELECT_OFERTA_PROPIA,
    });
    if (!oferta) throw noExiste();
    return this.ofertaPropia(oferta);
  }

  /**
   * Editar, cambiar stock o visibilidad, pausar y reactivar (RF-06, RF-08, RF-09). Todo
   * cambio cuenta como actualización (fecha visible y «Revísala»), salvo pausar.
   */
  async editar(id: string, cambios: EditarOfertaDatos, tiendaId: string): Promise<OfertaPropia> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await tx.oferta.findFirst({
          where: { id, tiendaId, estado: { not: 'ELIMINADA' } },
          select: {
            precioCentimos: true,
            precioVisible: true,
            fotos: { select: { ruta: true, ancho: true, alto: true } },
            portadaRuta: true,
            producto: { select: { categoria: { select: { slug: true } } } },
          },
        });
        if (!actual) throw noExiste();

        const precio = cambios.precio === undefined ? actual.precioCentimos : cambios.precio;
        let visible = cambios.precio_visible ?? actual.precioVisible;
        if (precio === null && visible) {
          if (cambios.precio_visible) {
            throw new ApiHttpException(
              HttpStatus.BAD_REQUEST,
              'DATOS_INVALIDOS',
              'Para mostrar el precio, escribe el monto.',
            );
          }
          // Se borró el monto de un precio visible: queda al interno.
          visible = false;
        }

        const data: Prisma.OfertaUpdateInput = {
          condicion: cambios.condicion,
          stock: cambios.stock,
          moneda: cambios.moneda,
          descripcion: cambios.descripcion,
          estado: cambios.estado,
          // La razón vale mientras dure la pausa: al reactivar se borra.
          ...(cambios.estado === 'ACTIVA'
            ? { razonPausa: null }
            : cambios.estado === 'PAUSADA'
              ? { razonPausa: cambios.razon_pausa ?? null }
              : {}),
          precioVisible: visible,
          tiendaVisible: cambios.tienda_visible,
          ...(cambios.precio === undefined
            ? {}
            : { precioCentimos: cambios.precio === null ? null : BigInt(cambios.precio) }),
          ...sinLoQueNoPregunta(actual.producto.categoria.slug, columnasDeDetalle(cambios)),
        };
        // «Bajó de precio · Antes US$ 465» (SEG_Web): se guarda el de antes; si sube, se borra.
        if (cambios.precio !== undefined && actual.precioCentimos !== null) {
          const nuevo = cambios.precio === null ? null : BigInt(cambios.precio);
          if (nuevo !== null && nuevo < actual.precioCentimos) {
            data.precioAnteriorCentimos = actual.precioCentimos;
            data.precioBajoEn = new Date();
          } else if (nuevo === null || nuevo > actual.precioCentimos) {
            data.precioAnteriorCentimos = null;
            data.precioBajoEn = null;
          }
        }
        // «¿Quién ve el precio? Todas» sin monto no se puede: queda por chat.
        if (data.precioVisible === true && precio === null) data.precioVisible = false;
        const soloPausa =
          cambios.estado === 'PAUSADA' &&
          Object.keys(cambios).every((clave) => clave === 'estado' || clave === 'razon_pausa');
        if (!soloPausa) data.actualizadaEn = new Date();

        // La portada es una de las fotos que quedan; si se quitó la que era portada, vuelve a la
        // de siempre (docs/17 §5).
        const quedan = cambios.fotos ?? actual.fotos.map((foto) => foto.ruta);
        if (cambios.portada !== undefined) {
          data.portadaRuta = portadaEntre(cambios.portada, quedan);
        } else if (actual.portadaRuta && !quedan.includes(actual.portadaRuta)) {
          data.portadaRuta = null;
        }

        if (cambios.fotos) {
          const existentes = new Map(actual.fotos.map((f) => [f.ruta, f]));
          const nuevas = await this.archivos.reclamar(
            tx,
            cambios.fotos.filter((ruta) => !existentes.has(ruta)),
            tiendaId,
          );
          await tx.ofertaFoto.deleteMany({ where: { ofertaId: id } });
          await tx.ofertaFoto.createMany({
            data: cambios.fotos.map((ruta, orden) => {
              const medidas = existentes.get(ruta) ?? nuevas.get(ruta);
              return { ofertaId: id, ruta, orden, ancho: medidas?.ancho, alto: medidas?.alto };
            }),
          });
        }

        const oferta = await tx.oferta.update({
          where: { id },
          data,
          select: SELECT_OFERTA_PROPIA,
        });
        return this.ofertaPropia(oferta);
      });
    } catch (error) {
      if (esUnicoRepetido(error, 'oferta_vigente_key') && cambios.condicion) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          `Tu tienda ya tiene otra publicación de este producto como ${CONDICION_TEXTO[cambios.condicion]}.`,
        );
      }
      throw error;
    }
  }

  /**
   * Eliminar es lógico: la oferta sale del catálogo y de Mis publicaciones, pero sus
   * conversaciones y ventas se conservan (docs/05 §4.2).
   */
  async eliminar(id: string, tiendaId: string): Promise<void> {
    const { count } = await this.prisma.oferta.updateMany({
      where: { id, tiendaId, estado: { not: 'ELIMINADA' } },
      data: { estado: 'ELIMINADA', vigente: null },
    });
    if (count === 0) throw noExiste();
  }

  /**
   * «Eliminar varias» desde el perfil (docs/19 §12), lógico como `eliminar`. Todas tienen que ser
   * de la tienda: con una ajena (o que no existe) no se borra ninguna. Las que ya estaban
   * eliminadas no cuentan, para que un «Deshacer» que llega dos veces no falle.
   */
  async eliminarVarias(
    { ids }: EliminarOfertasDatos,
    tiendaId: string,
  ): Promise<RespuestaEliminarOfertas> {
    return this.prisma.$transaction(async (tx) => {
      const propias = await tx.oferta.count({ where: { id: { in: ids }, tiendaId } });
      if (propias !== ids.length) throw noExiste();
      const { count } = await tx.oferta.updateMany({
        where: { id: { in: ids }, tiendaId, estado: { not: 'ELIMINADA' } },
        data: { estado: 'ELIMINADA', vigente: null },
      });
      return { eliminadas: count };
    });
  }

  /** «Siguen igual» (RF-10). */
  async confirmar({ ids }: ConfirmarOfertas, tiendaId: string): Promise<RespuestaConfirmar> {
    const { count } = await this.prisma.oferta.updateMany({
      where: {
        tiendaId,
        estado: 'ACTIVA',
        actualizadaEn: { lt: limiteRevision() },
        ...(ids ? { id: { in: ids } } : {}),
      },
      data: { actualizadaEn: new Date() },
    });
    return { confirmadas: count };
  }

  /**
   * «48 vistas · 5 chats esta semana» (MP_Web): tiendas que la vieron en la ficha y contactos
   * por chat o WhatsApp de los últimos 7 días.
   */
  private async conLaSemana(ofertas: OfertaPropia[]): Promise<OfertaPropia[]> {
    if (ofertas.length === 0) return ofertas;
    const ids = ofertas.map((oferta) => oferta.id);
    const [chats, vistas] = await Promise.all([
      this.prisma.contacto.groupBy({
        by: ['ofertaId'],
        where: { ofertaId: { in: ids }, creadoEn: { gte: new Date(Date.now() - 7 * 86_400_000) } },
        _count: { _all: true },
      }),
      this.prisma.vistaOferta.groupBy({
        by: ['ofertaId'],
        where: { ofertaId: { in: ids }, dia: { gte: haceUnaSemana() } },
        _count: { _all: true },
      }),
    ]);
    const deChats = new Map(chats.map((fila) => [fila.ofertaId, fila._count._all]));
    const deVistas = new Map(vistas.map((fila) => [fila.ofertaId, fila._count._all]));
    return ofertas.map((oferta) => ({
      ...oferta,
      chats_semana: deChats.get(oferta.id) ?? 0,
      vistas_semana: deVistas.get(oferta.id) ?? 0,
    }));
  }

  /** «Impulsada por el equipo» (COR16): solo la tienda ve que la destacaron. */
  private async conImpulso(tiendaId: string, ofertas: OfertaPropia[]): Promise<OfertaPropia[]> {
    const destacado = await this.prisma.destacado.findFirst({
      where: { tiendaId, hasta: { gt: new Date() }, quitadoEn: null },
      orderBy: { hasta: 'desc' },
      select: { hasta: true, ofertas: true },
    });
    if (!destacado) return ofertas;
    const elegidas = new Set(destacado.ofertas);
    return ofertas.map((oferta) =>
      oferta.estado === 'ACTIVA' && (elegidas.size === 0 || elegidas.has(oferta.id))
        ? { ...oferta, impulsada_hasta: destacado.hasta.toISOString() }
        : oferta,
    );
  }

  private ofertaPropia(o: OfertaPropiaFila): OfertaPropia {
    return {
      id: o.id,
      producto: productoResumen(o.producto),
      condicion: o.condicion,
      stock: o.stock,
      precio: o.precioCentimos === null ? null : precioDe(Number(o.precioCentimos), o.moneda),
      moneda: o.moneda,
      precio_visible: o.precioVisible,
      tienda_visible: o.tiendaVisible,
      detalle: detalleDe(o),
      modo_venta: o.modoVenta,
      precio_facturado:
        o.precioFacturadoCentimos === null
          ? null
          : precioDe(Number(o.precioFacturadoCentimos), o.moneda),
      descuento_socio:
        o.descuentoSocioCentimos === null
          ? null
          : precioDe(Number(o.descuentoSocioCentimos), o.moneda),
      quien_ve_precio: o.precioVisible ? 'TODOS' : o.soloSocios ? 'SOCIOS' : 'NADIE',
      acepta_ofertas: o.aceptaOfertas,
      negociable: o.negociable,
      chats_semana: 0,
      vistas_semana: 0,
      razon_pausa: o.estado === 'PAUSADA' ? o.razonPausa : null,
      descripcion: o.descripcion,
      fotos: o.fotos,
      portada: o.portadaRuta,
      estado: o.estado === 'PAUSADA' ? 'PAUSADA' : 'ACTIVA',
      actualizada_en: o.actualizadaEn.toISOString(),
      revisar: o.estado === 'ACTIVA' && o.actualizadaEn < limiteRevision(),
      responsable: o.responsable,
    };
  }
}
