import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  EscribirEquipoDatos,
  HiloEquipoEnLista,
  MensajeChatEquipo,
  RespuestaChatEquipo,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';

const MOTIVO = { ESTAFA: 'Estafa', DESCRITO: 'No cumplió con lo descrito', TRATO: 'Mal trato' };
const ESTADO = {
  ABIERTA: 'Abierto',
  EN_REVISION: 'En revisión',
  REVISADA: 'Resuelto',
  DESCARTADA: 'Cerrado',
};
const ULTIMOS = 200;

const SELECT_MENSAJE = {
  id: true,
  texto: true,
  deEquipo: true,
  autorId: true,
  creadoEn: true,
  autor: { select: { nombre: true } },
  denuncia: { select: { codigo: true, tipo: true, estado: true } },
} satisfies Prisma.MensajeEquipoSelect;

type FilaMensaje = Prisma.MensajeEquipoGetPayload<{ select: typeof SELECT_MENSAJE }>;

function aMensaje(fila: FilaMensaje, usuarioId: string): MensajeChatEquipo {
  return {
    id: fila.id,
    texto: fila.texto,
    de_equipo: fila.deEquipo,
    // Del equipo se dice el nombre de pila: «Fabrizio · Equipo PaseLibre».
    autor: fila.deEquipo
      ? (fila.autor.nombre.split(' ')[0] ?? fila.autor.nombre)
      : fila.autor.nombre,
    mio: fila.autorId === usuarioId,
    creado_en: fila.creadoEn.toISOString(),
    caso: fila.denuncia
      ? {
          codigo: `R-${fila.denuncia.codigo}`,
          motivo: fila.denuncia.tipo ? MOTIVO[fila.denuncia.tipo] : 'Reporte',
          estado: ESTADO[fila.denuncia.estado],
        }
      : null,
  };
}

/**
 * El chat oficial con el equipo (REP_WebChatEquipo, secciones 13 y 18 del lienzo final): uno
 * por tienda, fijado arriba en Mensajes. El equipo puede escribir primero, por ejemplo por un
 * reporte («Caso R-1031»); la tienda contesta. Cada lado recibe su aviso.
 */
@Injectable()
export class SoporteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  private tiendaDe(sesion: SesionActiva): string {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    return tiendaId;
  }

  /** Lo de la tienda: los mensajes y cuántos no leyó. Con `leer`, los marca leídos. */
  async miChat(sesion: SesionActiva, leer: boolean): Promise<RespuestaChatEquipo> {
    const tiendaId = this.tiendaDe(sesion);
    const hilo = await this.prisma.hiloEquipo.findUnique({
      where: { tiendaId },
      select: { id: true, leidoTiendaHasta: true },
    });
    if (!hilo) return { mensajes: [], sin_leer: 0 };
    const [filas, sinLeer] = await Promise.all([
      this.prisma.mensajeEquipo.findMany({
        where: { hiloId: hilo.id },
        orderBy: { creadoEn: 'desc' },
        take: ULTIMOS,
        select: SELECT_MENSAJE,
      }),
      this.prisma.mensajeEquipo.count({
        where: {
          hiloId: hilo.id,
          deEquipo: true,
          ...(hilo.leidoTiendaHasta ? { creadoEn: { gt: hilo.leidoTiendaHasta } } : {}),
        },
      }),
    ]);
    if (leer && sinLeer > 0) {
      await this.prisma.hiloEquipo.update({
        where: { id: hilo.id },
        data: { leidoTiendaHasta: new Date() },
      });
    }
    return {
      mensajes: filas.reverse().map((fila) => aMensaje(fila, sesion.usuario.id)),
      sin_leer: leer ? 0 : sinLeer,
    };
  }

  /** La tienda le escribe al equipo: el hilo se crea si no existía y el equipo recibe aviso. */
  async escribirAlEquipo(
    datos: EscribirEquipoDatos,
    sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    const tiendaId = this.tiendaDe(sesion);
    const mensaje = await this.escribir(tiendaId, sesion.usuario.id, false, datos.texto, null);
    const equipo = await this.prisma.usuario.findMany({
      where: { rol: 'EQUIPO', estado: 'ACTIVO' },
      select: { id: true },
    });
    await this.avisos.crear(
      equipo.map((persona) => persona.id),
      {
        tipo: 'SISTEMA',
        titulo: `${sesion.usuario.tienda?.nombre ?? 'Una tienda'} escribió al equipo`,
        extracto: datos.texto,
        enlace: `/equipo/chats?tienda=${tiendaId}`,
      },
    );
    return aMensaje(mensaje, sesion.usuario.id);
  }

  // ── Del lado del equipo ──────────────────────────────────────────────────

  async hilos(): Promise<HiloEquipoEnLista[]> {
    const hilos = await this.prisma.hiloEquipo.findMany({
      orderBy: { ultimoMensajeEn: 'desc' },
      take: 200,
      select: {
        id: true,
        ultimoMensajeEn: true,
        leidoEquipoHasta: true,
        tienda: {
          select: { id: true, nombre: true, stand: true, galeria: { select: { nombre: true } } },
        },
        mensajes: { orderBy: { creadoEn: 'desc' }, take: 1, select: SELECT_MENSAJE },
      },
    });
    const sinLeer = await Promise.all(
      hilos.map((hilo) =>
        this.prisma.mensajeEquipo.count({
          where: {
            hiloId: hilo.id,
            deEquipo: false,
            ...(hilo.leidoEquipoHasta ? { creadoEn: { gt: hilo.leidoEquipoHasta } } : {}),
          },
        }),
      ),
    );
    return hilos.map((hilo, i) => ({
      tienda: {
        id: hilo.tienda.id,
        nombre: hilo.tienda.nombre,
        galeria: hilo.tienda.galeria?.nombre ?? null,
        stand: hilo.tienda.stand,
      },
      ultimo: hilo.mensajes[0] ? aMensaje(hilo.mensajes[0], '') : null,
      sin_leer: sinLeer[i] ?? 0,
      actualizado_en: hilo.ultimoMensajeEn.toISOString(),
    }));
  }

  async chatDeTienda(tiendaId: string, sesion: SesionActiva): Promise<RespuestaChatEquipo> {
    const hilo = await this.prisma.hiloEquipo.findUnique({
      where: { tiendaId },
      select: { id: true },
    });
    if (!hilo) return { mensajes: [], sin_leer: 0 };
    const filas = await this.prisma.mensajeEquipo.findMany({
      where: { hiloId: hilo.id },
      orderBy: { creadoEn: 'desc' },
      take: ULTIMOS,
      select: SELECT_MENSAJE,
    });
    await this.prisma.hiloEquipo.update({
      where: { id: hilo.id },
      data: { leidoEquipoHasta: new Date() },
    });
    return {
      mensajes: filas.reverse().map((fila) => aMensaje(fila, sesion.usuario.id)),
      sin_leer: 0,
    };
  }

  /** El equipo le escribe a una tienda (puede ser el primero): a su gente le llega un aviso. */
  async escribirATienda(
    tiendaId: string,
    datos: EscribirEquipoDatos,
    sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { id: true, usuarios: { where: { estado: 'ACTIVO' }, select: { id: true } } },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    if (datos.denuncia) {
      const denuncia = await this.prisma.denuncia.findUnique({
        where: { id: datos.denuncia },
        select: { tiendaDenunciadaId: true, denunciante: { select: { tiendaId: true } } },
      });
      // El caso tiene que ser de esa tienda: reportada o quien reportó.
      if (
        !denuncia ||
        (denuncia.tiendaDenunciadaId !== tiendaId && denuncia.denunciante.tiendaId !== tiendaId)
      ) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Ese reporte no es de esta tienda.',
        );
      }
    }
    const mensaje = await this.escribir(
      tiendaId,
      sesion.usuario.id,
      true,
      datos.texto,
      datos.denuncia ?? null,
    );
    await this.avisos.crear(
      tienda.usuarios.map((persona) => persona.id),
      {
        tipo: 'EQUIPO',
        titulo: 'El equipo PaseLibre te escribió',
        extracto: datos.texto,
        enlace: '/mensajes/equipo',
        accion: { tipo: 'ABRIR', texto: 'Responder', enlace: '/mensajes/equipo' },
      },
    );
    return aMensaje(mensaje, sesion.usuario.id);
  }

  private async escribir(
    tiendaId: string,
    autorId: string,
    deEquipo: boolean,
    texto: string,
    denunciaId: string | null,
  ): Promise<FilaMensaje> {
    const ahora = new Date();
    const hilo = await this.prisma.hiloEquipo.upsert({
      where: { tiendaId },
      create: {
        tiendaId,
        ultimoMensajeEn: ahora,
        ...(deEquipo ? { leidoEquipoHasta: ahora } : { leidoTiendaHasta: ahora }),
      },
      update: {
        ultimoMensajeEn: ahora,
        ...(deEquipo ? { leidoEquipoHasta: ahora } : { leidoTiendaHasta: ahora }),
      },
      select: { id: true },
    });
    return this.prisma.mensajeEquipo.create({
      data: { hiloId: hilo.id, autorId, deEquipo, texto, denunciaId, creadoEn: ahora },
      select: SELECT_MENSAJE,
    });
  }
}
