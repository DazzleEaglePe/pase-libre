import { Module, RequestMethod, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { validateEnvironment } from './config/env.schema';
import { DatabaseModule } from './infrastructure/database/database.module';
import { ObservabilityLoggerModule } from './infrastructure/observability/logger.module';
import { CuentaModule } from './modules/cuenta/cuenta.module';
import { SaludModule } from './modules/salud/salud.module';
import { SesionModule } from './modules/sesion/sesion.module';
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
    // Límite general por IP; las rutas sensibles ponen el suyo (docs/05 §9).
    ThrottlerModule.forRoot([{ name: 'default', limit: 120, ttl: 60_000 }]),
    DatabaseModule,
    SesionModule,
    CuentaModule,
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
