import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  advertenciaSchema,
  comunicadoSchema,
  decisionReporteSchema,
  suspensionSchema,
  tiendasPanelSchema,
  type AdvertenciaDatos,
  type ComunicadoDatos,
  type ComunicadoEnviado,
  type DecisionReporte,
  type DetalleReporte,
  type DetalleTiendaPanel,
  type ReporteEnCola,
  type RespuestaInicioEquipo,
  type SuspensionDatos,
  type TiendaEnPanel,
  type TiendasPanelConsulta,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { PanelService } from './panel.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));

/** El panel del equipo (sección 20 del lienzo final). Solo `rol = EQUIPO`. */
@Controller('equipo')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class PanelController {
  constructor(@Inject(PanelService) private readonly panel: PanelService) {}

  @Get('inicio')
  @Header('Cache-Control', 'no-store')
  inicio(): Promise<RespuestaInicioEquipo> {
    return this.panel.inicio();
  }

  @Get('reportes')
  @Header('Cache-Control', 'no-store')
  cola(): Promise<ReporteEnCola[]> {
    return this.panel.cola();
  }

  @Get('reportes/:id')
  @Header('Cache-Control', 'no-store')
  reporte(@Param('id', id('Ese reporte no existe.')) reporteId: string): Promise<DetalleReporte> {
    return this.panel.reporte(reporteId);
  }

  @Post('reportes/:id/decision')
  @HttpCode(HttpStatus.OK)
  decidir(
    @Param('id', id('Ese reporte no existe.')) reporteId: string,
    @Body(new ZodValidationPipe(decisionReporteSchema)) decision: DecisionReporte,
    @SesionActual() sesion: SesionActiva,
  ): Promise<DetalleReporte> {
    return this.panel.decidir(reporteId, decision, sesion);
  }

  @Get('panel/tiendas')
  @Header('Cache-Control', 'no-store')
  tiendas(
    @Query(new ZodValidationPipe(tiendasPanelSchema)) consulta: TiendasPanelConsulta,
  ): Promise<TiendaEnPanel[]> {
    return this.panel.tiendas(consulta);
  }

  @Get('panel/tiendas/:id')
  @Header('Cache-Control', 'no-store')
  tienda(@Param('id', id('Esta tienda no existe.')) tiendaId: string): Promise<DetalleTiendaPanel> {
    return this.panel.tienda(tiendaId);
  }

  @Post('panel/tiendas/:id/advertencia')
  @HttpCode(HttpStatus.NO_CONTENT)
  advertir(
    @Param('id', id('Esta tienda no existe.')) tiendaId: string,
    @Body(new ZodValidationPipe(advertenciaSchema)) datos: AdvertenciaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.panel.advertir(tiendaId, datos, sesion);
  }

  @Post('panel/tiendas/:id/suspension')
  @HttpCode(HttpStatus.NO_CONTENT)
  suspender(
    @Param('id', id('Esta tienda no existe.')) tiendaId: string,
    @Body(new ZodValidationPipe(suspensionSchema)) datos: SuspensionDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.panel.suspender(tiendaId, datos, sesion);
  }

  @Get('comunicados')
  @Header('Cache-Control', 'no-store')
  comunicados(): Promise<ComunicadoEnviado[]> {
    return this.panel.comunicados();
  }

  @Post('comunicados')
  comunicar(
    @Body(new ZodValidationPipe(comunicadoSchema)) datos: ComunicadoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<ComunicadoEnviado> {
    return this.panel.comunicar(datos, sesion);
  }
}
