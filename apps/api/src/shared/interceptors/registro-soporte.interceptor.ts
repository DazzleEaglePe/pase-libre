import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { type Observable, tap } from 'rxjs';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TiempoRealService } from '../../modules/tiempo-real/tiempo-real.service';
import { avisarSeguridad, duenosDe } from '../aviso-seguridad';
import { PERMITIR_EN_SOPORTE } from '../guards/sesion.guard';

/**
 * «Ayudar como la tienda» (N14): todo queda registrado y la tienda recibe aviso de cada cambio.
 * Después de un cambio que salió bien en modo soporte, lo anota en el historial de la tienda
 * («Fabrizio, en modo soporte, actualizó la portada») y le avisa al dueño.
 */
@Injectable()
export class RegistroSoporteInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RegistroSoporteInterceptor.name);

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  intercept(context: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const cambio = this.reflector.getAllAndOverride<string | undefined>(PERMITIR_EN_SOPORTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!cambio) return siguiente.handle();
    return siguiente.handle().pipe(
      tap(() => {
        const soporte = request.sesion?.soporte;
        if (!soporte) return;
        void this.anotar(soporte.equipo.id, soporte.tiendaId, cambio).catch((error: unknown) =>
          this.logger.error(`No se pudo anotar el cambio en modo soporte: ${String(error)}`),
        );
      }),
    );
  }

  private async anotar(equipoId: string, tiendaId: string, cambio: string): Promise<void> {
    await this.prisma.registroEquipo.create({
      data: { autorId: equipoId, tiendaId, accion: `en modo soporte, ${cambio}`.slice(0, 240) },
    });
    await avisarSeguridad(this.prisma, this.tiempoReal, await duenosDe(this.prisma, tiendaId), {
      titulo: `El Equipo PaseLibre ${cambio}`.slice(0, 160),
      extracto: 'Lo hizo en modo soporte. Si no lo pediste, escríbenos.',
      enlace: '/mensajes/equipo',
    });
  }
}
