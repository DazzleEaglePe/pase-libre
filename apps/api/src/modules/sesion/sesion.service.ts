import { createHash, randomBytes } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  PERMISOS_ASESOR,
  type CambiarClaveEntrada,
  type DetallesLimiteDispositivos,
  type IngresarDatos,
  type PermisoAsesor,
  type RespuestaYo,
  type TiendaDeSesion,
} from '@paselibre/contracts';

import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { avisarSeguridad } from '../../shared/aviso-seguridad';
import { dispositivoDe, LUGAR_DE_SESION } from '../../shared/dispositivo';
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
  type SoporteActivo,
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
    logo: tienda.logo,
    precio_visible_defecto: tienda.precioVisibleDefecto,
    moneda_defecto: tienda.monedaDefecto,
  };
}

/** El dueño puede todo; el asesor, lo que le dio el dueño (N12); el equipo no tiene tienda. */
export function permisosDe(usuario: Pick<UsuarioConTienda, 'rol' | 'permisos'>): PermisoAsesor[] {
  if (usuario.rol === 'DUENO') return [...PERMISOS_ASESOR];
  if (usuario.rol === 'ASESOR') return PERMISOS_ASESOR.filter((p) => usuario.permisos.includes(p));
  return [];
}

export function respuestaYo(usuario: UsuarioConTienda, soporte?: SoporteActivo): RespuestaYo {
  const { tienda } = usuario;
  return {
    usuario: {
      id: usuario.id,
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      // En modo soporte el equipo no cambia la contraseña del dueño ni ve su bienvenida.
      debe_cambiar_clave: !soporte && usuario.debeCambiarClave,
      ver_bienvenida: !soporte && Boolean(tienda) && usuario.bienvenidaVistaEn === null,
      tema_oscuro: usuario.temaOscuro,
      version_vista: usuario.versionVista,
      invitar_secciones_cerrado: usuario.invitarSeccionesCerradoEn !== null,
      permisos: permisosDe(usuario),
    },
    tienda: tienda ? tiendaDeSesion(tienda) : null,
    soporte: soporte
      ? {
          tienda_id: soporte.tiendaId,
          tienda: soporte.tienda,
          equipo: soporte.equipo.nombre.split(' ')[0] ?? soporte.equipo.nombre,
          vence_en: soporte.venceEn.toISOString(),
        }
      : null,
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

    // Un asesor que el dueño quitó ya no existe para el ingreso.
    if (usuario.quitadoEn) throw credencialesInvalidas();
    if (usuario.estado === 'SUSPENDIDO' || usuario.tienda?.estado === 'SUSPENDIDA') {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida. Escríbele al equipo de PaseLibre.',
      );
    }
    if (usuario.pausadoEn) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'CUENTA_PAUSADA',
        'Tu tienda pausó tu acceso. Pídele al dueño que lo vuelva a activar.',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiraEn = new Date(
      ahora.getTime() + (entrada.recordar ? DURACION_RECORDAR_MS : DURACION_SESION_MS),
    );
    const { actualizado, cerradas } = await this.prisma.$transaction(async (tx) => {
      const cerradas = await this.hacerLugar(tx, usuario, entrada, ahora);
      const actualizado = await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: 0,
          intentosDesde: null,
          bloqueadoHasta: null,
          ultimoIngresoEn: ahora,
          // Quien entra con una contraseña que no es temporal (el asesor que creó el dueño) ya
          // hizo su primer ingreso.
          ...(!usuario.debeCambiarClave && !usuario.primerIngresoEn
            ? { primerIngresoEn: ahora }
            : {}),
        },
        include: INCLUIR_TIENDA,
      });
      await tx.sesion.create({
        data: {
          usuarioId: usuario.id,
          tokenHash: hashToken(token),
          recordar: entrada.recordar,
          expiraEn,
          agente: solicitud.agente?.slice(0, 300),
          ip: solicitud.ip?.slice(0, 45),
        },
      });
      return { actualizado, cerradas };
    });
    // Desde el primer pedido, el límite «por persona» la cuenta por su cookie.
    recordarSesionValida(hashToken(token));

    if (cerradas.length > 0) {
      for (const cerrada of cerradas) this.tiempoReal.desconectarSesion(cerrada.id);
      const aqui = dispositivoDe(solicitud.agente ?? null);
      await avisarSeguridad(this.prisma, this.tiempoReal, [usuario.id], {
        titulo:
          cerradas.length === 1
            ? `Se cerró tu sesión en ${dispositivoDe(cerradas[0]?.agente ?? null)}`
            : `Se cerraron ${cerradas.length} de tus sesiones`,
        extracto: `Entraste desde ${aqui}. Si no fuiste tú, cambia tu contraseña.`,
        enlace: '/cuenta/configuracion?seccion=seguridad',
      });
    }

    return { token, expiraEn, usuario: actualizado };
  }

  /**
   * Máximo de dispositivos de la cuenta principal (N10). Se llama con la contraseña ya revisada:
   * así un extraño no ve los equipos de la tienda. Si ya está en el límite y no dijo cuál cerrar,
   * responde con la lista; si dijo, las cierra en la misma transacción que abre la nueva. La fila
   * del usuario queda tomada para que dos ingresos a la vez no se pasen del límite.
   */
  private async hacerLugar(
    tx: Prisma.TransactionClient,
    usuario: UsuarioConTienda,
    entrada: IngresarDatos,
    ahora: Date,
  ): Promise<Array<{ id: string; agente: string | null }>> {
    if (usuario.rol !== 'DUENO' || !usuario.tienda) return [];
    await tx.$executeRaw`SELECT 1 FROM usuario WHERE id = ${usuario.id}::uuid FOR UPDATE`;
    const limite = usuario.tienda.limiteDispositivos;
    const abiertas = await tx.sesion.findMany({
      where: { usuarioId: usuario.id, revocadaEn: null, expiraEn: { gt: ahora } },
      orderBy: { usadaEn: 'desc' },
      select: { id: true, agente: true, usadaEn: true },
    });
    if (abiertas.length < limite) return [];

    const elegidas =
      entrada.cerrar === 'todas'
        ? abiertas
        : abiertas.filter((abierta) => entrada.cerrar?.includes(abierta.id));
    if (abiertas.length - elegidas.length >= limite) {
      const detalles: DetallesLimiteDispositivos = {
        limite,
        sesiones: abiertas.map((abierta) => ({
          id: abierta.id,
          dispositivo: dispositivoDe(abierta.agente),
          lugar: LUGAR_DE_SESION,
          ultimo_uso: abierta.usadaEn.toISOString(),
        })),
      };
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'LIMITE_DISPOSITIVOS',
        limite === 1
          ? 'Ya tienes 1 sesión abierta. Ciérrala para entrar aquí.'
          : `Ya tienes ${limite} sesiones abiertas. Elige cuál cerrar para entrar aquí.`,
        detalles as unknown as Record<string, unknown>,
      );
    }
    await tx.sesion.updateMany({
      where: { id: { in: elegidas.map((elegida) => elegida.id) } },
      data: { revocadaEn: ahora },
    });
    return elegidas;
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
    if (
      usuario.estado === 'SUSPENDIDO' ||
      usuario.tienda?.estado === 'SUSPENDIDA' ||
      usuario.pausadoEn ||
      usuario.quitadoEn
    ) {
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

    if (sesion.soporteId && usuario.rol === 'EQUIPO') {
      const soporte = await this.soporteVigente(sesion.id, sesion.soporteId, ahora);
      if (soporte) {
        return {
          sesionId: sesion.id,
          usuario: soporte.dueno,
          soporte: soporte.activo,
          nuevaExpiracion,
        };
      }
    }
    return { sesionId: sesion.id, usuario, nuevaExpiracion };
  }

  /**
   * «Ayudar como la tienda» (N14): mientras no venza, la sesión del equipo ve PaseLibre como el
   * dueño de la tienda. Al vencer (o si la tienda se suspendió) se termina sola.
   */
  private async soporteVigente(
    sesionId: string,
    soporteId: string,
    ahora: Date,
  ): Promise<{ dueno: UsuarioConTienda; activo: SoporteActivo } | null> {
    const soporte = await this.prisma.modoSoporte.findUnique({
      where: { id: soporteId },
      select: {
        id: true,
        tiendaId: true,
        venceEn: true,
        terminadoEn: true,
        equipo: { select: { id: true, nombre: true } },
        tienda: { select: { nombre: true, estado: true } },
      },
    });
    const dueno = soporte
      ? await this.prisma.usuario.findFirst({
          where: { tiendaId: soporte.tiendaId, rol: 'DUENO', estado: 'ACTIVO', quitadoEn: null },
          orderBy: { creadoEn: 'asc' },
          include: INCLUIR_TIENDA,
        })
      : null;
    if (
      !soporte ||
      !dueno ||
      !soporte.equipo ||
      !soporte.venceEn ||
      soporte.terminadoEn ||
      soporte.venceEn <= ahora ||
      soporte.tienda.estado !== 'ACTIVA'
    ) {
      await this.prisma.$transaction([
        this.prisma.sesion.update({ where: { id: sesionId }, data: { soporteId: null } }),
        this.prisma.modoSoporte.updateMany({
          where: { id: soporteId, terminadoEn: null },
          data: { terminadoEn: ahora },
        }),
      ]);
      return null;
    }
    return {
      dueno,
      activo: {
        id: soporte.id,
        equipo: soporte.equipo,
        tiendaId: soporte.tiendaId,
        tienda: soporte.tienda.nombre,
        venceEn: soporte.venceEn,
      },
    };
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

    // La contraseña del asesor la pone el dueño (N12); la temporal del primer ingreso sí la cambia.
    if (usuario.rol === 'ASESOR' && !usuario.debeCambiarClave) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'SIN_PERMISO',
        'Tu contraseña la cambia el dueño de la tienda. Pídesela a él.',
      );
    }

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
