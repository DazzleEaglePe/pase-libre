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
  UseGuards,
} from '@nestjs/common';
import {
  agregarAvisoGaleriaSchema,
  crearGaleriaSchema,
  editarGaleriaSchema,
  ordenGaleriasSchema,
  type AgregarAvisoGaleriaDatos,
  type CrearGaleriaDatos,
  type EditarGaleriaDatos,
  type GaleriaEquipo,
  type OrdenGaleriasDatos,
  type RespuestaGaleriasEquipo,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { GaleriasService } from './galerias.service';

const idDeGaleria = new ZodValidationPipe(z.uuid('Esa galería no existe.'));
const idDeAviso = new ZodValidationPipe(z.uuid('Ese aviso ya no está.'));
/** «Agregar» sin cuerpo usa el nombre tal como lo escribieron. */
const agregarAviso = new ZodValidationPipe(
  z.preprocess((valor) => valor ?? {}, agregarAvisoGaleriaSchema),
);

/** Equipo › Galerías (docs/18 §3). Solo `rol = EQUIPO`. */
@Controller('equipo/galerias')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class GaleriasController {
  constructor(@Inject(GaleriasService) private readonly galerias: GaleriasService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  lista(): Promise<RespuestaGaleriasEquipo> {
    return this.galerias.lista();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  crear(
    @Body(new ZodValidationPipe(crearGaleriaSchema)) datos: CrearGaleriaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<GaleriaEquipo> {
    return this.galerias.crear(datos, sesion);
  }

  /** Va antes de `:id` para que «orden» no se lea como un id. */
  @Put('orden')
  @HttpCode(HttpStatus.NO_CONTENT)
  async ordenar(
    @Body(new ZodValidationPipe(ordenGaleriasSchema)) { ids }: OrdenGaleriasDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.galerias.ordenar(ids, sesion);
  }

  @Post('avisos/:id/agregar')
  @Header('Cache-Control', 'no-store')
  agregarAviso(
    @Param('id', idDeAviso) id: string,
    @Body(agregarAviso) datos: AgregarAvisoGaleriaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<GaleriaEquipo> {
    return this.galerias.agregarAviso(id, datos, sesion);
  }

  @Post('avisos/:id/descartar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async descartarAviso(
    @Param('id', idDeAviso) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.galerias.descartarAviso(id, sesion);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  editar(
    @Param('id', idDeGaleria) id: string,
    @Body(new ZodValidationPipe(editarGaleriaSchema)) datos: EditarGaleriaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<GaleriaEquipo> {
    return this.galerias.editar(id, datos, sesion);
  }

  /** Solo si nadie la usa: con tiendas responde 409 y se oculta en vez de borrar. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async borrar(
    @Param('id', idDeGaleria) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.galerias.borrar(id, sesion);
  }
}
