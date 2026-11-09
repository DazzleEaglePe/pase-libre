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
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  aprobarSolicitudSchema,
  codigoDeConsultaSchema,
  consultarRucSchema,
  corregirSolicitudSchema,
  crearSolicitudSchema,
  filtroSolicitudesSchema,
  mensajeDelEquipoSchema,
  pedirCodigoSchema,
  verificarCodigoSchema,
  type AprobarSolicitud,
  type ConsultarRuc,
  type CorregirSolicitud,
  type CrearSolicitud,
  type FiltroSolicitudes,
  type MensajeDelEquipo,
  type PedirCodigo,
  type RespuestaCodigo,
  type RespuestaOpcionesRegistro,
  type RespuestaRuc,
  type RespuestaSolicitud,
  type RespuestaSolicitudesEquipo,
  type RespuestaVerificacion,
  type SolicitudEquipo,
  type VerificarCodigo,
} from '@paselibre/contracts';
import { Query } from '@nestjs/common';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { LIMITE_IP } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { RegistroService } from './registro.service';

const HORA = 60 * 60_000;
const consulta = new ZodValidationPipe(codigoDeConsultaSchema);

/**
 * Registro propio de tiendas, sin sesión (RF-01, RF-04). Cada ruta lleva un techo por IP más
 * alto que el de una tienda suelta: en una galería muchas salen con el mismo wifi. Nada de
 * esto se cachea: trae códigos, tokens y datos personales.
 */
@Controller('registro')
export class RegistroController {
  constructor(@Inject(RegistroService) private readonly registro: RegistroService) {}

  @Get('opciones')
  @Header('Cache-Control', 'no-store')
  opciones(): Promise<RespuestaOpcionesRegistro> {
    return this.registro.opciones();
  }

  @Post('celular')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 60, ttl: HORA } })
  pedirCodigo(
    @Body(new ZodValidationPipe(pedirCodigoSchema)) entrada: PedirCodigo,
  ): Promise<RespuestaCodigo> {
    return this.registro.pedirCodigo(entrada.celular);
  }

  @Post('celular/verificar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 120, ttl: HORA } })
  verificar(
    @Body(new ZodValidationPipe(verificarCodigoSchema)) entrada: VerificarCodigo,
  ): Promise<RespuestaVerificacion> {
    return this.registro.verificarCodigo(entrada.celular, entrada.codigo);
  }

  @Post('ruc')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 120, ttl: HORA } })
  ruc(
    @Body(new ZodValidationPipe(consultarRucSchema)) entrada: ConsultarRuc,
  ): Promise<RespuestaRuc> {
    return this.registro.consultarRuc(entrada.ruc);
  }

  @Post('solicitudes')
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 30, ttl: HORA } })
  crear(
    @Body(new ZodValidationPipe(crearSolicitudSchema)) entrada: CrearSolicitud,
  ): Promise<RespuestaSolicitud> {
    return this.registro.crear(entrada);
  }

  @Get('solicitudes/:consulta')
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 300, ttl: HORA } })
  estado(@Param('consulta', consulta) codigo: string): Promise<RespuestaSolicitud> {
    return this.registro.estado(codigo);
  }

  @Put('solicitudes/:consulta')
  @Header('Cache-Control', 'no-store')
  @Throttle({ [LIMITE_IP]: { limit: 60, ttl: HORA } })
  corregir(
    @Param('consulta', consulta) codigo: string,
    @Body(new ZodValidationPipe(corregirSolicitudSchema)) entrada: CorregirSolicitud,
  ): Promise<RespuestaSolicitud> {
    return this.registro.corregir(codigo, entrada);
  }
}

const idDeSolicitud = new ZodValidationPipe(z.uuid('Esa solicitud no existe.'));

/** La cola de solicitudes del panel del equipo: solo `rol = EQUIPO`. */
@Controller('equipo/solicitudes')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class SolicitudesEquipoController {
  constructor(@Inject(RegistroService) private readonly registro: RegistroService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(
    @Query(new ZodValidationPipe(filtroSolicitudesSchema)) filtro: FiltroSolicitudes,
  ): Promise<RespuestaSolicitudesEquipo> {
    return this.registro.listar(filtro);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detalle(@Param('id', idDeSolicitud) id: string): Promise<SolicitudEquipo> {
    return this.registro.detalle(id);
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  aprobar(
    @Param('id', idDeSolicitud) id: string,
    @Body(new ZodValidationPipe(aprobarSolicitudSchema)) entrada: AprobarSolicitud,
    @SesionActual() sesion: SesionActiva,
  ): Promise<SolicitudEquipo> {
    return this.registro.aprobar(id, entrada.galeria, sesion.usuario.id);
  }

  @Post(':id/pedir-cambios')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  pedirCambios(
    @Param('id', idDeSolicitud) id: string,
    @Body(new ZodValidationPipe(mensajeDelEquipoSchema)) entrada: MensajeDelEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<SolicitudEquipo> {
    return this.registro.pedirCambios(id, entrada.mensaje, sesion.usuario.id);
  }

  @Post(':id/rechazar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  rechazar(
    @Param('id', idDeSolicitud) id: string,
    @Body(new ZodValidationPipe(mensajeDelEquipoSchema)) entrada: MensajeDelEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<SolicitudEquipo> {
    return this.registro.rechazar(id, entrada.mensaje, sesion.usuario.id);
  }
}
