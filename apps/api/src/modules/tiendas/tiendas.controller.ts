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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  agregarSocioSchema,
  buscarTiendasSchema,
  descuentoSocioSchema,
  filtroOpinionesSchema,
  novedadesSchema,
  opinarSchema,
  pedirRevisionSchema,
  publicacionesTiendaSchema,
  responderOpinionSchema,
  seguirTiendaSchema,
  type AgregarSocioDatos,
  type BuscarTiendasConsulta,
  type DescuentoSocioDatos,
  type FiltroOpinionesConsulta,
  type NovedadesConsulta,
  type OpinarDatos,
  type OpinionPublica,
  type PedirRevisionDatos,
  type PerfilTienda,
  type PublicacionesTiendaConsulta,
  type ResponderOpinionDatos,
  type RespuestaNovedades,
  type RespuestaOpiniones,
  type RespuestaPublicacionesTienda,
  type RespuestaSeguir,
  type RespuestaSocios,
  type RespuestaTiendaCompartida,
  type SeguirTiendaDatos,
  type TiendaBreve,
  type TiendaSeguida,
} from '@paselibre/contracts';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';

import { LIMITE_PERSONA } from '../../shared/limites';
import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { NovedadesService } from './novedades.service';
import { TiendasService } from './tiendas.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));
const idTienda = id('Esta tienda no existe.');
const comoMeVenSchema = z.object({ como_me_ven: z.enum(['0', '1']).optional() });

/**
 * El nombre de una tienda para «Te compartieron…» en Iniciar sesión (COR3): sin sesión, porque
 * quien abre el enlace todavía no entró.
 */
@Controller()
export class TiendaCompartidaController {
  constructor(@Inject(TiendasService) private readonly tiendas: TiendasService) {}

  @Get('tiendas/:id/compartida')
  compartida(@Param('id', idTienda) tiendaId: string): Promise<RespuestaTiendaCompartida> {
    return this.tiendas.compartida(tiendaId);
  }
}

/**
 * Perfil de otra tienda, seguir y opiniones (SG_Web, SEG_Web, sección 15 del lienzo final).
 * Todo con sesión y sin caché: cambia con quien mira.
 */
@Controller()
@UseGuards(SesionGuard)
export class TiendasController {
  constructor(
    @Inject(TiendasService) private readonly tiendas: TiendasService,
    @Inject(NovedadesService) private readonly novedadesSeguidas: NovedadesService,
  ) {}

  @Get('socios')
  @Header('Cache-Control', 'no-store')
  socios(@SesionActual() sesion: SesionActiva): Promise<RespuestaSocios> {
    return this.tiendas.socios(sesion);
  }

  @Post('socios')
  @HttpCode(HttpStatus.OK)
  agregarSocio(
    @Body(new ZodValidationPipe(agregarSocioSchema)) datos: AgregarSocioDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSocios> {
    return this.tiendas.agregarSocio(datos.tienda_id, sesion, datos.avisar);
  }

  @Put('socios/descuento')
  descuentoPorDefecto(
    @Body(new ZodValidationPipe(descuentoSocioSchema)) datos: DescuentoSocioDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSocios> {
    return this.tiendas.descuentoPorDefecto(datos, sesion);
  }

  @Delete('socios/:id')
  quitarSocio(
    @Param('id', idTienda) socioId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSocios> {
    return this.tiendas.quitarSocio(socioId, sesion);
  }

  /** Va antes de `tiendas/:id` para que «buscar» no se lea como id. */
  @Get('tiendas/buscar')
  @Header('Cache-Control', 'no-store')
  buscarTiendas(
    @Query(new ZodValidationPipe(buscarTiendasSchema)) consulta: BuscarTiendasConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<TiendaBreve[]> {
    return this.tiendas.buscarTiendas(consulta.q, sesion);
  }

  /** «De tiendas que sigues» (SEG_Web): lo que publicaron, bajaron o piden en vivo. */
  @Get('seguidas/novedades')
  @Header('Cache-Control', 'no-store')
  novedades(
    @Query(new ZodValidationPipe(novedadesSchema)) consulta: NovedadesConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaNovedades> {
    return this.novedadesSeguidas.novedades(consulta, sesion);
  }

  @Get('tiendas/seguidas')
  @Header('Cache-Control', 'no-store')
  seguidas(@SesionActual() sesion: SesionActiva): Promise<TiendaSeguida[]> {
    return this.tiendas.seguidas(sesion);
  }

  /** Con `?como_me_ven=1`, tu perfil tal como lo ve otra tienda («Cómo me ven», doc 20 §5). */
  @Get('tiendas/:id')
  @Header('Cache-Control', 'no-store')
  perfil(
    @Param('id', idTienda) tiendaId: string,
    @Query(new ZodValidationPipe(comoMeVenSchema)) consulta: z.infer<typeof comoMeVenSchema>,
    @SesionActual() sesion: SesionActiva,
  ): Promise<PerfilTienda> {
    return this.tiendas.perfil(tiendaId, sesion, consulta.como_me_ven === '1');
  }

  /** «Todo» del perfil con sus burbujas y «Ordenar ▾» (doc 20, punto 20). */
  @Get('tiendas/:id/publicaciones')
  @Header('Cache-Control', 'no-store')
  publicaciones(
    @Param('id', idTienda) tiendaId: string,
    @Query(new ZodValidationPipe(publicacionesTiendaSchema)) consulta: PublicacionesTiendaConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaPublicacionesTienda> {
    return this.tiendas.publicacionesDe(tiendaId, consulta, sesion);
  }

  @Get('tiendas/:id/opiniones')
  @Header('Cache-Control', 'no-store')
  opiniones(
    @Param('id', idTienda) tiendaId: string,
    @Query(new ZodValidationPipe(filtroOpinionesSchema)) consulta: FiltroOpinionesConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaOpiniones> {
    return this.tiendas.opiniones(tiendaId, consulta, sesion);
  }

  @Post('tiendas/:id/seguir')
  @HttpCode(HttpStatus.OK)
  seguir(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(seguirTiendaSchema)) datos: SeguirTiendaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSeguir> {
    return this.tiendas.seguir(tiendaId, datos, sesion);
  }

  @Patch('tiendas/:id/seguir')
  cambiarAvisos(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(seguirTiendaSchema)) datos: SeguirTiendaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSeguir> {
    return this.tiendas.cambiarAvisos(tiendaId, datos, sesion);
  }

  @Delete('tiendas/:id/seguir')
  dejarDeSeguir(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSeguir> {
    return this.tiendas.dejarDeSeguir(tiendaId, sesion);
  }

  @Post('tiendas/:id/bloqueo')
  @HttpCode(HttpStatus.NO_CONTENT)
  bloquear(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.tiendas.bloquear(tiendaId, sesion);
  }

  @Post('ventas/:id/opinion')
  opinar(
    @Param('id', id('Esta venta no existe.')) ventaId: string,
    @Body(new ZodValidationPipe(opinarSchema)) datos: OpinarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<OpinionPublica> {
    return this.tiendas.opinar(ventaId, datos, sesion);
  }

  @Post('opiniones/:id/respuesta')
  @HttpCode(HttpStatus.NO_CONTENT)
  responder(
    @Param('id', id('Esta opinión no existe.')) opinionId: string,
    @Body(new ZodValidationPipe(responderOpinionSchema)) datos: ResponderOpinionDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.tiendas.responder(opinionId, datos.texto, sesion);
  }

  /**
   * «Pedir revisión al Equipo» (N03): solo la tienda calificada, sobre una opinión de ella. Va a
   * la cola de reportes del Equipo; si ya hay una abierta, devuelve esa.
   */
  @Post('opiniones/:id/revision')
  @HttpCode(HttpStatus.OK)
  @Roles('DUENO', 'ASESOR')
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 60 * 60_000 } })
  pedirRevision(
    @Param('id', id('Esta opinión no existe.')) opinionId: string,
    @Body(new ZodValidationPipe(pedirRevisionSchema)) datos: PedirRevisionDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<{ codigo: string; resuelta: boolean }> {
    return this.tiendas.pedirRevision(opinionId, datos.motivo, sesion);
  }
}
