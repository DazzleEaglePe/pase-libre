import { Module } from '@nestjs/common';

import { MensajesModule } from '../mensajes/mensajes.module';
import { HistorialController } from './historial.controller';
import { HistorialService } from './historial.service';

@Module({
  imports: [MensajesModule],
  controllers: [HistorialController],
  providers: [HistorialService],
})
export class HistorialModule {}
