import { Controller, Get, Inject, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  directorioTiendasSchema,
  type DirectorioTiendasConsulta,
  type RespuestaDirectorioTiendas,
} from '@paselibre/contracts';

import {
  MiradaActual,
  SesionOpcionalGuard,
  type Mirada,
} from '../../shared/guards/sesion-opcional.guard';
import { CachePorAudienciaInterceptor } from '../../shared/interceptors/cache-por-audiencia.interceptor';
import { LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { DirectorioService } from './directorio.service';

/**
 * La pestaña «Tiendas» de Wilson en vivo (N13): el directorio con sus filtros. Solo con
 * sesión (401 sin ella); las reservadas y las que bloqueaste no salen (ver `DirectorioService`).
 */
@Controller()
@UseGuards(SesionOpcionalGuard)
@UseInterceptors(CachePorAudienciaInterceptor)
export class DirectorioController {
  constructor(@Inject(DirectorioService) private readonly directorio: DirectorioService) {}

  /** 60 por minuto por persona, como la búsqueda: es una lista de todas las tiendas. */
  @Get('wilson/tiendas')
  @Throttle({ [LIMITE_PERSONA]: { limit: 60, ttl: 60_000 } })
  tiendas(
    @Query(new ZodValidationPipe(directorioTiendasSchema)) consulta: DirectorioTiendasConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaDirectorioTiendas> {
    return this.directorio.directorio(consulta, mirada);
  }
}
