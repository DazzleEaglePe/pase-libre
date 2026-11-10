import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  CambiarClaveEntrada,
  IngresarDatos,
  RespuestaYo,
  TiendaDeSesion,
} from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { olvidarSesion, recordarSesionValida } from '../../shared/sesiones-validas';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import {
  cifrarClave,
  esClaveComprometida,
  hashParaUsuarioInexistente,
  verificarClave,
} from './clave';
import {
  DURACION_RECORDAR_MS,
  DURACION_SESION_MS,
  MAX_INTENTOS_FALLIDOS,
  VENTANA_INTENTOS_MS,
  type DatosDeSolicitud,
  type SesionActiva,
  type UsuarioConTienda,
} from './sesion.types';

const INCLUIR_TIENDA = { tienda: { include: { galeria: true } } } as const;

/** Una hora sin usarse basta para registrar el uso; evita escribir en cada petición. */
const REFRESCO_USO_MS = 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tiendaDeSesion(tienda: NonNullable<UsuarioConTienda['tienda']>): TiendaDeSesion {
  return {
    id: tienda.id,
    nombre: tienda.nombre,
    tipo: tienda.tipo,
    galeria: tienda.galeria?.nombre ?? null,
    stand: tienda.stand,
    precio_visible_defecto: tienda.precioVisibleDefecto,
    moneda_defecto: tienda.monedaDefecto,
  };
}

export function respuestaYo(usuario: UsuarioConTienda): RespuestaYo {
  const { tienda } = usuario;
  return {
    usuario: {
      id: usuario.id,
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      debe_cambiar_clave: usuario.debeCambiarClave,
      ver_bienvenida: Boolean(tienda) && usuario.bienvenidaVistaEn === null,
    },
    tienda: tienda ? tiendaDeSesion(tienda) : null,
  };
}

const credencialesInvalidas = () =>
  new ApiHttpException(
    HttpStatus.UNAUTHORIZED,
    'CREDENCIALES_INVALIDAS',
    'El usuario o la contraseña no coinciden. Después de 5 intentos hay que esperar 15 minutos.',
  );

@Injectable()
export class SesionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  /**
   * Ingresar con usuario o correo (RF-02). Después de 5 intentos fallidos en
   * 15 minutos la cuenta espera 15 minutos (docs/05 §9).
   */
  async ingresar(
    entrada: IngresarDatos,
    solicitud: DatosDeSolicitud,
  ): Promise<{ token: string; expiraEn: Date; usuario: UsuarioConTienda }> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { OR: [{ usuario: entrada.usuario }, { correo: entrada.usuario }] },
      include: INCLUIR_TIENDA,
    });

    if (!usuario) {
      await verificarClave(await hashParaUsuarioInexistente(), entrada.clave);
      throw credencialesInvalidas();
    }

    const ahora = new Date();
    const claveCorrecta = await verificarClave(usuario.claveHash, entrada.clave);
    // Con la cuenta en espera se responde igual que con la clave mal (y tardando lo mismo): un
    // aviso distinto diría qué usuarios (o qué celulares) existen.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora) {
      throw credencialesInvalidas();
    }

    if (!claveCorrecta) {
      await this.registrarIntentoFallido(usuario, ahora);
      throw credencialesInvalidas();
    }

    if (usuario.estado === 'SUSPENDIDO' || usuario.tienda?.estado === 'SUSPENDIDA') {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida. Escríbele al equipo de PaseLibre.',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiraEn = new Date(
      ahora.getTime() + (entrada.recordar ? DURACION_RECORDAR_MS : DURACION_SESION_MS),
    );
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: 0,
          intentosDesde: null,
          bloqueadoHasta: null,
          ultimoIngresoEn: ahora,
        },
        include: INCLUIR_TIENDA,
      }),
      this.prisma.sesion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: hashToken(token),
          recordar: entrada.recordar,
          expiraEn,
          agente: solicitud.agente?.slice(0, 300),
          ip: solicitud.ip?.slice(0, 45),
        },
      }),
    ]);
    // Desde el primer pedido, el límite «por persona» la cuenta por su cookie.
    recordarSesionValida(hashToken(token));

    return { token, expiraEn, usuario: actualizado };
  }

  /** Devuelve la sesión vigente del token, o nada. Renueva las de «Mantener la sesión». */
  async validar(token: string): Promise<(SesionActiva & { nuevaExpiracion?: Date }) | null> {
    const sesion = await this.prisma.sesion.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: { include: INCLUIR_TIENDA } },
    });
    const ahora = new Date();
    if (!sesion || sesion.revocadaEn || sesion.expiraEn <= ahora) {
      olvidarSesion(hashToken(token));
      return null;
    }

    const { usuario } = sesion;
    if (usuario.estado === 'SUSPENDIDO' || usuario.tienda?.estado === 'SUSPENDIDA') {
      await this.prisma.sesion.update({ where: { id: sesion.id }, data: { revocadaEn: ahora } });
      return null;
    }

    recordarSesionValida(sesion.tokenHash);
    let nuevaExpiracion: Date | undefined;
    if (ahora.getTime() - sesion.usadaEn.getTime() > REFRESCO_USO_MS) {
      nuevaExpiracion = sesion.recordar
        ? new Date(ahora.getTime() + DURACION_RECORDAR_MS)
        : undefined;
      await this.prisma.sesion.update({
        where: { id: sesion.id },
        data: { usadaEn: ahora, ...(nuevaExpiracion ? { expiraEn: nuevaExpiracion } : {}) },
      });
    }

    return { sesionId: sesion.id, usuario, nuevaExpiracion };
  }

  async salir(sesionId: string): Promise<void> {
    await this.prisma.sesion.updateMany({
      where: { id: sesionId, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    this.tiempoReal.desconectarSesion(sesionId);
  }

  /**
   * Primer ingreso o cambio de contraseña (RF-50, RF-60). Con la clave temporal no
   * se pide la actual. Al cambiarla se cierran las demás sesiones.
   */
  async cambiarClave(
    sesion: SesionActiva,
    entrada: CambiarClaveEntrada,
  ): Promise<UsuarioConTienda> {
    const { usuario } = sesion;

    if (!usuario.debeCambiarClave) {
      if (
        !entrada.clave_actual ||
        !(await verificarClave(usuario.claveHash, entrada.clave_actual))
      ) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'CLAVE_ACTUAL_INCORRECTA',
          'La contraseña actual no coincide.',
        );
      }
    }
    if (await verificarClave(usuario.claveHash, entrada.clave_nueva)) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'La contraseña nueva tiene que ser distinta de la anterior.',
      );
    }
    if (esClaveComprometida(entrada.clave_nueva)) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Esa contraseña es muy fácil de adivinar. Elige otra.',
      );
    }

    const ahora = new Date();
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          claveHash: await cifrarClave(entrada.clave_nueva),
          debeCambiarClave: false,
          primerIngresoEn: usuario.primerIngresoEn ?? ahora,
        },
        include: INCLUIR_TIENDA,
      }),
      this.prisma.sesion.updateMany({
        where: { usuarioId: usuario.id, revocadaEn: null, NOT: { id: sesion.sesionId } },
        data: { revocadaEn: ahora },
      }),
    ]);
    await this.tiempoReal.desconectarUsuario(usuario.id, sesion.sesionId);
    return actualizado;
  }

  /**
   * Un intento fallido, contado en una sola sentencia: con 60 intentos a la vez, cada uno leería
   * «0 fallidos» y escribiría 1 si se contara en la aplicación. Postgres evalúa cada SET con la
   * fila de antes, por eso la cuenta nueva se repite en `bloqueado_hasta`. Un intento nunca quita
   * una espera ya puesta.
   */
  private async registrarIntentoFallido(usuario: UsuarioConTienda, ahora: Date): Promise<void> {
    const desde = new Date(ahora.getTime() - VENTANA_INTENTOS_MS);
    const hasta = new Date(ahora.getTime() + VENTANA_INTENTOS_MS);
    await this.prisma.$executeRaw`
      UPDATE usuario SET
        intentos_fallidos = CASE WHEN intentos_desde IS NULL OR intentos_desde < ${desde}
                                 THEN 1 ELSE intentos_fallidos + 1 END,
        intentos_desde = CASE WHEN intentos_desde IS NULL OR intentos_desde < ${desde}
                              THEN ${ahora} ELSE intentos_desde END,
        bloqueado_hasta = CASE WHEN (CASE WHEN intentos_desde IS NULL OR intentos_desde < ${desde}
                                          THEN 1 ELSE intentos_fallidos + 1 END) >= ${MAX_INTENTOS_FALLIDOS}
                               THEN ${hasta} ELSE bloqueado_hasta END
      WHERE id = ${usuario.id}::uuid`;
  }
}
