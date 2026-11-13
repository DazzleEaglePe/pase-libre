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
  corregirCambioLugarSchema,
  rechazarCambioLugarSchema,
  type CambioDeLugar,
  type CorregirCambioLugarDatos,
  type RechazarCambioLugarDatos,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { LugarService } from './lugar.service';

const idCambio = new ZodValidationPipe(z.uuid('Ese cambio no existe.'));

/**
 * Los cambios de galería, piso o stand de las tiendas (N09, doc 19 §10), en Solicitudes: los ya
 * aplicados («Está bien», «Corregir», «Deshacer») y las «Otra galería» que esperan. Solo
 * `rol = EQUIPO`.
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

  /** «Está bien» (aplicado) o «Confirmar» (pendiente con una galería de la lista). */
  @Post(':id/aprobar')
  @HttpCode(HttpStatus.NO_CONTENT)
  aprobar(@Param('id', idCambio) id: string, @SesionActual() sesion: SesionActiva): Promise<void> {
    return this.lugares.aprobar(id, sesion);
  }

  /** «Corregir», o confirmar una «Otra galería» eligiendo la que se creó. */
  @Post(':id/corregir')
  @HttpCode(HttpStatus.NO_CONTENT)
  corregir(
    @Param('id', idCambio) id: string,
    @Body(new ZodValidationPipe(corregirCambioLugarSchema)) datos: CorregirCambioLugarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.lugares.corregir(id, datos, sesion);
  }

  /** «No confirmar» una «Otra galería». */
  @Post(':id/rechazar')
  @HttpCode(HttpStatus.NO_CONTENT)
  rechazar(
    @Param('id', idCambio) id: string,
    @Body(new ZodValidationPipe(rechazarCambioLugarSchema)) datos: RechazarCambioLugarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.lugares.rechazar(id, datos.motivo, sesion);
  }

  /** «Deshacer» uno aplicado: vuelve a como estaba y la tienda recibe aviso. */
  @Post(':id/deshacer')
  @HttpCode(HttpStatus.NO_CONTENT)
  deshacer(
    @Param('id', idCambio) id: string,
    @Body(new ZodValidationPipe(rechazarCambioLugarSchema)) datos: RechazarCambioLugarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.lugares.deshacer(id, datos.motivo, sesion);
  }
}
