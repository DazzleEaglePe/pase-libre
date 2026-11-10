import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { OfertasController } from './ofertas.controller';
import { OfertasService } from './ofertas.service';

@Module({
  imports: [ArchivosModule, CatalogoModule, MensajesModule],
  controllers: [OfertasController],
  providers: [OfertasService],
})
export class OfertasModule {}
