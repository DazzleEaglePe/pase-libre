import { HttpStatus, Injectable, type NestMiddleware } from '@nestjs/common';
import { CABECERA_PASELIBRE } from '@paselibre/contracts';
import type { NextFunction, Request, Response } from 'express';

import { ApiHttpException } from '../errors/api-http.exception';

const METODOS_QUE_CAMBIAN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defensa contra CSRF (docs/05 §9): toda petición que cambia datos debe traer
 * `X-PaseLibre`. Un formulario o un enlace de otro sitio no puede ponerla, y la
 * cookie `SameSite=Lax` cubre el resto.
 */
@Injectable()
export class CabeceraPaseLibreMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    if (METODOS_QUE_CAMBIAN.has(request.method) && !request.headers[CABECERA_PASELIBRE]) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'FALTA_CABECERA_PASELIBRE',
        'La solicitud no viene de la web de PaseLibre.',
      );
    }
    next();
  }
}
