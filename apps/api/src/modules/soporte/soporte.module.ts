import { Module } from '@nestjs/common';

import { MensajesModule } from '../mensajes/mensajes.module';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { ChatEquipoController, ChatsDelEquipoController } from './soporte.controller';
import { SoporteService } from './soporte.service';

@Module({
  imports: [MensajesModule],
  controllers: [ChatEquipoController, ChatsDelEquipoController, PanelController],
  providers: [SoporteService, PanelService],
})
export class SoporteModule {}
