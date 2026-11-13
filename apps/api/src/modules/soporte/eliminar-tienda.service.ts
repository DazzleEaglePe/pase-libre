import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  HORAS_PARA_ELIMINAR,
  MAX_INTENTOS_ELIMINAR,
  MINUTOS_BLOQUEO_ELIMINAR,
  type SuspensionTienda,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { esAdministrador } from '../../shared/administrador';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import { verificarClave } from '../sesion/clave';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';

const PLAZO_MS = HORAS_PARA_ELIMINAR * 3_600_000;
const BLOQUEO_MS = MINUTOS_BLOQUEO_ELIMINAR * 60_000;

/**
 * Los intentos con la contraseña quedan en `auditoria` (así sobreviven a un reinicio de la API y
 * quedan a la vista): cada error, el bloqueo al tercero y cada eliminación hecha.
 */
const CLAVE_MAL = 'eliminar_tienda_clave_mal';
const BLOQUEO = 'eliminar_tienda_bloqueo';
const ELIMINADA = 'eliminar_tienda';

/** «Podrás eliminarla en 21 h (mañana 19:04)». La hora es la de Lima. */
export function cuandoSePodraEliminar(desde: Date, ahora = new Date()): string {
  const horas = Math.max(1, Math.ceil((desde.getTime() - ahora.getTime()) / 3_600_000));
  const enLima = (fecha: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', dateStyle: 'short' }).format(
      fecha,
    );
  const dia = enLima(desde) === enLima(ahora) ? 'hoy' : 'mañana';
  const hora = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(desde);
  return `${horas} h (${dia} ${hora})`;
}

/** Cuándo, quién y por qué se suspendió, para la ficha (doc 19 §9). Nula si está activa. */
export async function suspensionDe(
  prisma: PrismaService,
  tienda: {
    id: string;
    estado: string;
    suspendidaEn: Date | null;
    suspendidaPorId: string | null;
    motivoSuspension: string | null;
    actualizadaEn: Date;
  },
): Promise<SuspensionTienda | null> {
  if (tienda.estado !== 'SUSPENDIDA') return null;
  const en = tienda.suspendidaEn ?? tienda.actualizadaEn;
  const [por, activas, antiguas] = await Promise.all([
    tienda.suspendidaPorId
      ? prisma.usuario.findUnique({
          where: { id: tienda.suspendidaPorId },
          select: { nombre: true },
        })
      : null,
    prisma.oferta.count({ where: { tiendaId: tienda.id, estado: 'ACTIVA' } }),
    prisma.oferta.count({ where: { tiendaId: tienda.id, estado: { not: 'ACTIVA' } } }),
  ]);
  return {
    en: en.toISOString(),
    por: por?.nombre.split(' ')[0] ?? null,
    motivo: tienda.motivoSuspension,
    eliminable_desde: new Date(en.getTime() + PLAZO_MS).toISOString(),
    publicaciones: { activas, antiguas },
  };
}

/**
 * «Eliminar definitivamente» (doc 19 §9): solo un administrador, con la tienda suspendida hace
 * más de 24 h y con **su** contraseña (3 errores = 15 min de espera). Todo en una transacción:
 *
 * - de la tienda: la cuenta, sus asesores y sus sesiones; sus publicaciones (con fotos, vistas,
 *   contactos y ventas); su perfil; sus pedidos en vivo y sus respuestas; sus avisos, seguidores,
 *   socios, bloqueos, reportes que hizo, opiniones (las suyas y las que recibió), advertencias,
 *   chat con el Equipo, cargas, archivos, destacados, cambios de lugar, solicitud de registro y
 *   su «Historial de cambios»;
 * - en los chats con otras tiendas, solo sus mensajes: la otra conserva los suyos y ve «Tienda
 *   eliminada» (el lado de la eliminada queda nulo). Un chat sin mensajes de la otra se borra;
 * - de otras tiendas no se borra nada: sus ventas a la eliminada quedan sin comprador y los
 *   reportes contra ella, cerrados y sin tienda.
 *
 * Si algo de otra tienda dependiera de una persona de esta (una llave en RESTRICT), la
 * transacción falla entera y no se borra nada. Los archivos se borran después, con la limpieza de
 * `archivos.service.ts`. En el historial del Equipo queda solo el nombre, quién y cuándo.
 */
@Injectable()
export class EliminarTiendaService {
  private readonly logger = new Logger(EliminarTiendaService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  async eliminar(tiendaId: string, clave: string, sesion: SesionActiva): Promise<void> {
    if (!esAdministrador(sesion.usuario)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'Solo un administrador puede eliminar una tienda.',
      );
    }
    await this.revisarBloqueo(sesion.usuario.id);
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true, estado: true, suspendidaEn: true },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    if (tienda.estado !== 'SUSPENDIDA' || !tienda.suspendidaEn) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        `Primero suspende a ${tienda.nombre}: se puede eliminar ${HORAS_PARA_ELIMINAR} h después.`,
      );
    }
    const desde = new Date(tienda.suspendidaEn.getTime() + PLAZO_MS);
    if (desde > new Date()) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        `Podrás eliminarla en ${cuandoSePodraEliminar(desde)}. Mientras tanto se puede reactivar sin perder nada.`,
      );
    }
    await this.revisarClave(sesion.usuario.id, clave);

    const { rutas, usuarios } = await this.prisma
      .$transaction((tx) => this.borrar(tx, tiendaId, tienda.nombre, sesion.usuario.id), {
        maxWait: 10_000,
        timeout: 120_000,
      })
      .catch((error: unknown) => {
        // Algo de otra tienda depende de una persona de esta (una llave en RESTRICT): no se
        // borró nada.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
          this.logger.warn(`No se pudo eliminar ${tiendaId}: ${error.message}`);
          throw new ApiHttpException(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            `No se pudo eliminar a ${tienda.nombre}: algo de otra tienda depende de ella. No se borró nada; escríbele a desarrollo.`,
          );
        }
        throw error;
      });
    for (const usuarioId of usuarios) {
      await this.tiempoReal.desconectarUsuario(usuarioId).catch(() => undefined);
    }
    // Las fotos, después: si la transacción hubiera fallado, seguirían ahí.
    await this.archivos.borrarSinUso(rutas).catch((error: unknown) => {
      this.logger.warn(`No se pudieron borrar las fotos de ${tiendaId}: ${String(error)}`);
    });
  }

  /** Con 3 errores seguidos, 15 minutos de espera. */
  private async revisarBloqueo(actorId: string): Promise<void> {
    const bloqueo = await this.prisma.auditoria.findFirst({
      where: { actorId, accion: BLOQUEO, creadaEn: { gt: new Date(Date.now() - BLOQUEO_MS) } },
      orderBy: { creadaEn: 'desc' },
      select: { creadaEn: true },
    });
    if (bloqueo) throw bloqueado(bloqueo.creadaEn);
  }

  private async revisarClave(actorId: string, clave: string): Promise<void> {
    const { claveHash } = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: actorId },
      select: { claveHash: true },
    });
    if (await verificarClave(claveHash, clave)) return;

    const ahora = new Date();
    // Cuentan los errores de los últimos 15 min, desde el último bloqueo o la última eliminación.
    const reinicio = await this.prisma.auditoria.findFirst({
      where: { actorId, accion: { in: [BLOQUEO, ELIMINADA] } },
      orderBy: { creadaEn: 'desc' },
      select: { creadaEn: true },
    });
    const ventana = new Date(ahora.getTime() - BLOQUEO_MS);
    const desde = reinicio && reinicio.creadaEn > ventana ? reinicio.creadaEn : ventana;
    await this.prisma.auditoria.create({
      data: { actorId, accion: CLAVE_MAL, objeto: 'usuario', objetoId: actorId, datos: {} },
    });
    const errores = await this.prisma.auditoria.count({
      where: { actorId, accion: CLAVE_MAL, creadaEn: { gt: desde } },
    });
    if (errores >= MAX_INTENTOS_ELIMINAR) {
      const fila = await this.prisma.auditoria.create({
        data: { actorId, accion: BLOQUEO, objeto: 'usuario', objetoId: actorId, datos: {} },
        select: { creadaEn: true },
      });
      throw bloqueado(fila.creadaEn);
    }
    const quedan = MAX_INTENTOS_ELIMINAR - errores;
    throw new ApiHttpException(
      HttpStatus.BAD_REQUEST,
      'CLAVE_ACTUAL_INCORRECTA',
      `Esa no es tu contraseña. ${quedan === 1 ? 'Te queda 1 intento' : `Te quedan ${quedan} intentos`}.`,
    );
  }

  private async borrar(
    tx: Prisma.TransactionClient,
    tiendaId: string,
    nombre: string,
    actorId: string,
  ): Promise<{ rutas: string[]; usuarios: string[] }> {
    const [tienda, personas, publicaciones, vivos] = await Promise.all([
      tx.tienda.findUniqueOrThrow({
        where: { id: tiendaId },
        select: { logo: true, portadaRuta: true },
      }),
      tx.usuario.findMany({ where: { tiendaId }, select: { id: true } }),
      tx.oferta.findMany({ where: { tiendaId }, select: { id: true } }),
      tx.enVivo.findMany({ where: { tiendaId }, select: { id: true } }),
    ]);
    const usuarios = personas.map((p) => p.id);
    const ofertas = publicaciones.map((o) => o.id);
    const enVivo = vivos.map((v) => v.id);
    const deSusPersonas = { in: usuarios };

    // Las fotos que hay que borrar después: perfil, publicaciones, chat y lo que subió.
    const [fotosOfertas, fotosMensajes, subidas] = await Promise.all([
      tx.ofertaFoto.findMany({ where: { ofertaId: { in: ofertas } }, select: { ruta: true } }),
      tx.$queryRaw<Array<{ ruta: string }>>`
        SELECT m.foto AS ruta FROM mensaje m
        WHERE m.autor_id = ANY(${usuarios}::uuid[]) AND m.foto IS NOT NULL
        UNION SELECT v.foto FROM mensaje_version v JOIN mensaje m ON m.id = v.mensaje_id
        WHERE m.autor_id = ANY(${usuarios}::uuid[]) AND v.foto IS NOT NULL`,
      tx.archivo.findMany({
        where: { OR: [{ tiendaId }, { usuarioId: deSusPersonas }] },
        select: { ruta: true },
      }),
    ]);
    const rutas = [
      tienda.logo,
      tienda.portadaRuta,
      ...fotosOfertas.map((f) => f.ruta),
      ...fotosMensajes.map((f) => f.ruta),
      ...subidas.map((f) => f.ruta),
    ].filter((ruta): ruta is string => Boolean(ruta));

    // ── Chats: se van sus mensajes; la otra tienda conserva los suyos ──────────
    const hilos = (
      await tx.conversacion.findMany({
        where: {
          OR: [
            { tiendaCompradoraId: tiendaId },
            { tiendaVendedoraId: tiendaId },
            { compradorId: deSusPersonas },
            { vendedorId: deSusPersonas },
            { ofertaId: { in: ofertas } },
          ],
        },
        select: { id: true },
      })
    ).map((c) => c.id);
    await tx.mensaje.deleteMany({ where: { autorId: deSusPersonas } });
    // «Eliminar para mí» de sus personas: sus ids salen de los mensajes que quedan.
    if (hilos.length > 0 && usuarios.length > 0) {
      await tx.$executeRaw`
        UPDATE mensaje
        SET oculto_para = ARRAY(
          SELECT u FROM unnest(oculto_para) AS u WHERE NOT (u = ANY(${usuarios}::uuid[]))
        )
        WHERE conversacion_id = ANY(${hilos}::uuid[]) AND oculto_para && ${usuarios}::uuid[]`;
    }
    // Un chat en el que la otra tienda no escribió nada ya no le sirve a nadie.
    const vacios = (
      await tx.conversacion.findMany({
        where: { id: { in: hilos }, mensajes: { none: {} } },
        select: { id: true },
      })
    ).map((c) => c.id);
    await tx.conversacion.deleteMany({ where: { id: { in: vacios } } });
    // En los que quedan, su lado queda nulo («Tienda eliminada») y, si vendía, la publicación.
    await tx.conversacion.updateMany({
      where: { OR: [{ tiendaCompradoraId: tiendaId }, { compradorId: deSusPersonas }] },
      data: { tiendaCompradoraId: null, compradorId: null },
    });
    await tx.conversacion.updateMany({
      where: { OR: [{ tiendaVendedoraId: tiendaId }, { vendedorId: deSusPersonas }] },
      data: { tiendaVendedoraId: null, vendedorId: null },
    });
    await tx.conversacion.updateMany({
      where: { ofertaId: { in: ofertas } },
      data: { ofertaId: null },
    });

    // ── Ventas y opiniones ─────────────────────────────────────────────────────
    await tx.opinion.deleteMany({
      where: { OR: [{ tiendaId }, { autorTiendaId: tiendaId }, { autorId: deSusPersonas }] },
    });
    // Sus ventas (de sus publicaciones) se van; sus compras a otras quedan sin comprador.
    await tx.venta.deleteMany({ where: { ofertaId: { in: ofertas } } });
    await tx.venta.updateMany({
      where: { OR: [{ tiendaCompradoraId: tiendaId }, { compradorId: deSusPersonas }] },
      data: { tiendaCompradoraId: null, compradorId: null },
    });

    // ── Pedidos en vivo ────────────────────────────────────────────────────────
    await tx.enVivoRespuesta.deleteMany({
      where: { OR: [{ tiendaId }, { usuarioId: deSusPersonas }] },
    });
    await tx.enVivo.deleteMany({ where: { OR: [{ tiendaId }, { autorId: deSusPersonas }] } });

    // ── Publicaciones (fotos y vistas se van con ellas) ────────────────────────
    await tx.contacto.deleteMany({
      where: { OR: [{ ofertaId: { in: ofertas } }, { usuarioId: deSusPersonas }] },
    });
    await tx.oferta.deleteMany({ where: { tiendaId } });
    // El catálogo es de todos: los productos que creó quedan, sin su nombre.
    await tx.producto.updateMany({
      where: { creadoPorTiendaId: tiendaId },
      data: { creadoPorTiendaId: null },
    });

    // ── Avisos de otras personas sobre lo suyo: sus mensajes (el extracto los cita), su
    //    perfil, sus pedidos en vivo y los chats que se borraron ─────────────────────
    const enlaces = [tiendaId, ...enVivo, ...vacios];
    await tx.aviso.deleteMany({
      where: {
        OR: [
          { conversacionId: { in: hilos } },
          ...enlaces.map((id) => ({ enlace: { contains: id } })),
        ],
      },
    });

    // ── Reportes ───────────────────────────────────────────────────────────────
    await tx.denuncia.deleteMany({ where: { denuncianteId: deSusPersonas } });
    // Los de otras tiendas contra ella quedan (son de quien reportó), cerrados y sin tienda.
    await tx.denuncia.updateMany({
      where: { tiendaDenunciadaId: tiendaId, estado: { in: ['ABIERTA', 'EN_REVISION'] } },
      data: {
        estado: 'REVISADA',
        resolucion: 'La tienda ya no está en PaseLibre.',
        resueltaEn: new Date(),
      },
    });

    // ── Lo demás de la tienda ──────────────────────────────────────────────────
    await tx.cargaPlanilla.deleteMany({ where: { tiendaId } });
    await tx.destacado.deleteMany({ where: { tiendaId } });
    await tx.seguimiento.deleteMany({
      where: { OR: [{ tiendaId }, { seguidaId: tiendaId }, { usuarioId: deSusPersonas }] },
    });
    await tx.archivo.deleteMany({ where: { OR: [{ tiendaId }, { usuarioId: deSusPersonas }] } });
    await tx.registroEquipo.deleteMany({ where: { tiendaId } });
    await tx.solicitud.deleteMany({
      where: { OR: [{ tiendaId }, { usuarioId: deSusPersonas }] },
    });

    // Sus personas (con sesiones, avisos, bloqueos, respuestas rápidas, alertas y preferencias)
    // y la tienda (con advertencias, chat con el Equipo, socios, seguidores, cambios de lugar,
    // «Ayudar como la tienda» y bloqueos que recibió).
    await tx.usuario.deleteMany({ where: { id: deSusPersonas } });
    await tx.tienda.delete({ where: { id: tiendaId } });

    await tx.registroEquipo.create({
      data: { autorId: actorId, accion: `eliminó a ${nombre}`.slice(0, 240) },
    });
    await tx.auditoria.create({
      data: { actorId, accion: ELIMINADA, objeto: 'tienda', objetoId: tiendaId, datos: {} },
    });
    return { rutas, usuarios };
  }
}

function bloqueado(desde: Date): ApiHttpException {
  const minutos = Math.max(1, Math.ceil((desde.getTime() + BLOQUEO_MS - Date.now()) / 60_000));
  return new ApiHttpException(
    HttpStatus.TOO_MANY_REQUESTS,
    'CUENTA_BLOQUEADA_TEMPORALMENTE',
    `Escribiste mal tu contraseña ${MAX_INTENTOS_ELIMINAR} veces. Vuelve a intentarlo en ${minutos} min.`,
  );
}
