import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config/env.schema';
import { INTERRUPTOR_REGISTRO, type InterruptorRegistro } from './interruptor';
import { PROVEEDOR_RUC, PROVEEDOR_SMS, RucSimulado, SmsSimulado } from './proveedores';
import { RegistroController, SolicitudesEquipoController } from './registro.controller';
import { RegistroService } from './registro.service';

@Module({
  controllers: [RegistroController, SolicitudesEquipoController],
  providers: [
    RegistroService,
    {
      provide: INTERRUPTOR_REGISTRO,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>): InterruptorRegistro => ({
        activo: config.get('REGISTRO_PROPIO', { infer: true }),
      }),
    },
    // Cuando haya un proveedor de SMS y uno de consulta a SUNAT de verdad, se cambian aquí.
    { provide: PROVEEDOR_SMS, useClass: SmsSimulado },
    { provide: PROVEEDOR_RUC, useClass: RucSimulado },
  ],
})
export class RegistroModule {}
