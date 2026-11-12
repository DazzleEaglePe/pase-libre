import { Module } from '@nestjs/common';

import { ArchivosModule } from '../archivos/archivos.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { AsesoresController } from './asesores.controller';
import { AsesoresService } from './asesores.service';
import { CambiosDeLugarController } from './cambios-lugar.controller';
import { CuentaController } from './cuenta.controller';
import { CuentaService } from './cuenta.service';
import { LugarService } from './lugar.service';
import { ResumenService } from './resumen.service';

@Module({
  imports: [ArchivosModule, CatalogoModule, MensajesModule],
  controllers: [CuentaController, CambiosDeLugarController, AsesoresController],
  providers: [CuentaService, ResumenService, LugarService, AsesoresService],
})
export class CuentaModule {}
