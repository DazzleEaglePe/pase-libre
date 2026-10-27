import { Global, Module } from '@nestjs/common';

import { SesionGuard } from '../../shared/guards/sesion.guard';
import { SesionController, YoController } from './sesion.controller';
import { SesionService } from './sesion.service';

/** Global para que cualquier módulo pueda usar `SesionGuard` sin importarlo. */
@Global()
@Module({
  controllers: [SesionController, YoController],
  providers: [SesionService, SesionGuard],
  exports: [SesionService, SesionGuard],
})
export class SesionModule {}
