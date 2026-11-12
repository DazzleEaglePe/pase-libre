import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AlertaBusqueda,
  MiReporte,
  ActualizarCuentaDatos,
  AvisosCuentaDatos,
  RespuestaAvisosCuenta,
  RespuestaCuenta,
  RespuestaRapida,
  RespuestaSesiones,
  TiendaBloqueada,
} from '@paselibre/contracts';
import {
  horarioTiendaSchema,
  leerHorarioEscrito,
  normalizarTexto,
  textoHorario,
  TIENDA_RESERVADA,
  type PortadaDatos,
  type PortadaTienda,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import { INTERRUPTOR_EN_VIVO, type InterruptorEnVivo } from '../en-vivo/interruptor';
import { dispositivoDe, LUGAR_DE_SESION } from '../../shared/dispositivo';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';

export { dispositivoDe };

const INCLUIR_TIENDA = {
  tienda: {
    include: {
      galeria: true,
      // N09: el cambio de galería, piso o stand que espera al Equipo.
      cambiosLugar: {
        where: { estado: 'PENDIENTE' },
        include: { galeria: true },
        orderBy: { creadoEn: 'desc' },
        take: 1,
      },
    },
  },
} as const;
type UsuarioConTienda = Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_TIENDA }>;

/** Los tipos de aviso que se pueden apagar en «Configurar avisos» (AV_Web). */
type TipoConPreferencia =
  | 'MENSAJE'
  | 'EN_VIVO'
  | 'EN_VIVO_RESPUESTA'
  | 'VENTA'
  | 'RECORDATORIO'
  | 'SEGUIDA'
  | 'ALERTA'
  | 'EQUIPO';

/** 1320 → «22:00». */
function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

export function respuestaCuenta(usuario: UsuarioConTienda): RespuestaCuenta {
  const { tienda } = usuario;
  const pendiente = tienda?.cambiosLugar[0];
  const tramos = horarioTiendaSchema.safeParse(tienda?.horarioDatos);
  return {
    usuario: {
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      whatsapp: usuario.whatsapp,
      rol: usuario.rol,
      mostrar_visto: usuario.mostrarVisto,
    },
    tienda: tienda
      ? {
          nombre: tienda.nombre,
          tipo: tienda.tipo,
          galeria: tienda.galeria?.nombre ?? null,
          stand: tienda.stand,
          galeria_id: tienda.galeriaId,
          piso: tienda.piso,
          lugar_pendiente: pendiente
            ? {
                galeria_id: pendiente.galeriaId,
                galeria: pendiente.galeria.nombre,
                piso: pendiente.piso,
                stand: pendiente.stand,
                pedido_en: pendiente.creadoEn.toISOString(),
              }
            : null,
          whatsapp: tienda.whatsapp,
          horario: tienda.horario,
          horario_tramos: tramos.success ? tramos.data : leerHorarioEscrito(tienda.horario),
          portada: tienda.portadaRuta,
          indicaciones: tienda.indicaciones,
          descripcion: tienda.descripcion,
          logo: tienda.logo,
          precio_visible_defecto: tienda.precioVisibleDefecto,
          moneda_defecto: tienda.monedaDefecto,
        }
      : null,
  };
}

/**
 * Configuración (C_Configuracion; RF-48, RF-56, RF-58 a RF-60). En el MVP el dueño y el
 * asesor pueden lo mismo dentro de su tienda (docs/05 §9), así que los dos editan sus datos.
 */
@Injectable()
export class CuentaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
    @Inject(INTERRUPTOR_EN_VIVO) private readonly enVivo: InterruptorEnVivo,
  ) {}

  async cuenta(usuarioId: string): Promise<RespuestaCuenta> {
    return respuestaCuenta(
      await this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        include: INCLUIR_TIENDA,
      }),
    );
  }

  /** Sube o acomoda la portada del perfil (COR1). La foto tiene que ser de la tienda. */
  async portada(usuarioId: string, datos: PortadaDatos): Promise<PortadaTienda> {
    return this.prisma.$transaction(async (tx) => {
      const { tiendaId, tienda } = await tx.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { tiendaId: true, tienda: { select: { portadaRuta: true } } },
      });
      if (!tiendaId) {
        throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
      }
      let medidas: { ancho: number; alto: number } | undefined;
      if (datos.ruta && datos.ruta !== tienda?.portadaRuta) {
        medidas = (await this.archivos.reclamar(tx, [datos.ruta], tiendaId)).get(datos.ruta);
      } else if (!datos.ruta && !tienda?.portadaRuta) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Primero sube una foto de portada.',
        );
      }
      const nueva = await tx.tienda.update({
        where: { id: tiendaId },
        data: {
          ...(medidas && datos.ruta
            ? {
                portadaRuta: datos.ruta,
                portadaAncho: medidas.ancho,
                portadaAlto: medidas.alto,
                // Una foto nueva arranca al centro.
                portadaPosicion: datos.posicion ?? 50,
              }
            : {}),
          ...(!medidas && datos.posicion !== undefined ? { portadaPosicion: datos.posicion } : {}),
        },
        select: { portadaRuta: true, portadaAncho: true, portadaAlto: true, portadaPosicion: true },
      });
      return {
        ruta: nueva.portadaRuta ?? '',
        ancho: nueva.portadaAncho,
        alto: nueva.portadaAlto,
        posicion: nueva.portadaPosicion,
      };
    });
  }

  async quitarPortada(usuarioId: string): Promise<void> {
    const { tiendaId } = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { tiendaId: true },
    });
    if (!tiendaId) return;
    await this.prisma.tienda.update({
      where: { id: tiendaId },
      data: { portadaRuta: null, portadaAncho: null, portadaAlto: null, portadaPosicion: 50 },
    });
  }

  async actualizar(usuarioId: string, cambios: ActualizarCuentaDatos): Promise<RespuestaCuenta> {
    try {
      const usuario = await this.prisma.$transaction(async (tx) => {
        const actual = await tx.usuario.findUniqueOrThrow({
          where: { id: usuarioId },
          select: { tiendaId: true, tienda: { select: { logo: true } } },
        });
        const { tienda } = cambios;
        if (tienda) {
          if (!actual.tiendaId) {
            throw new ApiHttpException(
              HttpStatus.FORBIDDEN,
              'PROHIBIDO',
              'Tu cuenta no tiene tienda.',
            );
          }
          if (tienda.logo && tienda.logo !== actual.tienda?.logo) {
            await this.archivos.reclamar(tx, [tienda.logo], actual.tiendaId);
          }
          // Con el horario por días (N09), el texto se escribe solo.
          const horario =
            tienda.horario_tramos === undefined || tienda.horario_tramos === null
              ? tienda.horario
              : textoHorario(tienda.horario_tramos, 'largo').slice(0, 120);
          await tx.tienda.update({
            where: { id: actual.tiendaId },
            data: {
              nombre: tienda.nombre,
              whatsapp: tienda.whatsapp,
              horario,
              horarioDatos:
                tienda.horario_tramos === undefined
                  ? undefined
                  : tienda.horario_tramos === null
                    ? Prisma.DbNull
                    : tienda.horario_tramos,
              indicaciones: tienda.indicaciones,
              descripcion: tienda.descripcion,
              logo: tienda.logo,
              precioVisibleDefecto: tienda.precio_visible_defecto,
              monedaDefecto: tienda.moneda_defecto,
            },
          });
        }
        return tx.usuario.update({
          where: { id: usuarioId },
          data: {
            nombre: cambios.nombre,
            correo: cambios.correo,
            whatsapp: cambios.whatsapp,
            mostrarVisto: cambios.mostrar_visto,
          },
          include: INCLUIR_TIENDA,
        });
      });
      return respuestaCuenta(usuario);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese correo ya lo usa otra cuenta.',
        );
      }
      throw error;
    }
  }

  // ── Avisos (RF-59) ────────────────────────────────────────────────────────

  async avisos(usuarioId: string): Promise<RespuestaAvisosCuenta> {
    const [usuario, preferencias] = await Promise.all([
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { noMolestarDesde: true, noMolestarHasta: true },
      }),
      this.prisma.preferenciaAviso.findMany({ where: { usuarioId } }),
    ]);
    const encendido = (tipo: TipoConPreferencia) =>
      preferencias.find((p) => p.tipo === tipo)?.campanita ?? true;
    return {
      campanita: {
        MENSAJE: encendido('MENSAJE'),
        // Los avisos de En vivo solo se ofrecen con En vivo encendido (D-53).
        ...(this.enVivo.activo
          ? { EN_VIVO: encendido('EN_VIVO'), EN_VIVO_RESPUESTA: encendido('EN_VIVO_RESPUESTA') }
          : {}),
        VENTA: encendido('VENTA'),
        RECORDATORIO: encendido('RECORDATORIO'),
        SEGUIDA: encendido('SEGUIDA'),
        ALERTA: encendido('ALERTA'),
        EQUIPO: encendido('EQUIPO'),
      },
      no_molestar:
        usuario.noMolestarDesde !== null && usuario.noMolestarHasta !== null
          ? { desde: aHora(usuario.noMolestarDesde), hasta: aHora(usuario.noMolestarHasta) }
          : null,
    };
  }

  async guardarAvisos(usuarioId: string, datos: AvisosCuentaDatos): Promise<RespuestaAvisosCuenta> {
    const cambios = (
      Object.entries(datos.campanita) as Array<[TipoConPreferencia, boolean | undefined]>
    ).filter((cambio): cambio is [TipoConPreferencia, boolean] => cambio[1] !== undefined);
    await this.prisma.$transaction([
      ...cambios.map(([tipo, campanita]) =>
        this.prisma.preferenciaAviso.upsert({
          where: { usuarioId_tipo: { usuarioId, tipo } },
          update: { campanita },
          create: { usuarioId, tipo, campanita },
        }),
      ),
      // Las calificaciones van con las ventas (AV_Web: «Ventas y calificaciones»).
      ...(datos.campanita.VENTA === undefined
        ? []
        : [
            this.prisma.preferenciaAviso.upsert({
              where: { usuarioId_tipo: { usuarioId, tipo: 'CALIFICACION' } },
              update: { campanita: datos.campanita.VENTA },
              create: { usuarioId, tipo: 'CALIFICACION', campanita: datos.campanita.VENTA },
            }),
          ]),
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: {
          noMolestarDesde: datos.no_molestar?.desde ?? null,
          noMolestarHasta: datos.no_molestar?.hasta ?? null,
        },
      }),
    ]);
    return this.avisos(usuarioId);
  }

  // ── Respuestas rápidas (RF-56) ────────────────────────────────────────────

  respuestasRapidas(usuarioId: string): Promise<RespuestaRapida[]> {
    return this.prisma.respuestaRapida.findMany({
      where: { usuarioId },
      orderBy: { orden: 'asc' },
      select: { id: true, texto: true },
    });
  }

  async guardarRespuestasRapidas(usuarioId: string, textos: string[]): Promise<RespuestaRapida[]> {
    await this.prisma.$transaction([
      this.prisma.respuestaRapida.deleteMany({ where: { usuarioId } }),
      this.prisma.respuestaRapida.createMany({
        data: textos.map((texto, orden) => ({ usuarioId, texto, orden })),
      }),
    ]);
    return this.respuestasRapidas(usuarioId);
  }

  // ── Sesiones (RF-60) ──────────────────────────────────────────────────────

  /** «Sesiones abiertas · 2 de 2» (N10): la cuenta principal tiene límite; el asesor, no. */
  async sesiones(sesion: SesionActiva): Promise<RespuestaSesiones> {
    const abiertas = await this.prisma.sesion.findMany({
      where: { usuarioId: sesion.usuario.id, revocadaEn: null, expiraEn: { gt: new Date() } },
      orderBy: { usadaEn: 'desc' },
      select: { id: true, agente: true, usadaEn: true },
    });
    return {
      sesiones: abiertas
        .map((s) => ({
          id: s.id,
          dispositivo: dispositivoDe(s.agente),
          lugar: LUGAR_DE_SESION,
          ultimo_uso: s.usadaEn.toISOString(),
          actual: s.id === sesion.sesionId,
        }))
        .sort((a, b) => Number(b.actual) - Number(a.actual)),
      limite:
        sesion.usuario.rol === 'DUENO' ? (sesion.usuario.tienda?.limiteDispositivos ?? null) : null,
    };
  }

  async cerrarSesion(sesion: SesionActiva, id: string): Promise<void> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { id, usuarioId: sesion.usuario.id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    if (count === 0) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa sesión ya está cerrada.',
      );
    }
    this.tiempoReal.desconectarSesion(id);
  }

  async bienvenidaVista(usuarioId: string): Promise<void> {
    await this.prisma.usuario.updateMany({
      where: { id: usuarioId, bienvenidaVistaEn: null },
      data: { bienvenidaVistaEn: new Date() },
    });
  }

  async cerrarOtras(sesion: SesionActiva): Promise<{ cerradas: number }> {
    const { count } = await this.prisma.sesion.updateMany({
      where: { usuarioId: sesion.usuario.id, revocadaEn: null, NOT: { id: sesion.sesionId } },
      data: { revocadaEn: new Date() },
    });
    await this.tiempoReal.desconectarUsuario(sesion.usuario.id, sesion.sesionId);
    return { cerradas: count };
  }

  // ── Alertas de búsqueda (EV_WebRes) ───────────────────────────────────────

  async alertas(usuarioId: string): Promise<AlertaBusqueda[]> {
    const filas = await this.prisma.alertaBusqueda.findMany({
      where: { usuarioId },
      orderBy: { creadaEn: 'desc' },
    });
    return filas.map((fila) => ({
      id: fila.id,
      texto: fila.texto,
      creada_en: fila.creadaEn.toISOString(),
    }));
  }

  /** La misma búsqueda dos veces es una sola alerta. Hasta 20 por persona. */
  async crearAlerta(usuarioId: string, texto: string): Promise<AlertaBusqueda> {
    const palabras = normalizarTexto(texto);
    if (!palabras) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Escribe qué buscas con letras o números.',
      );
    }
    const cuantas = await this.prisma.alertaBusqueda.count({ where: { usuarioId } });
    const existente = await this.prisma.alertaBusqueda.findUnique({
      where: { usuarioId_palabras: { usuarioId, palabras } },
    });
    if (!existente && cuantas >= 20) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Ya tienes 20 alertas. Borra alguna para crear otra.',
      );
    }
    const alerta =
      existente ??
      (await this.prisma.alertaBusqueda.create({ data: { usuarioId, texto, palabras } }));
    return { id: alerta.id, texto: alerta.texto, creada_en: alerta.creadaEn.toISOString() };
  }

  async borrarAlerta(usuarioId: string, id: string): Promise<void> {
    await this.prisma.alertaBusqueda.deleteMany({ where: { id, usuarioId } });
  }

  // ── Mis reportes (REP_WebMisReportes) ─────────────────────────────────────

  async reportes(usuarioId: string): Promise<MiReporte[]> {
    const filas = await this.prisma.denuncia.findMany({
      where: { denuncianteId: usuarioId },
      orderBy: { creadaEn: 'desc' },
      take: 50,
      select: {
        codigo: true,
        tipo: true,
        estado: true,
        creadaEn: true,
        resolucion: true,
        reservada: true,
        tiendaDenunciada: { select: { nombre: true } },
      },
    });
    return filas.map((fila) => ({
      codigo: `R-${fila.codigo}`,
      // Una publicación reservada se reportó sin saber de quién era: tampoco se dice aquí.
      tienda: fila.reservada ? TIENDA_RESERVADA : (fila.tiendaDenunciada?.nombre ?? 'PaseLibre'),
      tipo: fila.tipo,
      estado:
        fila.estado === 'ABIERTA'
          ? 'ENVIADO'
          : fila.estado === 'EN_REVISION'
            ? 'EN_REVISION'
            : 'RESUELTO',
      creada_en: fila.creadaEn.toISOString(),
      revisar_antes_de: new Date(fila.creadaEn.getTime() + 3 * 3_600_000).toISOString(),
      resolucion:
        fila.resolucion ??
        (fila.estado === 'DESCARTADA'
          ? 'Lo revisamos y no encontramos nada que vaya contra las reglas de PaseLibre.'
          : null),
    }));
  }

  // ── Bloqueados (RF-57) ────────────────────────────────────────────────────

  async bloqueados(usuarioId: string): Promise<TiendaBloqueada[]> {
    const bloqueos = await this.prisma.bloqueo.findMany({
      where: { usuarioId },
      orderBy: { creadoEn: 'desc' },
      select: {
        id: true,
        reservada: true,
        creadoEn: true,
        tiendaBloqueada: {
          select: { id: true, nombre: true, galeria: { select: { nombre: true } } },
        },
      },
    });
    return bloqueos.map((b) => ({
      // Bloqueada desde una oferta con la tienda reservada: ni su nombre ni su id, solo la
      // galería (que el chat ya mostraba) y el id del bloqueo para poder deshacerlo.
      tienda: b.reservada
        ? { id: b.id, nombre: TIENDA_RESERVADA, galeria: b.tiendaBloqueada.galeria?.nombre ?? null }
        : {
            id: b.tiendaBloqueada.id,
            nombre: b.tiendaBloqueada.nombre,
            galeria: b.tiendaBloqueada.galeria?.nombre ?? null,
          },
      desde: b.creadoEn.toISOString(),
    }));
  }

  /** Recibe el id de la tienda o, si se bloqueó con la tienda reservada, el del bloqueo. */
  async desbloquear(usuarioId: string, id: string): Promise<void> {
    await this.prisma.bloqueo.deleteMany({
      where: { usuarioId, OR: [{ tiendaBloqueadaId: id }, { id }] },
    });
  }
}
