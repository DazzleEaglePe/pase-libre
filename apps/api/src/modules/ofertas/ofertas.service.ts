import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  normalizarTexto,
  precioDe,
  slugDe,
  tituloDeProducto,
  type ConfirmarOfertas,
  type EditarOfertaDatos,
  type MisOfertasConsulta,
  type OfertaPropia,
  type PestanaMisOfertas,
  type ProductoNuevoDatos,
  type ProductoResumen,
  type PublicarDatos,
  type RespuestaConfirmar,
  type RespuestaMisOfertas,
  type RespuestaPublicar,
  type RespuestaSugerencias,
  type SugerenciaProducto,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import { BusquedaService } from '../catalogo/busqueda.service';
import { tiendaDeSesion } from '../sesion/sesion.service';
import type { UsuarioConTienda } from '../sesion/sesion.types';

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
  fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
} satisfies Prisma.ProductoSelect;

const SELECT_OFERTA_PROPIA = {
  id: true,
  condicion: true,
  stock: true,
  precioCentimos: true,
  moneda: true,
  precioVisible: true,
  descripcion: true,
  estado: true,
  actualizadaEn: true,
  fotos: { select: { ruta: true, ancho: true, alto: true }, orderBy: { orden: 'asc' } },
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
  sin_stock: { estado: 'ACTIVA', stock: 0 },
  pausadas: { estado: 'PAUSADA' },
  todas: {},
};

const CONDICION_TEXTO = { NUEVO: 'nuevo', USADO: 'usado' } as const;

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
 * Publicar y Mis publicaciones (RF-05 a RF-10, RF-51 a RF-53). Todo se hace sobre la
 * tienda de la sesión: el dueño y sus asesores ven y cambian las mismas ofertas, y quien
 * publica queda como responsable de los mensajes de esa oferta (A-11).
 */
@Injectable()
export class OfertasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BusquedaService) private readonly busqueda: BusquedaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
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
        productos: await this.resumenes([producto.fusionadoEnId ?? producto.id], tiendaId),
      };
    }

    const palabras = this.busqueda.palabras(consulta.q);
    if (palabras.length === 0) return { correccion: null, productos: [] };
    let ids = await this.idsQueCoinciden(palabras);
    let correccion: RespuestaSugerencias['correccion'] = null;
    if (ids.length === 0) {
      const corregidas = await this.busqueda.corregir(palabras);
      if (corregidas.join(' ') !== palabras.join(' ')) {
        ids = await this.idsQueCoinciden(corregidas);
        if (ids.length > 0) correccion = { buscaste: consulta.q, mostramos: corregidas.join(' ') };
      }
    }
    return { correccion, productos: await this.resumenes(ids, tiendaId) };
  }

  private async idsQueCoinciden(palabras: string[]): Promise<string[]> {
    const condiciones = palabras.map(
      (palabra) => Prisma.sql`(' ' || p.texto_busqueda) LIKE ${`% ${palabra}%`}`,
    );
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT p.id::text AS id
      FROM producto p
      WHERE p.fusionado_en_id IS NULL AND ${Prisma.join(condiciones, ' AND ')}
      ORDER BY (
          SELECT count(*) FROM oferta o JOIN tienda t ON t.id = o.tienda_id
          WHERE o.producto_id = p.id AND o.estado = 'ACTIVA' AND t.estado = 'ACTIVA'
        ) DESC,
        similarity(p.texto_busqueda, ${palabras.join(' ')}) DESC,
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
      return await this.prisma.$transaction(async (tx) => {
        const productoNuevo = Boolean(datos.producto_nuevo);
        const productoId = datos.producto_nuevo
          ? await this.crearProducto(tx, datos.producto_nuevo, tienda.id)
          : await this.productoExistente(tx, datos.producto_id ?? '');

        const repetida = await tx.oferta.findFirst({
          where: { productoId, tiendaId: tienda.id, condicion: datos.condicion, vigente: true },
          select: { id: true, estado: true },
        });
        if (repetida) throw this.ofertaRepetida(datos.condicion, repetida);

        const fotos = await this.archivos.reclamar(tx, datos.fotos, tienda.id);
        const oferta = await tx.oferta.create({
          data: {
            productoId,
            tiendaId: tienda.id,
            responsableId: usuario.id,
            condicion: datos.condicion,
            stock: datos.stock,
            precioCentimos: datos.precio === null ? null : BigInt(datos.precio),
            moneda: datos.moneda ?? tienda.monedaDefecto,
            // Sin monto no hay precio que mostrar; si no se eligió, manda la tienda (D-37).
            precioVisible:
              datos.precio !== null && (datos.precio_visible ?? tienda.precioVisibleDefecto),
            descripcion: datos.descripcion,
            fotos: {
              create: datos.fotos.map((ruta, orden) => ({ ruta, orden, ...fotos.get(ruta) })),
            },
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
    } catch (error) {
      if (esUnicoRepetido(error, 'oferta_vigente_key')) {
        throw this.ofertaRepetida(datos.condicion, null);
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
    condicion: PublicarDatos['condicion'],
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

    const titulo = tituloDeProducto(marca.nombre, datos.modelo);
    const slug = slugDe(titulo);
    const existente = await tx.producto.findUnique({
      where: { slug },
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
      [titulo, marca.nombre, datos.modelo, ...etiquetas.values()].join(' '),
    );
    const fotos = await this.archivos.reclamar(tx, datos.fotos, tiendaId);

    const producto = await tx.producto.create({
      data: {
        categoriaId: categoria.id,
        marcaId: marca.id,
        titulo,
        modelo: datos.modelo,
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

    const palabras = normalizarTexto(consulta.q).split(' ').filter(Boolean);
    const where: Prisma.OfertaWhereInput = {
      AND: [
        { tiendaId: tienda.id, estado: { not: 'ELIMINADA' } },
        PESTANAS[consulta.estado],
        palabras.length > 0
          ? { producto: { AND: palabras.map((p) => ({ textoBusqueda: { contains: p } })) } }
          : {},
      ],
    };

    const [ofertas, total, [conteos], porRevisar] = await Promise.all([
      this.prisma.oferta.findMany({
        where,
        // Por fecha de publicación: así una fila no salta al cambiarle el stock.
        orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
        skip: (consulta.pagina - 1) * POR_PAGINA,
        take: POR_PAGINA,
        select: SELECT_OFERTA_PROPIA,
      }),
      this.prisma.oferta.count({ where }),
      this.prisma.$queryRaw<Array<Record<PestanaMisOfertas, number>>>`
        SELECT count(*) FILTER (WHERE estado = 'ACTIVA' AND stock > 0)::int AS activas,
               count(*) FILTER (WHERE estado = 'ACTIVA' AND stock = 0)::int AS sin_stock,
               count(*) FILTER (WHERE estado = 'PAUSADA')::int AS pausadas,
               count(*)::int AS todas
        FROM oferta
        WHERE tienda_id = ${tienda.id}::uuid AND estado <> 'ELIMINADA'`,
      this.prisma.oferta.count({
        where: { tiendaId: tienda.id, estado: 'ACTIVA', actualizadaEn: { lt: limiteRevision() } },
      }),
    ]);

    return {
      tienda: tiendaDeSesion(tienda),
      conteos: conteos ?? { activas: 0, sin_stock: 0, pausadas: 0, todas: 0 },
      por_revisar: porRevisar,
      ofertas: ofertas.map((o) => this.ofertaPropia(o)),
      pagina: consulta.pagina,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    };
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
          precioVisible: visible,
          ...(cambios.precio === undefined
            ? {}
            : { precioCentimos: cambios.precio === null ? null : BigInt(cambios.precio) }),
        };
        const soloPausa = cambios.estado === 'PAUSADA' && Object.keys(cambios).length === 1;
        if (!soloPausa) data.actualizadaEn = new Date();

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

  private ofertaPropia(o: OfertaPropiaFila): OfertaPropia {
    return {
      id: o.id,
      producto: productoResumen(o.producto),
      condicion: o.condicion,
      stock: o.stock,
      precio: o.precioCentimos === null ? null : precioDe(Number(o.precioCentimos), o.moneda),
      moneda: o.moneda,
      precio_visible: o.precioVisible,
      descripcion: o.descripcion,
      fotos: o.fotos,
      estado: o.estado === 'PAUSADA' ? 'PAUSADA' : 'ACTIVA',
      actualizada_en: o.actualizadaEn.toISOString(),
      revisar: o.estado === 'ACTIVA' && o.actualizadaEn < limiteRevision(),
      responsable: o.responsable,
    };
  }
}
