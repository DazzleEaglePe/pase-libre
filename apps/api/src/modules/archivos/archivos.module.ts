import { Module } from '@nestjs/common';

import { ArchivosController, LimiteDeSubidasGuard } from './archivos.controller';
import { ArchivosService } from './archivos.service';
import { MiniaturasService } from './miniaturas.service';

@Module({
  controllers: [ArchivosController],
  providers: [ArchivosService, LimiteDeSubidasGuard, MiniaturasService],
  exports: [ArchivosService, MiniaturasService],
})
export class ArchivosModule {}
