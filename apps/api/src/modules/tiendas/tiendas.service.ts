import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ASPECTOS_DEL_COMPRADOR,
  precioDe,
  ASPECTOS_DEL_VENDEDOR,
  horarioTiendaSchema,
  leerHorarioEscrito,
  opinionBaja,
  type AspectoOpinado,
  type FiltroOpinionesConsulta,
  type OpinarDatos,
  type OpinionPublica,
  type PerfilTienda,
  type PublicacionesTiendaConsulta,
  type Reputacion,
  type ReputacionDetallada,
  type RespuestaPublicacionesTienda,
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
import { accesoAlPerfil, comoLaEncuentra } from '../../shared/bloqueadas';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { audienciaDe, type Mirada } from '../../shared/guards/sesion-opcional.guard';
import { tiendasQueMeTienenDeSocia } from '../../shared/socios';
import { MiniaturasService } from '../archivos/miniaturas.service';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { OFERTA_DEL_PERFIL, PerfilPublicacionesService } from './perfil-publicaciones';
import { ReputacionService } from './reputacion.service';

const OPINIONES_POR_PAGINA = 50;

/** El logo y la portada de una privada, en píxeles de ancho: la web los muestra borrosos. */
const ANCHO_LOGO_BORROSO = 32;
const ANCHO_PORTADA_BORROSA = 64;
/** Lo que se muestra de la reputación de una privada que no sigues: nada. */
const REPUTACION_OCULTA: ReputacionDetallada = {
  promedio: null,
  opiniones: 0,
  ventas: 0,
  nivel: null,
  pases_60: 0,
  responde_en: null,
  respondidos: null,
};

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

// Antes vivía aquí; otras partes la siguen pidiendo desde este archivo.
export { OFERTA_DEL_PERFIL };

export function miradaDe(sesion: SesionActiva): Mirada {
  return {
    audiencia: audienciaDe(sesion),
    tiendaId: sesion.usuario.tiendaId,
    usuarioId: sesion.usuario.id,
  };
}

/**
 * Perfil de otra tienda, seguir y opiniones (SG_Web, SG_WebOpiniones, sección 15 del lienzo
 * final). Todo con sesión: un visitante no sabe qué tienda tiene qué. Las 3 categorías que más
 * publica (para la portada automática, COR1) salen de las burbujas de «Todo».
 */
@Injectable()
export class TiendasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
    @Inject(ReputacionService) private readonly reputaciones: ReputacionService,
    @Inject(PerfilPublicacionesService) private readonly publicaciones: PerfilPublicacionesService,
    @Inject(MiniaturasService) private readonly miniaturas: MiniaturasService,
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

  /**
   * El perfil de una tienda como lo ve quien mira (doc 20, punto 5): completo, privado (una
   * privada que no sigue: nombre, galería y seguidoras, con el logo y la portada borrosos) u
   * oculto (404). Con `comoMeVen`, la propia se ve como la ve otra tienda que no la sigue.
   */
  async perfil(id: string, sesion: SesionActiva, comoMeVen = false): Promise<PerfilTienda> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id, estado: 'ACTIVA' },
      include: { galeria: true },
    });
    if (!tienda) throw noEncontrada();
    const miTienda = sesion.usuario.tiendaId;
    const propia = miTienda === id;
    const comoOtra = comoMeVen && propia;
    // «Cómo me ven»: como otra tienda cualquiera, sin socias ni seguimiento.
    const mirada: Mirada = comoOtra
      ? { audiencia: 'vendedor', tiendaId: null, usuarioId: null }
      : miradaDe(sesion);

    const [siguiendo, solicitud, bloqueos, seguidores] = await Promise.all([
      miTienda && !comoOtra
        ? this.prisma.seguimiento.findUnique({
            where: { tiendaId_seguidaId: { tiendaId: miTienda, seguidaId: id } },
            select: { avisos: true },
          })
        : null,
      miTienda && !propia
        ? this.prisma.solicitudSeguir.count({ where: { tiendaId: miTienda, seguidaId: id } })
        : 0,
      comoOtra
        ? 0
        : this.prisma.bloqueo.count({
            where: { usuarioId: sesion.usuario.id, tiendaBloqueadaId: id },
          }),
      this.prisma.seguimiento.count({ where: { seguidaId: id } }),
    ]);
    const acceso = accesoAlPerfil(tienda, miradaDe(sesion), siguiendo !== null, comoMeVen);
    // Una oculta no existe para las demás; en «Cómo me ven» se dice que nadie la ve.
    if (acceso === 'oculto' && !comoOtra) throw noEncontrada();
    const bloqueada = bloqueos > 0;
    const base = {
      id: tienda.id,
      nombre: tienda.nombre,
      iniciales: inicialesDe(tienda.nombre),
      galeria: tienda.galeria?.nombre ?? null,
      desde: tienda.creadaEn.toISOString(),
      seguidores,
      siguiendo: siguiendo ? { avisos: siguiendo.avisos } : null,
      explicar_seguir: sesion.usuario.seguirExplicadoEn === null,
      propia: propia && !comoOtra,
      puede_seguir: !comoOtra && miTienda !== null && !propia,
      bloqueada,
      visibilidad: propia ? tienda.visibilidad : null,
      solicitud_enviada: solicitud > 0,
      como_me_ven: comoOtra,
    };

    if (acceso !== 'completo') {
      // Privada que no sigue (o «Cómo me ven» de una privada u oculta): sin productos, stand ni
      // datos, y el logo y la portada chicos para mostrarlos borrosos.
      const [logoBorroso, portadaBorrosa] =
        acceso === 'privado'
          ? await Promise.all([
              this.miniaturas.chica(tienda.logo, ANCHO_LOGO_BORROSO),
              this.miniaturas.chica(tienda.portadaRuta, ANCHO_PORTADA_BORROSA),
            ])
          : [null, null];
      return {
        ...base,
        galeria: acceso === 'privado' ? base.galeria : null,
        seguidores: acceso === 'privado' ? seguidores : 0,
        stand: null,
        horario: null,
        descripcion: null,
        horario_tramos: null,
        indicaciones: null,
        logo: null,
        reputacion: REPUTACION_OCULTA,
        total_productos: 0,
        productos: [],
        portada: null,
        categorias_principales: [],
        privada: acceso === 'privado',
        oculta: acceso === 'oculto',
        logo_borroso: logoBorroso,
        portada_borrosa: portadaBorrosa,
        puede_escribir: false,
        nuevas: [],
        mejores_precios: [],
        categorias: [],
        hay_mas: false,
        // Restringido: ni el sello de fundadora (solo se ve el nombre).
        fundadora: null,
      };
    }

    const socios = await tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId);
    // Bloqueada: «Ya no verás sus publicaciones».
    const [todo, total, nuevas, mejores, categorias, reputacion] = await Promise.all([
      bloqueada
        ? null
        : this.publicaciones.todo(
            id,
            { categoria: [], orden: 'recientes', pagina: 1 },
            mirada,
            socios,
          ),
      this.publicaciones.total(id),
      bloqueada ? [] : this.publicaciones.nuevas(id, mirada, socios),
      bloqueada ? [] : this.publicaciones.mejoresPrecios(tienda, mirada, socios),
      bloqueada ? [] : this.publicaciones.categorias(id),
      this.reputaciones.de(id),
    ]);
    const productos = todo?.productos ?? [];
    const tramos = horarioTiendaSchema.safeParse(tienda.horarioDatos);

    return {
      ...base,
      stand: tienda.stand,
      horario: tienda.horario,
      descripcion: tienda.descripcion,
      horario_tramos: tramos.success ? tramos.data : leerHorarioEscrito(tienda.horario),
      indicaciones: tienda.indicaciones,
      logo: tienda.logo,
      reputacion,
      total_productos: total,
      portada: tienda.portadaRuta
        ? {
            ruta: tienda.portadaRuta,
            ancho: tienda.portadaAncho,
            alto: tienda.portadaAlto,
            posicion: tienda.portadaPosicion,
            zoom: tienda.portadaZoom,
            x: tienda.portadaX,
          }
        : null,
      categorias_principales: categorias.slice(0, 3).map((categoria) => categoria.nombre),
      productos,
      privada: false,
      oculta: false,
      logo_borroso: null,
      portada_borrosa: null,
      puede_escribir: base.puede_seguir,
      nuevas,
      mejores_precios: mejores,
      categorias,
      hay_mas: todo?.hay_mas ?? false,
      // El sello «★ Fundadora», solo en su perfil (doc 20, punto 7).
      fundadora:
        tienda.fundadoraDesde && tienda.fundadoraSello
          ? { desde: tienda.fundadoraDesde.toISOString() }
          : null,
    };
  }

  /**
   * «Todo» del perfil con sus filtros (doc 20, punto 20): `?categoria=ram,teclados&orden=…`. Con
   * los mismos permisos que el perfil: nada de una privada que no sigues, ni de una oculta, ni de
   * una que bloqueaste.
   */
  async publicacionesDe(
    id: string,
    consulta: PublicacionesTiendaConsulta,
    sesion: SesionActiva,
  ): Promise<RespuestaPublicacionesTienda> {
    const mirada = miradaDe(sesion);
    const acceso = await this.acceso(id, sesion);
    const vacia = { productos: [], total: 0, pagina: consulta.pagina, hay_mas: false };
    if (acceso === 'privado') return vacia;
    const bloqueada =
      (await this.prisma.bloqueo.count({
        where: { usuarioId: sesion.usuario.id, tiendaBloqueadaId: id },
      })) > 0;
    if (bloqueada) return vacia;
    const socios = await tiendasQueMeTienenDeSocia(this.prisma, mirada.tiendaId);
    return this.publicaciones.todo(id, consulta, mirada, socios);
  }

  /**
   * Qué ve quien mira de esta tienda (`accesoAlPerfil`). Una oculta (o suspendida) no existe para
   * las demás: 404.
   */
  private async acceso(id: string, sesion: SesionActiva): Promise<'completo' | 'privado'> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id, estado: 'ACTIVA' },
      select: { id: true, visibilidad: true },
    });
    if (!tienda) throw noEncontrada();
    const miTienda = sesion.usuario.tiendaId;
    const sigue =
      tienda.visibilidad === 'PRIVADO' && miTienda
        ? (await this.prisma.seguimiento.count({ where: { tiendaId: miTienda, seguidaId: id } })) >
          0
        : false;
    const acceso = accesoAlPerfil(tienda, miradaDe(sesion), sigue);
    if (acceso === 'oculto') throw noEncontrada();
    return acceso;
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
    const seguida = await this.prisma.tienda.findFirst({
      where: { id: seguidaId, estado: 'ACTIVA' },
      select: { visibilidad: true },
    });
    // Una oculta no existe para las demás (doc 20, punto 5).
    if (!seguida || seguida.visibilidad === 'OCULTO') throw noEncontrada();
    if (seguida.visibilidad === 'PRIVADO') {
      // A una privada se le pide seguirla; quien ya la seguía solo cambia sus avisos.
      const yaLaSigue = await this.prisma.seguimiento.count({ where: { tiendaId, seguidaId } });
      if (!yaLaSigue) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Esta cuenta es privada: pide seguirla y la tienda decide si te acepta.',
        );
      }
    }
    // Si había pedido seguirla, la solicitud ya no hace falta.
    await this.prisma.solicitudSeguir.deleteMany({ where: { tiendaId, seguidaId } });
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
      // Una oculta no aparece a nadie, ni a quien la sigue (doc 20, punto 5).
      where: { tiendaId, seguida: { estado: 'ACTIVA', visibilidad: { not: 'OCULTO' } } },
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

  /**
   * Para agregar socias: tiendas activas por su nombre, sin la propia. Como en la búsqueda de
   * tiendas (doc 20, punto 5): sin las ocultas, y una privada que no sigues solo con su nombre
   * exacto y sin su galería ni su stand.
   */
  async buscarTiendas(q: string, sesion: SesionActiva): Promise<TiendaBreve[]> {
    const miTienda = sesion.usuario.tiendaId;
    const tiendas = await this.prisma.tienda.findMany({
      where: {
        estado: 'ACTIVA',
        visibilidad: { not: 'OCULTO' },
        nombre: { contains: q, mode: 'insensitive' },
        ...(miTienda ? { id: { not: miTienda } } : {}),
      },
      orderBy: { nombre: 'asc' },
      take: 8,
      select: {
        id: true,
        nombre: true,
        stand: true,
        visibilidad: true,
        galeria: { select: { nombre: true } },
        seguidores: miTienda ? { where: { tiendaId: miTienda }, select: { id: true } } : false,
      },
    });
    return tiendas.flatMap((tienda) => {
      const como = comoLaEncuentra(
        tienda,
        miradaDe(sesion),
        (tienda.seguidores?.length ?? 0) > 0,
        q,
      );
      if (!como) return [];
      return [
        como === 'privada'
          ? { ...this.breve({ ...tienda, stand: null, galeria: null }) }
          : this.breve(tienda),
      ];
    });
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
    // Las de una privada que no sigues tampoco se ven (doc 20, punto 5); una oculta, 404.
    if ((await this.acceso(tiendaId, sesion)) === 'privado') {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'Esta cuenta es privada. Pide seguirla para ver sus opiniones.',
      );
    }

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
          autorTiendaId: true,
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

    // N03: el comentario de una opinión baja solo lo ven la tienda calificada, quien lo escribió
    // y el Equipo. Las estrellas sí cuentan para todos.
    const miTienda = sesion.usuario.tiendaId;
    const esLaCalificada = miTienda === tiendaId;
    const veTodo = esLaCalificada || sesion.usuario.rol === 'EQUIPO';
    const revisiones = esLaCalificada ? await this.revisionesDe(filas.map((f) => f.id)) : null;

    const opiniones: OpinionPublica[] = filas.map((fila) => {
      // Una venta de una publicación reservada no dice qué producto fue: la delataría.
      const producto = fila.venta.oferta.tiendaVisible ? fila.venta.oferta.producto.titulo : null;
      const privada = opinionBaja(fila.estrellas);
      const visible = !privada || veTodo || fila.autorTiendaId === miTienda;
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
        texto: visible ? fila.texto : null,
        respuesta: visible ? fila.respuesta : null,
        creada_en: fila.creadaEn.toISOString(),
        privada,
        revision: revisiones?.get(fila.id) ?? null,
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

  /** Las revisiones que la tienda calificada pidió al Equipo, por opinión (la más reciente). */
  private async revisionesDe(
    opinionIds: string[],
  ): Promise<Map<string, { codigo: string; resuelta: boolean }>> {
    if (opinionIds.length === 0) return new Map();
    const filas = await this.prisma.denuncia.findMany({
      where: { objeto: 'OPINION', objetoId: { in: opinionIds } },
      orderBy: { creadaEn: 'asc' },
      select: { objetoId: true, codigo: true, estado: true },
    });
    return new Map(
      filas.map((fila) => [
        fila.objetoId,
        {
          codigo: `R-${fila.codigo}`,
          resuelta: fila.estado === 'REVISADA' || fila.estado === 'DESCARTADA',
        },
      ]),
    );
  }

  /**
   * «Pedir revisión al Equipo» (N03): la tienda calificada cree que una opinión no es justa. Se
   * guarda como un reporte sobre la tienda que la escribió, para la misma cola del Equipo. Si ya
   * hay una revisión abierta de esa opinión, se devuelve esa en vez de crear otra.
   */
  async pedirRevision(
    opinionId: string,
    motivo: string | undefined,
    sesion: SesionActiva,
  ): Promise<{ codigo: string; resuelta: boolean }> {
    const miTienda = sesion.usuario.tiendaId;
    const opinion = await this.prisma.opinion.findUnique({
      where: { id: opinionId },
      select: { id: true, tiendaId: true, autorTiendaId: true },
    });
    if (!opinion || !miTienda || opinion.tiendaId !== miTienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta opinión no existe.');
    }
    const abierta = await this.prisma.denuncia.findFirst({
      where: {
        objeto: 'OPINION',
        objetoId: opinion.id,
        estado: { in: ['ABIERTA', 'EN_REVISION'] },
      },
      select: { codigo: true },
    });
    if (abierta) return { codigo: `R-${abierta.codigo}`, resuelta: false };
    const creada = await this.prisma.denuncia.create({
      data: {
        denuncianteId: sesion.usuario.id,
        objeto: 'OPINION',
        objetoId: opinion.id,
        tiendaDenunciadaId: opinion.autorTiendaId,
        motivo: motivo ?? 'La tienda calificada pide revisar esta opinión.',
      },
      select: { codigo: true },
    });
    return { codigo: `R-${creada.codigo}`, resuelta: false };
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
