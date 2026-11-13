import { Module } from '@nestjs/common';

import { SesionOpcionalGuard } from '../../shared/guards/sesion-opcional.guard';
import { ArchivosModule } from '../archivos/archivos.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { EnVivoActivoGuard } from './en-vivo-activo.guard';
import { EnVivoController, EnVivoPublicoController } from './en-vivo.controller';
import { EnVivoService } from './en-vivo.service';

@Module({
  imports: [ArchivosModule, MensajesModule],
  controllers: [EnVivoPublicoController, EnVivoController],
  providers: [EnVivoService, EnVivoActivoGuard, SesionOpcionalGuard],
  exports: [EnVivoService],
})
export class EnVivoModule {}
