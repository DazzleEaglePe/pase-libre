import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/env.schema';

/** El interruptor de En vivo (`EN_VIVO`, D-53). Las pruebas lo fijan sin tocar el entorno. */
export const INTERRUPTOR_EN_VIVO = Symbol('INTERRUPTOR_EN_VIVO');

export interface InterruptorEnVivo {
  activo: boolean;
}

@Global()
@Module({
  providers: [
    {
      provide: INTERRUPTOR_EN_VIVO,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>): InterruptorEnVivo => ({
        activo: config.get('EN_VIVO', { infer: true }),
      }),
    },
  ],
  exports: [INTERRUPTOR_EN_VIVO],
})
export class InterruptorEnVivoModule {}
