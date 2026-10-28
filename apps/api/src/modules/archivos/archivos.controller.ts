import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Header,
  HttpStatus,
  Inject,
  Injectable,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ArchivoSubido } from '@paselibre/contracts';
import type { Request } from 'express';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { Roles, SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import type { SesionActiva } from '../sesion/sesion.types';
import { ArchivosService, MAX_BYTES_FOTO } from './archivos.service';

/** Subidas por persona y por hora (docs/05 §9). */
export const SUBIDAS_POR_HORA = 30;

/**
 * El límite se cuenta por persona y no por IP: en una galería muchas tiendas salen a
 * internet con la misma IP. Corre antes de recibir el archivo.
 */
@Injectable()
export class LimiteDeSubidasGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { sesion } = context.switchToHttp().getRequest<Request>();
    if (!sesion) return false;
    const subidas = await this.prisma.archivo.count({
      where: { usuarioId: sesion.usuario.id, creadoEn: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (subidas >= SUBIDAS_POR_HORA) {
      throw new ApiHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADAS_SOLICITUDES',
        'Subiste muchas fotos en la última hora. Espera un rato y vuelve a intentarlo.',
      );
    }
    return true;
  }
}

/** Lo que deja Multer de la foto recibida (en memoria, nunca en disco sin revisar). */
interface FotoRecibida {
  buffer: Buffer;
  size: number;
}

@Controller('archivos')
@UseGuards(SesionGuard, LimiteDeSubidasGuard)
@Roles('DUENO', 'ASESOR')
export class ArchivosController {
  constructor(@Inject(ArchivosService) private readonly archivos: ArchivosService) {}

  /** `POST /v1/archivos` con el campo `foto` (multipart). */
  @Post()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_BYTES_FOTO, files: 1, fields: 0 } }),
  )
  subir(
    @UploadedFile() foto: FotoRecibida | undefined,
    @SesionActual() sesion: SesionActiva,
  ): Promise<ArchivoSubido> {
    if (!foto?.size) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Elige una foto para subir.',
      );
    }
    return this.archivos.subir(foto.buffer, {
      id: sesion.usuario.id,
      tiendaId: sesion.usuario.tiendaId,
    });
  }
}
