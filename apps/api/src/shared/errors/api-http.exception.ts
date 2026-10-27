import { HttpException } from '@nestjs/common';
import type { CodigoError } from '@paselibre/contracts';

export class ApiHttpException extends HttpException {
  constructor(
    status: number,
    public readonly code: CodigoError,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
  }
}
