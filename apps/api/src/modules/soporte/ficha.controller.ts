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
import { Throttle } from '@nestjs/throttler';
import {
  claveTiendaEquipoSchema,
  datosTiendaEquipoSchema,
  eliminarTiendaSchema,
  estadoPublicacionEquipoSchema,
  limiteDispositivosSchema,
  type ActividadDeTienda,
  type CambioDelEquipo,
  type ClaveTiendaEquipo,
  type DatosTiendaEquipo,
  type EliminarTiendaDatos,
  type EstadoPublicacionEquipo,
  type EstadoSoporteTienda,
  type FichaTienda,
  type LecturaDeChat,
  type LimiteDispositivos,
  type PublicacionDeTienda,
  type ReportesDeTienda,
  type RespuestaChatsDeTienda,
  type RespuestaClaveTienda,
} from '@paselibre/contracts';
import { z } from 'zod';

import {
  PermitirEnSoporte,
  Roles,
  SesionActual,
  SesionGuard,
} from '../../shared/guards/sesion.guard';
import { LIMITE_PERSONA } from '../../shared/limites';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { AyudaService } from './ayuda.service';
import { EliminarTiendaService } from './eliminar-tienda.service';
import { FichaService } from './ficha.service';

const id = (mensaje: string) => new ZodValidationPipe(z.uuid(mensaje));
const idTienda = id('Esta tienda no existe.');
const cualImagen = new ZodValidationPipe(z.enum(['logo', 'portada'], 'Elige logo o portada.'));

/** La ficha completa de una tienda (N14). Solo `rol = EQUIPO`; nada se guarda en caché. */
@Controller('equipo/panel/tiendas')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class FichaController {
  constructor(
    @Inject(FichaService) private readonly fichas: FichaService,
    @Inject(AyudaService) private readonly ayuda: AyudaService,
    @Inject(EliminarTiendaService) private readonly eliminacion: EliminarTiendaService,
  ) {}

  @Get(':id/ficha')
  @Header('Cache-Control', 'no-store')
  ficha(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.ficha(tiendaId, sesion);
  }

  /**
   * «Eliminar definitivamente» (doc 19 §9): con la tienda suspendida hace más de 24 h y **tu**
   * contraseña. Solo administradores.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 15 * 60_000 } })
  eliminar(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(eliminarTiendaSchema)) datos: EliminarTiendaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.eliminacion.eliminar(tiendaId, datos.clave, sesion);
  }

  @Patch(':id/datos')
  @Header('Cache-Control', 'no-store')
  datos(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(datosTiendaEquipoSchema)) datos: DatosTiendaEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.datos(tiendaId, datos, sesion);
  }

  @Delete(':id/imagen/:cual')
  @Header('Cache-Control', 'no-store')
  quitarImagen(
    @Param('id', idTienda) tiendaId: string,
    @Param('cual', cualImagen) cual: 'logo' | 'portada',
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.quitarImagen(tiendaId, cual, sesion);
  }

  @Get(':id/publicaciones')
  @Header('Cache-Control', 'no-store')
  publicaciones(@Param('id', idTienda) tiendaId: string): Promise<PublicacionDeTienda[]> {
    return this.fichas.publicaciones(tiendaId);
  }

  @Post(':id/publicaciones/:oferta/estado')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  estadoPublicacion(
    @Param('id', idTienda) tiendaId: string,
    @Param('oferta', id('Esa publicación no existe.')) ofertaId: string,
    @Body(new ZodValidationPipe(estadoPublicacionEquipoSchema)) datos: EstadoPublicacionEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<PublicacionDeTienda[]> {
    return this.fichas.estadoPublicacion(tiendaId, ofertaId, datos.estado, sesion);
  }

  @Get(':id/conversaciones')
  @Header('Cache-Control', 'no-store')
  conversaciones(@Param('id', idTienda) tiendaId: string): Promise<RespuestaChatsDeTienda> {
    return this.fichas.conversaciones(tiendaId);
  }

  /** Solo lectura; queda anotado quién lo abrió y cuándo (mejoras 42 y 49). */
  @Get(':id/conversaciones/:conversacion')
  @Header('Cache-Control', 'no-store')
  leerChat(
    @Param('id', idTienda) tiendaId: string,
    @Param('conversacion', id('Ese chat no existe.')) conversacionId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<LecturaDeChat> {
    return this.fichas.leerChat(tiendaId, conversacionId, sesion);
  }

  @Get(':id/actividad')
  @Header('Cache-Control', 'no-store')
  actividad(@Param('id', idTienda) tiendaId: string): Promise<ActividadDeTienda> {
    return this.fichas.actividad(tiendaId);
  }

  @Get(':id/reportes')
  @Header('Cache-Control', 'no-store')
  reportes(@Param('id', idTienda) tiendaId: string): Promise<ReportesDeTienda> {
    return this.fichas.reportes(tiendaId);
  }

  @Post(':id/clave')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [LIMITE_PERSONA]: { limit: 10, ttl: 15 * 60_000 } })
  @Header('Cache-Control', 'no-store')
  clave(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(claveTiendaEquipoSchema)) datos: ClaveTiendaEquipo,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaClaveTienda> {
    return this.fichas.clave(tiendaId, datos, sesion);
  }

  /** Va antes de `sesiones/:sesion` para que no se lea como id. */
  @Post(':id/sesiones/cerrar-todas')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  cerrarTodas(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.cerrarTodas(tiendaId, sesion);
  }

  @Delete(':id/sesiones/:sesion')
  @Header('Cache-Control', 'no-store')
  cerrarSesion(
    @Param('id', idTienda) tiendaId: string,
    @Param('sesion', id('Esa sesión ya está cerrada.')) sesionId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.cerrarSesion(tiendaId, sesionId, sesion);
  }

  @Put(':id/limite')
  @Header('Cache-Control', 'no-store')
  limite(
    @Param('id', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(limiteDispositivosSchema)) datos: LimiteDispositivos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<FichaTienda> {
    return this.fichas.limite(tiendaId, datos.limite, sesion);
  }

  @Get(':id/historial')
  @Header('Cache-Control', 'no-store')
  historial(@Param('id', idTienda) tiendaId: string): Promise<CambioDelEquipo[]> {
    return this.fichas.historial(tiendaId);
  }

  /** «Ayudar como la tienda»: desde aquí la sesión ve PaseLibre como el dueño por 1 hora. */
  @Post(':id/soporte')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  iniciarSoporte(
    @Param('id', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<{ vence_en: string }> {
    return this.ayuda.iniciar(tiendaId, sesion);
  }
}

/** «Pedir ayuda al Equipo» en Ayuda (N14). Lo autoriza la cuenta principal. */
@Controller('cuenta/soporte')
@UseGuards(SesionGuard)
export class PedirAyudaController {
  constructor(@Inject(AyudaService) private readonly ayuda: AyudaService) {}

  @Get()
  @Roles('DUENO', 'ASESOR')
  @Header('Cache-Control', 'no-store')
  estado(@SesionActual() sesion: SesionActiva): Promise<EstadoSoporteTienda> {
    return this.ayuda.estado(sesion);
  }

  @Post()
  @Roles('DUENO')
  @HttpCode(HttpStatus.OK)
  @Throttle({ [LIMITE_PERSONA]: { limit: 5, ttl: 60 * 60_000 } })
  @Header('Cache-Control', 'no-store')
  pedir(@SesionActual() sesion: SesionActiva): Promise<EstadoSoporteTienda> {
    return this.ayuda.pedir(sesion);
  }
}

/** «Salir» de la franja del modo soporte: funciona dentro del modo (es lo único que cambia). */
@Controller('soporte')
@UseGuards(SesionGuard)
export class SalirDeSoporteController {
  constructor(@Inject(AyudaService) private readonly ayuda: AyudaService) {}

  @Post('salir')
  @HttpCode(HttpStatus.OK)
  @PermitirEnSoporte()
  @Header('Cache-Control', 'no-store')
  salir(@SesionActual() sesion: SesionActiva): Promise<{ tienda_id: string | null }> {
    return this.ayuda.salir(sesion);
  }
}
