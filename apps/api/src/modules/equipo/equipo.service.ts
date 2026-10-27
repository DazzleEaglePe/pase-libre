import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CrearCuentaDatos,
  CuentaEquipo,
  EstadoCuenta,
  FiltroCuentas,
  RespuestaAcceso,
  RespuestaCuentas,
  TiendaParaEquipo,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { RESPUESTAS_RAPIDAS_INICIALES } from '../cuenta/respuestas-rapidas';
import { cifrarClave, generarClaveTemporal } from '../sesion/clave';

const INCLUIR_TIENDA = { tienda: { include: { galeria: true } } } as const;
type UsuarioConTienda = Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_TIENDA }>;

/** Las cuentas del equipo no se administran desde el panel: se crean con `pnpm cuenta:equipo`. */
const SOLO_VENDEDORES = { rol: { not: 'EQUIPO' } } satisfies Prisma.UsuarioWhereInput;

export function estadoDeCuenta(usuario: {
  estado: string;
  primerIngresoEn: Date | null;
}): EstadoCuenta {
  if (usuario.estado === 'SUSPENDIDO') return 'SUSPENDIDA';
  return usuario.primerIngresoEn ? 'ACTIVA' : 'SIN_PRIMER_INGRESO';
}

function aCuenta(usuario: UsuarioConTienda): CuentaEquipo {
  const { tienda } = usuario;
  if (!tienda || usuario.rol === 'EQUIPO') {
    throw new Error(`La cuenta ${usuario.id} no es de una tienda.`);
  }
  return {
    id: usuario.id,
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    correo: usuario.correo,
    whatsapp: usuario.whatsapp,
    rol: usuario.rol,
    estado: estadoDeCuenta(usuario),
    clave_temporal_pendiente: usuario.debeCambiarClave && usuario.primerIngresoEn !== null,
    tienda: {
      id: tienda.id,
      nombre: tienda.nombre,
      tipo: tienda.tipo,
      galeria: tienda.galeria?.nombre ?? null,
      stand: tienda.stand,
    },
    ultimo_ingreso_en: usuario.ultimoIngresoEn?.toISOString() ?? null,
    creada_en: usuario.creadoEn.toISOString(),
  };
}

/**
 * Panel del equipo (RF-35, RF-49, RF-50, D-42): crear cuentas, darles una clave
 * temporal nueva (también sirve para «reenviar acceso») y suspender o reactivar.
 * Cada acción queda en `auditoria`, sin la clave.
 */
@Injectable()
export class EquipoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  async cuentas(filtro: FiltroCuentas): Promise<RespuestaCuentas> {
    const condiciones: Prisma.UsuarioWhereInput[] = [SOLO_VENDEDORES];
    if (filtro.estado === 'suspendida') condiciones.push({ estado: 'SUSPENDIDO' });
    if (filtro.estado === 'activa')
      condiciones.push({ estado: 'ACTIVO', primerIngresoEn: { not: null } });
    if (filtro.estado === 'sin_primer_ingreso')
      condiciones.push({ estado: 'ACTIVO', primerIngresoEn: null });
    if (filtro.galeria) {
      condiciones.push({
        tienda:
          filtro.galeria === 'independientes'
            ? { galeriaId: null }
            : { galeria: { slug: filtro.galeria } },
      });
    }
    if (filtro.q) {
      const contiene = { contains: filtro.q, mode: 'insensitive' } as const;
      condiciones.push({
        OR: [{ nombre: contiene }, { usuario: contiene }, { tienda: { nombre: contiene } }],
      });
    }

    const [usuarios, todos] = await Promise.all([
      this.prisma.usuario.findMany({
        where: { AND: condiciones },
        include: INCLUIR_TIENDA,
        orderBy: [{ creadoEn: 'desc' }, { usuario: 'asc' }],
      }),
      this.prisma.usuario.findMany({
        where: SOLO_VENDEDORES,
        select: { estado: true, primerIngresoEn: true },
      }),
    ]);
    const estados = todos.map(estadoDeCuenta);
    return {
      cuentas: usuarios.map(aCuenta),
      resumen: {
        total: estados.length,
        activas: estados.filter((e) => e === 'ACTIVA').length,
        sin_primer_ingreso: estados.filter((e) => e === 'SIN_PRIMER_INGRESO').length,
        suspendidas: estados.filter((e) => e === 'SUSPENDIDA').length,
      },
    };
  }

  async tiendas(): Promise<TiendaParaEquipo[]> {
    const tiendas = await this.prisma.tienda.findMany({
      where: { estado: 'ACTIVA' },
      include: { galeria: true },
      orderBy: { nombre: 'asc' },
    });
    return tiendas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      tipo: t.tipo,
      galeria: t.galeria?.nombre ?? null,
      stand: t.stand,
    }));
  }

  async crear(entrada: CrearCuentaDatos, actorId: string): Promise<RespuestaAcceso> {
    await this.exigirUsuarioLibre(entrada.usuario);
    if (
      entrada.correo &&
      (await this.prisma.usuario.findUnique({ where: { correo: entrada.correo } }))
    ) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Ese correo ya está en otra cuenta.',
      );
    }

    const clave = generarClaveTemporal();
    const claveHash = await cifrarClave(clave);

    const usuario = await this.prisma
      .$transaction(async (tx) => {
        let tiendaId: string;
        let whatsapp: string | null = entrada.whatsapp ?? null;

        if (entrada.tipo === 'ASESOR') {
          const tienda = await tx.tienda.findUnique({ where: { id: entrada.tienda_id } });
          if (!tienda || tienda.estado !== 'ACTIVA') {
            throw new ApiHttpException(
              HttpStatus.BAD_REQUEST,
              'DATOS_INVALIDOS',
              'Esa tienda no existe o está suspendida.',
            );
          }
          tiendaId = tienda.id;
        } else {
          const datos = entrada.tienda;
          if (!datos) throw new Error('crearCuentaSchema garantiza la tienda.');
          const galeria = datos.galeria
            ? await tx.galeria.findUnique({ where: { slug: datos.galeria } })
            : null;
          if (datos.galeria && !galeria) {
            throw new ApiHttpException(
              HttpStatus.BAD_REQUEST,
              'DATOS_INVALIDOS',
              'Esa galería no existe.',
            );
          }
          const tienda = await tx.tienda.create({
            data: {
              tipo: entrada.tipo === 'INDEPENDIENTE' ? 'INDEPENDIENTE' : 'TIENDA',
              nombre: datos.nombre,
              galeriaId: galeria?.id ?? null,
              stand: datos.stand ?? null,
              whatsapp: datos.whatsapp,
            },
          });
          tiendaId = tienda.id;
          whatsapp ??= datos.whatsapp;
        }

        const creado = await tx.usuario.create({
          data: {
            tiendaId,
            rol: entrada.tipo === 'ASESOR' ? 'ASESOR' : 'DUENO',
            usuario: entrada.usuario,
            correo: entrada.correo ?? null,
            nombre: entrada.nombre,
            whatsapp,
            claveHash,
            debeCambiarClave: true,
            respuestasRapidas: {
              create: RESPUESTAS_RAPIDAS_INICIALES.map((texto, orden) => ({ texto, orden })),
            },
          },
          include: INCLUIR_TIENDA,
        });
        await tx.auditoria.create({
          data: {
            actorId,
            accion: 'crear_cuenta',
            objeto: 'usuario',
            objetoId: creado.id,
            datos: { usuario: creado.usuario, tipo: entrada.tipo, tienda_id: tiendaId },
          },
        });
        return creado;
      })
      .catch((error: unknown) => {
        // Dos personas del equipo creando el mismo usuario a la vez.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ApiHttpException(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            'Ese usuario o correo ya existe.',
          );
        }
        throw error;
      });

    return this.acceso(usuario, clave, 'nueva');
  }

  /** Clave temporal nueva: cierra sus sesiones y obliga a cambiarla al entrar. Es también «Reenviar acceso». */
  async claveTemporal(id: string, actorId: string): Promise<RespuestaAcceso> {
    const usuario = await this.buscar(id);
    if (usuario.estado === 'SUSPENDIDO') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'La cuenta está suspendida. Reactívala antes de darle una clave nueva.',
      );
    }
    const clave = generarClaveTemporal();
    const ahora = new Date();
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: {
          claveHash: await cifrarClave(clave),
          debeCambiarClave: true,
          intentosFallidos: 0,
          intentosDesde: null,
          bloqueadoHasta: null,
        },
        include: INCLUIR_TIENDA,
      }),
      this.prisma.sesion.updateMany({
        where: { usuarioId: id, revocadaEn: null },
        data: { revocadaEn: ahora },
      }),
      this.prisma.auditoria.create({
        data: { actorId, accion: 'clave_temporal', objeto: 'usuario', objetoId: id, datos: {} },
      }),
    ]);
    return this.acceso(actualizado, clave, usuario.primerIngresoEn ? 'cambio' : 'nueva');
  }

  /** Suspender corta sus sesiones al instante (A-05); reactivar le devuelve el acceso. */
  async cambiarEstado(
    id: string,
    estado: 'ACTIVA' | 'SUSPENDIDA',
    actorId: string,
  ): Promise<CuentaEquipo> {
    await this.buscar(id);
    const ahora = new Date();
    const operaciones: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.auditoria.create({
        data: {
          actorId,
          accion: estado === 'SUSPENDIDA' ? 'suspender' : 'reactivar',
          objeto: 'usuario',
          objetoId: id,
          datos: {},
        },
      }),
    ];
    if (estado === 'SUSPENDIDA') {
      operaciones.push(
        this.prisma.sesion.updateMany({
          where: { usuarioId: id, revocadaEn: null },
          data: { revocadaEn: ahora },
        }),
      );
    }
    const [actualizado] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id },
        data: { estado: estado === 'SUSPENDIDA' ? 'SUSPENDIDO' : 'ACTIVO' },
        include: INCLUIR_TIENDA,
      }),
      ...operaciones,
    ]);
    return aCuenta(actualizado as UsuarioConTienda);
  }

  private async buscar(id: string): Promise<UsuarioConTienda> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id, ...SOLO_VENDEDORES },
      include: INCLUIR_TIENDA,
    });
    if (!usuario)
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'No encontramos esa cuenta.',
      );
    return usuario;
  }

  /** Si el usuario está tomado, sugiere el siguiente libre: «tiendaf2», «tiendaf3»… */
  private async exigirUsuarioLibre(usuario: string): Promise<void> {
    const tomados = await this.prisma.usuario.findMany({
      where: { usuario: { startsWith: usuario } },
      select: { usuario: true },
    });
    const ocupados = new Set(tomados.map((t) => t.usuario.toLowerCase()));
    if (!ocupados.has(usuario)) return;
    let numero = 2;
    while (ocupados.has(`${usuario}${numero}`)) numero += 1;
    throw new ApiHttpException(
      HttpStatus.CONFLICT,
      'CONFLICTO',
      `El usuario «${usuario}» ya existe.`,
      {
        sugerencia: `${usuario}${numero}`,
      },
    );
  }

  private acceso(
    usuario: UsuarioConTienda,
    clave: string,
    motivo: 'nueva' | 'cambio',
  ): RespuestaAcceso {
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    const saludo =
      motivo === 'nueva'
        ? `Hola ${usuario.nombre}, ya tienes tu cuenta de PaseLibre.`
        : `Hola ${usuario.nombre}, te dejamos una contraseña temporal nueva para PaseLibre.`;
    const mensaje = [
      saludo,
      `Entra en ${web}/ingresar`,
      `Usuario: ${usuario.usuario}`,
      `Contraseña temporal: ${clave}`,
      'Al entrar te pedirá crear tu propia contraseña.',
    ].join('\n');
    return {
      cuenta: aCuenta(usuario),
      clave_temporal: clave,
      mensaje,
      enlace_whatsapp: usuario.whatsapp
        ? `https://wa.me/51${usuario.whatsapp}?text=${encodeURIComponent(mensaje)}`
        : null,
    };
  }
}
