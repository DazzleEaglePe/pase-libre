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
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  alcanceEnVivoSchema,
  cambiarEnVivoSchema,
  enVivoConsultaSchema,
  publicarEnVivoSchema,
  responderEnVivoSchema,
  type AlcanceEnVivoConsulta,
  type CambiarEnVivo,
  type EnVivoConsulta,
  type EnVivoPropio,
  type PublicarEnVivoDatos,
  type RespuestaAlcanceEnVivo,
  type RespuestaEnVivo,
  type RespuestaMisEnVivo,
  type RespuestaOpcionesEnVivo,
  type RespuestaResponderEnVivo,
  type ResponderEnVivoDatos,
} from '@paselibre/contracts';
import { z } from 'zod';

import { LIMITE_PERSONA } from '../../shared/limites';
import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import {
  MiradaActual,
  SesionOpcionalGuard,
  type Mirada,
} from '../../shared/guards/sesion-opcional.guard';
import { CachePorAudienciaInterceptor } from '../../shared/interceptors/cache-por-audiencia.interceptor';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { EnVivoActivoGuard } from './en-vivo-activo.guard';
import { EnVivoService } from './en-vivo.service';

const idDeEnVivo = new ZodValidationPipe(z.uuid('Este pase del día ya se cerró o venció.'));

/**
 * `GET /v1/en-vivo`: lo ve cualquiera (RF-77). Sin sesión no lleva tienda, precio,
 * presupuesto ni nota, y se cachea 60 s como el resto del catálogo.
 */
@Controller('en-vivo')
@UseGuards(EnVivoActivoGuard, SesionOpcionalGuard)
@UseInterceptors(CachePorAudienciaInterceptor)
export class EnVivoPublicoController {
  constructor(@Inject(EnVivoService) private readonly enVivo: EnVivoService) {}

  @Get()
  lista(
    @Query(new ZodValidationPipe(enVivoConsultaSchema)) consulta: EnVivoConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaEnVivo> {
    return this.enVivo.lista(consulta, mirada);
  }
}

/** Publicar, responder, sumar una hora y cerrar: solo dueños y asesores (D-53). */
@Controller('en-vivo')
@UseGuards(EnVivoActivoGuard, SesionGuard)
@Roles('DUENO', 'ASESOR')
export class EnVivoController {
  constructor(@Inject(EnVivoService) private readonly enVivo: EnVivoService) {}

  @Get('mios')
  @Header('Cache-Control', 'no-store')
  mios(@SesionActual() sesion: SesionActiva): Promise<RespuestaMisEnVivo> {
    return this.enVivo.mios(sesion.usuario);
  }

  @Get('alcance')
  @Header('Cache-Control', 'no-store')
  alcance(
    @Query(new ZodValidationPipe(alcanceEnVivoSchema)) consulta: AlcanceEnVivoConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaAlcanceEnVivo> {
    return this.enVivo.alcance(consulta, sesion.usuario);
  }

  /** Cada busco avisa a varias tiendas: 10 por hora por persona, contra el spam. */
  @Post()
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 60 * 60_000 } })
  @Header('Cache-Control', 'no-store')
  publicar(
    @Body(new ZodValidationPipe(publicarEnVivoSchema)) datos: PublicarEnVivoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<EnVivoPropio> {
    return this.enVivo.publicar(datos, sesion.usuario);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  cambiar(
    @Param('id', idDeEnVivo) id: string,
    @Body(new ZodValidationPipe(cambiarEnVivoSchema)) cambios: CambiarEnVivo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<EnVivoPropio> {
    return this.enVivo.cambiar(id, cambios, sesion.usuario);
  }

  @Get(':id/opciones')
  @Header('Cache-Control', 'no-store')
  opciones(
    @Param('id', idDeEnVivo) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaOpcionesEnVivo> {
    return this.enVivo.opciones(id, sesion.usuario);
  }

  @Post(':id/respuestas')
  @Throttle({ [LIMITE_PERSONA]: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  responder(
    @Param('id', idDeEnVivo) id: string,
    @Body(new ZodValidationPipe(responderEnVivoSchema)) datos: ResponderEnVivoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaResponderEnVivo> {
    return this.enVivo.responder(id, datos, sesion.usuario);
  }
}
