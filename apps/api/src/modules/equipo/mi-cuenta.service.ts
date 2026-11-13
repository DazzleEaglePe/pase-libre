import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  VERSION,
  type ActualizarMiCuentaEquipoDatos,
  type MiCuentaEquipo,
  type RespuestaVersionVista,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';

const SELECT_MI_CUENTA = {
  nombre: true,
  usuario: true,
  correo: true,
} satisfies Prisma.UsuarioSelect;

/**
 * «Mi cuenta» del Equipo (doc 19, punto 7) y la versión vista (punto 8). Cada persona del Equipo
 * cambia solo lo suyo; el rol no se toca aquí.
 */
@Injectable()
export class MiCuentaService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  miCuenta(usuarioId: string): Promise<MiCuentaEquipo> {
    return this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: SELECT_MI_CUENTA,
    });
  }

  /** Nombre, usuario para ingresar y correo. El usuario y el correo no se repiten. */
  async actualizar(
    usuarioId: string,
    cambios: ActualizarMiCuentaEquipoDatos,
  ): Promise<MiCuentaEquipo> {
    try {
      return await this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { nombre: cambios.nombre, usuario: cambios.usuario, correo: cambios.correo },
        select: SELECT_MI_CUENTA,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const campos = String(error.meta?.target ?? '');
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          campos.includes('correo')
            ? 'Ese correo ya lo usa otra cuenta.'
            : 'Ese usuario ya lo usa otra cuenta.',
        );
      }
      throw error;
    }
  }

  /** Abrió Equipo › Versiones: se apaga el puntito de la pastilla hasta la próxima versión. */
  async versionVista(usuarioId: string): Promise<RespuestaVersionVista> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { versionVista: VERSION },
    });
    return { version_vista: VERSION };
  }
}
