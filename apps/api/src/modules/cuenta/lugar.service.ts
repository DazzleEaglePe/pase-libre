import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  CambioDeLugar,
  CambioLugarDatos,
  CorregirCambioLugarDatos,
  GaleriaParaElegir,
  LugarTienda,
  RespuestaCuenta,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';

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

/** Los cambios que esperan algo del Equipo: suman en «Solicitudes N» (doc 19 §10). */
export const CAMBIOS_POR_REVISAR = {
  estado: { in: ['PENDIENTE', 'APLICADO_SIN_REVISAR'] },
} satisfies Prisma.CambioLugarWhereInput;

type Lugar = { galeriaId: string | null; piso: string | null; stand: string | null };

const mismoLugar = (a: Lugar, b: Lugar) =>
  a.galeriaId === b.galeriaId && (a.piso ?? null) === (b.piso ?? null) && a.stand === b.stand;

/**
 * Galería, piso y stand (N09_ConfigWebTodo, doc 19 §10). Con una galería de la lista, el cambio
 * queda al instante en el perfil y se guarda `APLICADO_SIN_REVISAR`, con lo de antes: en
 * Solicitudes el Equipo lo da por bueno, lo corrige o lo deshace. Con «Otra galería» (una que no
 * está en la lista) sigue «Pendiente de aprobación» como antes, porque el Equipo tiene que crearla.
 * Una pendiente por tienda: pedir otro cambio reemplaza al anterior.
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

  /**
   * Guarda el lugar nuevo. Con una galería de la lista se aplica ya; con «Otra galería» queda
   * pendiente. Si es igual al lugar de hoy, solo retira lo que estuviera pendiente.
   */
  async pedir(datos: CambioLugarDatos, sesion: SesionActiva): Promise<RespuestaCuenta> {
    const tienda = await this.tiendaDe(sesion);
    if (tienda.tipo === 'INDEPENDIENTE') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Las tiendas independientes no tienen galería. Escríbele al Equipo PaseLibre.',
      );
    }
    const piso = datos.piso ?? null;

    if (datos.galeria_otra) {
      const galeriaOtra = datos.galeria_otra;
      await this.prisma.$transaction(async (tx) => {
        await tx.cambioLugar.updateMany({
          where: { tiendaId: tienda.id, estado: 'PENDIENTE' },
          data: { estado: 'RETIRADO' },
        });
        await tx.cambioLugar.create({
          data: {
            tiendaId: tienda.id,
            galeriaOtra,
            piso,
            stand: datos.stand,
            pedidoPorId: sesion.usuario.id,
          },
        });
      });
      return this.cuentas.cuenta(sesion.usuario.id);
    }

    const galeria = await this.prisma.galeria.count({
      where: { id: datos.galeria_id, activa: true },
    });
    if (!galeria || !datos.galeria_id) {
      throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Elige la galería.');
    }
    const nuevo: Lugar = { galeriaId: datos.galeria_id, piso, stand: datos.stand };
    await this.prisma.$transaction(async (tx) => {
      // Elegir una de la lista deja sin efecto la «Otra galería» que esperaba.
      await tx.cambioLugar.updateMany({
        where: { tiendaId: tienda.id, estado: 'PENDIENTE' },
        data: { estado: 'RETIRADO' },
      });
      if (mismoLugar(tienda, nuevo)) return;
      await tx.tienda.update({
        where: { id: tienda.id },
        data: { galeriaId: nuevo.galeriaId, piso: nuevo.piso, stand: nuevo.stand },
      });
      // Si el Equipo todavía no miró el cambio anterior, este lo reemplaza y se conserva lo de
      // antes de todo: el Equipo ve una sola tarjeta. Si volvió a donde estaba, ya no hay nada
      // que revisar.
      const sinRevisar = await tx.cambioLugar.findFirst({
        where: { tiendaId: tienda.id, estado: 'APLICADO_SIN_REVISAR' },
        orderBy: { creadoEn: 'desc' },
      });
      if (sinRevisar) {
        const antes: Lugar = {
          galeriaId: sinRevisar.galeriaAntesId,
          piso: sinRevisar.pisoAntes,
          stand: sinRevisar.standAntes,
        };
        await tx.cambioLugar.update({
          where: { id: sinRevisar.id },
          data: mismoLugar(antes, nuevo)
            ? { estado: 'RETIRADO' }
            : {
                galeriaId: nuevo.galeriaId,
                piso: nuevo.piso,
                stand: datos.stand,
                pedidoPorId: sesion.usuario.id,
                creadoEn: new Date(),
              },
        });
        return;
      }
      await tx.cambioLugar.create({
        data: {
          tiendaId: tienda.id,
          galeriaId: nuevo.galeriaId,
          piso: nuevo.piso,
          stand: datos.stand,
          galeriaAntesId: tienda.galeriaId,
          pisoAntes: tienda.piso,
          standAntes: tienda.stand,
          estado: 'APLICADO_SIN_REVISAR',
          pedidoPorId: sesion.usuario.id,
        },
      });
    });
    return this.cuentas.cuenta(sesion.usuario.id);
  }

  /** «Dejar como estaba»: retira el cambio pendiente («Otra galería»). */
  async retirar(sesion: SesionActiva): Promise<RespuestaCuenta> {
    const tienda = await this.tiendaDe(sesion);
    await this.prisma.cambioLugar.updateMany({
      where: { tiendaId: tienda.id, estado: 'PENDIENTE' },
      data: { estado: 'RETIRADO' },
    });
    return this.cuentas.cuenta(sesion.usuario.id);
  }

  // ── Equipo ────────────────────────────────────────────────────────────────

  /** «Cambios de galería o stand · N»: los aplicados sin revisar y las «Otra galería». */
  async pendientes(): Promise<CambioDeLugar[]> {
    const filas = await this.prisma.cambioLugar.findMany({
      where: CAMBIOS_POR_REVISAR,
      orderBy: { creadoEn: 'asc' },
      take: 100,
      include: {
        galeria: { select: { nombre: true } },
        galeriaAntes: { select: { nombre: true } },
        tienda: {
          select: {
            id: true,
            nombre: true,
            logo: true,
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
    return filas.map((fila) => {
      const aplicado = fila.estado === 'APLICADO_SIN_REVISAR';
      return {
        id: fila.id,
        estado: aplicado ? 'APLICADO_SIN_REVISAR' : 'PENDIENTE',
        tienda: { id: fila.tienda.id, nombre: fila.tienda.nombre, logo: fila.tienda.logo },
        // En los aplicados, la tienda ya está en el lugar nuevo: lo de antes quedó guardado.
        antes: aplicado
          ? {
              galeria_id: fila.galeriaAntesId,
              galeria: fila.galeriaAntes?.nombre ?? null,
              piso: fila.pisoAntes,
              stand: fila.standAntes,
            }
          : {
              galeria_id: fila.tienda.galeriaId,
              galeria: fila.tienda.galeria?.nombre ?? null,
              piso: fila.tienda.piso,
              stand: fila.tienda.stand,
            },
        despues: {
          galeria_id: fila.galeriaId,
          galeria: fila.galeria?.nombre ?? fila.galeriaOtra,
          piso: fila.piso,
          stand: fila.stand,
        },
        galeria_otra: fila.galeriaId ? null : fila.galeriaOtra,
        pedido_por: nombre.get(fila.pedidoPorId) ?? 'Alguien de la tienda',
        pedido_en: fila.creadoEn.toISOString(),
      };
    });
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

  /**
   * «Confirmar» un pendiente de antes (la tienda pasa al lugar nuevo y se le avisa) o «Está bien»
   * con uno aplicado: se archiva y el número baja, sin avisarle nada a la tienda.
   */
  async aprobar(id: string, sesion: SesionActiva): Promise<void> {
    const cambio = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.cambioLugar.findFirst({
        where: { id, ...CAMBIOS_POR_REVISAR },
        include: { galeria: { select: { nombre: true } }, tienda: { select: { nombre: true } } },
      });
      if (!fila) throw noExiste();
      if (!fila.galeriaId || !fila.galeria) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          `«${fila.galeriaOtra ?? 'Esa galería'}» no está en la lista: créala en Galerías y elígela con «Confirmar».`,
        );
      }
      await tx.cambioLugar.update({
        where: { id },
        data: { estado: 'APROBADO', revisadoPorId: sesion.usuario.id, revisadoEn: new Date() },
      });
      const aplicado = fila.estado === 'APLICADO_SIN_REVISAR';
      if (!aplicado) {
        await tx.tienda.update({
          where: { id: fila.tiendaId },
          data: { galeriaId: fila.galeriaId, piso: fila.piso, stand: fila.stand },
        });
      }
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          tiendaId: fila.tiendaId,
          accion: (aplicado
            ? `dio por bueno el cambio de lugar de ${fila.tienda.nombre}`
            : `confirmó el nuevo lugar de ${fila.tienda.nombre}`
          ).slice(0, 240),
        },
      });
      return { ...fila, aplicado, galeria: fila.galeria };
    });
    if (cambio.aplicado) return;
    await this.avisarATienda(
      cambio.tiendaId,
      'El Equipo confirmó tu nuevo lugar',
      lugarATexto({ galeria: cambio.galeria.nombre, piso: cambio.piso, stand: cambio.stand }),
    );
  }

  /**
   * «Corregir» (doc 19 §10): el Equipo arregla galería, piso o stand ahí mismo («2b105» →
   * «2B 105») y queda revisado. Sirve también para confirmar una «Otra galería» ya creada. La
   * tienda recibe aviso de cómo quedó su perfil.
   */
  async corregir(id: string, datos: CorregirCambioLugarDatos, sesion: SesionActiva): Promise<void> {
    const piso = datos.piso ?? null;
    const cambio = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.cambioLugar.findFirst({
        where: { id, ...CAMBIOS_POR_REVISAR },
        include: { tienda: { select: { nombre: true } } },
      });
      if (!fila) throw noExiste();
      const galeria = await tx.galeria.findUnique({
        where: { id: datos.galeria_id },
        select: { nombre: true },
      });
      if (!galeria) {
        throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Elige la galería.');
      }
      await tx.cambioLugar.update({
        where: { id },
        data: {
          galeriaId: datos.galeria_id,
          piso,
          stand: datos.stand,
          estado: 'APROBADO',
          revisadoPorId: sesion.usuario.id,
          revisadoEn: new Date(),
        },
      });
      await tx.tienda.update({
        where: { id: fila.tiendaId },
        data: { galeriaId: datos.galeria_id, piso, stand: datos.stand },
      });
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          tiendaId: fila.tiendaId,
          accion: `corrigió el lugar de ${fila.tienda.nombre}: ${lugarATexto({
            galeria: galeria.nombre,
            piso,
            stand: datos.stand,
          })}`.slice(0, 240),
        },
      });
      return {
        tiendaId: fila.tiendaId,
        galeria: galeria.nombre,
        aplicado: fila.estado === 'APLICADO_SIN_REVISAR',
      };
    });
    await this.avisarATienda(
      cambio.tiendaId,
      // Una «Otra galería» que esperaba queda confirmada; uno ya aplicado, acomodado.
      cambio.aplicado
        ? 'El Equipo acomodó tu galería o stand'
        : 'El Equipo confirmó tu nuevo lugar',
      `Tu perfil dice ${lugarATexto({ galeria: cambio.galeria, piso, stand: datos.stand })}.`,
    );
  }

  /** «No confirmar» una «Otra galería»: queda el lugar de antes y la tienda sabe por qué. */
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
          tiendaId: fila.tiendaId,
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

  /**
   * «Deshacer» un cambio ya aplicado (doc 19 §10): la tienda vuelve a como estaba y le llega un
   * aviso, con el motivo si se escribió.
   */
  async deshacer(id: string, motivo: string | undefined, sesion: SesionActiva): Promise<void> {
    const cambio = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.cambioLugar.findFirst({
        where: { id, estado: 'APLICADO_SIN_REVISAR' },
        include: {
          tienda: { select: { nombre: true } },
          galeriaAntes: { select: { nombre: true } },
        },
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
      await tx.tienda.update({
        where: { id: fila.tiendaId },
        data: { galeriaId: fila.galeriaAntesId, piso: fila.pisoAntes, stand: fila.standAntes },
      });
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          tiendaId: fila.tiendaId,
          accion: `deshizo el cambio de lugar de ${fila.tienda.nombre}${
            motivo ? ` · ${motivo}` : ''
          }`.slice(0, 240),
        },
      });
      return fila;
    });
    const antes = lugarATexto({
      galeria: cambio.galeriaAntes?.nombre ?? null,
      piso: cambio.pisoAntes,
      stand: cambio.standAntes,
    });
    await this.avisarATienda(
      cambio.tiendaId,
      'El Equipo deshizo tu cambio de galería o stand',
      motivo
        ? `Motivo: ${motivo.replace(/[.\s]+$/, '')}. Tu perfil vuelve a decir ${antes}.`
        : `Tu perfil vuelve a decir ${antes}. Si es un error, escríbenos por el chat del Equipo.`,
    );
  }
}
