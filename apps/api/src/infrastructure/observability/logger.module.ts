import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { Module, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import type { Environment } from '../../config/env.schema';
import { REQUEST_ID_HEADER } from '../../shared/middleware/request-id.middleware';

/** Registros JSON con id de correlación (RNF-38). Nunca se registran cookies ni claves. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environment, true>) => {
        const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

        return {
          // Comodín con nombre: con el prefijo `v1`, el `*` por defecto de nestjs-pino
          // genera la advertencia de rutas heredadas de path-to-regexp.
          forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            genReqId: (req: IncomingMessage) => {
              const incoming = req.headers[REQUEST_ID_HEADER];
              const value = Array.isArray(incoming) ? incoming[0] : incoming;
              return value?.trim() || randomUUID();
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              censor: '[oculto]',
            },
            serializers: {
              req: (req: { id: string; method: string; url?: string }) => ({
                id: req.id,
                method: req.method,
                // Sin la consulta: las búsquedas no van al registro.
                url: req.url?.split('?', 1)[0],
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },
            ...(isProduction ? {} : { transport: { target: 'pino-pretty' } }),
          },
        };
      },
    }),
  ],
})
export class ObservabilityLoggerModule {}
