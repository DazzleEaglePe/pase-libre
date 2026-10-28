import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  cambiarClaveSchema,
  ingresarSchema,
  type CambiarClaveEntrada,
  type IngresarDatos,
  type RespuestaYo,
} from '@paselibre/contracts';
import type { Request, Response } from 'express';

import type { Environment } from '../../config/env.schema';
import {
  PermitirClaveTemporal,
  SesionActual,
  SesionGuard,
  opcionesCookieSesion,
} from '../../shared/guards/sesion.guard';
import { LIMITE_IP, LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { SesionService, respuestaYo } from './sesion.service';
import { COOKIE_SESION, type SesionActiva } from './sesion.types';

@Controller('sesion')
export class SesionController {
  constructor(
    @Inject(SesionService) private readonly sesiones: SesionService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  /**
   * Ingresar (RF-02). Además del límite por cuenta (5 fallidos en 15 minutos), 60 intentos
   * por IP cada 15 minutos: alcanza para que toda una galería entre a la vez con el mismo
   * wifi y frena el relleno de credenciales.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ [LIMITE_IP]: { limit: 60, ttl: 15 * 60_000 } })
  async ingresar(
    @Body(new ZodValidationPipe(ingresarSchema)) entrada: IngresarDatos,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RespuestaYo> {
    const { token, expiraEn, usuario } = await this.sesiones.ingresar(entrada, {
      agente: request.headers['user-agent'],
      ip: request.ip,
    });
    // Sin «Mantener la sesión», la cookie muere al cerrar el navegador (y la sesión a las 12 horas).
    response.cookie(
      COOKIE_SESION,
      token,
      opcionesCookieSesion(this.cookieSegura(), entrada.recordar ? expiraEn : undefined),
    );
    return respuestaYo(usuario);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SesionGuard)
  @PermitirClaveTemporal()
  async salir(
    @SesionActual() sesion: SesionActiva,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sesiones.salir(sesion.sesionId);
    response.clearCookie(COOKIE_SESION, opcionesCookieSesion(this.cookieSegura()));
  }

  @Post('clave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SesionGuard)
  @PermitirClaveTemporal()
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 15 * 60_000 } })
  async cambiarClave(
    @SesionActual() sesion: SesionActiva,
    @Body(new ZodValidationPipe(cambiarClaveSchema)) entrada: CambiarClaveEntrada,
  ): Promise<RespuestaYo> {
    return respuestaYo(await this.sesiones.cambiarClave(sesion, entrada));
  }

  private cookieSegura(): boolean {
    return this.config.get('SESION_COOKIE_SEGURA', { infer: true });
  }
}

@Controller('yo')
export class YoController {
  @Get()
  @UseGuards(SesionGuard)
  @PermitirClaveTemporal()
  yo(@SesionActual() sesion: SesionActiva): RespuestaYo {
    return respuestaYo(sesion.usuario);
  }
}
