import { Module } from '@nestjs/common';

import { RegistroModule } from '../registro/registro.module';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';
import { GaleriasController } from './galerias.controller';
import { GaleriasService } from './galerias.service';
import { MiCuentaController } from './mi-cuenta.controller';
import { MiCuentaService } from './mi-cuenta.service';

@Module({
  imports: [RegistroModule],
  controllers: [EquipoController, GaleriasController, MiCuentaController],
  providers: [EquipoService, GaleriasService, MiCuentaService],
})
export class EquipoModule {}
