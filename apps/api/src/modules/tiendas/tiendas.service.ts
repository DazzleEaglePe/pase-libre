import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ASPECTOS_DEL_COMPRADOR,
  precioDe,
  ASPECTOS_DEL_VENDEDOR,
  type AspectoOpinado,
  type FiltroOpinionesConsulta,
  type OpinarDatos,
  type OpinionPublica,
  type PerfilTienda,
  type Reputacion,
  type RespuestaOpiniones,
  type RespuestaSeguir,
  type RespuestaSocios,
  type SeguirTiendaDatos,
  type TiendaBreve,
  type TiendaSeguida,
  type RespuestaTiendaCompartida,
} from '@paselibre/contracts';
import type { LadoOpinion, Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { audienciaDe, type Mirada } from '../../shared/guards/sesion-opcional.guard';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { preciosPara } from '../catalogo/visibilidad';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';

/** Productos que se muestran en el perfil (SG_Web); el resto, en la búsqueda. */
const PRODUCTOS_EN_PERFIL = 48;
const OPINIONES_POR_PAGINA = 50;

/** «Lo que dicen las tiendas» (SG_WebOpiniones): cómo se lee cada cosa que se marcó al opinar. */
const ASPECTOS_DEL_PERFIL: Array<[string, string]> = [
  ['Precio como se publicó', 'Respeta el precio acordado'],
  ['Producto como se describió', 'El producto es como lo describe'],
  ['Rapidez para separar', 'Responde rápido'],
];

const noEncontrada = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');

/** «CS» para «Computer Shock», «A» para «Tienda A». */
export function inicialesDe(nombre: string): string {
  return (
    nombre
      .replace(/^tienda\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0] ?? '')
      .join('')
      .toUpperCase() || '·'
  );
}

/** Las publicaciones que se pueden mostrar en el perfil: vigentes y con el nombre a la vista. */
export const OFERTA_DEL_PERFIL = {
  estado: 'ACTIVA',
  tiendaVisible: true,
  stock: { gt: 0 },
  producto: { fusionadoEnId: null },
} satisfies Prisma.OfertaWhereInput;

export function miradaDe(sesion: SesionActiva): Mirada {
  return {
    audiencia: audienciaDe(sesion),
    tiendaId: sesion.usuario.tiendaId,
    usuarioId: sesion.usuario.id,
  };
}

/**
 * Perfil de otra tienda, seguir y opiniones (SG_Web, SG_WebOpiniones, sección 15 del lienzo
 * final). Todo con sesión: un visitante no sabe qué tienda tiene qué.
 */
@Injectable()
export class TiendasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  // ── Perfil ────────────────────────────────────────────────────────────────

  /** Para un enlace compartido sin sesión (COR3): solo el nombre de una tienda activa. */
  async compartida(id: string): Promise<RespuestaTiendaCompartida> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id, estado: 'ACTIVA' },
      select: { nombre: true },
    });
    if (!tienda) throw noEncontrada();
    return { nombre: tienda.nombre };
  }

  async perfil(id: string, sesion: SesionActiva): Promise<PerfilTienda> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id, estado: 'ACTIVA' },
      include: { galeria: true },
    });
    if (!tienda) throw noEncontrada();
    const mirada = miradaDe(sesion);
    const miTienda = sesion.usuario.tiendaId;

    const bloqueada =
      (await this.prisma.bloqueo.count({
        where: { usuarioId: sesion.usuario.id, tiendaBloqueadaId: id },
      })) > 0;
    const socios = await tiendasQueMeTienenDeSocia(this.prisma, miTienda);
    const [ofertas, total, seguidores, siguiendo, reputacion] = await Promise.all([
      this.prisma.oferta.findMany({
        where: { tiendaId: id, ...OFERTA_DEL_PERFIL },
        orderBy: [{ actualizadaEn: 'desc' }, { creadaEn: 'desc' }],
        // Bloqueada: «Ya no verás sus publicaciones».
        take: bloqueada ? 0 : PRODUCTOS_EN_PERFIL,
        select: {
          id: true,
          condicion: true,
          stock: true,
          precioCentimos: true,
          precioFacturadoCentimos: true,
          descuentoSocioCentimos: true,
          soloSocios: true,
          moneda: true,
          precioVisible: true,
          tiendaId: true,
          producto: {
            select: {
              slug: true,
              titulo: true,
              categoria: { select: { slug: true, nombre: true } },
              fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
            },
          },
        },
      }),
      this.prisma.oferta.count({ where: { tiendaId: id, ...OFERTA_DEL_PERFIL } }),
      this.prisma.seguimiento.count({ where: { seguidaId: id } }),
      miTienda
        ? this.prisma.seguimiento.findUnique({
            where: { tiendaId_seguidaId: { tiendaId: miTienda, seguidaId: id } },
            select: { avisos: true },
          })
        : null,
      this.reputacion(id),
    ]);

    return {
      id: tienda.id,
      nombre: tienda.nombre,
      iniciales: inicialesDe(tienda.nombre),
      galeria: tienda.galeria?.nombre ?? null,
      stand: tienda.stand,
      horario: tienda.horario,
      descripcion: tienda.descripcion,
      reputacion,
      seguidores,
      siguiendo: siguiendo ? { avisos: siguiendo.avisos } : null,
      explicar_seguir: sesion.usuario.seguirExplicadoEn === null,
      propia: miTienda === id,
      puede_seguir: miTienda !== null && miTienda !== id,
      bloqueada,
      total_productos: total,
      productos: ofertas.map((oferta) => ({
        oferta_id: oferta.id,
        producto: {
          slug: oferta.producto.slug,
          titulo: oferta.producto.titulo,
          foto: oferta.producto.fotos[0]?.ruta ?? null,
          categoria: oferta.producto.categoria,
        },
        condicion: oferta.condicion,
        stock: oferta.stock,
        precio: preciosPara(oferta, mirada, socios).precio,
      })),
    };
  }

  /** Promedio de estrellas, cuántas opiniones y cuántas ventas marcó como vendedora. */
  private async reputacion(tiendaId: string): Promise<Reputacion> {
    const [opiniones, ventas] = await Promise.all([
      this.prisma.opinion.aggregate({
        where: { tiendaId },
        _avg: { estrellas: true },
        _count: { _all: true },
      }),
      this.prisma.venta.count({ where: { oferta: { tiendaId } } }),
    ]);
    const promedio = opiniones._avg.estrellas;
    return {
      promedio: promedio === null ? null : Math.round(promedio * 10) / 10,
      opiniones: opiniones._count._all,
      ventas,
    };
  }

  // ── Seguir ────────────────────────────────────────────────────────────────

  private tiendaQueSigue(sesion: SesionActiva, seguidaId: string): string {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'Las cuentas del equipo no siguen tiendas.',
      );
    }
    if (tiendaId === seguidaId) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'No puedes seguir a tu propia tienda.',
      );
    }
    return tiendaId;
  }

  async seguir(
    seguidaId: string,
    datos: SeguirTiendaDatos,
    sesion: SesionActiva,
  ): Promise<RespuestaSeguir> {
    const tiendaId = this.tiendaQueSigue(sesion, seguidaId);
    const existe = await this.prisma.tienda.count({ where: { id: seguidaId, estado: 'ACTIVA' } });
    if (!existe) throw noEncontrada();
    const seguimiento = await this.prisma.seguimiento.upsert({
      where: { tiendaId_seguidaId: { tiendaId, seguidaId } },
      create: { tiendaId, seguidaId, usuarioId: sesion.usuario.id, avisos: datos.avisos },
      update: { avisos: datos.avisos },
      select: { avisos: true },
    });
    if (sesion.usuario.seguirExplicadoEn === null) {
      await this.prisma.usuario.update({
        where: { id: sesion.usuario.id },
        data: { seguirExplicadoEn: new Date() },
      });
    }
    return {
      siguiendo: { avisos: seguimiento.avisos },
      seguidores: await this.prisma.seguimiento.count({ where: { seguidaId } }),
    };
  }

  async cambiarAvisos(
    seguidaId: string,
    datos: SeguirTiendaDatos,
    sesion: SesionActiva,
  ): Promise<RespuestaSeguir> {
    const tiendaId = this.tiendaQueSigue(sesion, seguidaId);
    const { count } = await this.prisma.seguimiento.updateMany({
      where: { tiendaId, seguidaId },
      data: { avisos: datos.avisos },
    });
    if (count === 0) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'No sigues a esta tienda.');
    }
    return {
      siguiendo: { avisos: datos.avisos },
      seguidores: await this.prisma.seguimiento.count({ where: { seguidaId } }),
    };
  }

  async dejarDeSeguir(seguidaId: string, sesion: SesionActiva): Promise<RespuestaSeguir> {
    const tiendaId = this.tiendaQueSigue(sesion, seguidaId);
    await this.prisma.seguimiento.deleteMany({ where: { tiendaId, seguidaId } });
    return {
      siguiendo: null,
      seguidores: await this.prisma.seguimiento.count({ where: { seguidaId } }),
    };
  }

  /** «De tiendas que sigues» (SEG_Web): las que sigue tu tienda, la más reciente primero. */
  async seguidas(sesion: SesionActiva): Promise<TiendaSeguida[]> {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) return [];
    const filas = await this.prisma.seguimiento.findMany({
      where: { tiendaId, seguida: { estado: 'ACTIVA' } },
      orderBy: { creadoEn: 'desc' },
      select: {
        avisos: true,
        seguida: { select: { id: true, nombre: true, stand: true, galeria: true } },
      },
    });
    const hace7Dias = new Date(Date.now() - 7 * 86_400_000);
    return Promise.all(
      filas.map(async ({ avisos, seguida }) => {
        const [reputacion, productos, nuevos] = await Promise.all([
          this.reputacion(seguida.id),
          this.prisma.oferta.count({ where: { tiendaId: seguida.id, ...OFERTA_DEL_PERFIL } }),
          this.prisma.oferta.count({
            where: { tiendaId: seguida.id, ...OFERTA_DEL_PERFIL, creadaEn: { gte: hace7Dias } },
          }),
        ]);
        return {
          id: seguida.id,
          nombre: seguida.nombre,
          iniciales: inicialesDe(seguida.nombre),
          galeria: seguida.galeria?.nombre ?? null,
          stand: seguida.stand,
          avisos,
          reputacion,
          productos,
          nuevos_semana: nuevos,
        };
      }),
    );
  }

  // ── Socios (PS_SociosWeb) ─────────────────────────────────────────────────

  private breve(tienda: {
    id: string;
    nombre: string;
    stand: string | null;
    galeria: { nombre: string } | null;
  }): TiendaBreve {
    return {
      id: tienda.id,
      nombre: tienda.nombre,
      iniciales: inicialesDe(tienda.nombre),
      galeria: tienda.galeria?.nombre ?? null,
      stand: tienda.stand,
    };
  }

  async socios(sesion: SesionActiva): Promise<RespuestaSocios> {
    const tiendaId = sesion.usuario.tiendaId;
    const ninguno = { PEN: null, USD: null };
    if (!tiendaId) return { mis_socios: [], me_tienen: [], descuento_defecto: ninguno };
    const tienda = {
      select: {
        id: true,
        nombre: true,
        stand: true,
        galeria: true,
        descuentoSocioPen: true,
        descuentoSocioUsd: true,
      },
    } as const;
    const propia = await this.prisma.tienda.findUniqueOrThrow({
      where: { id: tiendaId },
      select: { descuentoSocioPen: true, descuentoSocioUsd: true },
    });
    const descuentos = (fila: {
      descuentoSocioPen: bigint | null;
      descuentoSocioUsd: bigint | null;
    }) => ({
      PEN: fila.descuentoSocioPen === null ? null : precioDe(Number(fila.descuentoSocioPen), 'PEN'),
      USD: fila.descuentoSocioUsd === null ? null : precioDe(Number(fila.descuentoSocioUsd), 'USD'),
    });
    const [mios, meTienen] = await Promise.all([
      this.prisma.socio.findMany({
        where: { tiendaId, socio: { estado: 'ACTIVA' } },
        orderBy: { creadoEn: 'desc' },
        select: { creadoEn: true, socio: tienda },
      }),
      this.prisma.socio.findMany({
        where: { socioId: tiendaId, tienda: { estado: 'ACTIVA' } },
        orderBy: { creadoEn: 'desc' },
        select: { creadoEn: true, tienda },
      }),
    ]);
    return {
      mis_socios: mios.map((fila) => ({
        ...this.breve(fila.socio),
        desde: fila.creadoEn.toISOString(),
      })),
      me_tienen: meTienen.map((fila) => ({
        ...this.breve(fila.tienda),
        desde: fila.creadoEn.toISOString(),
        descuento: descuentos(fila.tienda),
      })),
      descuento_defecto: descuentos(propia),
    };
  }

  async descuentoPorDefecto(
    datos: { PEN: number | null; USD: number | null },
    sesion: SesionActiva,
  ): Promise<RespuestaSocios> {
    const tiendaId = sesion.usuario.tiendaId;
    if (tiendaId) {
      await this.prisma.tienda.update({
        where: { id: tiendaId },
        data: {
          descuentoSocioPen: datos.PEN === null ? null : BigInt(datos.PEN),
          descuentoSocioUsd: datos.USD === null ? null : BigInt(datos.USD),
        },
      });
    }
    return this.socios(sesion);
  }

  async agregarSocio(
    socioId: string,
    sesion: SesionActiva,
    avisar = true,
  ): Promise<RespuestaSocios> {
    const tiendaId = this.tiendaQueSigue(sesion, socioId);
    const socia = await this.prisma.tienda.findFirst({
      where: { id: socioId, estado: 'ACTIVA' },
      select: { id: true },
    });
    if (!socia) throw noEncontrada();
    const existe = await this.prisma.socio.count({ where: { tiendaId, socioId } });
    if (!existe) {
      await this.prisma.socio.create({ data: { tiendaId, socioId } });
    }
    if (!existe && avisar) {
      // AV_Web: «CGS te agregó como socio · Ahora ves su precio socio».
      const personas = await this.prisma.usuario.findMany({
        where: { tiendaId: socioId, estado: 'ACTIVO' },
        select: { id: true },
      });
      const nombre = sesion.usuario.tienda?.nombre ?? 'Una tienda';
      await this.avisos.crear(
        personas.map((persona) => persona.id),
        {
          tipo: 'VENTA',
          titulo: `${nombre} te agregó como socio`,
          extracto: 'Ahora ves su precio socio y lo que publica solo para sus socios.',
          enlace: `/tiendas/${tiendaId}`,
          accion: { tipo: 'ABRIR', texto: 'Ver sus productos', enlace: `/tiendas/${tiendaId}` },
        },
      );
    }
    return this.socios(sesion);
  }

  async quitarSocio(socioId: string, sesion: SesionActiva): Promise<RespuestaSocios> {
    const tiendaId = sesion.usuario.tiendaId;
    if (tiendaId) await this.prisma.socio.deleteMany({ where: { tiendaId, socioId } });
    return this.socios(sesion);
  }

  /** Para agregar socias: tiendas activas por su nombre, sin la propia. */
  async buscarTiendas(q: string, sesion: SesionActiva): Promise<TiendaBreve[]> {
    const tiendas = await this.prisma.tienda.findMany({
      where: {
        estado: 'ACTIVA',
        nombre: { contains: q, mode: 'insensitive' },
        ...(sesion.usuario.tiendaId ? { id: { not: sesion.usuario.tiendaId } } : {}),
      },
      orderBy: { nombre: 'asc' },
      take: 8,
      select: { id: true, nombre: true, stand: true, galeria: { select: { nombre: true } } },
    });
    return tiendas.map((tienda) => this.breve(tienda));
  }

  // ── Bloquear (REP_Web) ────────────────────────────────────────────────────

  /** «Bloquear a…» desde la ficha o el perfil: la tienda tiene el nombre a la vista. */
  async bloquear(tiendaId: string, sesion: SesionActiva): Promise<void> {
    if (sesion.usuario.tiendaId === tiendaId) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'No puedes bloquear a tu propia tienda.',
      );
    }
    const existe = await this.prisma.tienda.count({ where: { id: tiendaId } });
    if (!existe) throw noEncontrada();
    const clave = { usuarioId: sesion.usuario.id, tiendaBloqueadaId: tiendaId };
    await this.prisma.bloqueo.upsert({
      where: { usuarioId_tiendaBloqueadaId: clave },
      update: {},
      create: clave,
    });
  }

  // ── Opiniones ─────────────────────────────────────────────────────────────

  async opiniones(
    tiendaId: string,
    consulta: FiltroOpinionesConsulta,
    sesion: SesionActiva,
  ): Promise<RespuestaOpiniones> {
    const existe = await this.prisma.tienda.count({ where: { id: tiendaId, estado: 'ACTIVA' } });
    if (!existe) throw noEncontrada();

    const filtro: Prisma.OpinionWhereInput =
      consulta.filtro === 'con_respuesta'
        ? { respuesta: { not: null } }
        : consulta.filtro === 'cinco'
          ? { estrellas: 5 }
          : consulta.filtro === 'bajas'
            ? { estrellas: { lte: 3 } }
            : {};

    const [reputacion, porEstrellas, comoVendedora, filas] = await Promise.all([
      this.reputacion(tiendaId),
      this.prisma.opinion.groupBy({
        by: ['estrellas'],
        where: { tiendaId },
        _count: { _all: true },
      }),
      this.prisma.opinion.findMany({
        where: { tiendaId, lado: 'COMPRADOR' },
        select: { aspectos: true },
      }),
      this.prisma.opinion.findMany({
        where: { tiendaId, ...filtro },
        orderBy: { creadaEn: 'desc' },
        take: OPINIONES_POR_PAGINA,
        select: {
          id: true,
          estrellas: true,
          aspectos: true,
          texto: true,
          respuesta: true,
          creadaEn: true,
          autorTienda: { select: { nombre: true, galeria: { select: { nombre: true } } } },
          venta: {
            select: {
              oferta: { select: { tiendaVisible: true, producto: { select: { titulo: true } } } },
            },
          },
        },
      }),
    ]);

    const cuenta = new Map(porEstrellas.map((fila) => [fila.estrellas, fila._count._all]));
    const aspectos: AspectoOpinado[] =
      comoVendedora.length === 0
        ? []
        : ASPECTOS_DEL_PERFIL.map(([marcado, texto]) => ({
            aspecto: texto,
            porcentaje: Math.round(
              (comoVendedora.filter((opinion) => opinion.aspectos.includes(marcado)).length /
                comoVendedora.length) *
                100,
            ),
          }));

    const opiniones: OpinionPublica[] = filas.map((fila) => {
      // Una venta de una publicación reservada no dice qué producto fue: la delataría.
      const producto = fila.venta.oferta.tiendaVisible ? fila.venta.oferta.producto.titulo : null;
      return {
        id: fila.id,
        autor: {
          nombre: fila.autorTienda.nombre,
          iniciales: inicialesDe(fila.autorTienda.nombre),
          galeria: fila.autorTienda.galeria?.nombre ?? null,
        },
        estrellas: fila.estrellas,
        aspectos: fila.aspectos,
        producto,
        texto: fila.texto,
        respuesta: fila.respuesta,
        creada_en: fila.creadaEn.toISOString(),
      };
    });

    return {
      reputacion,
      distribucion: [5, 4, 3, 2, 1].map((estrellas) => ({
        estrellas,
        cantidad: cuenta.get(estrellas) ?? 0,
      })),
      aspectos,
      opiniones,
      puede_responder: sesion.usuario.tiendaId === tiendaId,
    };
  }

  /**
   * Opinar después de una venta marcada en el chat (PCH_CelCalificar): quien compró opina de
   * quien vendió y al revés. Una por venta y por lado.
   */
  async opinar(ventaId: string, datos: OpinarDatos, sesion: SesionActiva): Promise<OpinionPublica> {
    const miTienda = sesion.usuario.tiendaId;
    const venta = await this.prisma.venta.findUnique({
      where: { id: ventaId },
      select: {
        id: true,
        tiendaCompradoraId: true,
        oferta: { select: { tiendaId: true } },
      },
    });
    if (!venta || !miTienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta venta no existe.');
    }
    let lado: LadoOpinion;
    let tiendaId: string;
    if (venta.tiendaCompradoraId === miTienda) {
      lado = 'COMPRADOR';
      tiendaId = venta.oferta.tiendaId;
    } else if (venta.oferta.tiendaId === miTienda && venta.tiendaCompradoraId) {
      lado = 'VENDEDOR';
      tiendaId = venta.tiendaCompradoraId;
    } else {
      // Ni la compró ni la vendió: para quien mira, esa venta no existe.
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta venta no existe.');
    }

    const permitidos: readonly string[] =
      lado === 'COMPRADOR' ? ASPECTOS_DEL_VENDEDOR : ASPECTOS_DEL_COMPRADOR;
    const aspectos = [...new Set(datos.aspectos)];
    if (aspectos.some((aspecto) => !permitidos.includes(aspecto))) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Elige lo que marcaste de la lista.',
      );
    }

    try {
      const creada = await this.prisma.opinion.create({
        data: {
          ventaId,
          lado,
          autorTiendaId: miTienda,
          autorId: sesion.usuario.id,
          tiendaId,
          estrellas: datos.estrellas,
          aspectos,
          texto: datos.texto ?? null,
        },
        select: { id: true },
      });
      // AV_Web: «Tienda B te calificó con 5 estrellas».
      const destinatarios = await this.prisma.usuario.findMany({
        where: { tiendaId, estado: 'ACTIVO' },
        select: { id: true },
      });
      await this.avisos.crear(
        destinatarios.map((persona) => persona.id),
        {
          tipo: 'CALIFICACION',
          titulo: `${sesion.usuario.tienda?.nombre ?? 'Una tienda'} te calificó con ${datos.estrellas} ${datos.estrellas === 1 ? 'estrella' : 'estrellas'}`,
          extracto: datos.texto ? `«${datos.texto}»` : null,
          enlace: `/tiendas/${tiendaId}?pestana=opiniones`,
        },
      );
      const [opinion] = (
        await this.opiniones(tiendaId, { filtro: 'todas' }, sesion)
      ).opiniones.filter((otra) => otra.id === creada.id);
      if (!opinion) throw new Error('La opinión recién creada no aparece');
      return opinion;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ya diste tu opinión sobre esta venta.',
        );
      }
      throw error;
    }
  }

  /** La tienda opinada responde una vez (SG_WebOpiniones, «Respuesta de…»). */
  async responder(opinionId: string, texto: string, sesion: SesionActiva): Promise<void> {
    const miTienda = sesion.usuario.tiendaId;
    const opinion = await this.prisma.opinion.findUnique({
      where: { id: opinionId },
      select: { tiendaId: true },
    });
    if (!opinion || !miTienda || opinion.tiendaId !== miTienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta opinión no existe.');
    }
    const { count } = await this.prisma.opinion.updateMany({
      where: { id: opinionId, respuesta: null },
      data: { respuesta: texto, respondidaEn: new Date() },
    });
    if (count === 0) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya respondiste esta opinión.');
    }
  }
}
