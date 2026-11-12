import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { AsesoresController } from './asesores.controller';
import { AsesoresService } from './asesores.service';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';
import { ResumenService } from './resumen.service';

@Module({
  imports: [ArchivosModule, CatalogoModule],
  controllers: [CuentaController, AsesoresController],
  providers: [CuentaService, ResumenService, AsesoresService],
})
export class CuentaModule {}
