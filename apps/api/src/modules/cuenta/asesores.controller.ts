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
import { Throttle } from '@nestjs/throttler';
import {
  cambiarAsesorSchema,
  claveAsesorSchema,
  crearAsesorSchema,
  type Asesor,
  type CambiarAsesorDatos,
  type ClaveAsesorDatos,
  type CrearAsesorDatos,
  type RespuestaAsesores,
  type RespuestaClaveAsesor,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { AsesoresService } from './asesores.service';

const idAsesor = new ZodValidationPipe(z.uuid('Ese asesor no es de tu tienda.'));

/**
 * Configuración · Asesores (N12). Agregar, pausar o quitar asesores y su seguridad son solo del
 * dueño: el asesor recibe 403 aunque tenga todos los permisos. Las respuestas con contraseña
 * nunca se guardan en caché.
 */
@Controller('cuenta/asesores')
@UseGuards(SesionGuard)
@Roles('DUENO')
export class AsesoresController {
  constructor(@Inject(AsesoresService) private readonly asesores: AsesoresService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  lista(@SesionActual() sesion: SesionActiva): Promise<RespuestaAsesores> {
    return this.asesores.lista(sesion);
  }

  @Post()
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 15 * 60_000 } })
  @Header('Cache-Control', 'no-store')
  crear(
    @Body(new ZodValidationPipe(crearAsesorSchema)) datos: CrearAsesorDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaClaveAsesor> {
    return this.asesores.crear(datos, sesion);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  cambiar(
    @Param('id', idAsesor) id: string,
    @Body(new ZodValidationPipe(cambiarAsesorSchema)) datos: CambiarAsesorDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<Asesor> {
    return this.asesores.cambiar(id, datos, sesion);
  }

  @Post(':id/clave')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 15 * 60_000 } })
  @Header('Cache-Control', 'no-store')
  clave(
    @Param('id', idAsesor) id: string,
    @Body(new ZodValidationPipe(claveAsesorSchema)) datos: ClaveAsesorDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaClaveAsesor> {
    return this.asesores.nuevaClave(id, datos.clave, sesion);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  quitar(@Param('id', idAsesor) id: string, @SesionActual() sesion: SesionActiva): Promise<void> {
    return this.asesores.quitar(id, sesion);
  }
}
