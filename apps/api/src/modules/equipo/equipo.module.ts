import { Module } from '@nestjs/common';

import { RegistroModule } from '../registro/registro.module';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { GaleriasController } from './galerias.controller';
import { GaleriasService } from './galerias.service';

@Module({
  imports: [RegistroModule],
  controllers: [EquipoController, GaleriasController],
  providers: [EquipoService, GaleriasService],
})
export class EquipoModule {}
