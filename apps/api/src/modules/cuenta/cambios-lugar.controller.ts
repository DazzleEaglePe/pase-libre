import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  rechazarCambioLugarSchema,
  type CambioDeLugar,
  type RechazarCambioLugarDatos,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { LugarService } from './lugar.service';

const idCambio = new ZodValidationPipe(z.uuid('Ese cambio no existe.'));

/**
 * Los cambios de galería, piso o stand que piden las tiendas (N09): el Equipo los confirma o no
 * desde Solicitudes. Solo `rol = EQUIPO`.
 */
@Controller('equipo/cambios-de-lugar')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class CambiosDeLugarController {
  constructor(@Inject(LugarService) private readonly lugares: LugarService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  pendientes(): Promise<CambioDeLugar[]> {
    return this.lugares.pendientes();
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.NO_CONTENT)
  aprobar(@Param('id', idCambio) id: string, @SesionActual() sesion: SesionActiva): Promise<void> {
    return this.lugares.aprobar(id, sesion);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  rechazar(
    @Param('id', idCambio) id: string,
    @Body(new ZodValidationPipe(rechazarCambioLugarSchema)) datos: RechazarCambioLugarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.lugares.rechazar(id, datos.motivo, sesion);
  }
}
