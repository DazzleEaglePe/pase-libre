import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  CategoriaResumen,
  DetalleOferta,
  Foto,
  GaleriaResumen,
  OfertaConVendedor,
  OfertaPublica,
  PortadaConsulta,
  ProductoDetalle,
  RespuestaFicha,
  RespuestaInicio,
  RespuestaMapaDelSitio,
  RespuestaPortada,
  RespuestaRedireccion,
  TarjetaOferta,
  TarjetaOfertaConVendedor,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { destacadasAhora, mezclarDestacadas } from '../../shared/destacados';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { MemoriaPorClave, recordarPor } from '../../shared/memoria';
import { portadaDe } from '../../shared/portada';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { tiendasBloqueadasPor } from '../../shared/bloqueadas';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { conSesion, preciosPara, tiendaPara } from './visibilidad';

/** El día en Lima, «2026-11-10». */
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/** Una oferta se muestra si está activa, su tienda no está suspendida y su producto no se unió a otro. */
export const OFERTA_VIGENTE = {
  estado: 'ACTIVA',
  tienda: { estado: 'ACTIVA' },
  producto: { fusionadoEnId: null },
} satisfies Prisma.OfertaWhereInput;

const FOTOS = {
  select: { ruta: true, ancho: true, alto: true },
  orderBy: { orden: 'asc' },
} as const;

/**
 * Lo único que se pide de una oferta para un visitante: sin precio ni tienda. Sus fotos (y la
 * portada, que es una de ellas) ya se veían en la ficha pública: no dicen el precio ni la tienda.
 */
export const SELECT_OFERTA_PUBLICA = {
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
  stock: true,
  descripcion: true,
  actualizadaEn: true,
  fotos: FOTOS,
  portadaRuta: true,
  tienda: { select: { tipo: true, galeria: { select: { nombre: true } } } },
} satisfies Prisma.OfertaSelect;

export const SELECT_OFERTA_CON_VENDEDOR = {
  ...SELECT_OFERTA_PUBLICA,
  tiendaId: true,
  precioCentimos: true,
  precioFacturadoCentimos: true,
  descuentoSocioCentimos: true,
  modoVenta: true,
  soloSocios: true,
  aceptaOfertas: true,
  negociable: true,
  moneda: true,
  precioVisible: true,
  tiendaVisible: true,
  tienda: {
    select: {
      id: true,
      nombre: true,
      stand: true,
      logo: true,
      tipo: true,
      galeria: { select: { nombre: true } },
    },
  },
} satisfies Prisma.OfertaSelect;

export const PRODUCTO_TARJETA = {
  select: {
    slug: true,
    titulo: true,
    categoria: { select: { slug: true, nombre: true } },
    fotos: { ...FOTOS, take: 1 },
  },
} as const;

type OfertaPublicaFila = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA_PUBLICA }>;
type TarjetaConVendedorFila = Prisma.OfertaGetPayload<{
  select: typeof SELECT_OFERTA_CON_VENDEDOR & { producto: typeof PRODUCTO_TARJETA };
}>;

/**
 * Las tarjetas de la portada, del inicio y de «De tiendas que sigues», con precio y tienda. Con
 * `socios` (las tiendas que tienen a quien mira como socia), el precio sale como lo ve una socia
 * y la burbujita dice «Socio» (N06).
 */
export function tarjetaConVendedor(
  o: TarjetaConVendedorFila,
  mirada: Mirada,
  socios: ReadonlySet<string> = new Set(),
): TarjetaOfertaConVendedor {
  const precios = preciosPara(o, mirada, socios);
  // «Socio»: el precio que ves es el de socia (con descuento o de «Solo mis socios»).
  const deSocio =
    precios.precio !== null &&
    (precios.socio || (o.soloSocios && !o.precioVisible && socios.has(o.tiendaId)));
  return {
    oferta_id: o.id,
    producto: {
      slug: o.producto.slug,
      titulo: o.producto.titulo,
      categoria: o.producto.categoria,
      foto: portadaDe(o),
    },
    condicion: o.condicion,
    stock: o.stock,
    galeria: o.tienda.galeria?.nombre ?? null,
    actualizada_en: o.actualizadaEn.toISOString(),
    tienda: (({ nombre, stand }) => ({ nombre, stand }))(tiendaPara(o, o.tienda, mirada)),
    tienda_visible: o.tiendaVisible,
    precio: precios.precio,
    precio_visible: o.precioVisible,
    propia: o.tiendaId === mirada.tiendaId,
    precio_socio: deSocio,
    negociable: o.negociable && precios.precio !== null,
  };
}

/**
 * «2 filas de 6 mezcladas por tienda» (FI_WebNormal): de lo más reciente, una de cada tienda
 * por vuelta, para que una tienda que sube 20 de golpe no tape a las demás.
 */
export function mezclarPorTienda<T extends { tiendaId: string }>(lista: T[], cuantas: number): T[] {
  const porTienda = new Map<string, T[]>();
  for (const item of lista)
    porTienda.set(item.tiendaId, [...(porTienda.get(item.tiendaId) ?? []), item]);
  const colas = [...porTienda.values()];
  const mezcla: T[] = [];
  for (let vuelta = 0; mezcla.length < cuantas; vuelta++) {
    const deEstaVuelta = colas.map((cola) => cola[vuelta]).filter((item) => item !== undefined);
    if (deEstaVuelta.length === 0) break;
    mezcla.push(...deEstaVuelta);
  }
  return mezcla.slice(0, cuantas);
}
type OfertaConVendedorFila = Prisma.OfertaGetPayload<{ select: typeof SELECT_OFERTA_CON_VENDEDOR }>;

/**
 * Cuántas ofertas trae «Recién publicado» en la portada. La web las muestra en una fila que
 * se desliza (4 por página en computadora): 16 son 4 páginas, y la tarjeta «Ver todos» cierra la fila.
 */
export const PORTADA_RECIENTES = 16;

/** Pseudo-galería para quienes venden sin galería. */
export const INDEPENDIENTES = { slug: 'independientes', nombre: 'Independientes' } as const;

/** Lo único que puede tener la dirección de un producto (`slugDe` solo deja letras, números y guiones). */
const SLUG_VALIDO = /^[a-z0-9-]{1,300}$/;

function aFoto(foto: { ruta: string; ancho: number | null; alto: number | null }): Foto {
  return { ruta: foto.ruta, ancho: foto.ancho, alto: foto.alto };
}

/** El detalle de una oferta; lo publicado antes del lienzo final no tiene estado propio. */
export function detalleDe(o: {
  condicion: 'NUEVO' | 'USADO';
  estadoDetalle: DetalleOferta['estado'] | null;
  conCaja: boolean;
  conFactura: boolean;
  probado: boolean;
  garantia: DetalleOferta['garantia'];
  estadoOtro: string | null;
  garantiaOtra: string | null;
  enAlmacen: boolean;
}): DetalleOferta {
  return {
    estado: o.estadoDetalle ?? (o.condicion === 'NUEVO' ? 'SELLADO' : 'USADO'),
    con_caja: o.conCaja,
    con_factura: o.conFactura,
    probado: o.probado,
    garantia: o.garantia,
    estado_otro: o.estadoDetalle === 'OTRO' ? o.estadoOtro : null,
    garantia_otra: o.garantia === 'OTRA' ? o.garantiaOtra : null,
    en_almacen: o.enAlmacen,
  };
}

function ofertaPublica(o: OfertaPublicaFila): OfertaPublica {
  return {
    id: o.id,
    condicion: o.condicion,
    detalle: detalleDe(o),
    stock: o.stock,
    galeria: o.tienda.galeria?.nombre ?? null,
    tipo_vendedor: o.tienda.tipo,
    descripcion: o.descripcion,
    fotos: o.fotos.map(aFoto),
    actualizada_en: o.actualizadaEn.toISOString(),
  };
}

function ofertaConVendedor(
  o: OfertaConVendedorFila,
  mirada: Mirada,
  respondeEn: Map<string, number> = new Map(),
  socios: ReadonlySet<string> = new Set(),
): OfertaConVendedor {
  const tienda = tiendaPara(o, o.tienda, mirada);
  const precios = preciosPara(o, mirada, socios);
  return {
    ...ofertaPublica(o),
    tienda,
    tienda_visible: o.tiendaVisible,
    // Con la tienda reservada tampoco: sería una pista de quién es.
    responde_en_min: tienda.id ? (respondeEn.get(o.tiendaId) ?? null) : null,
    precio: precios.precio,
    precio_visible: o.precioVisible,
    propia: o.tiendaId === mirada.tiendaId,
    modo_venta: o.modoVenta,
    precio_facturado: precios.facturado,
    precio_socio: precios.socio,
    descuento_socio: precios.descuento,
    solo_socios: o.soloSocios,
    acepta_ofertas: o.aceptaOfertas,
    negociable: o.negociable,
  };
}

/**
 * Orden de la ficha con sesión (RF-52): primero los precios visibles en dólares de menor
 * a mayor, luego los visibles en soles, y al final las ofertas al interno. Se ordena por
 * lo que ve cualquier vendedor, aunque la tienda dueña vea su propio precio oculto.
 */
function compararPorPrecio(a: OfertaConVendedorFila, b: OfertaConVendedorFila): number {
  const grupo = (o: OfertaConVendedorFila) =>
    !o.precioVisible || o.precioCentimos === null ? 2 : o.moneda === 'USD' ? 0 : 1;
  const diferencia = grupo(a) - grupo(b);
  if (diferencia !== 0) return diferencia;
  if (grupo(a) === 2) return b.actualizadaEn.getTime() - a.actualizadaEn.getTime();
  return Number((a.precioCentimos ?? 0n) - (b.precioCentimos ?? 0n));
}

@Injectable()
export class CatalogoService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Categorías, galerías y totales cambian poco y los pide cada página (la barra, la portada):
   * un minuto en memoria. «Responde en ~N min» se guarda 15 minutos por tienda.
   */
  private readonly categoriasEnMemoria = recordarPor(60_000, () => this.cargarCategorias());
  private readonly galeriasEnMemoria = recordarPor(60_000, () => this.cargarGalerias());
  private readonly totalesEnMemoria = recordarPor(60_000, () => this.cargarTotales());
  private readonly recienHoyEnMemoria = recordarPor(60_000, () => this.cargarRecienHoy());
  private readonly respondeEnMemoria = new MemoriaPorClave<number | null>(15 * 60_000);
  /**
   * «Recién publicado» del visitante, 30 s por galería (docs/16 §4.4), como la búsqueda: es lo
   * mismo para todos los visitantes y, con miles de ofertas de la misma hora, ordenarlas en cada
   * pedido llenaba el pool. Una sola consulta en curso por galería. Con sesión nunca se guarda:
   * depende de quién mira (bloqueos, destacadas, socios).
   */
  private readonly recienDeVisitantes = new MemoriaPorClave<TarjetaOferta[]>(30_000, 100);

  categorias(): Promise<CategoriaResumen[]> {
    return this.categoriasEnMemoria();
  }

  galerias(): Promise<GaleriaResumen[]> {
    return this.galeriasEnMemoria();
  }

  private async cargarCategorias(): Promise<CategoriaResumen[]> {
    return this.prisma.$queryRaw<CategoriaResumen[]>`
      SELECT c.slug::text AS slug, c.nombre, c.grupo, count(DISTINCT p.id)::int AS productos
      FROM categoria c
      LEFT JOIN producto p ON p.categoria_id = c.id AND p.fusionado_en_id IS NULL
        AND EXISTS (
          SELECT 1 FROM oferta o JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
          WHERE o.producto_id = p.id AND o.estado = 'ACTIVA'
        )
      WHERE c.padre_id IS NULL
      GROUP BY c.id
      ORDER BY c.orden, c.nombre`;
  }

  /**
   * Mapa del sitio (RNF-42): cada producto con una oferta vigente, con la fecha de la más
   * reciente. Un sitemap admite hasta 50 000 direcciones.
   */
  async mapaDelSitio(): Promise<RespuestaMapaDelSitio> {
    const filas = await this.prisma.$queryRaw<Array<{ slug: string; actualizado_en: Date }>>`
      SELECT p.slug::text AS slug, max(o.actualizada_en) AS actualizado_en
      FROM producto p
      JOIN oferta o ON o.producto_id = p.id AND o.estado = 'ACTIVA'
      JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      WHERE p.fusionado_en_id IS NULL
      GROUP BY p.id
      ORDER BY max(o.actualizada_en) DESC
      LIMIT 50000`;
    return {
      productos: filas.map((f) => ({
        slug: f.slug,
        actualizado_en: f.actualizado_en.toISOString(),
      })),
    };
  }

  private async cargarGalerias(): Promise<GaleriaResumen[]> {
    const filas = await this.prisma.$queryRaw<
      Array<{ slug: string | null; nombre: string | null; ofertas: number }>
    >`
      SELECT g.slug::text AS slug, g.nombre, count(o.id)::int AS ofertas
      FROM tienda t
      LEFT JOIN galeria g ON g.id = t.galeria_id
      JOIN oferta o ON o.tienda_id = t.id AND o.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE t.estado = 'ACTIVA' AND (g.id IS NULL OR g.activa)
      GROUP BY g.slug, g.nombre, g.orden
      ORDER BY g.orden NULLS LAST, g.nombre`;
    // En el orden de Equipo › Galerías (docs/18 §3); las ocultas no salen.
    const activas = await this.prisma.galeria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    const cuenta = new Map(filas.map((f) => [f.slug ?? INDEPENDIENTES.slug, f.ofertas]));
    return [
      ...activas.map((g) => ({ slug: g.slug, nombre: g.nombre, ofertas: cuenta.get(g.slug) ?? 0 })),
      { ...INDEPENDIENTES, ofertas: cuenta.get(INDEPENDIENTES.slug) ?? 0 },
    ];
  }

  /** Portada (RF-44, RF-15, RF-17): recién publicado, categorías, galerías y totales. */
  async portada(consulta: PortadaConsulta, mirada: Mirada): Promise<RespuestaPortada> {
    const filtroGaleria: Prisma.OfertaWhereInput = !consulta.galeria
      ? {}
      : consulta.galeria === INDEPENDIENTES.slug
        ? { tienda: { estado: 'ACTIVA', galeriaId: null } }
        : { tienda: { estado: 'ACTIVA', galeria: { slug: consulta.galeria } } };
    // «Recién publicado» muestra lo que se puede pasar hoy: sin las que quedaron en 0.
    const where: Prisma.OfertaWhereInput = {
      AND: [OFERTA_VIGENTE, filtroGaleria, { stock: { gt: 0 } }],
    };
    const orderBy = [
      { actualizadaEn: 'desc' },
      { creadaEn: 'desc' },
    ] satisfies Prisma.OfertaOrderByWithRelationInput[];

    const [categorias, galerias, totales] = await Promise.all([
      this.categorias(),
      this.galerias(),
      this.totalesEnMemoria(),
    ]);
    const base = { categorias, galerias, totales };

    if (!conSesion(mirada)) {
      const recienPublicado = await this.recienDeVisitantes.recordar(consulta.galeria ?? '', () =>
        this.recienParaVisitantes(where, orderBy),
      );
      return { ...base, audiencia: 'visitante', recien_publicado: recienPublicado };
    }

    const [bloqueadas, destacadas, socios] = await Promise.all([
      tiendasBloqueadasPor(this.prisma, mirada.usuarioId),
      destacadasAhora(this.prisma),
      tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId),
    ]);
    const sinBloqueadas: Prisma.OfertaWhereInput =
      bloqueadas.length > 0 ? { AND: [where, { tiendaId: { notIn: bloqueadas } }] } : where;
    const candidatas = await this.prisma.oferta.findMany({
      where: sinBloqueadas,
      orderBy,
      take: PORTADA_RECIENTES * 3,
      select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
    });
    // «Destacar en silencio» (COR16): mezcladas entre los 4 primeros, sin etiqueta.
    const hayDestacadas = destacadas.tiendas.size > 0 || destacadas.ofertas.size > 0;
    const impulsadas = hayDestacadas
      ? await this.prisma.oferta.findMany({
          where: {
            AND: [
              sinBloqueadas,
              {
                OR: [
                  { tiendaId: { in: [...destacadas.tiendas] } },
                  { id: { in: [...destacadas.ofertas] } },
                ],
              },
            ],
          },
          orderBy,
          take: 4,
          select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
        })
      : [];
    const vistas = new Set(impulsadas.map((o) => o.id));
    const mezcladas = mezclarDestacadas(
      [
        ...impulsadas,
        ...mezclarPorTienda(
          candidatas.filter((o) => !vistas.has(o.id)),
          PORTADA_RECIENTES,
        ),
      ],
      (o) => vistas.has(o.id),
    ).slice(0, PORTADA_RECIENTES);
    return {
      ...base,
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      recien_publicado: mezcladas.map((o) => tarjetaConVendedor(o, mirada, socios)),
    };
  }

  /**
   * Las 16 recién publicadas que ve un visitante: sin precio ni tienda, mezcladas por tienda, con
   * la portada de cada oferta (docs/17 §5; sus fotos ya se ven en la ficha pública).
   */
  private async recienParaVisitantes(
    where: Prisma.OfertaWhereInput,
    orderBy: Prisma.OfertaOrderByWithRelationInput[],
  ): Promise<TarjetaOferta[]> {
    const candidatas = await this.prisma.oferta.findMany({
      where,
      orderBy,
      take: PORTADA_RECIENTES * 3,
      select: { ...SELECT_OFERTA_PUBLICA, tiendaId: true, producto: PRODUCTO_TARJETA },
    });
    const ofertas = mezclarPorTienda(candidatas, PORTADA_RECIENTES);
    return ofertas.map((o) => ({
      oferta_id: o.id,
      producto: {
        slug: o.producto.slug,
        titulo: o.producto.titulo,
        categoria: o.producto.categoria,
        foto: portadaDe(o),
      },
      condicion: o.condicion,
      stock: o.stock,
      galeria: o.tienda.galeria?.nombre ?? null,
      actualizada_en: o.actualizadaEn.toISOString(),
    }));
  }

  /** «De tiendas que sigues» (SG_WebFeed): lo último con stock de las tiendas que sigues. */
  async deSeguidas(mirada: Mirada): Promise<RespuestaInicio['de_seguidas']> {
    if (!mirada.tiendaId) return { tiendas: [], ofertas: [] };
    const seguidas = await this.prisma.seguimiento.findMany({
      where: { tiendaId: mirada.tiendaId },
      select: { seguidaId: true },
    });
    if (seguidas.length === 0) return { tiendas: [], ofertas: [] };
    const filas = await this.prisma.oferta.findMany({
      where: {
        AND: [
          OFERTA_VIGENTE,
          { stock: { gt: 0 } },
          // Las reservadas no se delatan: quien sigue a una tienda no ve que esa es suya.
          { tiendaVisible: true },
          { tiendaId: { in: seguidas.map((s) => s.seguidaId) } },
        ],
      },
      orderBy: [{ actualizadaEn: 'desc' }, { creadaEn: 'desc' }],
      take: 4,
      select: { ...SELECT_OFERTA_CON_VENDEDOR, producto: PRODUCTO_TARJETA },
    });
    const socios = await tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId);
    return {
      tiendas: [...new Set(filas.map((o) => o.tienda.nombre))],
      ofertas: filas.map((o) => tarjetaConVendedor(o, mirada, socios)),
    };
  }

  /**
   * Ficha (RF-19, RF-52). Si el producto se unió a otro (RF-54), devuelve a dónde ir
   * y el controlador responde 301. Un producto sin ofertas vigentes sigue existiendo:
   * la ficha muestra la lista vacía.
   */
  async ficha(slug: string, mirada: Mirada): Promise<RespuestaFicha | RespuestaRedireccion> {
    // Un slug solo tiene letras, números y guiones (`slugDe`): lo demás no puede existir, y
    // algunos caracteres (como el nulo de `%00`) harían fallar la consulta con un 500.
    if (!SLUG_VALIDO.test(slug)) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Este producto no existe en PaseLibre.',
      );
    }
    const producto = await this.prisma.producto.findUnique({
      where: { slug },
      include: {
        categoria: { select: { slug: true, nombre: true } },
        marca: { select: { nombre: true } },
        fotos: FOTOS,
        etiquetas: { select: { etiqueta: { select: { nombre: true } } } },
        fusionadoEn: { select: { slug: true } },
      },
    });
    if (!producto) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Este producto no existe en PaseLibre.',
      );
    }
    if (producto.fusionadoEn) return { redirigir_a: producto.fusionadoEn.slug };

    const detalle: ProductoDetalle = {
      id: producto.id,
      slug: producto.slug,
      titulo: producto.titulo,
      modelo: producto.modelo,
      categoria: producto.categoria,
      marca: producto.marca?.nombre ?? null,
      etiquetas: producto.etiquetas.map((e) => e.etiqueta.nombre),
      caracteristicas: this.caracteristicas(producto.caracteristicas),
      fotos: producto.fotos.map(aFoto),
    };
    const where: Prisma.OfertaWhereInput = { ...OFERTA_VIGENTE, productoId: producto.id };

    if (!conSesion(mirada)) {
      // Para el visitante, de la más reciente a la más antigua: ordenar por precio lo delataría.
      const ofertas = await this.prisma.oferta.findMany({
        where,
        orderBy: [{ actualizadaEn: 'desc' }, { id: 'asc' }],
        select: SELECT_OFERTA_PUBLICA,
      });
      return { audiencia: 'visitante', producto: detalle, ofertas: ofertas.map(ofertaPublica) };
    }

    const bloqueadas = await tiendasBloqueadasPor(this.prisma, mirada.usuarioId);
    if (bloqueadas.length > 0) where.tiendaId = { notIn: bloqueadas };
    const ofertas = await this.prisma.oferta.findMany({
      where,
      select: SELECT_OFERTA_CON_VENDEDOR,
    });
    const [respondeEn, socios] = await Promise.all([
      this.respondeEn([...new Set(ofertas.map((o) => o.tiendaId))]),
      tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId),
      this.contarVistas(ofertas, mirada.tiendaId),
    ]);
    return {
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      producto: detalle,
      ofertas: ofertas
        .sort(compararPorPrecio)
        .map((o) => ofertaConVendedor(o, mirada, respondeEn, socios)),
    };
  }

  /**
   * «48 vistas esta semana» (MP_Web): la tienda que abre la ficha ve todas sus ofertas; cuenta
   * una vez por día para cada una. Las propias y las del equipo no cuentan.
   */
  private async contarVistas(
    ofertas: Array<{ id: string; tiendaId: string }>,
    tiendaId: string | null,
  ): Promise<void> {
    if (!tiendaId) return;
    const ajenas = ofertas.filter((oferta) => oferta.tiendaId !== tiendaId);
    if (ajenas.length === 0) return;
    const dia = new Date(`${DIA_LIMA.format(new Date())}T00:00:00Z`);
    await this.prisma.vistaOferta
      .createMany({
        data: ajenas.map((oferta) => ({ ofertaId: oferta.id, tiendaId, dia })),
        skipDuplicates: true,
      })
      // Una vista que no se guardó no debe tumbar la ficha.
      .catch(() => undefined);
  }

  /**
   * «Responde en ~10 min» (lienzo «Demo · lo aprobado»): por tienda, la mediana de lo que tardó
   * en contestar el primer mensaje de cada hilo de los últimos 60 días. Cuenta cualquier
   * persona de la tienda (el hilo se puede traspasar), no los mensajes del sistema. Con menos
   * de 3 hilos contestados no se muestra: sería más ruido que dato.
   */
  async respondeEn(todas: string[]): Promise<Map<string, number>> {
    const resultado = new Map<string, number>();
    const tiendaIds = todas.filter((id) => {
      if (!this.respondeEnMemoria.tiene(id)) return true;
      const minutos = this.respondeEnMemoria.leer(id);
      if (minutos != null) resultado.set(id, minutos);
      return false;
    });
    if (tiendaIds.length === 0) return resultado;
    const filas = await this.prisma.$queryRaw<Array<{ tienda_id: string; minutos: number }>>`
      WITH preguntas AS (
        SELECT c.id, c.tienda_vendedora_id, c.comprador_id, min(m.creado_en) AS pregunta
        FROM conversacion c
        JOIN mensaje m ON m.conversacion_id = c.id AND m.autor_id = c.comprador_id
        WHERE c.tienda_vendedora_id IN (${Prisma.join(tiendaIds.map((id) => Prisma.sql`${id}::uuid`))})
          AND c.creada_en > now() - interval '60 days'
        GROUP BY c.id, c.tienda_vendedora_id, c.comprador_id
      ),
      demoras AS (
        SELECT p.tienda_vendedora_id,
               extract(epoch FROM (
                 SELECT min(m.creado_en) FROM mensaje m
                 WHERE m.conversacion_id = p.id AND m.autor_id IS NOT NULL
                   AND m.autor_id <> p.comprador_id AND m.creado_en >= p.pregunta
               ) - p.pregunta) / 60 AS minutos
        FROM preguntas p
      )
      SELECT tienda_vendedora_id::text AS tienda_id,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY minutos)::float8 AS minutos
      FROM demoras
      WHERE minutos IS NOT NULL
      GROUP BY tienda_vendedora_id
      HAVING count(*) >= 3`;
    const calculadas = new Map(filas.map((f) => [f.tienda_id, Math.max(1, Math.round(f.minutos))]));
    for (const id of tiendaIds) {
      const minutos = calculadas.get(id) ?? null;
      this.respondeEnMemoria.guardar(id, minutos);
      if (minutos !== null) resultado.set(id, minutos);
    }
    return resultado;
  }

  /** «Recién llegados +N hoy»: ofertas vigentes publicadas hoy, en hora de Lima. */
  recienHoy(): Promise<number> {
    return this.recienHoyEnMemoria();
  }

  private async cargarRecienHoy(): Promise<number> {
    const [fila] = await this.prisma.$queryRaw<Array<{ cantidad: number }>>`
      SELECT count(*)::int AS cantidad
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE o.estado = 'ACTIVA' AND o.stock > 0
        AND o.creada_en >= (date_trunc('day', now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima')`;
    return fila?.cantidad ?? 0;
  }

  private async cargarTotales(): Promise<RespuestaPortada['totales']> {
    const [fila] = await this.prisma.$queryRaw<Array<RespuestaPortada['totales']>>`
      SELECT count(DISTINCT o.producto_id)::int AS productos,
             count(DISTINCT o.tienda_id)::int AS tiendas,
             (SELECT count(*)::int FROM galeria WHERE activa) AS galerias
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE o.estado = 'ACTIVA'`;
    return fila ?? { productos: 0, tiendas: 0, galerias: 0 };
  }

  private caracteristicas(valor: Prisma.JsonValue): Record<string, string> {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {};
    return Object.fromEntries(
      Object.entries(valor).filter((par): par is [string, string] => typeof par[1] === 'string'),
    );
  }
}
