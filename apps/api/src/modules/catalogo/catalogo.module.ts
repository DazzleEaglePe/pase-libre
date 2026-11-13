import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { SesionOpcionalGuard } from '../../shared/guards/sesion-opcional.guard';
import { BusquedaService } from './busqueda.service';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { DirectorioController } from './directorio.controller';
import { DirectorioService } from './directorio.service';
import { InicioController } from './inicio.controller';
import { InicioService } from './inicio.service';
import { WilsonService } from './wilson.service';

@Module({
  imports: [ArchivosModule],
  controllers: [CatalogoController, DirectorioController, InicioController],
  providers: [
    CatalogoService,
    BusquedaService,
    InicioService,
    WilsonService,
    DirectorioService,
    SesionOpcionalGuard,
  ],
  exports: [BusquedaService, CatalogoService],
})
export class CatalogoModule {}
