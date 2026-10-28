import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  cambiarEstadoCuentaSchema,
  crearCuentaSchema,
  filtroCuentasSchema,
  traspasarSchema,
  type CambiarEstadoCuenta,
  type CrearCuentaDatos,
  type CuentaEquipo,
  type FiltroCuentas,
  type RespuestaAcceso,
  type RespuestaCuentas,
  type RespuestaTraspaso,
  type TiendaParaEquipo,
  type Traspasar,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { EquipoService } from './equipo.service';

const idDeCuenta = new ZodValidationPipe(z.uuid('Esa cuenta no existe.'));

/** Panel del equipo (docs/05 §6.2). Solo `rol = EQUIPO`; las respuestas traen claves, así que nunca se cachean. */
@Controller('equipo')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class EquipoController {
  constructor(@Inject(EquipoService) private readonly equipo: EquipoService) {}

  @Get('cuentas')
  @Header('Cache-Control', 'no-store')
  cuentas(
    @Query(new ZodValidationPipe(filtroCuentasSchema)) filtro: FiltroCuentas,
  ): Promise<RespuestaCuentas> {
    return this.equipo.cuentas(filtro);
  }

  @Get('tiendas')
  @Header('Cache-Control', 'no-store')
  tiendas(): Promise<TiendaParaEquipo[]> {
    return this.equipo.tiendas();
  }

  @Post('cuentas')
  @Header('Cache-Control', 'no-store')
  crear(
    @Body(new ZodValidationPipe(crearCuentaSchema)) entrada: CrearCuentaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaAcceso> {
    return this.equipo.crear(entrada, sesion.usuario.id);
  }

  /** Nueva clave temporal. En la pantalla es «Reenviar acceso» o «Nueva contraseña». */
  @Post('cuentas/:id/clave-temporal')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  claveTemporal(
    @Param('id', idDeCuenta) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaAcceso> {
    return this.equipo.claveTemporal(id, sesion.usuario.id);
  }

  /** Pasar publicaciones y conversaciones a otra cuenta de la misma tienda (RF-71, A-11). */
  @Post('cuentas/:id/traspasar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  traspasar(
    @Param('id', idDeCuenta) id: string,
    @Body(new ZodValidationPipe(traspasarSchema)) { a_usuario_id }: Traspasar,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaTraspaso> {
    return this.equipo.traspasar(id, a_usuario_id, sesion.usuario.id);
  }

  @Patch('cuentas/:id')
  @Header('Cache-Control', 'no-store')
  cambiarEstado(
    @Param('id', idDeCuenta) id: string,
    @Body(new ZodValidationPipe(cambiarEstadoCuentaSchema)) { estado }: CambiarEstadoCuenta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<CuentaEquipo> {
    return this.equipo.cambiarEstado(id, estado, sesion.usuario.id);
  }
}
