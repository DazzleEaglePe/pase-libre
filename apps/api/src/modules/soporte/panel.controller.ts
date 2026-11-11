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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  advertenciaSchema,
  comunicadoSchema,
  decisionReporteSchema,
  destacarSchema,
  preferenciasEquipoSchema,
  suspensionSchema,
  tiendasPanelSchema,
  type AdvertenciaDatos,
  type ComunicadoDatos,
  type ComunicadoEnviado,
  type DecisionReporte,
  type DestacadoActivo,
  type DestacarDatos,
  type PreferenciasEquipo,
  type RespuestaDestacados,
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
import { DestacadosService } from './destacados.service';
import { PanelService } from './panel.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));

/** El panel del equipo (sección 20 del lienzo final). Solo `rol = EQUIPO`. */
@Controller('equipo')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class PanelController {
  constructor(
    @Inject(PanelService) private readonly panel: PanelService,
    @Inject(DestacadosService) private readonly destacados: DestacadosService,
  ) {}

  /** El modo claro u oscuro del panel (COR18). */
  @Put('preferencias')
  @Header('Cache-Control', 'no-store')
  preferencias(
    @Body(new ZodValidationPipe(preferenciasEquipoSchema)) datos: PreferenciasEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<PreferenciasEquipo> {
    return this.panel.preferencias(sesion, datos);
  }

  /** Las destacadas ahora (COR16): solo las ve el equipo. */
  @Get('destacados')
  @Header('Cache-Control', 'no-store')
  destacadosActivos(): Promise<RespuestaDestacados> {
    return this.destacados.activos();
  }

  @Post('panel/tiendas/:id/destacar')
  @Header('Cache-Control', 'no-store')
  destacar(
    @Param('id', id('Esta tienda no existe.')) tiendaId: string,
    @Body(new ZodValidationPipe(destacarSchema)) datos: DestacarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<DestacadoActivo> {
    return this.destacados.destacar(tiendaId, datos, sesion);
  }

  /** «Quitar ahora». */
  @Delete('destacados/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async quitarDestacado(
    @Param('id', id('Ese destacado no existe.')) destacado: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.destacados.quitar(destacado, sesion);
  }

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
