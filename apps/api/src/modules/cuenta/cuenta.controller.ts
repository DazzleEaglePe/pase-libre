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
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  actualizarCuentaSchema,
  avisosCuentaSchema,
  respuestasRapidasSchema,
  type ActualizarCuentaDatos,
  type AvisosCuentaDatos,
  type RespuestaAvisosCuenta,
  type RespuestaCuenta,
  type RespuestaRapida,
  type RespuestasRapidasDatos,
  type SesionAbierta,
  type TiendaBloqueada,
} from '@paselibre/contracts';
import { z } from 'zod';

import { SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { CuentaService } from './cuenta.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));

/**
 * Configuración (docs/05 §6.2): datos de la cuenta, avisos, respuestas rápidas, sesiones
 * abiertas y bloqueados. Todo es de quien tiene la sesión; nada se cachea.
 */
@Controller('cuenta')
@UseGuards(SesionGuard)
export class CuentaController {
  constructor(@Inject(CuentaService) private readonly cuentas: CuentaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  cuenta(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaCuenta> {
    return this.cuentas.cuenta(usuario.id);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  actualizar(
    @Body(new ZodValidationPipe(actualizarCuentaSchema)) cambios: ActualizarCuentaDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaCuenta> {
    return this.cuentas.actualizar(usuario.id, cambios);
  }

  @Get('avisos')
  @Header('Cache-Control', 'no-store')
  avisos(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaAvisosCuenta> {
    return this.cuentas.avisos(usuario.id);
  }

  @Put('avisos')
  @Header('Cache-Control', 'no-store')
  guardarAvisos(
    @Body(new ZodValidationPipe(avisosCuentaSchema)) datos: AvisosCuentaDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaAvisosCuenta> {
    return this.cuentas.guardarAvisos(usuario.id, datos);
  }

  /** Sobre la caja de texto del chat (RF-56). */
  @Get('respuestas-rapidas')
  @Header('Cache-Control', 'no-store')
  respuestasRapidas(@SesionActual() { usuario }: SesionActiva): Promise<RespuestaRapida[]> {
    return this.cuentas.respuestasRapidas(usuario.id);
  }

  @Put('respuestas-rapidas')
  @Header('Cache-Control', 'no-store')
  guardarRespuestasRapidas(
    @Body(new ZodValidationPipe(respuestasRapidasSchema)) { textos }: RespuestasRapidasDatos,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<RespuestaRapida[]> {
    return this.cuentas.guardarRespuestasRapidas(usuario.id, textos);
  }

  @Get('sesiones')
  @Header('Cache-Control', 'no-store')
  sesiones(@SesionActual() sesion: SesionActiva): Promise<SesionAbierta[]> {
    return this.cuentas.sesiones(sesion);
  }

  /** «Cerrar todas las demás». Va antes de `sesiones/:id` para que no se lea como id. */
  @Post('sesiones/cerrar-otras')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  cerrarOtras(@SesionActual() sesion: SesionActiva): Promise<{ cerradas: number }> {
    return this.cuentas.cerrarOtras(sesion);
  }

  @Delete('sesiones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrarSesion(
    @Param('id', id('Esa sesión ya está cerrada.')) sesionId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.cuentas.cerrarSesion(sesion, sesionId);
  }

  @Get('bloqueados')
  @Header('Cache-Control', 'no-store')
  bloqueados(@SesionActual() { usuario }: SesionActiva): Promise<TiendaBloqueada[]> {
    return this.cuentas.bloqueados(usuario.id);
  }

  @Delete('bloqueados/:tienda')
  @HttpCode(HttpStatus.NO_CONTENT)
  desbloquear(
    @Param('tienda', id('Esa tienda no existe.')) tiendaId: string,
    @SesionActual() { usuario }: SesionActiva,
  ): Promise<void> {
    return this.cuentas.desbloquear(usuario.id, tiendaId);
  }
}
