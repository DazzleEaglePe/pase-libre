import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  RespuestaResolverSolicitud,
  RespuestaSeguidores,
  RespuestaSolicitudSeguir,
  RespuestaVisibilidad,
  VisibilidadPerfil,
} from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { inicialesDe } from './tiendas.service';

const noEncontrada = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
const solicitudNoEncontrada = () =>
  new ApiHttpException(
    HttpStatus.NOT_FOUND,
    'NO_ENCONTRADO',
    'Esta solicitud ya no está: la cancelaron o ya la respondiste.',
  );

/** La tienda de quien tiene la sesión; el Equipo no tiene tienda. */
function miTienda(sesion: SesionActiva): string {
  const tiendaId = sesion.usuario.tiendaId;
  if (!tiendaId) {
    throw new ApiHttpException(
      HttpStatus.FORBIDDEN,
      'PROHIBIDO',
      'Las cuentas del equipo no tienen perfil de tienda.',
    );
  }
  return tiendaId;
}

/**
 * Perfil Público / Privado / Oculto (doc 20, punto 5): el selector «Perfil: Público ▾», «Solicitar
 * seguir» a un perfil privado (con su aviso «Aceptar» / «Rechazar» en la campana) y «Tus
 * seguidores (N)» con «Quitar». Qué ve cada quien lo decide `shared/bloqueadas.ts`.
 */
@Injectable()
export class PrivacidadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  /**
   * «¿QUIÉN VE TU PERFIL?». Al pasar a Privado, las que ya la seguían se quedan. Las solicitudes
   * que esperan siguen ahí: la dueña las acepta o rechaza desde la campana.
   */
  async cambiarVisibilidad(
    visibilidad: VisibilidadPerfil,
    sesion: SesionActiva,
  ): Promise<RespuestaVisibilidad> {
    const tiendaId = miTienda(sesion);
    const tienda = await this.prisma.tienda.update({
      where: { id: tiendaId },
      data: { visibilidad },
      select: { visibilidad: true },
    });
    return { visibilidad: tienda.visibilidad };
  }

  // ── Solicitar seguir ──────────────────────────────────────────────────────

  /** «Solicitar seguir» a un perfil privado: le llega a la tienda como aviso en la campana. */
  async solicitar(seguidaId: string, sesion: SesionActiva): Promise<RespuestaSolicitudSeguir> {
    const tiendaId = miTienda(sesion);
    if (tiendaId === seguidaId) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'No puedes seguir a tu propia tienda.',
      );
    }
    const seguida = await this.prisma.tienda.findFirst({
      where: { id: seguidaId, estado: 'ACTIVA' },
      select: { visibilidad: true },
    });
    if (!seguida || seguida.visibilidad === 'OCULTO') throw noEncontrada();
    if (seguida.visibilidad === 'PUBLICO') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esta tienda es pública: puedes seguirla directamente.',
      );
    }
    const yaLaSigue = await this.prisma.seguimiento.count({ where: { tiendaId, seguidaId } });
    if (yaLaSigue) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya sigues a esta tienda.');
    }
    const existente = await this.prisma.solicitudSeguir.findUnique({
      where: { tiendaId_seguidaId: { tiendaId, seguidaId } },
      select: { id: true },
    });
    // Pedirla dos veces no vuelve a avisar.
    if (existente) return { solicitud_enviada: true };
    const solicitud = await this.prisma.solicitudSeguir.create({
      data: { tiendaId, seguidaId, usuarioId: sesion.usuario.id },
      select: { id: true },
    });
    const personas = await this.prisma.usuario.findMany({
      where: { tiendaId: seguidaId, estado: 'ACTIVO', quitadoEn: null },
      select: { id: true },
    });
    const nombre = sesion.usuario.tienda?.nombre ?? 'Una tienda';
    await this.avisos.crear(
      personas.map((persona) => persona.id),
      {
        tipo: 'SOLICITUD_SEGUIR',
        titulo: `${nombre} quiere seguir tu tienda.`,
        enlace: `/tiendas/${tiendaId}`,
        accion: {
          tipo: 'SOLICITUD_SEGUIR',
          solicitud_id: solicitud.id,
          enlace: `/tiendas/${tiendaId}`,
        },
      },
    );
    return { solicitud_enviada: true };
  }

  /** «Solicitud enviada» → cancelar: se borra, y también su aviso en la otra tienda. */
  async cancelar(seguidaId: string, sesion: SesionActiva): Promise<RespuestaSolicitudSeguir> {
    const tiendaId = miTienda(sesion);
    const solicitud = await this.prisma.solicitudSeguir.findUnique({
      where: { tiendaId_seguidaId: { tiendaId, seguidaId } },
      select: { id: true },
    });
    if (solicitud) await this.borrar(solicitud.id);
    return { solicitud_enviada: false };
  }

  /** «Aceptar»: crea el seguimiento y borra la solicitud. A la otra tienda le llega un aviso. */
  async aceptar(solicitudId: string, sesion: SesionActiva): Promise<RespuestaResolverSolicitud> {
    const seguidaId = miTienda(sesion);
    const solicitud = await this.prisma.solicitudSeguir.findFirst({
      where: { id: solicitudId, seguidaId },
      select: {
        id: true,
        tiendaId: true,
        usuarioId: true,
        tienda: { select: { nombre: true } },
      },
    });
    if (!solicitud) throw solicitudNoEncontrada();
    await this.prisma.$transaction([
      this.prisma.seguimiento.upsert({
        where: { tiendaId_seguidaId: { tiendaId: solicitud.tiendaId, seguidaId } },
        create: { tiendaId: solicitud.tiendaId, seguidaId, usuarioId: solicitud.usuarioId },
        update: {},
      }),
      this.prisma.solicitudSeguir.delete({ where: { id: solicitud.id } }),
    ]);
    await this.borrarAvisos(solicitud.id);
    const personas = await this.prisma.usuario.findMany({
      where: { tiendaId: solicitud.tiendaId, estado: 'ACTIVO', quitadoEn: null },
      select: { id: true },
    });
    const nombre = sesion.usuario.tienda?.nombre ?? 'La tienda';
    await this.avisos.crear(
      personas.map((persona) => persona.id),
      {
        tipo: 'SEGUIDA',
        titulo: `${nombre} aceptó tu solicitud`,
        extracto: 'Ya ves sus publicaciones, su stand y sus datos.',
        enlace: `/tiendas/${seguidaId}`,
        accion: { tipo: 'ABRIR', texto: 'Ver sus productos', enlace: `/tiendas/${seguidaId}` },
      },
    );
    return { mensaje: `Ahora ${solicitud.tienda.nombre} te sigue.` };
  }

  /** «Rechazar»: la borra sin avisar a la otra tienda. */
  async rechazar(solicitudId: string, sesion: SesionActiva): Promise<RespuestaResolverSolicitud> {
    const seguidaId = miTienda(sesion);
    const solicitud = await this.prisma.solicitudSeguir.findFirst({
      where: { id: solicitudId, seguidaId },
      select: { id: true, tienda: { select: { nombre: true } } },
    });
    if (!solicitud) throw solicitudNoEncontrada();
    await this.borrar(solicitud.id);
    return { mensaje: `Rechazaste la solicitud de ${solicitud.tienda.nombre}.` };
  }

  private async borrar(solicitudId: string): Promise<void> {
    await this.prisma.solicitudSeguir.deleteMany({ where: { id: solicitudId } });
    await this.borrarAvisos(solicitudId);
  }

  /** El aviso «… quiere seguir tu tienda» ya no tiene nada que responder. */
  private async borrarAvisos(solicitudId: string): Promise<void> {
    await this.prisma.aviso.deleteMany({
      where: { tipo: 'SOLICITUD_SEGUIR', accion: { path: ['solicitud_id'], equals: solicitudId } },
    });
  }

  // ── Tus seguidores ────────────────────────────────────────────────────────

  /** «Tus seguidores (N)»: las tiendas que siguen a la tuya, la más reciente primero. */
  async seguidoras(sesion: SesionActiva): Promise<RespuestaSeguidores> {
    const seguidaId = miTienda(sesion);
    const filas = await this.prisma.seguimiento.findMany({
      where: { seguidaId, tienda: { estado: 'ACTIVA' } },
      orderBy: { creadoEn: 'desc' },
      select: {
        creadoEn: true,
        tienda: { select: { id: true, nombre: true, galeria: { select: { nombre: true } } } },
      },
    });
    return {
      seguidoras: filas.map(({ creadoEn, tienda }) => ({
        id: tienda.id,
        nombre: tienda.nombre,
        iniciales: inicialesDe(tienda.nombre),
        galeria: tienda.galeria?.nombre ?? null,
        desde: creadoEn.toISOString(),
      })),
      total: filas.length,
    };
  }

  /** «Quitar»: borra su seguimiento, sin avisarle. Si tu perfil es privado, ya no ve lo tuyo. */
  async quitarSeguidora(tiendaId: string, sesion: SesionActiva): Promise<RespuestaSeguidores> {
    const seguidaId = miTienda(sesion);
    await this.prisma.seguimiento.deleteMany({ where: { tiendaId, seguidaId } });
    return this.seguidoras(sesion);
  }
}
