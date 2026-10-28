import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import type { RespuestaCuenta, RespuestaRapida } from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import type { SesionActiva } from '../sesion/sesion.types';

/** Configuración de la cuenta (RF-58). Por ahora solo lectura; la edición llega el 30/10. */
@Controller('cuenta')
@UseGuards(SesionGuard)
export class CuentaController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  cuenta(@SesionActual() { usuario }: SesionActiva): RespuestaCuenta {
    const { tienda } = usuario;
    return {
      usuario: {
        usuario: usuario.usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        whatsapp: usuario.whatsapp,
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
            precio_visible_defecto: tienda.precioVisibleDefecto,
            moneda_defecto: tienda.monedaDefecto,
          }
        : null,
    };
  }

  /** Respuestas rápidas sobre la caja de texto del chat (RF-56). Se editan el 30/10. */
  @Get('respuestas-rapidas')
  @Header('Cache-Control', 'no-store')
  respuestasRapidas(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaRapida[]> {
    return this.prisma.respuestaRapida.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { orden: 'asc' },
      select: { id: true, texto: true },
    });
  }
}
