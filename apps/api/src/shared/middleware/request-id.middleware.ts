import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * `pino-http` ya generó `request.id` (o tomó el `X-Request-Id` entrante). Aquí solo
 * se refleja en la respuesta y en `response.locals`, que usa el filtro de errores.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = typeof request.id === 'string' && request.id ? request.id : randomUUID();

    response.locals.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
