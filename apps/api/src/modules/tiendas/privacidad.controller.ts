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
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  visibilidadPerfilSchema,
  type RespuestaResolverSolicitud,
  type RespuestaSeguidores,
  type RespuestaSolicitudSeguir,
  type RespuestaVisibilidad,
  type VisibilidadPerfilDatos,
} from '@paselibre/contracts';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { LIMITE_PERSONA } from '../../shared/limites';
import { Permiso, Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { PrivacidadService } from './privacidad.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));
const idTienda = id('Esta tienda no existe.');
const idSolicitud = id('Esta solicitud no existe.');

/**
 * Perfil Público / Privado / Oculto (doc 20, punto 5). Decidir quién ve el perfil (el selector,
 * aceptar o rechazar, quitar seguidoras) es cosa del dueño o del asesor con permiso para los datos
 * de la tienda; pedir seguir, de cualquiera de la tienda. En modo soporte, nada de esto.
 */
@Controller()
@UseGuards(SesionGuard)
export class PrivacidadController {
  constructor(@Inject(PrivacidadService) private readonly privacidad: PrivacidadService) {}

  /** «Perfil: Público ▾»: Público, Privado u Oculto. */
  @Put('cuenta/visibilidad')
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  @Header('Cache-Control', 'no-store')
  visibilidad(
    @Body(new ZodValidationPipe(visibilidadPerfilSchema)) datos: VisibilidadPerfilDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaVisibilidad> {
    return this.privacidad.cambiarVisibilidad(datos.visibilidad, sesion);
  }

  /** «Tus seguidores (N)». */
  @Get('cuenta/seguidores')
  @Roles('DUENO', 'ASESOR')
  @Header('Cache-Control', 'no-store')
  seguidoras(@SesionActual() sesion: SesionActiva): Promise<RespuestaSeguidores> {
    return this.privacidad.seguidoras(sesion);
  }

  /** «Quitar» a una seguidora. */
  @Delete('cuenta/seguidores/:tienda')
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  quitarSeguidora(
    @Param('tienda', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSeguidores> {
    return this.privacidad.quitarSeguidora(tiendaId, sesion);
  }

  /** «Solicitar seguir» a un perfil privado. */
  @Post('tiendas/:id/solicitud')
  @HttpCode(HttpStatus.OK)
  @Roles('DUENO', 'ASESOR')
  @Throttle({ [LIMITE_PERSONA]: { limit: 30, ttl: 60 * 60_000 } })
  solicitar(
    @Param('id', idTienda) seguidaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSolicitudSeguir> {
    return this.privacidad.solicitar(seguidaId, sesion);
  }

  /** «Solicitud enviada» → cancelar. */
  @Delete('tiendas/:id/solicitud')
  @Roles('DUENO', 'ASESOR')
  cancelar(
    @Param('id', idTienda) seguidaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSolicitudSeguir> {
    return this.privacidad.cancelar(seguidaId, sesion);
  }

  /** «Aceptar» desde el aviso de la campana. */
  @Post('solicitudes-seguir/:id/aceptar')
  @HttpCode(HttpStatus.OK)
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  aceptar(
    @Param('id', idSolicitud) solicitudId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaResolverSolicitud> {
    return this.privacidad.aceptar(solicitudId, sesion);
  }

  /** «Rechazar» desde el aviso de la campana: sin avisarle a la otra tienda. */
  @Post('solicitudes-seguir/:id/rechazar')
  @HttpCode(HttpStatus.OK)
  @Roles('DUENO', 'ASESOR')
  @Permiso('DATOS_TIENDA')
  rechazar(
    @Param('id', idSolicitud) solicitudId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaResolverSolicitud> {
    return this.privacidad.rechazar(solicitudId, sesion);
  }
}
