import {
  Body,
  type CanActivate,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  cambiarConversacionSchema,
  contactarSchema,
  denunciaSchema,
  enviarMensajeSchema,
  filtroConversacionesSchema,
  historialSchema,
  leerAvisosSchema,
  vendidoSchema,
  type CambiarConversacion,
  type ConsultaHistorial,
  type Contactar,
  type Contadores,
  type DenunciaDatos,
  type DetalleConversacion,
  type EnviarMensajeDatos,
  type FiltroConversaciones,
  type InteresadoOferta,
  type LeerAvisos,
  type MensajeChat,
  type RespuestaAvisos,
  type RespuestaContacto,
  type RespuestaConversaciones,
  type RespuestaMensajes,
  type RespuestaVendido,
  type Vendido,
} from '@paselibre/contracts';
import type { Request } from 'express';
import { z } from 'zod';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { AvisosService } from './avisos.service';
import { MensajesService } from './mensajes.service';

/** Mensajes por persona y por minuto (docs/05 §9). */
export const MENSAJES_POR_MINUTO = 30;

/** Se cuenta por persona: en una galería muchas tiendas comparten la misma IP. */
@Injectable()
export class LimiteDeMensajesGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { sesion } = context.switchToHttp().getRequest<Request>();
    if (!sesion) return false;
    const recientes = await this.prisma.mensaje.count({
      where: { autorId: sesion.usuario.id, creadoEn: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recientes >= MENSAJES_POR_MINUTO) {
      throw new ApiHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADAS_SOLICITUDES',
        'Vas muy rápido. Espera un momento antes de seguir escribiendo.',
      );
    }
    return true;
  }
}

const idDeConversacion = new ZodValidationPipe(z.uuid('Esta conversación no existe.'));
const idDeOferta = new ZodValidationPipe(z.uuid('Esta publicación no existe.'));

/**
 * Mensajes, campanita y «Vendido» (docs/05 §6.2 y §8). Solo dueños y asesores: el equipo
 * no tiene ninguna ruta para leer conversaciones (RNF-44). Nada de esto se cachea.
 */
@Controller()
@UseGuards(SesionGuard)
@Roles('DUENO', 'ASESOR')
export class MensajesController {
  constructor(
    @Inject(MensajesService) private readonly mensajes: MensajesService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  /** «Enviar mensaje» o «WhatsApp» en la ficha (RF-21, RF-23). */
  @Post('ofertas/:id/contacto')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  contactar(
    @Param('id', idDeOferta) id: string,
    @Body(new ZodValidationPipe(contactarSchema)) { canal }: Contactar,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaContacto> {
    return this.mensajes.contactar(id, canal, sesion.usuario);
  }

  @Get('conversaciones')
  @Header('Cache-Control', 'no-store')
  lista(
    @Query(new ZodValidationPipe(filtroConversacionesSchema)) filtro: FiltroConversaciones,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaConversaciones> {
    return this.mensajes.lista(filtro, sesion.usuario.id);
  }

  @Get('conversaciones/:id')
  @Header('Cache-Control', 'no-store')
  detalle(
    @Param('id', idDeConversacion) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<DetalleConversacion> {
    return this.mensajes.detalle(id, sesion.usuario);
  }

  @Get('conversaciones/:id/mensajes')
  @Header('Cache-Control', 'no-store')
  historial(
    @Param('id', idDeConversacion) id: string,
    @Query(new ZodValidationPipe(historialSchema)) consulta: ConsultaHistorial,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaMensajes> {
    return this.mensajes.mensajes(id, consulta, sesion.usuario.id);
  }

  @Post('conversaciones/:id/mensajes')
  @UseGuards(LimiteDeMensajesGuard)
  @Header('Cache-Control', 'no-store')
  enviar(
    @Param('id', idDeConversacion) id: string,
    @Body(new ZodValidationPipe(enviarMensajeSchema)) datos: EnviarMensajeDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<MensajeChat> {
    return this.mensajes.enviar(id, datos, sesion.usuario);
  }

  /** Leída o no leída, silenciar y archivar (RF-57). */
  @Patch('conversaciones/:id')
  @Header('Cache-Control', 'no-store')
  cambiar(
    @Param('id', idDeConversacion) id: string,
    @Body(new ZodValidationPipe(cambiarConversacionSchema)) cambios: CambiarConversacion,
    @SesionActual() sesion: SesionActiva,
  ): Promise<DetalleConversacion> {
    return this.mensajes.cambiar(id, cambios, sesion.usuario);
  }

  @Post('conversaciones/:id/bloqueo')
  @HttpCode(HttpStatus.NO_CONTENT)
  bloquear(
    @Param('id', idDeConversacion) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.mensajes.bloquear(id, true, sesion.usuario);
  }

  @Delete('conversaciones/:id/bloqueo')
  @HttpCode(HttpStatus.NO_CONTENT)
  desbloquear(
    @Param('id', idDeConversacion) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<void> {
    return this.mensajes.bloquear(id, false, sesion.usuario);
  }

  @Post('denuncias')
  @Header('Cache-Control', 'no-store')
  denunciar(
    @Body(new ZodValidationPipe(denunciaSchema)) datos: DenunciaDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<{ id: string }> {
    return this.mensajes.denunciar(datos, sesion.usuario.id);
  }

  @Get('ofertas/:id/interesados')
  @Header('Cache-Control', 'no-store')
  interesados(
    @Param('id', idDeOferta) id: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<InteresadoOferta[]> {
    return this.mensajes.interesados(id, sesion.usuario);
  }

  @Post('ofertas/:id/vendido')
  @Header('Cache-Control', 'no-store')
  vendido(
    @Param('id', idDeOferta) id: string,
    @Body(new ZodValidationPipe(vendidoSchema)) { conversacion_id }: Vendido,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaVendido> {
    return this.mensajes.vendido(id, conversacion_id, sesion.usuario);
  }

  // ── Campanita (RF-40) ─────────────────────────────────────────────────────

  @Get('avisos')
  @Header('Cache-Control', 'no-store')
  listaDeAvisos(@SesionActual() sesion: SesionActiva): Promise<RespuestaAvisos> {
    return this.avisos.lista(sesion.usuario.id);
  }

  @Post('avisos/leidos')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  leerAvisos(
    @Body(new ZodValidationPipe(leerAvisosSchema)) { ids }: LeerAvisos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaAvisos> {
    return this.avisos.leer(sesion.usuario.id, ids);
  }

  /** Las insignias de Mensajes y la campanita. */
  @Get('contadores')
  @Header('Cache-Control', 'no-store')
  contadores(@SesionActual() sesion: SesionActiva): Promise<Contadores> {
    return this.avisos.contadores(sesion.usuario.id);
  }
}
