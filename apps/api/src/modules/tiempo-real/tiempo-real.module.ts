import { Global, Module } from '@nestjs/common';

import { TiempoRealGateway } from './tiempo-real.gateway';
import { TiempoRealService } from './tiempo-real.service';

/** Global: la sesión, el equipo y los mensajes emiten eventos o cortan sockets. */
@Global()
@Module({
  providers: [TiempoRealService, TiempoRealGateway],
  exports: [TiempoRealService],
})
export class TiempoRealModule {}
