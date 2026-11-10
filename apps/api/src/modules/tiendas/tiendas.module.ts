import { Module } from '@nestjs/common';

import { MensajesModule } from '../mensajes/mensajes.module';
import { TiendasController } from './tiendas.controller';
import { TiendasService } from './tiendas.service';

@Module({
  imports: [MensajesModule],
  controllers: [TiendasController],
  providers: [TiendasService],
  exports: [TiendasService],
})
export class TiendasModule {}
