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
  opinarSchema,
  responderOpinionSchema,
  seguirTiendaSchema,
  type AgregarSocioDatos,
  type BuscarTiendasConsulta,
  type DescuentoSocioDatos,
  type FiltroOpinionesConsulta,
  type OpinarDatos,
  type OpinionPublica,
  type PerfilTienda,
  type ResponderOpinionDatos,
  type RespuestaOpiniones,
  type RespuestaSeguir,
  type RespuestaSocios,
  type SeguirTiendaDatos,
  type TiendaBreve,
  type TiendaSeguida,
} from '@paselibre/contracts';
import { z } from 'zod';

import { SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiendasService } from './tiendas.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));
const idTienda = id('Esta tienda no existe.');

/**
 * Perfil de otra tienda, seguir y opiniones (SG_Web, SEG_Web, sección 15 del lienzo final).
 * Todo con sesión y sin caché: cambia con quien mira.
 */
@Controller()
@UseGuards(SesionGuard)
export class TiendasController {
  constructor(@Inject(TiendasService) private readonly tiendas: TiendasService) {}

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

  @Get('tiendas/seguidas')
  @Header('Cache-Control', 'no-store')
  seguidas(@SesionActual() sesion: SesionActiva): Promise<TiendaSeguida[]> {
    return this.tiendas.seguidas(sesion);
  }

  @Get('tiendas/:id')
  @Header('Cache-Control', 'no-store')
  perfil(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<PerfilTienda> {
    return this.tiendas.perfil(tiendaId, sesion);
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
}
