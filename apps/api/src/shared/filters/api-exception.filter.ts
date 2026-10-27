import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { CodigoError, RespuestaError } from '@paselibre/contracts';
import type { Response } from 'express';

import { ApiHttpException } from '../errors/api-http.exception';

const statusToCode: Partial<Record<number, CodigoError>> = {
  [HttpStatus.BAD_REQUEST]: 'DATOS_INVALIDOS',
  [HttpStatus.UNAUTHORIZED]: 'SIN_SESION',
  [HttpStatus.FORBIDDEN]: 'PROHIBIDO',
  [HttpStatus.NOT_FOUND]: 'NO_ENCONTRADO',
  [HttpStatus.CONFLICT]: 'CONFLICTO',
  [HttpStatus.TOO_MANY_REQUESTS]: 'DEMASIADAS_SOLICITUDES',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICIO_NO_DISPONIBLE',
};

const statusToMessage: Partial<Record<number, string>> = {
  [HttpStatus.UNAUTHORIZED]: 'Inicia sesión para continuar.',
  [HttpStatus.FORBIDDEN]: 'No tienes permiso para hacer esto.',
  [HttpStatus.NOT_FOUND]: 'No encontramos lo que buscabas.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Demasiados intentos seguidos. Espera un momento y vuelve a probar.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'El servicio no está disponible por ahora.',
};

/** Todas las respuestas de error con la forma de docs/05 §6.2, en español. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = String(response.locals.requestId ?? 'desconocido');

    // Para los 5xx el cliente recibe un mensaje genérico; el detalle queda solo en el registro.
    if (status >= 500) {
      const detail = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${requestId}] Error no controlado: ${detail}`);
    }
    const codigo =
      exception instanceof ApiHttpException
        ? exception.code
        : (statusToCode[status] ?? 'ERROR_INTERNO');
    const body: RespuestaError = {
      error: {
        codigo,
        mensaje: this.resolveMessage(exception, status),
        ...(exception instanceof ApiHttpException && exception.details
          ? { detalles: exception.details }
          : {}),
        id_solicitud: requestId,
      },
    };

    response.status(status).json(body);
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (status >= 500) return 'Algo falló de nuestro lado. Vuelve a intentarlo.';
    if (exception instanceof ApiHttpException) return exception.message;
    if (status !== HttpStatus.BAD_REQUEST && statusToMessage[status])
      return statusToMessage[status];
    if (!(exception instanceof HttpException)) return 'No pudimos procesar la solicitud.';

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') return exceptionResponse;

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const { message } = exceptionResponse as { message: string | string[] };
      return Array.isArray(message) ? message.join(' ') : message;
    }

    return exception.message;
  }
}
