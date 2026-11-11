import { Module } from '@nestjs/common';

import { EnVivoModule } from '../en-vivo/en-vivo.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { NovedadesService } from './novedades.service';
import { TiendaCompartidaController, TiendasController } from './tiendas.controller';
import { TiendasService } from './tiendas.service';

@Module({
  imports: [MensajesModule, EnVivoModule],
  controllers: [TiendaCompartidaController, TiendasController],
  providers: [TiendasService, NovedadesService],
  exports: [TiendasService],
})
export class TiendasModule {}
