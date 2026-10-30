import { type CanActivate, HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { INTERRUPTOR_EN_VIVO, type InterruptorEnVivo } from './interruptor';

/**
 * Con En vivo apagado (`EN_VIVO`, D-53), sus rutas responden 404 como si no existieran, y la
 * web no muestra nada.
 */
@Injectable()
export class EnVivoActivoGuard implements CanActivate {
  constructor(@Inject(INTERRUPTOR_EN_VIVO) private readonly interruptor: InterruptorEnVivo) {}

  canActivate(): boolean {
    if (this.interruptor.activo) return true;
    throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta página no existe.');
  }
}
