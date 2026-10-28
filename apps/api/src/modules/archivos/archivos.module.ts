import { Module } from '@nestjs/common';

import { ArchivosController, LimiteDeSubidasGuard } from './archivos.controller';
import { ArchivosService } from './archivos.service';

@Module({
  controllers: [ArchivosController],
  providers: [ArchivosService, LimiteDeSubidasGuard],
  exports: [ArchivosService],
})
export class ArchivosModule {}
