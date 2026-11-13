import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { EnVivoModule } from '../en-vivo/en-vivo.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { NovedadesService } from './novedades.service';
import { PerfilPublicacionesService } from './perfil-publicaciones';
import { PrivacidadController } from './privacidad.controller';
import { PrivacidadService } from './privacidad.service';
import { ReputacionService } from './reputacion.service';
import { TiendaCompartidaController, TiendasController } from './tiendas.controller';
import { TiendasService } from './tiendas.service';

@Module({
  imports: [MensajesModule, EnVivoModule, CatalogoModule, ArchivosModule],
  controllers: [TiendaCompartidaController, TiendasController, PrivacidadController],
  providers: [
    TiendasService,
    NovedadesService,
    ReputacionService,
    PerfilPublicacionesService,
    PrivacidadService,
  ],
  exports: [TiendasService, ReputacionService],
})
export class TiendasModule {}
