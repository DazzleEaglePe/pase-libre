import { Module } from '@nestjs/common';

import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';

@Module({
  controllers: [EquipoController],
  providers: [EquipoService],
})
export class EquipoModule {}
