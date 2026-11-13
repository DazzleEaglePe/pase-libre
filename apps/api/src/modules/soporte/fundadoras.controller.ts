import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  agregarFundadoraSchema,
  cambiarFundadoraSchema,
  type AgregarFundadoraDatos,
  type CambiarFundadoraDatos,
  type FundadoraEnPanel,
  type RespuestaFundadoras,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { FundadorasService } from './fundadoras.service';

const idTienda = new ZodValidationPipe(z.uuid('Esta tienda no existe.'));

/** Equipo › Tiendas › Fundadoras (doc 20, punto 7). Solo `rol = EQUIPO`. */
@Controller('equipo/fundadoras')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class FundadorasController {
  constructor(@Inject(FundadorasService) private readonly fundadoras: FundadorasService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  lista(): Promise<RespuestaFundadoras> {
    return this.fundadoras.lista();
  }

  /** «+ Agregar fundadora»: con 15 responde 409 «Ya están las 15». */
  @Post()
  @Header('Cache-Control', 'no-store')
  agregar(
    @Body(new ZodValidationPipe(agregarFundadoraSchema)) datos: AgregarFundadoraDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FundadoraEnPanel> {
    return this.fundadoras.agregar(datos, sesion);
  }

  @Patch(':tienda')
  @Header('Cache-Control', 'no-store')
  cambiar(
    @Param('tienda', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(cambiarFundadoraSchema)) datos: CambiarFundadoraDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FundadoraEnPanel> {
    return this.fundadoras.cambiar(tiendaId, datos, sesion);
  }

  @Delete(':tienda')
  @HttpCode(HttpStatus.NO_CONTENT)
  async quitar(
    @Param('tienda', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.fundadoras.quitar(tiendaId, sesion);
  }
}
