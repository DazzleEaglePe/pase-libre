import {
  type CanActivate,
  Controller,
  type ExecutionContext,
  Header,
  HttpStatus,
  Inject,
  Injectable,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { ArchivoSubido } from '@paselibre/contracts';
import type { Request } from 'express';
import { z } from 'zod';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import {
  PermitirEnSoporte,
  Roles,
  SesionActual,
  SesionGuard,
} from '../../shared/guards/sesion.guard';
import type { SesionActiva } from '../sesion/sesion.types';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import { ArchivosService, MAX_BYTES_FOTO } from './archivos.service';

/** `?para=portada`: la portada del perfil se guarda de hasta 2400 px (docs/19 §20). */
const paraQue = z.object({ para: z.enum(['portada'], 'Eso no se puede subir aquí.').optional() });

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
// El equipo también sube fotos: las del catálogo (COR15).
@Roles('DUENO', 'ASESOR', 'EQUIPO')
export class ArchivosController {
  constructor(@Inject(ArchivosService) private readonly archivos: ArchivosService) {}

  /**
   * `POST /v1/archivos` con el campo `foto` (multipart). En modo soporte, para la portada (N14).
   * Con `?para=portada`, la foto se guarda de hasta 2400 px por lado; las demás, de 1600.
   */
  @Post()
  @PermitirEnSoporte()
  @Header('Cache-Control', 'no-store')
  @UseInterceptors(
    FileInterceptor('foto', { limits: { fileSize: MAX_BYTES_FOTO, files: 1, fields: 0 } }),
  )
  subir(
    @UploadedFile() foto: FotoRecibida | undefined,
    @Query(new ZodValidationPipe(paraQue)) consulta: z.output<typeof paraQue>,
    @SesionActual() sesion: SesionActiva,
  ): Promise<ArchivoSubido> {
    if (!foto?.size) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Elige una foto para subir.',
      );
    }
    return this.archivos.subir(
      foto.buffer,
      { id: sesion.usuario.id, tiendaId: sesion.usuario.tiendaId },
      consulta.para === 'portada' ? 'portada' : 'foto',
    );
  }
}
