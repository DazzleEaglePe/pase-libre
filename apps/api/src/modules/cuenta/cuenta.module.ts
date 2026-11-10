import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';
import { ResumenService } from './resumen.service';

@Module({
  imports: [ArchivosModule, CatalogoModule],
  controllers: [CuentaController],
  providers: [CuentaService, ResumenService],
})
export class CuentaModule {}
