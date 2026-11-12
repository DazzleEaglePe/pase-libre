import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  CambioDeLugar,
  CambioLugarDatos,
  GaleriaParaElegir,
  LugarTienda,
  RespuestaCuenta,
} from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { CuentaService } from './cuenta.service';

/** «Cyberplaza · Piso 2 · Stand 2B 105». */
export function lugarATexto(lugar: Pick<LugarTienda, 'galeria' | 'piso' | 'stand'>): string {
  return [
    lugar.galeria ?? 'Independiente',
    lugar.piso && `Piso ${lugar.piso}`,
    lugar.stand && `Stand ${lugar.stand}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const noExiste = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Ese cambio ya no está pendiente.');

/**
 * Galería, piso y stand (N09_ConfigWebTodo): la tienda los cambia en Configuración, pero quedan
 * «Pendiente de aprobación» hasta que el Equipo los confirma; mientras, el perfil sigue con el
 * lugar de antes. Una pendiente por tienda: pedir otro cambio reemplaza al anterior.
 */
@Injectable()
export class LugarService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CuentaService) private readonly cuentas: CuentaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  /** Las galerías activas, en el orden del Equipo. */
  async galerias(): Promise<GaleriaParaElegir[]> {
    return this.prisma.galeria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true },
    });
  }

  private async tiendaDe(sesion: SesionActiva) {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    return this.prisma.tienda.findUniqueOrThrow({
      where: { id: tiendaId },
      select: { id: true, tipo: true, galeriaId: true, piso: true, stand: true },
    });
  }

  /** Pide el cambio. Si es igual al lugar de hoy, solo retira lo que estuviera pendiente. */
  async pedir(datos: CambioLugarDatos, sesion: SesionActiva): Promise<RespuestaCuenta> {
    const tienda = await this.tiendaDe(sesion);
    if (tienda.tipo === 'INDEPENDIENTE') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Las tiendas independientes no tienen galería. Escríbele al Equipo PaseLibre.',
      );
    }
    const galeria = await this.prisma.galeria.count({
      where: { id: datos.galeria_id, activa: true },
    });
    if (!galeria) {
      throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Elige la galería.');
    }
    const igual =
      tienda.galeriaId === datos.galeria_id &&
      (tienda.piso ?? null) === (datos.piso ?? null) &&
      tienda.stand === datos.stand;
    await this.prisma.$transaction(async (tx) => {
      await tx.cambioLugar.updateMany({
        where: { tiendaId: tienda.id, estado: 'PENDIENTE' },
        data: { estado: 'RETIRADO' },
      });
      if (!igual) {
        await tx.cambioLugar.create({
          data: {
            tiendaId: tienda.id,
            galeriaId: datos.galeria_id,
            piso: datos.piso ?? null,
            stand: datos.stand,
            pedidoPorId: sesion.usuario.id,
          },
        });
      }
    });
    return this.cuentas.cuenta(sesion.usuario.id);
  }

  /** «Dejar como estaba»: retira el cambio pendiente. */
  async retirar(sesion: SesionActiva): Promise<RespuestaCuenta> {
    const tienda = await this.tiendaDe(sesion);
    await this.prisma.cambioLugar.updateMany({
      where: { tiendaId: tienda.id, estado: 'PENDIENTE' },
      data: { estado: 'RETIRADO' },
    });
    return this.cuentas.cuenta(sesion.usuario.id);
  }

  // ── Equipo ────────────────────────────────────────────────────────────────

  async pendientes(): Promise<CambioDeLugar[]> {
    const filas = await this.prisma.cambioLugar.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { creadoEn: 'asc' },
      take: 100,
      include: {
        galeria: { select: { nombre: true } },
        tienda: {
          select: {
            id: true,
            nombre: true,
            galeriaId: true,
            piso: true,
            stand: true,
            galeria: { select: { nombre: true } },
          },
        },
      },
    });
    const personas = await this.prisma.usuario.findMany({
      where: { id: { in: filas.map((fila) => fila.pedidoPorId) } },
      select: { id: true, nombre: true },
    });
    const nombre = new Map(personas.map((persona) => [persona.id, persona.nombre]));
    return filas.map((fila) => ({
      id: fila.id,
      tienda: { id: fila.tienda.id, nombre: fila.tienda.nombre },
      antes: {
        galeria_id: fila.tienda.galeriaId,
        galeria: fila.tienda.galeria?.nombre ?? null,
        piso: fila.tienda.piso,
        stand: fila.tienda.stand,
      },
      despues: {
        galeria_id: fila.galeriaId,
        galeria: fila.galeria.nombre,
        piso: fila.piso,
        stand: fila.stand,
      },
      pedido_por: nombre.get(fila.pedidoPorId) ?? 'Alguien de la tienda',
      pedido_en: fila.creadoEn.toISOString(),
    }));
  }

  private async avisarATienda(tiendaId: string, titulo: string, extracto: string) {
    const personas = await this.prisma.usuario.findMany({
      where: { tiendaId, estado: 'ACTIVO' },
      select: { id: true },
    });
    await this.avisos.crear(
      personas.map((persona) => persona.id),
      { tipo: 'EQUIPO', titulo, extracto, enlace: '/cuenta/configuracion?seccion=datos' },
    );
  }

  /** «Confirmar»: la tienda pasa al lugar nuevo y se le avisa. */
  async aprobar(id: string, sesion: SesionActiva): Promise<void> {
    const cambio = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.cambioLugar.findFirst({
        where: { id, estado: 'PENDIENTE' },
        include: { galeria: { select: { nombre: true } }, tienda: { select: { nombre: true } } },
      });
      if (!fila) throw noExiste();
      await tx.cambioLugar.update({
        where: { id },
        data: { estado: 'APROBADO', revisadoPorId: sesion.usuario.id, revisadoEn: new Date() },
      });
      await tx.tienda.update({
        where: { id: fila.tiendaId },
        data: { galeriaId: fila.galeriaId, piso: fila.piso, stand: fila.stand },
      });
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          accion: `confirmó el nuevo lugar de ${fila.tienda.nombre}`.slice(0, 240),
        },
      });
      return fila;
    });
    await this.avisarATienda(
      cambio.tiendaId,
      'El Equipo confirmó tu nuevo lugar',
      lugarATexto({ galeria: cambio.galeria.nombre, piso: cambio.piso, stand: cambio.stand }),
    );
  }

  /** «No confirmar»: queda el lugar de antes y la tienda sabe por qué. */
  async rechazar(id: string, motivo: string | undefined, sesion: SesionActiva): Promise<void> {
    const cambio = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.cambioLugar.findFirst({
        where: { id, estado: 'PENDIENTE' },
        include: { tienda: { select: { nombre: true } } },
      });
      if (!fila) throw noExiste();
      await tx.cambioLugar.update({
        where: { id },
        data: {
          estado: 'RECHAZADO',
          motivo: motivo ?? null,
          revisadoPorId: sesion.usuario.id,
          revisadoEn: new Date(),
        },
      });
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          accion: `no confirmó el cambio de lugar de ${fila.tienda.nombre}`.slice(0, 240),
        },
      });
      return fila;
    });
    await this.avisarATienda(
      cambio.tiendaId,
      'El Equipo no confirmó tu cambio de galería o stand',
      motivo ?? 'Sigues con tu lugar de antes. Si es un error, escríbenos por el chat del Equipo.',
    );
  }
}
