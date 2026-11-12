import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { SesionGuard } from '../../shared/guards/sesion.guard';
import { RegistroSoporteInterceptor } from '../../shared/interceptors/registro-soporte.interceptor';
import { SesionController, YoController } from './sesion.controller';
import { SesionService } from './sesion.service';

/** Global para que cualquier módulo pueda usar `SesionGuard` sin importarlo. */
@Global()
@Module({
  controllers: [SesionController, YoController],
  providers: [
    SesionService,
    SesionGuard,
    // Lo que el equipo cambia en «Ayudar como la tienda» queda anotado y avisado (N14).
    { provide: APP_INTERCEPTOR, useClass: RegistroSoporteInterceptor },
  ],
  exports: [SesionService, SesionGuard],
})
export class SesionModule {}
