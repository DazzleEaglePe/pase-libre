import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { RespuestaSalud, RespuestaSaludLista } from '@paselibre/contracts';
import type { Response } from 'express';

import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller('salud')
@SkipThrottle()
export class SaludController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** El proceso responde. No toca la base, para que una caída de Postgres no reinicie la API en cadena. */
  @Get()
  salud(): RespuestaSalud {
    return { estado: 'ok', servicio: 'paselibre-api', fecha: new Date().toISOString() };
  }

  /** Lista para atender: la base responde. Es la que revisa el monitor externo (RNF-39). */
  @Get('lista')
  async lista(@Res({ passthrough: true }) response: Response): Promise<RespuestaSaludLista> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { estado: 'ok', base_de_datos: 'ok' };
    } catch {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { estado: 'error', base_de_datos: 'error' };
    }
  }
}
