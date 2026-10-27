import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * A-09: lo que ve un visitante no tiene datos privados y se puede cachear un minuto;
 * lo que ve alguien con sesión nunca se guarda en una caché compartida.
 * `Vary: Cookie` evita que un proxy sirva a un visitante la versión con precios.
 */
@Injectable()
export class CachePorAudienciaInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Se suma a `Vary: Origin` de CORS en vez de reemplazarlo.
    response.vary('Cookie');
    response.setHeader(
      'Cache-Control',
      request.sesion ? 'private, no-store' : 'public, max-age=60, stale-while-revalidate=60',
    );
    return next.handle();
  }
}
