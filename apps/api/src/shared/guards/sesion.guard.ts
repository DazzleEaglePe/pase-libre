import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Rol } from '@paselibre/contracts';
import type { CookieOptions, Request, Response } from 'express';

import type { Environment } from '../../config/env.schema';
import { SesionService } from '../../modules/sesion/sesion.service';
import { COOKIE_SESION, type SesionActiva } from '../../modules/sesion/sesion.types';
import { ApiHttpException } from '../errors/api-http.exception';

declare module 'express' {
  interface Request {
    sesion?: SesionActiva;
  }
}

const PERMITIR_CLAVE_TEMPORAL = 'paselibre:permitir-clave-temporal';
const ROLES = 'paselibre:roles';

/** La ruta funciona aunque la persona todavía tenga la clave temporal (yo, salir, cambiar clave). */
export const PermitirClaveTemporal = () => SetMetadata(PERMITIR_CLAVE_TEMPORAL, true);

/** Restringe la ruta a ciertos roles, por ejemplo `@Roles('EQUIPO')`. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

export const SesionActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SesionActiva => {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.sesion) throw new Error('SesionActual se usó en una ruta sin SesionGuard.');
    return request.sesion;
  },
);

export function opcionesCookieSesion(segura: boolean, expira?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: segura,
    sameSite: 'lax',
    path: '/',
    ...(expira ? { expires: expira } : {}),
  };
}

/**
 * Exige una sesión vigente (cookie `pl_sesion`). Si la persona aún tiene la clave
 * temporal, solo deja pasar a las rutas marcadas con `@PermitirClaveTemporal()`.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  constructor(
    @Inject(SesionService) private readonly sesiones: SesionService,
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const token: unknown = request.cookies?.[COOKIE_SESION];

    const sesion = typeof token === 'string' && token ? await this.sesiones.validar(token) : null;
    if (!sesion) {
      if (token) response.clearCookie(COOKIE_SESION, opcionesCookieSesion(this.cookieSegura()));
      throw new ApiHttpException(
        HttpStatus.UNAUTHORIZED,
        'SIN_SESION',
        'Inicia sesión para continuar.',
      );
    }

    if (sesion.nuevaExpiracion) {
      response.cookie(
        COOKIE_SESION,
        token as string,
        opcionesCookieSesion(this.cookieSegura(), sesion.nuevaExpiracion),
      );
    }

    const objetivos = [context.getHandler(), context.getClass()];
    const permiteTemporal = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_CLAVE_TEMPORAL,
      objetivos,
    );
    if (sesion.usuario.debeCambiarClave && !permiteTemporal) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'DEBE_CAMBIAR_CLAVE',
        'Antes de seguir, crea tu propia contraseña.',
      );
    }

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, objetivos);
    if (roles && !roles.includes(sesion.usuario.rol)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'No tienes permiso para hacer esto.',
      );
    }

    request.sesion = { sesionId: sesion.sesionId, usuario: sesion.usuario };
    return true;
  }

  private cookieSegura(): boolean {
    return this.config.get('SESION_COOKIE_SEGURA', { infer: true });
  }
}
