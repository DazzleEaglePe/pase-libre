import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnvironment } from './config/env.schema';
import { LIMITES } from './shared/limites';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ObservabilityLoggerModule } from './infrastructure/observability/logger.module';
import { ArchivosModule } from './modules/archivos/archivos.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';
import { CuentaModule } from './modules/cuenta/cuenta.module';
import { EnVivoModule } from './modules/en-vivo/en-vivo.module';
import { InterruptorEnVivoModule } from './modules/en-vivo/interruptor';
import { EquipoModule } from './modules/equipo/equipo.module';
import { MensajesModule } from './modules/mensajes/mensajes.module';
import { OfertasModule } from './modules/ofertas/ofertas.module';
import { SaludModule } from './modules/salud/salud.module';
import { SesionModule } from './modules/sesion/sesion.module';
import { TiempoRealModule } from './modules/tiempo-real/tiempo-real.module';
import { CabeceraPaseLibreMiddleware } from './shared/middleware/cabecera-paselibre.middleware';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: false,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ObservabilityLoggerModule,
    // Por IP y por persona; las rutas sensibles ajustan el suyo (shared/limites.ts).
    ThrottlerModule.forRoot(LIMITES),
    DatabaseModule,
    InterruptorEnVivoModule,
    TiempoRealModule,
    SesionModule,
    CuentaModule,
    CatalogoModule,
    ArchivosModule,
    OfertasModule,
    MensajesModule,
    EnVivoModule,
    EquipoModule,
    SaludModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, CabeceraPaseLibreMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
