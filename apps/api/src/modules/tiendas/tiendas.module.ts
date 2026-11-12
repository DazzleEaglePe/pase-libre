import { Module } from '@nestjs/common';

import { CatalogoModule } from '../catalogo/catalogo.module';
import { EnVivoModule } from '../en-vivo/en-vivo.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { NovedadesService } from './novedades.service';
import { ReputacionService } from './reputacion.service';
import { TiendaCompartidaController, TiendasController } from './tiendas.controller';
import { TiendasService } from './tiendas.service';

@Module({
  imports: [MensajesModule, EnVivoModule, CatalogoModule],
  controllers: [TiendaCompartidaController, TiendasController],
  providers: [TiendasService, NovedadesService, ReputacionService],
  exports: [TiendasService, ReputacionService],
})
export class TiendasModule {}
