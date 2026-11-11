import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { ChatEquipoController, ChatsDelEquipoController } from './soporte.controller';
import { SoporteService } from './soporte.service';

import { CatalogoEquipoController } from './catalogo-equipo.controller';
import { CatalogoEquipoService } from './catalogo-equipo.service';
import { DestacadosService } from './destacados.service';

@Module({
  imports: [MensajesModule, ArchivosModule],
  controllers: [
    ChatEquipoController,
    ChatsDelEquipoController,
    PanelController,
    CatalogoEquipoController,
  ],
  providers: [SoporteService, PanelService, DestacadosService, CatalogoEquipoService],
})
export class SoporteModule {}
