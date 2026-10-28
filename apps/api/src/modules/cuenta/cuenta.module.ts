import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';

@Module({
  imports: [ArchivosModule],
  controllers: [CuentaController],
  providers: [CuentaService],
})
export class CuentaModule {}
