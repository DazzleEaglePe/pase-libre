import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  inicioRecienSchema,
  type InicioRecienConsulta,
  type RespuestaRecienInicio,
  type RespuestaRecienLlegados,
} from '@paselibre/contracts';

import { MiradaActual, type Mirada } from '../../shared/guards/sesion-opcional.guard';
import { Roles, SesionGuard } from '../../shared/guards/sesion.guard';
import { LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { InicioService } from './inicio.service';

/**
 * Lo del feed que solo es de una tienda (N15, N16, N07): las siguientes 24 de «Recién
 * publicado», la X del banner de invitar y el «+N nuevo» de «Recién llegados». Con sesión de
 * dueño o asesor; nada se cachea.
 */
@Controller()
@UseGuards(SesionGuard)
@Roles('DUENO', 'ASESOR')
export class InicioController {
  constructor(@Inject(InicioService) private readonly inicio: InicioService) {}

  /**
   * Una página del Inicio, de a 20 (doc 20, punto 4): `‹ 1 2 3 … 7 Siguiente ›`. La página 1
   * llega con `GET /v1/inicio`; las demás, de aquí. 60 por minuto, contra el scraping.
   */
  @Get('inicio/recien')
  @Throttle({ [LIMITE_PERSONA]: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  recien(
    @Query(new ZodValidationPipe(inicioRecienSchema)) { pagina }: InicioRecienConsulta,
    @MiradaActual() mirada: Mirada,
  ): Promise<RespuestaRecienInicio> {
    return this.inicio.recien(mirada, pagina);
  }

  /** La X de «¿Conoces una tienda que debería estar aquí?» del inicio: vuelve a los 2 días. */
  @Post('inicio/invitar-cerrado')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrarInvitar(@MiradaActual() mirada: Mirada): Promise<void> {
    return this.inicio.cerrarInvitar(mirada);
  }

  /** La X de esa banda en las secciones de la barra negra (doc 19, 14): no vuelve más. */
  @Post('secciones/invitar-cerrado')
  @HttpCode(HttpStatus.NO_CONTENT)
  cerrarInvitarSecciones(@MiradaActual() mirada: Mirada): Promise<void> {
    return this.inicio.cerrarInvitarSecciones(mirada);
  }

  @Get('recien-llegados')
  @Header('Cache-Control', 'no-store')
  recienLlegados(@MiradaActual() mirada: Mirada): Promise<RespuestaRecienLlegados> {
    return this.inicio.recienLlegados(mirada);
  }

  /** Entró a «Recién llegados»: desde aquí se cuenta lo nuevo. */
  @Post('recien-llegados/visto')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  recienVisto(@MiradaActual() mirada: Mirada): Promise<RespuestaRecienLlegados> {
    return this.inicio.recienVisto(mirada);
  }
}
