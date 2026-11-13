import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { MINUTOS_SOPORTE, type EstadoSoporteTienda } from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { avisarSeguridad, duenosDe } from '../../shared/aviso-seguridad';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';

/** Un pedido de ayuda sirve un día: si nadie entró, hay que volver a pedirlo. */
const PEDIDO_VIGENTE_MS = 86_400_000;

const primerNombre = (nombre: string) => nombre.split(' ')[0] ?? nombre;

/**
 * «Ayudar como la tienda» (N14, mejora 39). Empieza de dos formas: la tienda toca «Pedir ayuda al
 * Equipo» en Ayuda (la recomendada) o el equipo lo activa (por ejemplo, si la tienda llamó por
 * teléfono). En los dos casos a la tienda le llega el aviso. Dura una hora; mientras tanto la
 * sesión del equipo ve PaseLibre como el dueño, pero no puede chatear ni cerrar ventas (el guard
 * solo deja lo marcado con `@PermitirEnSoporte`), y cada cambio se anota y se avisa.
 */
@Injectable()
export class AyudaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  async estado(sesion: SesionActiva): Promise<EstadoSoporteTienda> {
    const tiendaId = this.tiendaDe(sesion);
    const ahora = new Date();
    const [pedido, activo] = await Promise.all([
      this.pedidoVigente(tiendaId, ahora),
      this.prisma.modoSoporte.findFirst({
        where: { tiendaId, terminadoEn: null, venceEn: { gt: ahora } },
        select: { venceEn: true, equipo: { select: { nombre: true } } },
      }),
    ]);
    return {
      pedido_en: pedido?.pedidoEn?.toISOString() ?? null,
      activo:
        activo?.venceEn && activo.equipo
          ? { equipo: primerNombre(activo.equipo.nombre), vence_en: activo.venceEn.toISOString() }
          : null,
    };
  }

  /** «Pedir ayuda al Equipo»: el equipo recibe aviso y en la ficha ve «La tienda lo autorizó». */
  async pedir(sesion: SesionActiva): Promise<EstadoSoporteTienda> {
    const tiendaId = this.tiendaDe(sesion);
    const ahora = new Date();
    if (!(await this.pedidoVigente(tiendaId, ahora))) {
      await this.prisma.modoSoporte.create({
        data: { tiendaId, pedidoPorId: sesion.usuario.id, pedidoEn: ahora },
      });
      const equipo = await this.prisma.usuario.findMany({
        where: { rol: 'EQUIPO', estado: 'ACTIVO' },
        select: { id: true },
      });
      await this.avisos.crear(
        equipo.map((persona) => persona.id),
        {
          tipo: 'SISTEMA',
          titulo: `${sesion.usuario.tienda?.nombre ?? 'Una tienda'} pidió ayuda al Equipo`,
          extracto: 'Autorizó que entres como la tienda por 1 hora para acomodar algo.',
          enlace: `/equipo/tiendas/${tiendaId}`,
        },
      );
    }
    return this.estado(sesion);
  }

  /** El equipo entra como la tienda. Usa el pedido de la tienda si hay uno vigente. */
  async iniciar(tiendaId: string, sesion: SesionActiva): Promise<{ vence_en: string }> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { nombre: true, estado: true },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    const duenos = await duenosDe(this.prisma, tiendaId);
    if (tienda.estado !== 'ACTIVA' || duenos.length === 0) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Solo se puede ayudar a una tienda activa con su cuenta principal.',
      );
    }
    const ahora = new Date();
    const venceEn = new Date(ahora.getTime() + MINUTOS_SOPORTE * 60_000);
    const pedido = await this.pedidoVigente(tiendaId, ahora);
    const soporte = pedido
      ? await this.prisma.modoSoporte.update({
          where: { id: pedido.id },
          data: { equipoId: sesion.usuario.id, iniciadoEn: ahora, venceEn },
          select: { id: true },
        })
      : await this.prisma.modoSoporte.create({
          data: { tiendaId, equipoId: sesion.usuario.id, iniciadoEn: ahora, venceEn },
          select: { id: true },
        });
    await this.prisma.$transaction([
      this.prisma.sesion.update({
        where: { id: sesion.sesionId },
        data: { soporteId: soporte.id },
      }),
      this.prisma.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          tiendaId,
          accion: pedido
            ? 'entró a ayudar como la tienda (la tienda lo pidió)'
            : 'entró a ayudar como la tienda (lo activó el equipo)',
        },
      }),
      this.prisma.auditoria.create({
        data: {
          actorId: sesion.usuario.id,
          accion: 'modo_soporte',
          objeto: 'tienda',
          objetoId: tiendaId,
          datos: { pedido: Boolean(pedido), vence_en: venceEn.toISOString() },
        },
      }),
    ]);
    await avisarSeguridad(this.prisma, this.tiempoReal, duenos, {
      titulo: pedido
        ? 'El Equipo PaseLibre ya está ayudándote'
        : 'El Equipo PaseLibre entró a tu cuenta para ayudarte',
      extracto: pedido
        ? 'Por 1 hora puede acomodar tu perfil y publicar por tu tienda. No puede chatear ni cerrar ventas.'
        : 'Por 1 hora puede acomodar tu perfil y publicar por tu tienda. No puede chatear ni cerrar ventas. Si no lo pediste, escríbenos.',
      enlace: '/mensajes/equipo',
    });
    return { vence_en: venceEn.toISOString() };
  }

  /** «Salir» de la franja: vuelve al panel. */
  async salir(sesion: SesionActiva): Promise<{ tienda_id: string | null }> {
    const { soporte } = sesion;
    if (!soporte) return { tienda_id: null };
    const ahora = new Date();
    await this.prisma.$transaction([
      this.prisma.sesion.update({ where: { id: sesion.sesionId }, data: { soporteId: null } }),
      this.prisma.modoSoporte.update({
        where: { id: soporte.id },
        data: { terminadoEn: ahora },
      }),
      this.prisma.registroEquipo.create({
        data: {
          autorId: soporte.equipo.id,
          tiendaId: soporte.tiendaId,
          accion: 'terminó de ayudar como la tienda',
        },
      }),
    ]);
    return { tienda_id: soporte.tiendaId };
  }

  private pedidoVigente(tiendaId: string, ahora: Date) {
    return this.prisma.modoSoporte.findFirst({
      where: {
        tiendaId,
        iniciadoEn: null,
        pedidoEn: { gt: new Date(ahora.getTime() - PEDIDO_VIGENTE_MS) },
      },
      orderBy: { pedidoEn: 'desc' },
      select: { id: true, pedidoEn: true },
    });
  }

  private tiendaDe(sesion: SesionActiva): string {
    const { tiendaId } = sesion.usuario;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    return tiendaId;
  }
}
