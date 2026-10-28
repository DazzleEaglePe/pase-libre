import { resolve } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';

import { ApiExceptionFilter } from '../shared/filters/api-exception.filter';

export interface OpcionesDeAplicacion {
  webUrl: string;
  proxiesDeConfianza?: readonly string[];
  /** Carpeta de las fotos subidas, que la API sirve en `/media` (en producción, nginx). */
  carpetaMedia?: string;
}

export function configureApplication(
  app: INestApplication,
  { webUrl, proxiesDeConfianza = ['loopback'], carpetaMedia }: OpcionesDeAplicacion,
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
  if (carpetaMedia) {
    // Cada foto tiene un nombre único que no se reutiliza: se puede cachear para siempre.
    (app as NestExpressApplication).useStaticAssets(resolve(carpetaMedia), {
      prefix: '/media/',
      index: false,
      dotfiles: 'deny',
      immutable: true,
      maxAge: '365d',
    });
  }
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
}
