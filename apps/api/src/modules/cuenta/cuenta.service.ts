import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  ActualizarCuentaDatos,
  AvisosCuentaDatos,
  RespuestaAvisosCuenta,
  RespuestaCuenta,
  RespuestaRapida,
  SesionAbierta,
  TiendaBloqueada,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';

const INCLUIR_TIENDA = { tienda: { include: { galeria: true } } } as const;
type UsuarioConTienda = Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_TIENDA }>;

/** «Chrome en Android», para reconocer cada sesión abierta. */
export function dispositivoDe(agente: string | null): string {
  if (!agente) return 'Navegador desconocido';
  const navegador = /Edg(e|iOS|A)?\//.test(agente)
    ? 'Edge'
    : /Firefox\/|FxiOS\//.test(agente)
      ? 'Firefox'
      : /OPR\/|Opera/.test(agente)
        ? 'Opera'
        : /Chrome\/|CriOS\//.test(agente)
          ? 'Chrome'
          : /Safari\//.test(agente)
            ? 'Safari'
            : 'Navegador';
  const sistema = /iPhone/.test(agente)
    ? 'iPhone'
    : /iPad/.test(agente)
      ? 'iPad'
      : /Android/.test(agente)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(agente)
          ? 'Mac'
          : /Windows/.test(agente)
            ? 'Windows'
            : /Linux/.test(agente)
              ? 'Linux'
              : '';
  return sistema ? `${navegador} en ${sistema}` : navegador;
}

/** 1320 → «22:00». */
function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

function respuestaCuenta(usuario: UsuarioConTienda): RespuestaCuenta {
  const { tienda } = usuario;
  return {
    usuario: {
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      whatsapp: usuario.whatsapp,
      rol: usuario.rol,
      mostrar_visto: usuario.mostrarVisto,
    },
    tienda: tienda
      ? {
          nombre: tienda.nombre,
          tipo: tienda.tipo,
          galeria: tienda.galeria?.nombre ?? null,
          stand: tienda.stand,
          whatsapp: tienda.whatsapp,
          horario: tienda.horario,
          descripcion: tienda.descripcion,
          logo: tienda.logo,
          precio_visible_defecto: tienda.precioVisibleDefecto,
          moneda_defecto: tienda.monedaDefecto,
        }
      : null,
  };
}

/**
 * Configuración (C_Configuracion; RF-48, RF-56, RF-58 a RF-60). En el MVP el dueño y el
 * asesor pueden lo mismo dentro de su tienda (docs/05 §9), así que los dos editan sus datos.
 */
@Injectable()
export class CuentaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  async cuenta(usuarioId: string): Promise<RespuestaCuenta> {
    return respuestaCuenta(
      await this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        include: INCLUIR_TIENDA,
      }),
    );
  }

  async actualizar(usuarioId: string, cambios: ActualizarCuentaDatos): Promise<RespuestaCuenta> {
    try {
      const usuario = await this.prisma.$transaction(async (tx) => {
        const actual = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { tiendaId: true, tienda: { select: { logo: true } } },
        });
        const { tienda } = cambios;
        if (tienda) {
          if (!actual.tiendaId) {
            throw new ApiHttpException(
              HttpStatus.FORBIDDEN,
              'PROHIBIDO',
              'Tu cuenta no tiene tienda.',
            );
          }
          if (tienda.logo && tienda.logo !== actual.tienda?.logo) {
            await this.archivos.reclamar(tx, [tienda.logo], actual.tiendaId);
          }
          await tx.tienda.update({
            where: { id: actual.tiendaId },
            data: {
              nombre: tienda.nombre,
              whatsapp: tienda.whatsapp,
              horario: tienda.horario,
              descripcion: tienda.descripcion,
              logo: tienda.logo,
              precioVisibleDefecto: tienda.precio_visible_defecto,
              monedaDefecto: tienda.moneda_defecto,
            },
          });
        }
        return tx.usuario.update({
          where: { id: usuarioId },
          data: {
            nombre: cambios.nombre,
            correo: cambios.correo,
            whatsapp: cambios.whatsapp,
            mostrarVisto: cambios.mostrar_visto,
          },
          include: INCLUIR_TIENDA,
        });
      });
      return respuestaCuenta(usuario);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese correo ya lo usa otra cuenta.',
        );
      }
      throw error;
    }
  }

  // ── Avisos (RF-59) ────────────────────────────────────────────────────────

  async avisos(usuarioId: string): Promise<RespuestaAvisosCuenta> {
    const [usuario, preferencia] = await Promise.all([
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { noMolestarDesde: true, noMolestarHasta: true },
      }),
      this.prisma.preferenciaAviso.findUnique({
        where: { usuarioId_tipo: { usuarioId, tipo: 'MENSAJE' } },
      }),
    ]);
    return {
      campanita: { MENSAJE: preferencia?.campanita ?? true },
      no_molestar:
        usuario.noMolestarDesde !== null && usuario.noMolestarHasta !== null
          ? { desde: aHora(usuario.noMolestarDesde), hasta: aHora(usuario.noMolestarHasta) }
          : null,
    };
  }

  async guardarAvisos(usuarioId: string, datos: AvisosCuentaDatos): Promise<RespuestaAvisosCuenta> {
    await this.prisma.$transaction([
      this.prisma.preferenciaAviso.upsert({
        where: { usuarioId_tipo: { usuarioId, tipo: 'MENSAJE' } },
        update: { campanita: datos.campanita.MENSAJE },
        create: { usuarioId, tipo: 'MENSAJE', campanita: datos.campanita.MENSAJE },
      }),
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          noMolestarDesde: datos.no_molestar?.desde ?? null,
          noMolestarHasta: datos.no_molestar?.hasta ?? null,
        },
      }),
    ]);
    return this.avisos(usuarioId);
  }

  // ── Respuestas rápidas (RF-56) ────────────────────────────────────────────

  respuestasRapidas(usuarioId: string): Promise<RespuestaRapida[]> {
    return this.prisma.respuestaRapida.findMany({
      where: { usuarioId },
      orderBy: { orden: 'asc' },
      select: { id: true, texto: true },
    });
  }

  async guardarRespuestasRapidas(usuarioId: string, textos: string[]): Promise<RespuestaRapida[]> {
    await this.prisma.$transaction([
      this.prisma.respuestaRapida.deleteMany({ where: { usuarioId } }),
      this.prisma.respuestaRapida.createMany({
        data: textos.map((texto, orden) => ({ usuarioId, texto, orden })),
      }),
    ]);
    return this.respuestasRapidas(usuarioId);
  }

  // ── Sesiones (RF-60) ──────────────────────────────────────────────────────

  async sesiones(sesion: SesionActiva): Promise<SesionAbierta[]> {
    const abiertas = await this.prisma.sesion.findMany({
      where: { usuarioId: sesion.usuario.id, revocadaEn: null, expiraEn: { gt: new Date() } },
      orderBy: { usadaEn: 'desc' },
      select: { id: true, agente: true, usadaEn: true },
    });
    return abiertas
      .map((s) => ({
        id: s.id,
        dispositivo: dispositivoDe(s.agente),
        ultimo_uso: s.usadaEn.toISOString(),
        actual: s.id === sesion.sesionId,
      }))
      .sort((a, b) => Number(b.actual) - Number(a.actual));
  }

  async cerrarSesion(sesion: SesionActiva, id: string): Promise<void> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { id, usuarioId: sesion.usuario.id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    if (count === 0) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa sesión ya está cerrada.',
      );
    }
    this.tiempoReal.desconectarSesion(id);
  }

  async cerrarOtras(sesion: SesionActiva): Promise<{ cerradas: number }> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { usuarioId: sesion.usuario.id, revocadaEn: null, NOT: { id: sesion.sesionId } },
      data: { revocadaEn: new Date() },
    });
    await this.tiempoReal.desconectarUsuario(sesion.usuario.id, sesion.sesionId);
    return { cerradas: count };
  }

  // ── Bloqueados (RF-57) ────────────────────────────────────────────────────

  async bloqueados(usuarioId: string): Promise<TiendaBloqueada[]> {
    const bloqueos = await this.prisma.bloqueo.findMany({
      where: { usuarioId },
      orderBy: { creadoEn: 'desc' },
      select: {
        creadoEn: true,
        tiendaBloqueada: {
          select: { id: true, nombre: true, galeria: { select: { nombre: true } } },
        },
      },
    });
    return bloqueos.map((b) => ({
      tienda: {
        id: b.tiendaBloqueada.id,
        nombre: b.tiendaBloqueada.nombre,
        galeria: b.tiendaBloqueada.galeria?.nombre ?? null,
      },
      desde: b.creadoEn.toISOString(),
    }));
  }

  async desbloquear(usuarioId: string, tiendaId: string): Promise<void> {
    await this.prisma.bloqueo.deleteMany({ where: { usuarioId, tiendaBloqueadaId: tiendaId } });
  }
}
