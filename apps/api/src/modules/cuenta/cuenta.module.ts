import { Module } from '@nestjs/common';

import { CuentaController } from './cuenta.controller';

@Module({
  controllers: [CuentaController],
})
export class CuentaModule {}
