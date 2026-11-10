import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  escribirEquipoSchema,
  type EscribirEquipoDatos,
  type HiloEquipoEnLista,
  type MensajeChatEquipo,
  type RespuestaChatEquipo,
} from '@paselibre/contracts';
import { z } from 'zod';

import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import type { SesionActiva } from '../sesion/sesion.types';
import { SoporteService } from './soporte.service';

const idTienda = new ZodValidationPipe(z.uuid('Esta tienda no existe.'));

/** El chat de la tienda con el equipo (REP_WebChatEquipo). */
@Controller('equipo-chat')
@UseGuards(SesionGuard)
export class ChatEquipoController {
  constructor(@Inject(SoporteService) private readonly soporte: SoporteService) {}

  /** Con `?leer=1` se marca leído (al abrir el chat); sin él, solo se cuenta. */
  @Get()
  @Header('Cache-Control', 'no-store')
  miChat(
    @SesionActual() sesion: SesionActiva,
    @Query('leer') leer?: string,
  ): Promise<RespuestaChatEquipo> {
    return this.soporte.miChat(sesion, leer === '1' || leer === 'true');
  }

  @Post('mensajes')
  escribir(
    @Body(new ZodValidationPipe(escribirEquipoSchema)) datos: EscribirEquipoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    return this.soporte.escribirAlEquipo(datos, sesion);
  }
}

/** Los chats con las tiendas, del lado del equipo (panel del equipo). */
@Controller('equipo/chats')
@UseGuards(SesionGuard)
@Roles('EQUIPO')
export class ChatsDelEquipoController {
  constructor(@Inject(SoporteService) private readonly soporte: SoporteService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  hilos(): Promise<HiloEquipoEnLista[]> {
    return this.soporte.hilos();
  }

  @Get(':tienda')
  @Header('Cache-Control', 'no-store')
  chat(
    @Param('tienda', idTienda) tiendaId: string,
    @SesionActual() sesion: SesionActiva,
  ): Promise<RespuestaChatEquipo> {
    return this.soporte.chatDeTienda(tiendaId, sesion);
  }

  @Post(':tienda/mensajes')
  escribir(
    @Param('tienda', idTienda) tiendaId: string,
    @Body(new ZodValidationPipe(escribirEquipoSchema)) datos: EscribirEquipoDatos,
    @SesionActual() sesion: SesionActiva,
  ): Promise<MensajeChatEquipo> {
    return this.soporte.escribirATienda(tiendaId, datos, sesion);
  }
}
