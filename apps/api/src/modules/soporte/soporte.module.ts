import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { PanelController } from './panel.controller';
import { PanelService } from './panel.service';
import { ChatEquipoController, ChatsDelEquipoController } from './soporte.controller';
import { SoporteService } from './soporte.service';

import { AyudaService } from './ayuda.service';
import { CatalogoEquipoController } from './catalogo-equipo.controller';
import { CatalogoEquipoService } from './catalogo-equipo.service';
import { DestacadosService } from './destacados.service';
import {
  FichaController,
  PedirAyudaController,
  SalirDeSoporteController,
} from './ficha.controller';
import { FichaService } from './ficha.service';

@Module({
  imports: [MensajesModule, ArchivosModule],
  controllers: [
    ChatEquipoController,
    ChatsDelEquipoController,
    PanelController,
    CatalogoEquipoController,
    FichaController,
    PedirAyudaController,
    SalirDeSoporteController,
  ],
  providers: [
    SoporteService,
    PanelService,
    DestacadosService,
    CatalogoEquipoService,
    FichaService,
    AyudaService,
  ],
})
export class SoporteModule {}
