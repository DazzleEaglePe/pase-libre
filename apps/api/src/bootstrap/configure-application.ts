import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';

import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';

export function configureApplication(
  app: INestApplication,
  webUrl: string,
  proxiesDeConfianza: readonly string[] = ['loopback'],
): void {
  // `request.ip` sale de `X-Forwarded-For` solo a través del nginx propio:
  // sin esto, cualquiera podría saltarse los límites por IP inventando la cabecera.
  const expressApp: Express = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', [...proxiesDeConfianza]);

  app.setGlobalPrefix('v1');
  app.use(cookieParser());
  app.use(helmet());
  // En producción la web y la API comparten dominio (nginx); CORS solo cubre el desarrollo.
  app.enableCors({ credentials: true, origin: [webUrl] });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
