import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EVENTOS,
  MAX_ASESORES,
  PERMISOS_ASESOR,
  PERMISOS_INICIALES,
  type Asesor,
  type CambiarAsesorDatos,
  type CrearAsesorDatos,
  type PermisoAsesor,
  type RespuestaAsesores,
  type RespuestaClaveAsesor,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { cifrarClave, esClaveComprometida, generarClaveTemporal } from '../sesion/clave';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { RESPUESTAS_RAPIDAS_INICIALES } from './respuestas-rapidas';

const SELECT_ASESOR = {
  id: true,
  nombre: true,
  usuario: true,
  pausadoEn: true,
  permisos: true,
  ultimoIngresoEn: true,
} satisfies Prisma.UsuarioSelect;

type FilaAsesor = Prisma.UsuarioGetPayload<{ select: typeof SELECT_ASESOR }>;

/** Los asesores que cuentan para «2 de 3»: los de la tienda que el dueño no quitó. */
const DE_LA_TIENDA = (tiendaId: string) =>
  ({ tiendaId, rol: 'ASESOR', quitadoEn: null }) satisfies Prisma.UsuarioWhereInput;

function aAsesor(fila: FilaAsesor): Asesor {
  return {
    id: fila.id,
    nombre: fila.nombre,
    usuario: fila.usuario,
    activo: fila.pausadoEn === null,
    // En el orden de las casillas.
    permisos: PERMISOS_ASESOR.filter((permiso) => fila.permisos.includes(permiso)),
    ultimo_ingreso_en: fila.ultimoIngresoEn?.toISOString() ?? null,
  };
}

const noEncontrado = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Ese asesor no es de tu tienda.');

/**
 * Asesores (N12): hasta 3 por tienda, cada uno con sus permisos. Solo el dueño los agrega, los
 * pausa, les cambia los permisos o la contraseña (las rutas son `@Roles('DUENO')`). La
 * contraseña se ve una sola vez, al crearla o al poner una nueva; en la base queda cifrada y el
 * asesor no la puede cambiar.
 */
@Injectable()
export class AsesoresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  private tiendaDe(sesion: SesionActiva): string {
    const { tiendaId } = sesion.usuario;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    return tiendaId;
  }

  async lista(sesion: SesionActiva): Promise<RespuestaAsesores> {
    const tiendaId = this.tiendaDe(sesion);
    const filas = await this.prisma.usuario.findMany({
      where: DE_LA_TIENDA(tiendaId),
      orderBy: { creadoEn: 'asc' },
      select: SELECT_ASESOR,
    });
    return { asesores: filas.map(aAsesor), maximo: MAX_ASESORES, prefijo: sesion.usuario.usuario };
  }

  async crear(datos: CrearAsesorDatos, sesion: SesionActiva): Promise<RespuestaClaveAsesor> {
    const tiendaId = this.tiendaDe(sesion);
    const usuario = `${sesion.usuario.usuario}.${datos.sufijo}`;
    const clave = datos.clave ?? generarClaveTemporal();
    this.exigirClaveSegura(clave);
    const claveHash = await cifrarClave(clave);
    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        // Que dos «Crear asesor» a la vez no pasen de 3.
        await tx.$executeRaw`SELECT 1 FROM tienda WHERE id = ${tiendaId}::uuid FOR UPDATE`;
        const cuantos = await tx.usuario.count({ where: DE_LA_TIENDA(tiendaId) });
        if (cuantos >= MAX_ASESORES) {
          throw new ApiHttpException(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            `Ya tienes ${MAX_ASESORES} asesores. Quita uno para añadir otro.`,
          );
        }
        const asesor = await tx.usuario.create({
          data: {
            tiendaId,
            rol: 'ASESOR',
            usuario,
            nombre: datos.nombre,
            claveHash,
            // La pone el dueño y el asesor no la cambia (N12): no se le pide crear la suya.
            debeCambiarClave: false,
            permisos: datos.permisos ?? [...PERMISOS_INICIALES],
            respuestasRapidas: {
              create: [...RESPUESTAS_RAPIDAS_INICIALES],
            },
          },
          select: SELECT_ASESOR,
        });
        await tx.auditoria.create({
          data: {
            actorId: sesion.usuario.id,
            accion: 'crear_asesor',
            objeto: 'usuario',
            objetoId: asesor.id,
            datos: { usuario, permisos: asesor.permisos },
          },
        });
        return asesor;
      });
      return this.conClave(creado, clave, 'nuevo');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          `El usuario «${usuario}» ya existe. Prueba con otro.`,
        );
      }
      throw error;
    }
  }

  /**
   * «Guardar permisos» y el interruptor Activo / Pausado. Pausarlo cierra sus sesiones al
   * instante; quitarle un permiso vale desde su siguiente pedido (el guard lo lee de la base).
   */
  async cambiar(id: string, datos: CambiarAsesorDatos, sesion: SesionActiva): Promise<Asesor> {
    const tiendaId = this.tiendaDe(sesion);
    const actual = await this.prisma.usuario.findFirst({
      where: { id, ...DE_LA_TIENDA(tiendaId) },
      select: { id: true },
    });
    if (!actual) throw noEncontrado();
    const ahora = new Date();
    const pausar = datos.activo === false;
    const [asesor] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: {
          ...(datos.permisos ? { permisos: ordenar(datos.permisos) } : {}),
          ...(datos.activo === undefined ? {} : { pausadoEn: datos.activo ? null : ahora }),
        },
        select: SELECT_ASESOR,
      }),
      ...(pausar
        ? [
            this.prisma.sesion.updateMany({
              where: { usuarioId: id, revocadaEn: null },
              data: { revocadaEn: ahora },
            }),
          ]
        : []),
      this.prisma.auditoria.create({
        data: {
          actorId: sesion.usuario.id,
          accion: 'cambiar_asesor',
          objeto: 'usuario',
          objetoId: id,
          datos: {
            ...(datos.permisos ? { permisos: ordenar(datos.permisos) } : {}),
            ...(datos.activo === undefined ? {} : { activo: datos.activo }),
          },
        },
      }),
    ]);
    if (pausar) await this.tiempoReal.desconectarUsuario(id);
    return aAsesor(asesor);
  }

  /** «Contraseña»: una nueva (la que escribe el dueño o una armada). Cierra sus sesiones. */
  async nuevaClave(
    id: string,
    clavePedida: string | undefined,
    sesion: SesionActiva,
  ): Promise<RespuestaClaveAsesor> {
    const tiendaId = this.tiendaDe(sesion);
    const actual = await this.prisma.usuario.findFirst({
      where: { id, ...DE_LA_TIENDA(tiendaId) },
      select: { id: true },
    });
    if (!actual) throw noEncontrado();
    const clave = clavePedida ?? generarClaveTemporal();
    this.exigirClaveSegura(clave);
    const ahora = new Date();
    const [asesor] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: {
          claveHash: await cifrarClave(clave),
          debeCambiarClave: false,
          intentosFallidos: 0,
          intentosDesde: null,
          bloqueadoHasta: null,
        },
        select: SELECT_ASESOR,
      }),
      this.prisma.sesion.updateMany({
        where: { usuarioId: id, revocadaEn: null },
        data: { revocadaEn: ahora },
      }),
      this.prisma.auditoria.create({
        data: {
          actorId: sesion.usuario.id,
          accion: 'clave_asesor',
          objeto: 'usuario',
          objetoId: id,
          datos: {},
        },
      }),
    ]);
    await this.tiempoReal.desconectarUsuario(id);
    return this.conClave(asesor, clave, 'cambio');
  }

  /**
   * Quitar al asesor: lo que estaba a su nombre (publicaciones y chats) pasa al dueño para que
   * nada se pierda, se cierran sus sesiones y ya no entra. Su usuario queda reservado.
   */
  async quitar(id: string, sesion: SesionActiva): Promise<void> {
    const tiendaId = this.tiendaDe(sesion);
    const dueno = sesion.usuario.id;
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findFirst({
        where: { id, ...DE_LA_TIENDA(tiendaId) },
        select: { id: true },
      });
      if (!actual) throw noEncontrado();
      await tx.oferta.updateMany({
        where: { responsableId: id, estado: { not: 'ELIMINADA' } },
        data: { responsableId: dueno },
      });
      const comoVendedor = await tx.conversacion.findMany({
        where: { vendedorId: id },
        select: { id: true },
      });
      await tx.conversacion.updateMany({ where: { vendedorId: id }, data: { vendedorId: dueno } });
      const comoComprador = await tx.conversacion.findMany({
        where: { compradorId: id },
        select: { id: true, ofertaId: true },
      });
      const yaTiene = new Set(
        (
          await tx.conversacion.findMany({
            where: {
              compradorId: dueno,
              ofertaId: { in: comoComprador.map((c) => c.ofertaId) },
            },
            select: { ofertaId: true },
          })
        ).map((c) => c.ofertaId),
      );
      const pasan = comoComprador.filter((c) => !yaTiene.has(c.ofertaId)).map((c) => c.id);
      await tx.conversacion.updateMany({
        where: { id: { in: pasan } },
        data: { compradorId: dueno },
      });
      const movidas = [...comoVendedor.map((c) => c.id), ...pasan];
      // Si el dueño ya participaba del hilo, se queda con su propio estado de lectura.
      const yaParticipa = new Set(
        (
          await tx.participacion.findMany({
            where: { conversacionId: { in: movidas }, usuarioId: dueno },
            select: { conversacionId: true },
          })
        ).map((p) => p.conversacionId),
      );
      await tx.participacion.updateMany({
        where: {
          conversacionId: { in: movidas.filter((c) => !yaParticipa.has(c)) },
          usuarioId: id,
        },
        data: { usuarioId: dueno },
      });
      await tx.aviso.deleteMany({ where: { usuarioId: id } });
      await tx.usuario.update({
        where: { id },
        data: { quitadoEn: ahora, pausadoEn: ahora, estado: 'SUSPENDIDO' },
      });
      await tx.sesion.updateMany({
        where: { usuarioId: id, revocadaEn: null },
        data: { revocadaEn: ahora },
      });
      await tx.auditoria.create({
        data: {
          actorId: dueno,
          accion: 'quitar_asesor',
          objeto: 'usuario',
          objetoId: id,
          datos: { conversaciones: movidas.length },
        },
      });
    });
    await this.tiempoReal.desconectarUsuario(id);
    this.tiempoReal.emitirAUsuario(dueno, EVENTOS.contadores);
  }

  private exigirClaveSegura(clave: string): void {
    if (esClaveComprometida(clave)) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Esa contraseña es muy fácil de adivinar. Elige otra.',
      );
    }
  }

  private conClave(
    asesor: FilaAsesor,
    clave: string,
    motivo: 'nuevo' | 'cambio',
  ): RespuestaClaveAsesor {
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    const mensaje = [
      motivo === 'nuevo'
        ? `Hola ${asesor.nombre}, ya eres asesor de la tienda en PaseLibre.`
        : `Hola ${asesor.nombre}, te puse una contraseña nueva para PaseLibre.`,
      `Entra en ${web}/ingresar`,
      `Usuario: ${asesor.usuario}`,
      `Contraseña: ${clave}`,
    ].join('\n');
    return { asesor: aAsesor(asesor), clave, mensaje };
  }
}

function ordenar(permisos: PermisoAsesor[]): PermisoAsesor[] {
  return PERMISOS_ASESOR.filter((permiso) => permisos.includes(permiso));
}
