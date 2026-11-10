import { Module } from '@nestjs/common';

import { SesionOpcionalGuard } from '../../shared/guards/sesion-opcional.guard';
import { BusquedaService } from './busqueda.service';
import { CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { InicioService } from './inicio.service';
import { WilsonService } from './wilson.service';

@Module({
  controllers: [CatalogoController],
  providers: [CatalogoService, BusquedaService, InicioService, WilsonService, SesionOpcionalGuard],
  exports: [BusquedaService, CatalogoService],
})
export class CatalogoModule {}
