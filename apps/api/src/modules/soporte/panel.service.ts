import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  formatearPrecio,
  MAX_ADVERTENCIAS,
  precioDe,
  type PreferenciasEquipo,
} from '@paselibre/contracts';
import type {
  AdvertenciaDatos,
  ComunicadoDatos,
  ComunicadoEnviado,
  DecisionReporte,
  DetalleReporte,
  DetalleTiendaPanel,
  ReporteEnCola,
  RespuestaInicioEquipo,
  SuspensionDatos,
  TiendaEnPanel,
  TiendasPanelConsulta,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { avisosDeGalerias } from '../../shared/galerias-nuevas';
import { inicioDelDiaEnLima } from '../en-vivo/horario';
import { CAMBIOS_POR_REVISAR } from '../cuenta/lugar.service';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { DestacadosService } from './destacados.service';
import { SoporteService } from './soporte.service';

const MOTIVO = {
  ESTAFA: 'Estafa o intento de estafa',
  DESCRITO: 'No cumplió con lo descrito',
  TRATO: 'Mal trato o acoso',
};
const ESTADO = {
  ABIERTA: 'abierto',
  EN_REVISION: 'en revisión',
  REVISADA: 'resuelto',
  DESCARTADA: 'descartado',
};
/** Cuánto tiene el equipo para revisar un reporte: una estafa, 3 horas; lo demás, un día. */
const HORAS = { urgente: 3, normal: 24 };
const SEMANA = 7 * 86_400_000;

const RESOLUCION: Record<DecisionReporte['accion'], string> = {
  ESCRIBIR: 'Le escribimos a la tienda para que nos cuente qué pasó.',
  ADVERTIR: 'La tienda recibió una advertencia. Si se repite, revisamos su cuenta.',
  SUSPENDER: 'Suspendimos a la tienda: ya no puede publicar ni sus publicaciones se ven.',
  NADA: 'Lo revisamos y no encontramos nada que corregir.',
};

const SELECT_COLA = {
  id: true,
  codigo: true,
  tipo: true,
  motivo: true,
  estado: true,
  creadaEn: true,
  reservada: true,
  tiendaDenunciada: { select: { id: true, nombre: true } },
} satisfies Prisma.DenunciaSelect;

type FilaCola = Prisma.DenunciaGetPayload<{ select: typeof SELECT_COLA }>;

function enCola(fila: FilaCola): ReporteEnCola {
  const urgente = fila.tipo === 'ESTAFA';
  return {
    id: fila.id,
    codigo: `R-${fila.codigo}`,
    motivo: fila.tipo ? MOTIVO[fila.tipo] : 'Reporte',
    urgente,
    tienda: fila.tiendaDenunciada?.nombre ?? null,
    estado: fila.estado,
    vence_en: new Date(
      fila.creadaEn.getTime() + (urgente ? HORAS.urgente : HORAS.normal) * 3_600_000,
    ).toISOString(),
  };
}

const primerNombre = (nombre: string) => nombre.split(' ')[0] ?? nombre;

/**
 * El panel del equipo (sección 20 del lienzo final): el inicio con lo de hoy (ADM_Web), la cola
 * de reportes con «¿Qué hacemos?» (REP_WebEquipo), las tiendas con advertencias y suspensión
 * (ADM_WebTiendas) y los comunicados (ADM_WebComunicados). Cada decisión queda anotada.
 */
@Injectable()
export class PanelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
    @Inject(SoporteService) private readonly soporte: SoporteService,
    @Inject(DestacadosService) private readonly destacados: DestacadosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  /** El modo claro u oscuro del panel se guarda en tu cuenta (COR18). */
  async preferencias(sesion: SesionActiva, datos: PreferenciasEquipo): Promise<PreferenciasEquipo> {
    const { temaOscuro } = await this.prisma.usuario.update({
      where: { id: sesion.usuario.id },
      data: { temaOscuro: datos.tema_oscuro },
      select: { temaOscuro: true },
    });
    return { tema_oscuro: temaOscuro };
  }

  /** Con `tiendaId`, sale también en el «Historial de cambios» de su ficha (N14). */
  private anotar(sesion: SesionActiva, accion: string, tiendaId?: string) {
    return this.prisma.registroEquipo.create({
      data: { autorId: sesion.usuario.id, accion: accion.slice(0, 240), tiendaId },
    });
  }

  // ── Inicio (ADM_Web) ─────────────────────────────────────────────────────

  async inicio(): Promise<RespuestaInicioEquipo> {
    const ahora = Date.now();
    const haceSemana = new Date(ahora - SEMANA);
    const haceDos = new Date(ahora - 2 * SEMANA);
    const hoy = inicioDelDiaEnLima(new Date());
    const [
      abiertos,
      solicitudes,
      [chats],
      tiendas,
      tiendasSemana,
      publicaciones,
      publicacionesSemana,
      enVivoHoy,
      enVivoRespondidos,
      ventasSemana,
      ventasAnterior,
      actividad,
    ] = await Promise.all([
      this.prisma.denuncia.findMany({
        where: { estado: { in: ['ABIERTA', 'EN_REVISION'] } },
        orderBy: { creadaEn: 'asc' },
        select: SELECT_COLA,
      }),
      // «Solicitudes N»: las cuentas por aprobar y los cambios de galería o stand sin revisar
      // (doc 19 §10).
      Promise.all([
        this.prisma.solicitud.count({ where: { estado: 'PENDIENTE' } }).catch(() => 0),
        this.prisma.cambioLugar.count({ where: CAMBIOS_POR_REVISAR }),
      ]).then(([cuentas, lugares]) => cuentas + lugares),
      this.prisma.$queryRaw<Array<{ cuantos: number }>>`
        SELECT count(*)::int AS cuantos FROM hilo_equipo h
        WHERE (SELECT m.de_equipo FROM mensaje_equipo m WHERE m.hilo_id = h.id
               ORDER BY m.creado_en DESC LIMIT 1) = false`,
      this.prisma.tienda.count({ where: { estado: 'ACTIVA' } }),
      this.prisma.tienda.count({ where: { estado: 'ACTIVA', creadaEn: { gte: haceSemana } } }),
      this.prisma.oferta.count({ where: { estado: 'ACTIVA', tienda: { estado: 'ACTIVA' } } }),
      this.prisma.oferta.count({
        where: { estado: 'ACTIVA', tienda: { estado: 'ACTIVA' }, creadaEn: { gte: haceSemana } },
      }),
      this.prisma.enVivo.count({ where: { creadoEn: { gte: hoy } } }),
      this.prisma.enVivo.count({ where: { creadoEn: { gte: hoy }, respuestas: { some: {} } } }),
      this.prisma.venta.count({ where: { creadaEn: { gte: haceSemana } } }),
      this.prisma.venta.count({ where: { creadaEn: { gte: haceDos, lt: haceSemana } } }),
      this.prisma.registroEquipo.findMany({
        orderBy: { creadoEn: 'desc' },
        take: 6,
        select: { id: true, accion: true, creadoEn: true, autor: { select: { nombre: true } } },
      }),
    ]);
    const [catalogoPorRevisar, destacadas, galeriasNuevas] = await Promise.all([
      this.prisma.producto.count({ where: { revisado: false, fusionadoEnId: null } }),
      this.destacados.activos(),
      avisosDeGalerias(this.prisma),
    ]);
    const primeraDestacada = destacadas.activas[0];
    const cola = abiertos.map(enCola).sort((a, b) => Number(b.urgente) - Number(a.urgente));
    const primero = cola[0];
    const chatsSin = chats?.cuantos ?? 0;
    return {
      por_revisar: cola.length + solicitudes + chatsSin,
      reportes: {
        abiertos: cola.length,
        urgentes: cola.filter((r) => r.urgente).length,
        primero: primero
          ? { motivo: primero.motivo, tienda: primero.tienda, vence_en: primero.vence_en }
          : null,
      },
      solicitudes,
      chats: chatsSin,
      numeros: {
        tiendas,
        tiendas_semana: tiendasSemana,
        publicaciones,
        publicaciones_semana: publicacionesSemana,
        en_vivo_hoy: enVivoHoy,
        en_vivo_respondidos: enVivoRespondidos,
        ventas_semana: ventasSemana,
        ventas_semana_anterior: ventasAnterior,
      },
      actividad: actividad.map((fila) => ({
        id: fila.id,
        autor: primerNombre(fila.autor.nombre),
        accion: fila.accion,
        fecha: fila.creadoEn.toISOString(),
      })),
      catalogo_por_revisar: catalogoPorRevisar,
      galerias_nuevas: galeriasNuevas.length,
      destacadas: {
        activas: destacadas.activas.length,
        maximo: destacadas.maximo,
        primera: primeraDestacada
          ? { tienda: primeraDestacada.tienda.nombre, hasta: primeraDestacada.hasta }
          : null,
      },
    };
  }

  // ── Reportes (REP_WebEquipo) ─────────────────────────────────────────────

  async cola(): Promise<ReporteEnCola[]> {
    const filas = await this.prisma.denuncia.findMany({
      where: { estado: { in: ['ABIERTA', 'EN_REVISION'] } },
      orderBy: { creadaEn: 'asc' },
      take: 200,
      select: SELECT_COLA,
    });
    return filas
      .map(enCola)
      .sort(
        (a, b) => Number(b.urgente) - Number(a.urgente) || a.vence_en.localeCompare(b.vence_en),
      );
  }

  async reporte(id: string): Promise<DetalleReporte> {
    const fila = await this.prisma.denuncia.findUnique({
      where: { id },
      select: {
        ...SELECT_COLA,
        objeto: true,
        objetoId: true,
        resolucion: true,
        conversacionAdjuntaId: true,
        denunciante: { select: { nombre: true, tienda: { select: { nombre: true } } } },
      },
    });
    if (!fila) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Ese reporte no existe.');
    }
    const reportada = fila.tiendaDenunciada?.id ?? null;
    const [chat, tienda, sobre] = await Promise.all([
      fila.conversacionAdjuntaId
        ? this.prisma.mensaje.findMany({
            where: { conversacionId: fila.conversacionAdjuntaId },
            orderBy: { creadoEn: 'asc' },
            take: 100,
            select: {
              id: true,
              texto: true,
              creadoEn: true,
              autor: { select: { tiendaId: true } },
            },
          })
        : null,
      reportada ? this.sobreTienda(reportada, fila.id) : null,
      this.sobre(fila.objeto, fila.objetoId),
    ]);
    // Abrir el reporte lo pasa a «Lo revisa una persona» (Mis reportes de quien reportó).
    if (fila.estado === 'ABIERTA') {
      await this.prisma.denuncia.update({
        where: { id },
        data: { estado: 'EN_REVISION', tomadaEn: new Date() },
      });
    }
    return {
      ...enCola(fila),
      estado: fila.estado === 'ABIERTA' ? 'EN_REVISION' : fila.estado,
      denunciante: {
        nombre: fila.denunciante.nombre,
        tienda: fila.denunciante.tienda?.nombre ?? null,
      },
      texto: fila.motivo,
      sobre,
      chat:
        chat?.map((mensaje) => ({
          id: mensaje.id,
          texto: mensaje.texto,
          de_reportada: mensaje.autor?.tiendaId === reportada,
          creado_en: mensaje.creadoEn.toISOString(),
        })) ?? null,
      tienda_reportada: tienda,
      resolucion: fila.resolucion,
    };
  }

  private async sobre(objeto: string, objetoId: string): Promise<string> {
    if (objeto === 'OFERTA') {
      const oferta = await this.prisma.oferta.findUnique({
        where: { id: objetoId },
        select: { producto: { select: { titulo: true } } },
      });
      return `Publicación · ${oferta?.producto.titulo ?? 'ya no existe'}`;
    }
    if (objeto === 'EN_VIVO') {
      const enVivo = await this.prisma.enVivo.findUnique({
        where: { id: objetoId },
        select: { titulo: true },
      });
      return `Pedido en vivo · ${enVivo?.titulo ?? 'ya no existe'}`;
    }
    if (objeto === 'CONVERSACION') return 'Un chat';
    if (objeto === 'OPINION') {
      // «Pedir revisión al Equipo» (N03): la pide la tienda calificada; la reportada es la autora.
      const opinion = await this.prisma.opinion.findUnique({
        where: { id: objetoId },
        select: { estrellas: true, texto: true, tienda: { select: { nombre: true } } },
      });
      if (!opinion) return 'Opinión · ya no existe';
      const estrellas = opinion.estrellas === 1 ? '1 estrella' : `${opinion.estrellas} estrellas`;
      return `Opinión de ${estrellas} sobre ${opinion.tienda.nombre}${
        opinion.texto ? ` · «${opinion.texto}»` : ''
      }`;
    }
    return 'La tienda';
  }

  private async sobreTienda(
    tiendaId: string,
    menos: string,
  ): Promise<NonNullable<DetalleReporte['tienda_reportada']>> {
    const [tienda, opiniones, ventas, advertencias, antes, solicitud] = await Promise.all([
      this.prisma.tienda.findUniqueOrThrow({
        where: { id: tiendaId },
        select: { id: true, nombre: true, estado: true, creadaEn: true },
      }),
      this.prisma.opinion.aggregate({ where: { tiendaId }, _avg: { estrellas: true } }),
      this.prisma.venta.count({ where: { oferta: { tiendaId } } }),
      this.prisma.advertencia.count({ where: { tiendaId } }),
      this.prisma.denuncia.findMany({
        where: { tiendaDenunciadaId: tiendaId, id: { not: menos } },
        orderBy: { creadaEn: 'desc' },
        take: 5,
        select: { tipo: true, estado: true, creadaEn: true },
      }),
      this.prisma.solicitud.findFirst({ where: { tiendaId }, select: { ruc: true } }),
    ]);
    const promedio = opiniones._avg.estrellas;
    return {
      id: tienda.id,
      nombre: tienda.nombre,
      con_ruc: Boolean(solicitud?.ruc),
      estrellas: promedio === null ? null : Math.round(promedio * 10) / 10,
      ventas,
      advertencias,
      suspendida: tienda.estado === 'SUSPENDIDA',
      reportes_antes: antes.map((fila) => ({
        motivo: fila.tipo ? MOTIVO[fila.tipo] : 'Reporte',
        estado: ESTADO[fila.estado],
        fecha: fila.creadaEn.toISOString(),
      })),
      desde: tienda.creadaEn.toISOString(),
    };
  }

  /**
   * «¿Qué hacemos?»: escribirle a la tienda, advertirla, suspenderla o cerrarlo sin cambios. A
   * quien reportó le llega el resultado («Mis reportes» y la campanita), sin saber quién decidió.
   */
  async decidir(
    id: string,
    decision: DecisionReporte,
    sesion: SesionActiva,
  ): Promise<DetalleReporte> {
    const fila = await this.prisma.denuncia.findUnique({
      where: { id },
      select: {
        codigo: true,
        tipo: true,
        estado: true,
        denuncianteId: true,
        tiendaDenunciada: { select: { id: true, nombre: true } },
      },
    });
    if (!fila) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Ese reporte no existe.');
    }
    if (fila.estado === 'REVISADA' || fila.estado === 'DESCARTADA') {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ese reporte ya se resolvió.');
    }
    const tienda = fila.tiendaDenunciada;
    if (!tienda && decision.accion !== 'NADA') {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Este reporte no tiene una tienda a la que escribirle.',
      );
    }
    const codigo = `R-${fila.codigo}`;
    const motivo = fila.tipo ? MOTIVO[fila.tipo].toLowerCase() : 'un reporte';

    if (tienda && decision.accion === 'ESCRIBIR') {
      await this.soporte.escribirATienda(
        tienda.id,
        {
          texto:
            decision.texto ||
            `Hola, ${tienda.nombre}. Soy del equipo PaseLibre. Recibimos un reporte por ${motivo}. ¿Nos cuentas qué pasó?`,
          denuncia: id,
        },
        sesion,
      );
    }
    if (tienda && decision.accion === 'ADVERTIR') {
      await this.advertir(
        tienda.id,
        { motivo: `${MOTIVO[fila.tipo ?? 'TRATO']} (${codigo})` },
        sesion,
        {
          denuncia: id,
          texto: decision.texto,
        },
      );
    }
    if (tienda && decision.accion === 'SUSPENDER') {
      await this.suspender(tienda.id, { suspender: true, motivo: `${motivo} (${codigo})` }, sesion);
    }

    const estado =
      decision.accion === 'ESCRIBIR'
        ? 'EN_REVISION'
        : decision.accion === 'NADA'
          ? 'DESCARTADA'
          : 'REVISADA';
    await this.prisma.denuncia.update({
      where: { id },
      data: {
        estado,
        resolucion: RESOLUCION[decision.accion],
        ...(estado === 'EN_REVISION' ? {} : { resueltaEn: new Date() }),
      },
    });
    await this.avisos.crear([fila.denuncianteId], {
      tipo: 'REPORTE',
      titulo: `Tu reporte ${codigo}: ${estado === 'EN_REVISION' ? 'lo estamos viendo' : 'resuelto'}`,
      extracto: RESOLUCION[decision.accion],
      enlace: '/cuenta/configuracion?seccion=reportes',
    });
    if (decision.accion === 'NADA') {
      await this.anotar(sesion, `cerró el caso ${codigo} sin cambios`, tienda?.id);
    } else if (decision.accion === 'ESCRIBIR' && tienda) {
      await this.anotar(sesion, `le escribió a ${tienda.nombre} por el caso ${codigo}`, tienda.id);
    }
    return this.reporte(id);
  }

  // ── Tiendas (ADM_WebTiendas) ─────────────────────────────────────────────

  async tiendas(consulta: TiendasPanelConsulta): Promise<TiendaEnPanel[]> {
    const where: Prisma.TiendaWhereInput = {
      ...(consulta.q
        ? {
            OR: [
              { nombre: { contains: consulta.q, mode: 'insensitive' } },
              { galeria: { nombre: { contains: consulta.q, mode: 'insensitive' } } },
              { stand: { contains: consulta.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(consulta.filtro === 'activas' ? { estado: 'ACTIVA' } : {}),
      ...(consulta.filtro === 'suspendidas' ? { estado: 'SUSPENDIDA' } : {}),
      ...(consulta.filtro === 'advertidas' ? { advertencias: { some: {} } } : {}),
    };
    const tiendas = await this.prisma.tienda.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 300,
      select: {
        id: true,
        nombre: true,
        logo: true,
        stand: true,
        estado: true,
        creadaEn: true,
        galeria: { select: { nombre: true } },
        _count: { select: { advertencias: true, denunciasRecibidas: true } },
      },
    });
    const ids = tiendas.map((t) => t.id);
    const [ventas, solicitudes] = await Promise.all([
      this.prisma.$queryRaw<Array<{ tienda_id: string; ventas: number }>>`
        SELECT o.tienda_id::text, count(*)::int AS ventas
        FROM venta v JOIN oferta o ON o.id = v.oferta_id
        GROUP BY o.tienda_id`,
      this.prisma.solicitud.findMany({
        where: { tiendaId: { in: ids } },
        select: { tiendaId: true, ruc: true },
      }),
    ]);
    const deVentas = new Map(ventas.map((fila) => [fila.tienda_id, fila.ventas]));
    const conRuc = new Set(solicitudes.filter((s) => s.ruc).map((s) => s.tiendaId));
    return tiendas.map((tienda) => ({
      id: tienda.id,
      nombre: tienda.nombre,
      logo: tienda.logo,
      galeria: tienda.galeria?.nombre ?? null,
      stand: tienda.stand,
      suspendida: tienda.estado === 'SUSPENDIDA',
      con_ruc: conRuc.has(tienda.id),
      reportes: tienda._count.denunciasRecibidas,
      advertencias: tienda._count.advertencias,
      ventas: deVentas.get(tienda.id) ?? 0,
      desde: tienda.creadaEn.toISOString(),
    }));
  }

  async tienda(id: string): Promise<DetalleTiendaPanel> {
    const [lista] = await Promise.all([this.tiendas({ q: '', filtro: 'todas' })]);
    const base = lista.find((tienda) => tienda.id === id);
    if (!base) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    const [tienda, cuentas, publicaciones, advertencias, reportes, vigentes, destacado] =
      await Promise.all([
        this.prisma.tienda.findUniqueOrThrow({
          where: { id },
          select: { piso: true, horario: true, whatsapp: true },
        }),
        this.prisma.usuario.count({ where: { tiendaId: id } }),
        this.prisma.oferta.count({ where: { tiendaId: id, estado: 'ACTIVA' } }),
        this.prisma.advertencia.findMany({
          where: { tiendaId: id },
          orderBy: { creadaEn: 'desc' },
          select: { motivo: true, creadaEn: true },
        }),
        this.prisma.denuncia.findMany({
          where: { tiendaDenunciadaId: id },
          orderBy: { creadaEn: 'desc' },
          take: 20,
          select: { codigo: true, tipo: true, estado: true, creadaEn: true },
        }),
        this.prisma.oferta.findMany({
          where: { tiendaId: id, estado: 'ACTIVA', stock: { gt: 0 } },
          orderBy: { actualizadaEn: 'desc' },
          take: 12,
          select: {
            id: true,
            precioCentimos: true,
            moneda: true,
            producto: { select: { titulo: true } },
          },
        }),
        this.destacados.deTienda(id),
      ]);
    return {
      ...base,
      para_destacar: vigentes.map((oferta) => ({
        oferta_id: oferta.id,
        titulo: oferta.producto.titulo,
        precio:
          oferta.precioCentimos === null
            ? null
            : formatearPrecio(precioDe(Number(oferta.precioCentimos), oferta.moneda)),
      })),
      destacado,
      piso: tienda.piso,
      horario: tienda.horario,
      whatsapp: tienda.whatsapp,
      cuentas,
      publicaciones,
      historial: [
        ...advertencias.map((fila) => ({
          tipo: 'ADVERTENCIA' as const,
          texto: `Advertencia: ${fila.motivo}`,
          fecha: fila.creadaEn.toISOString(),
        })),
        ...reportes.map((fila) => ({
          tipo: 'REPORTE' as const,
          texto: `R-${fila.codigo} · ${fila.tipo ? MOTIVO[fila.tipo] : 'Reporte'} · ${ESTADO[fila.estado]}`,
          fecha: fila.creadaEn.toISOString(),
        })),
      ].sort((a, b) => b.fecha.localeCompare(a.fecha)),
    };
  }

  /** «Advertencia»: queda en su historial y le llega al chat oficial. Sus publicaciones siguen. */
  async advertir(
    tiendaId: string,
    datos: AdvertenciaDatos,
    sesion: SesionActiva,
    extra: { denuncia?: string; texto?: string } = {},
  ): Promise<void> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true, _count: { select: { advertencias: true } } },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    const advertencia = await this.prisma.advertencia.create({
      data: {
        tiendaId,
        autorId: sesion.usuario.id,
        motivo: datos.motivo,
        denunciaId: extra.denuncia,
      },
      select: { denuncia: { select: { codigo: true } } },
    });
    const numero = tienda._count.advertencias + 1;
    const caso = advertencia.denuncia ? `R-${advertencia.denuncia.codigo}` : null;
    await this.soporte.escribirATienda(
      tiendaId,
      {
        texto:
          extra.texto ||
          `Te dejamos una advertencia por: ${datos.motivo}. Tus publicaciones siguen activas. Es la ${numero}.ª: con 3, revisamos la cuenta. Escríbenos si quieres contarnos tu versión.`,
        ...(extra.denuncia ? { denuncia: extra.denuncia } : {}),
      },
      sesion,
    );
    // «Recibiste 1 advertencia de 3» (N14): cuenta las que dio el equipo, no los reportes.
    await this.avisos.crear(
      (
        await this.prisma.usuario.findMany({
          where: { tiendaId, estado: 'ACTIVO' },
          select: { id: true },
        })
      ).map((persona) => persona.id),
      {
        tipo: 'EQUIPO',
        titulo: `Recibiste ${numero} ${numero === 1 ? 'advertencia' : 'advertencias'} de ${MAX_ADVERTENCIAS}`,
        extracto: `Motivo: ${datos.motivo}${caso && !datos.motivo.includes(caso) ? ` (caso ${caso})` : ''}. Si llegas a ${MAX_ADVERTENCIAS}, tu cuenta puede suspenderse.`,
        enlace: '/mensajes/equipo',
        accion: { tipo: 'ABRIR', texto: 'Ver el motivo', enlace: '/mensajes/equipo' },
      },
    );
    const conCaso = caso && !datos.motivo.includes(caso) ? ` (caso ${caso})` : '';
    await this.anotar(
      sesion,
      `le dio una advertencia a ${tienda.nombre}${conCaso}: ${datos.motivo}`,
      tiendaId,
    );
  }

  /**
   * «Suspender» (doc 19 §9): al instante y sin contraseña. Se cierran todas sus sesiones, no entra
   * y sus publicaciones dejan de verse. Queda cuándo, quién y por qué: «Eliminar definitivamente»
   * se habilita 24 h después. «Reactivar» lo deshace sin perder nada (y el plazo vuelve a cero).
   */
  async suspender(tiendaId: string, datos: SuspensionDatos, sesion: SesionActiva): Promise<void> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true, estado: true },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    const ahora = new Date();
    // Suspender otra vez a una suspendida no le reinicia el plazo de las 24 h.
    const yaSuspendida = datos.suspender && tienda.estado === 'SUSPENDIDA';
    const personas = await this.prisma.usuario.findMany({
      where: { tiendaId },
      select: { id: true },
    });
    await this.prisma.$transaction([
      this.prisma.tienda.update({
        where: { id: tiendaId },
        data: datos.suspender
          ? {
              estado: 'SUSPENDIDA',
              ...(yaSuspendida
                ? {}
                : {
                    suspendidaEn: ahora,
                    suspendidaPorId: sesion.usuario.id,
                    motivoSuspension: datos.motivo || null,
                  }),
            }
          : { estado: 'ACTIVA', suspendidaEn: null, suspendidaPorId: null, motivoSuspension: null },
      }),
      ...(datos.suspender
        ? [
            this.prisma.sesion.updateMany({
              where: { usuarioId: { in: personas.map((p) => p.id) }, revocadaEn: null },
              data: { revocadaEn: ahora },
            }),
          ]
        : []),
    ]);
    if (datos.suspender) {
      for (const persona of personas) await this.tiempoReal.desconectarUsuario(persona.id);
    }
    await this.anotar(
      sesion,
      datos.suspender
        ? `suspendió a ${tienda.nombre}${datos.motivo ? ` · ${datos.motivo}` : ''}`
        : `reactivó a ${tienda.nombre}`,
      tiendaId,
    );
  }

  // ── Comunicados (ADM_WebComunicados) ─────────────────────────────────────

  async comunicados(): Promise<ComunicadoEnviado[]> {
    const filas = await this.prisma.comunicado.findMany({
      orderBy: { creadoEn: 'desc' },
      take: 50,
      select: {
        id: true,
        para: true,
        titulo: true,
        texto: true,
        enviados: true,
        creadoEn: true,
        autor: { select: { nombre: true } },
      },
    });
    return filas.map((fila) => ({
      id: fila.id,
      para: fila.para,
      titulo: fila.titulo,
      texto: fila.texto,
      enviados: fila.enviados,
      autor: primerNombre(fila.autor.nombre),
      fecha: fila.creadoEn.toISOString(),
    }));
  }

  async comunicar(datos: ComunicadoDatos, sesion: SesionActiva): Promise<ComunicadoEnviado> {
    const galeria = datos.galeria
      ? await this.prisma.galeria.findUnique({
          where: { slug: datos.galeria },
          select: { id: true, nombre: true },
        })
      : null;
    if (datos.galeria && !galeria) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Esa galería no existe.',
      );
    }
    const personas = await this.prisma.usuario.findMany({
      where: {
        estado: 'ACTIVO',
        tienda: { estado: 'ACTIVA', ...(galeria ? { galeriaId: galeria.id } : {}) },
      },
      select: { id: true },
    });
    await this.avisos.crear(
      personas.map((persona) => persona.id),
      { tipo: 'EQUIPO', titulo: datos.titulo, extracto: datos.texto, enlace: '/avisos' },
    );
    const para = galeria ? galeria.nombre : 'Todas las tiendas';
    const creado = await this.prisma.comunicado.create({
      data: {
        autorId: sesion.usuario.id,
        para,
        titulo: datos.titulo,
        texto: datos.texto,
        enviados: personas.length,
      },
      select: { id: true, creadoEn: true },
    });
    await this.anotar(sesion, `envió el comunicado «${datos.titulo}» a ${para.toLowerCase()}`);
    return {
      id: creado.id,
      para,
      titulo: datos.titulo,
      texto: datos.texto,
      enviados: personas.length,
      autor: primerNombre(sesion.usuario.nombre),
      fecha: creado.creadoEn.toISOString(),
    };
  }
}
