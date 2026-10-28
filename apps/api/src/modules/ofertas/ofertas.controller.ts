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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  confirmarOfertasSchema,
  editarOfertaSchema,
  misOfertasSchema,
  publicarSchema,
  sugerenciasSchema,
  type ConfirmarOfertas,
  type EditarOfertaDatos,
  type MisOfertasConsulta,
  type OfertaPropia,
  type PublicarDatos,
  type RespuestaConfirmar,
  type RespuestaMisOfertas,
  type RespuestaPublicar,
  type RespuestaSugerencias,
  type SugerenciasConsulta,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { OfertasService } from './ofertas.service';

const idDeOferta = new ZodValidationPipe(z.uuid('Esa publicación no existe.'));

/** La tienda de la sesión. El dueño y el asesor siempre tienen una (CHECK usuario_rol_tienda). */
const tiendaDe = (sesion: SesionActiva): string => sesion.usuario.tiendaId ?? '';

/**
 * Publicar y Mis publicaciones (docs/05 §6.2). Solo dueños y asesores, siempre sobre las
 * ofertas de su tienda: una oferta de otra tienda responde 404, como si no existiera.
 * Las respuestas traen precios ocultos de la propia tienda, así que nunca se cachean.
 */
@Controller()
@UseGuards(SesionGuard)
@Roles('DUENO', 'ASESOR')
export class OfertasController {
  constructor(@Inject(OfertasService) private readonly ofertas: OfertasService) {}

  @Get('catalogo/sugerencias')
  @Header('Cache-Control', 'no-store')
  sugerencias(
    @Query(new ZodValidationPipe(sugerenciasSchema)) consulta: SugerenciasConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaSugerencias> {
    return this.ofertas.sugerencias(consulta, tiendaDe(sesion));
  }

  @Post('ofertas')
  @Header('Cache-Control', 'no-store')
  publicar(
    @Body(new ZodValidationPipe(publicarSchema)) datos: PublicarDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaPublicar> {
    return this.ofertas.publicar(datos, sesion.usuario);
  }

  @Get('mis-ofertas')
  @Header('Cache-Control', 'no-store')
  misOfertas(
    @Query(new ZodValidationPipe(misOfertasSchema)) consulta: MisOfertasConsulta,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaMisOfertas> {
    return this.ofertas.misOfertas(consulta, sesion.usuario);
  }

  /** «Siguen igual»: va antes de `ofertas/:id` para que «confirmar» no se lea como id. */
  @Post('ofertas/confirmar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  confirmar(
    @Body(new ZodValidationPipe(confirmarOfertasSchema)) datos: ConfirmarOfertas,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaConfirmar> {
    return this.ofertas.confirmar(datos, tiendaDe(sesion));
  }

  @Get('ofertas/:id')
  @Header('Cache-Control', 'no-store')
  una(
    @Param('id', idDeOferta) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<OfertaPropia> {
    return this.ofertas.una(id, tiendaDe(sesion));
  }

  @Patch('ofertas/:id')
  @Header('Cache-Control', 'no-store')
  editar(
    @Param('id', idDeOferta) id: string,
    @Body(new ZodValidationPipe(editarOfertaSchema)) cambios: EditarOfertaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<OfertaPropia> {
    return this.ofertas.editar(id, cambios, tiendaDe(sesion));
  }

  @Delete('ofertas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(
    @Param('id', idDeOferta) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.ofertas.eliminar(id, tiendaDe(sesion));
  }
}
