import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApplication } from './bootstrap/configure-application';
import type { Environment } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.useLogger(app.get(Logger));
  configureApplication(
    app,
    config.get('WEB_URL', { infer: true }),
    config.get('PROXIES_DE_CONFIANZA', { infer: true }),
  );

  await app.listen(config.get('PORT', { infer: true }), '0.0.0.0');
}

void bootstrap();
