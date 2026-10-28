import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { AvisosService } from './avisos.service';
import { LimiteDeMensajesGuard, MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';

@Module({
  imports: [ArchivosModule],
  controllers: [MensajesController],
  providers: [MensajesService, AvisosService, LimiteDeMensajesGuard],
})
export class MensajesModule {}
