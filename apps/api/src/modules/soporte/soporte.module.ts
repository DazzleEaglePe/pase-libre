import { Module } from '@nestjs/common';

import { MensajesModule } from '../mensajes/mensajes.module';
import { ChatEquipoController, ChatsDelEquipoController } from './soporte.controller';
import { SoporteService } from './soporte.service';

@Module({
  imports: [MensajesModule],
  controllers: [ChatEquipoController, ChatsDelEquipoController],
  providers: [SoporteService],
})
export class SoporteModule {}
