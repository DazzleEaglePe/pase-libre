import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  historialVentasSchema,
  type HistorialConsulta,
  type RespuestaHistorial,
} from '@paselibre/contracts';
import type { Response } from 'express';
import { z } from 'zod';

import { SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { HistorialService } from './historial.service';

/** «Mis ventas y compras» (HI_A2_Web): de quien tiene la sesión, sin caché. */
@Controller()
@UseGuards(SesionGuard)
export class HistorialController {
  constructor(@Inject(HistorialService) private readonly historial: HistorialService) {}

  @Get('historial')
  @Header('Cache-Control', 'no-store')
  lista(
    @Query(new ZodValidationPipe(historialVentasSchema)) consulta: HistorialConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaHistorial> {
    return this.historial.historial(consulta, sesion);
  }

  @Get('historial/excel')
  @Header('Cache-Control', 'no-store')
  async excel(
    @Query(new ZodValidationPipe(historialVentasSchema)) consulta: HistorialConsulta,
    @SesionActual() sesion: SesionActiva,
    @Res() respuesta: Response,
  ): Promise<void> {
    const archivo = await this.historial.excel(consulta, sesion);
    const mes = consulta.mes ?? 'este-mes';
    respuesta.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    respuesta.setHeader(
      'Content-Disposition',
      `attachment; filename="paselibre-${consulta.lado}-${mes}.xlsx"`,
    );
    respuesta.send(archivo);
  }

  @Post('ventas/:id/recordar')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordar(
    @Param('id', new ZodValidationPipe(z.uuid('Esta venta no existe.'))) ventaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.historial.recordar(ventaId, sesion);
  }
}
