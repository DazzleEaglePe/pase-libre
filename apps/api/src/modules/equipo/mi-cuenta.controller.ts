import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  actualizarMiCuentaEquipoSchema,
  type ActualizarMiCuentaEquipoDatos,
  type MiCuentaEquipo,
  type RespuestaVersionVista,
} from '@paselibre/contracts';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { MiCuentaService } from './mi-cuenta.service';

/**
 * «Mi cuenta» del Equipo (doc 19, punto 7). `PATCH /v1/cuenta` no deja cambiar el usuario para
 * ingresar (a las tiendas se lo cambia el Equipo), así que el Equipo tiene el suyo aquí. La
 * contraseña y las sesiones usan los mismos de siempre (`/v1/sesion/clave`, `/v1/cuenta/sesiones`).
 */
@Controller('equipo')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class MiCuentaController {
  constructor(@Inject(MiCuentaService) private readonly miCuenta: MiCuentaService) {}

  @Get('mi-cuenta')
  @Header('Cache-Control', 'no-store')
  datos(@SesionActual() sesion: SesionActiva): Promise<MiCuentaEquipo> {
    return this.miCuenta.miCuenta(sesion.usuario.id);
  }

  @Patch('mi-cuenta')
  @Header('Cache-Control', 'no-store')
  actualizar(
    @Body(new ZodValidationPipe(actualizarMiCuentaEquipoSchema))
    cambios: ActualizarMiCuentaEquipoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<MiCuentaEquipo> {
    return this.miCuenta.actualizar(sesion.usuario.id, cambios);
  }

  /** Al abrir Equipo › Versiones (doc 19, punto 8): se apaga el puntito de la pastilla. */
  @Post('versiones/vista')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  versionVista(@SesionActual() sesion: SesionActiva): Promise<RespuestaVersionVista> {
    return this.miCuenta.versionVista(sesion.usuario.id);
  }
}
