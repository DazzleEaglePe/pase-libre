import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import type { Audiencia } from '@paselibre/contracts';
import type { Request } from 'express';

import { SesionService } from '../../modules/sesion/sesion.service';
import { COOKIE_SESION, type SesionActiva } from '../../modules/sesion/sesion.types';

/**
 * Para las rutas públicas del catálogo: si hay una sesión vigente la deja en
 * `request.sesion`, y si no, sigue como visitante. Nunca rechaza.
 *
 * Quien todavía tiene la clave temporal cuenta como visitante hasta crear la suya:
 * así nadie ve precios con una clave que conoce el equipo.
 */
@Injectable()
export class SesionOpcionalGuard implements CanActivate {
  constructor(@Inject(SesionService) private readonly sesiones: SesionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[COOKIE_SESION];
    if (typeof token !== 'string' || !token) return true;

    const sesion = await this.sesiones.validar(token);
    if (sesion && !sesion.usuario.debeCambiarClave) {
      request.sesion = { sesionId: sesion.sesionId, usuario: sesion.usuario };
    }
    return true;
  }
}

/** Quién mira, según la sesión que dejó el guard. */
export function audienciaDe(sesion: SesionActiva | undefined): Audiencia {
  if (!sesion) return 'visitante';
  return sesion.usuario.rol === 'EQUIPO' ? 'equipo' : 'vendedor';
}

export interface Mirada {
  audiencia: Audiencia;
  /** Tienda de quien mira, para marcar sus propias ofertas. */
  tiendaId: string | null;
  usuarioId: string | null;
}

export const MiradaActual = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Mirada => {
    const { sesion } = context.switchToHttp().getRequest<Request>();
    return {
      audiencia: audienciaDe(sesion),
      tiendaId: sesion?.usuario.tiendaId ?? null,
      usuarioId: sesion?.usuario.id ?? null,
    };
  },
);
