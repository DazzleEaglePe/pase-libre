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
import type { PermisoAsesor, Rol } from '@paselibre/contracts';
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
const PERMISO = 'paselibre:permiso';
export const PERMITIR_EN_SOPORTE = 'paselibre:permitir-en-soporte';
const NO_EN_SOPORTE = 'paselibre:no-en-soporte';

/** La ruta funciona aunque la persona todavía tenga la clave temporal (yo, salir, cambiar clave). */
export const PermitirClaveTemporal = () => SetMetadata(PERMITIR_CLAVE_TEMPORAL, true);

/** Restringe la ruta a ciertos roles, por ejemplo `@Roles('EQUIPO')`. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/**
 * El asesor necesita este permiso del dueño (N12), por ejemplo `@Permiso('PUBLICAR')`. El dueño
 * puede todo y el equipo no tiene tienda: para ellos no cambia nada (siguen sus `@Roles`).
 */
export const Permiso = (permiso: PermisoAsesor) => SetMetadata(PERMISO, permiso);

/**
 * En «Ayudar como la tienda» (N14) solo se puede cambiar lo marcado así. `cambio` es lo que se
 * anota y se le avisa a la tienda («actualizó tu portada»); sin él, no se anota (subir una foto
 * que todavía no se usa, por ejemplo).
 */
export const PermitirEnSoporte = (cambio?: string) =>
  SetMetadata(PERMITIR_EN_SOPORTE, cambio ?? '');

/** Ni siquiera se puede mirar en modo soporte (los chats de la tienda, por ejemplo). */
export const NoEnSoporte = () => SetMetadata(NO_EN_SOPORTE, true);

const enSoporte = () =>
  new ApiHttpException(
    HttpStatus.FORBIDDEN,
    'MODO_SOPORTE',
    'En modo soporte puedes acomodar el perfil y publicar por la tienda, pero no chatear ni cerrar ventas.',
  );

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
    if (sesion.soporte) {
      // Modo soporte (N14): mirar sí; cambiar, solo lo permitido; chatear y vender, nunca.
      const permitida = this.reflector.getAllAndOverride<string | undefined>(
        PERMITIR_EN_SOPORTE,
        objetivos,
      );
      const vedada = this.reflector.getAllAndOverride<boolean>(NO_EN_SOPORTE, objetivos);
      const mira = request.method === 'GET' || request.method === 'HEAD';
      if (vedada || (!mira && permitida === undefined)) throw enSoporte();
    }
    const permiteTemporal = this.reflector.getAllAndOverride<boolean>(
      PERMITIR_CLAVE_TEMPORAL,
      objetivos,
    );
    if (sesion.usuario.debeCambiarClave && !permiteTemporal && !sesion.soporte) {
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

    const permiso = this.reflector.getAllAndOverride<PermisoAsesor | undefined>(PERMISO, objetivos);
    if (permiso && sesion.usuario.rol === 'ASESOR' && !sesion.usuario.permisos.includes(permiso)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'SIN_PERMISO',
        'El dueño de tu tienda no te dio permiso para esto. Pídeselo si lo necesitas.',
      );
    }

    request.sesion = {
      sesionId: sesion.sesionId,
      usuario: sesion.usuario,
      ...(sesion.soporte ? { soporte: sesion.soporte } : {}),
    };
    return true;
  }

  private cookieSegura(): boolean {
    return this.config.get('SESION_COOKIE_SEGURA', { infer: true });
  }
}
