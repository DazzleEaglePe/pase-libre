import { Module } from '@nestjs/common';

import { SesionOpcionalGuard } from '../../shared/guards/sesion-opcional.guard';
import { MensajesModule } from '../mensajes/mensajes.module';
import { EnVivoActivoGuard } from './en-vivo-activo.guard';
import { EnVivoController, EnVivoPublicoController } from './en-vivo.controller';
import { EnVivoService } from './en-vivo.service';

@Module({
  imports: [MensajesModule],
  controllers: [EnVivoPublicoController, EnVivoController],
  providers: [EnVivoService, EnVivoActivoGuard, SesionOpcionalGuard],
})
export class EnVivoModule {}
