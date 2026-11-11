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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  agregarCatalogoSchema,
  catalogoEquipoSchema,
  editarCatalogoSchema,
  unirCatalogoSchema,
  type AgregarCatalogoDatos,
  type CatalogoEquipoConsulta,
  type EditarCatalogoDatos,
  type RespuestaCatalogoEquipo,
  type RespuestaImportacion,
  type RespuestaPorRevisar,
  type RevisionImportacion,
  type UnirCatalogoDatos,
} from '@paselibre/contracts';
import { z } from 'zod';

import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { CatalogoEquipoService } from './catalogo-equipo.service';

const id = new ZodValidationPipe(z.uuid('Ese producto no existe.'));
/** Un .zip con el Excel y las fotos: hasta 40 MB. */
const MAX_BYTES_ARCHIVO = 40 * 1024 * 1024;

/** El catálogo del equipo (COR15). Solo `rol = EQUIPO`. */
@Controller('equipo/catalogo')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class CatalogoEquipoController {
  constructor(@Inject(CatalogoEquipoService) private readonly catalogo: CatalogoEquipoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  lista(
    @Query(new ZodValidationPipe(catalogoEquipoSchema)) consulta: CatalogoEquipoConsulta,
  ): Promise<RespuestaCatalogoEquipo> {
    return this.catalogo.lista(consulta);
  }

  @Get('por-revisar')
  @Header('Cache-Control', 'no-store')
  porRevisar(): Promise<RespuestaPorRevisar> {
    return this.catalogo.porRevisar();
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  agregar(
    @Body(new ZodValidationPipe(agregarCatalogoSchema)) datos: AgregarCatalogoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<{ creados: number }> {
    return this.catalogo.agregar(datos, sesion);
  }

  @Post('importar')
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_BYTES_ARCHIVO, files: 1, fields: 0 } }),
  )
  importar(
    @UploadedFile() archivo: { buffer: Buffer; originalname: string; size: number } | undefined,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RevisionImportacion> {
    if (!archivo?.size) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Elige un archivo .xlsx, .csv o .zip.',
      );
    }
    return this.catalogo.importar(archivo, sesion);
  }

  @Post('importar/:id/crear')
  @Header('Cache-Control', 'no-store')
  crearImportacion(
    @Param('id', id) importacion: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaImportacion> {
    return this.catalogo.crearImportacion(importacion, sesion);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async editar(
    @Param('id', id) producto: string,
    @Body(new ZodValidationPipe(editarCatalogoSchema)) datos: EditarCatalogoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.catalogo.editar(producto, datos, sesion);
  }

  @Post(':id/aprobar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async aprobar(
    @Param('id', id) producto: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.catalogo.aprobar(producto, sesion);
  }

  @Post(':id/unir')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unir(
    @Param('id', id) producto: string,
    @Body(new ZodValidationPipe(unirCatalogoSchema)) datos: UnirCatalogoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    await this.catalogo.unir(producto, datos.con, sesion);
  }
}
