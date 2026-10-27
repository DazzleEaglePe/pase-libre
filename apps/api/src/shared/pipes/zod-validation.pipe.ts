import { HttpStatus, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

import { ApiHttpException } from '../errors/api-http.exception';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // El primer mensaje ya está escrito para mostrarse tal cual; el resto va en detalles.
      const [primero] = result.error.issues;
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        primero?.message ?? 'Revisa los datos enviados.',
        {
          campos: result.error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            mensaje: issue.message,
          })),
        },
      );
    }

    return result.data;
  }
}
