import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  formatearPrecio,
  interpretarBusqueda,
  precioDe,
  TIENDA_ELIMINADA,
  type ActividadDeTienda,
  type CambioDelEquipo,
  type ClaveTiendaEquipo,
  type DatosTiendaEquipo,
  type FichaTienda,
  type LecturaDeChat,
  type PublicacionDeTienda,
  type ReportesDeTienda,
  type RespuestaChatsDeTienda,
  type RespuestaClaveTienda,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import type { Environment } from '../../config/env.schema';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { esAdministrador } from '../../shared/administrador';
import { avisarSeguridad, duenosDe } from '../../shared/aviso-seguridad';
import { dispositivoDe, LUGAR_DE_SESION } from '../../shared/dispositivo';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { cifrarClave, esClaveComprometida, generarClaveTemporal } from '../sesion/clave';
import type { SesionActiva } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { suspensionDe } from './eliminar-tienda.service';

const MOTIVO = {
  ESTAFA: 'Estafa o intento de estafa',
  DESCRITO: 'No cumplió con lo descrito',
  TRATO: 'Mal trato o acoso',
};
const CHATS_EN_LA_FICHA = 10;
const DIAS_DE_ACTIVIDAD = 30;
const DIA = 86_400_000;
const SOLICITUD_VIGENTE_MS = DIA;

const noExiste = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');

const primerNombre = (nombre: string) => nombre.split(' ')[0] ?? nombre;

/** «hace 2 h» en el aviso no hace falta: la campanita ya dice cuándo. */
const AVISO_DEL_EQUIPO = 'Lo hizo el Equipo PaseLibre. Si no lo pediste, escríbenos.';

/**
 * La ficha completa de una tienda en el panel del equipo (N14, mejoras 39, 41, 42 y 49). Todo se
 * edita desde aquí, cada cambio queda en el «Historial de cambios» de la tienda y a la tienda le
 * llega un aviso. Nunca se ve su contraseña. Los chats se abren en solo lectura y queda anotado,
 * en silencio, quién los abrió y cuándo.
 */
@Injectable()
export class FichaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}

  /** Anota el cambio en la tienda y le avisa a su dueño. */
  private async cambio(
    sesion: SesionActiva,
    tiendaId: string,
    accion: string,
    aviso: { titulo: string; extracto?: string; enlace?: string } | null,
  ): Promise<void> {
    await this.prisma.registroEquipo.create({
      data: { autorId: sesion.usuario.id, tiendaId, accion: accion.slice(0, 240) },
    });
    if (aviso) {
      await avisarSeguridad(this.prisma, this.tiempoReal, await duenosDe(this.prisma, tiendaId), {
        extracto: AVISO_DEL_EQUIPO,
        enlace: '/mensajes/equipo',
        ...aviso,
      });
    }
  }

  private async dueno(tiendaId: string) {
    return this.prisma.usuario.findFirst({
      where: { tiendaId, rol: 'DUENO', quitadoEn: null },
      orderBy: { creadoEn: 'asc' },
      select: { id: true, usuario: true, nombre: true, estado: true, whatsapp: true },
    });
  }

  // ── Cabecera ─────────────────────────────────────────────────────────────

  async ficha(id: string, sesion: SesionActiva): Promise<FichaTienda> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        estado: true,
        suspendidaEn: true,
        suspendidaPorId: true,
        motivoSuspension: true,
        actualizadaEn: true,
        piso: true,
        stand: true,
        whatsapp: true,
        horario: true,
        indicaciones: true,
        descripcion: true,
        logo: true,
        portadaRuta: true,
        portadaPosicion: true,
        limiteDispositivos: true,
        galeria: { select: { nombre: true, slug: true } },
        _count: { select: { advertencias: true, denunciasRecibidas: true } },
      },
    });
    if (!tienda) throw noExiste();
    const ahora = new Date();
    const [dueno, asesores, publicaciones, pedido, activo, suspension] = await Promise.all([
      this.dueno(id),
      this.prisma.usuario.count({ where: { tiendaId: id, rol: 'ASESOR', quitadoEn: null } }),
      this.prisma.oferta.count({ where: { tiendaId: id, estado: { not: 'ELIMINADA' } } }),
      this.prisma.modoSoporte.findFirst({
        where: {
          tiendaId: id,
          pedidoEn: { gt: new Date(ahora.getTime() - SOLICITUD_VIGENTE_MS) },
          iniciadoEn: null,
        },
        orderBy: { pedidoEn: 'desc' },
        select: { pedidoEn: true },
      }),
      this.prisma.modoSoporte.findFirst({
        where: { tiendaId: id, terminadoEn: null, venceEn: { gt: ahora } },
        select: { venceEn: true, equipo: { select: { nombre: true } } },
      }),
      suspensionDe(this.prisma, tienda),
    ]);
    const sesiones = dueno
      ? await this.prisma.sesion.findMany({
          where: { usuarioId: dueno.id, revocadaEn: null, expiraEn: { gt: ahora } },
          orderBy: { usadaEn: 'desc' },
          select: { id: true, agente: true, usadaEn: true },
        })
      : [];
    return {
      id: tienda.id,
      nombre: tienda.nombre,
      suspendida: tienda.estado === 'SUSPENDIDA',
      suspension,
      puede_eliminar: esAdministrador(sesion.usuario),
      advertencias: tienda._count.advertencias,
      galeria: tienda.galeria?.nombre ?? null,
      piso: tienda.piso,
      stand: tienda.stand,
      usuario: dueno?.usuario ?? null,
      whatsapp: tienda.whatsapp,
      asesores,
      logo: tienda.logo,
      portada: tienda.portadaRuta
        ? { ruta: tienda.portadaRuta, posicion: tienda.portadaPosicion }
        : null,
      datos: {
        nombre: tienda.nombre,
        whatsapp: tienda.whatsapp,
        galeria: tienda.galeria?.slug ?? null,
        piso: tienda.piso,
        stand: tienda.stand,
        horario: tienda.horario,
        indicaciones: tienda.indicaciones,
        descripcion: tienda.descripcion,
      },
      publicaciones,
      reportes: tienda._count.denunciasRecibidas,
      limite_dispositivos: tienda.limiteDispositivos,
      sesiones: sesiones.map((s) => ({
        id: s.id,
        dispositivo: dispositivoDe(s.agente),
        lugar: LUGAR_DE_SESION,
        ultimo_uso: s.usadaEn.toISOString(),
      })),
      soporte: {
        pedido_en: pedido?.pedidoEn?.toISOString() ?? null,
        activo:
          activo?.venceEn && activo.equipo
            ? { equipo: primerNombre(activo.equipo.nombre), vence_en: activo.venceEn.toISOString() }
            : null,
      },
    };
  }

  // ── Datos ────────────────────────────────────────────────────────────────

  async datos(id: string, datos: DatosTiendaEquipo, sesion: SesionActiva): Promise<FichaTienda> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id },
      select: { nombre: true },
    });
    if (!tienda) throw noExiste();
    let galeriaId: string | null | undefined;
    if (datos.galeria !== undefined) {
      if (datos.galeria === null) {
        galeriaId = null;
      } else {
        const galeria = await this.prisma.galeria.findUnique({
          where: { slug: datos.galeria },
          select: { id: true },
        });
        if (!galeria) {
          throw new ApiHttpException(
            HttpStatus.BAD_REQUEST,
            'DATOS_INVALIDOS',
            'Esa galería no existe.',
          );
        }
        galeriaId = galeria.id;
      }
    }
    await this.prisma.tienda.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        whatsapp: datos.whatsapp,
        ...(galeriaId === undefined ? {} : { galeriaId }),
        piso: datos.piso,
        stand: datos.stand,
        horario: datos.horario,
        indicaciones: datos.indicaciones,
        descripcion: datos.descripcion,
      },
    });
    const NOMBRES: Record<keyof DatosTiendaEquipo, string> = {
      nombre: 'el nombre',
      whatsapp: 'el WhatsApp',
      galeria: 'la galería',
      piso: 'el piso',
      stand: 'el stand',
      horario: 'el horario',
      indicaciones: '«Cómo llegar»',
      descripcion: '«Sobre la tienda»',
    };
    const cambiados = (Object.keys(NOMBRES) as Array<keyof DatosTiendaEquipo>)
      .filter((campo) => datos[campo] !== undefined)
      .map((campo) => NOMBRES[campo]);
    const lista = juntar(cambiados);
    await this.cambio(sesion, id, `cambió ${lista} de ${tienda.nombre}`, {
      titulo: `El Equipo PaseLibre actualizó ${lista} de tu tienda`,
    });
    return this.ficha(id, sesion);
  }

  /** Pestaña Imagen: quitar el logo o la portada. Para subir una nueva, «Ayudar como la tienda». */
  async quitarImagen(
    id: string,
    cual: 'logo' | 'portada',
    sesion: SesionActiva,
  ): Promise<FichaTienda> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id },
      select: { nombre: true },
    });
    if (!tienda) throw noExiste();
    await this.prisma.tienda.update({
      where: { id },
      data:
        cual === 'logo'
          ? { logo: null }
          : { portadaRuta: null, portadaAncho: null, portadaAlto: null, portadaPosicion: 50 },
    });
    const que = cual === 'logo' ? 'el logo' : 'la portada';
    await this.cambio(sesion, id, `quitó ${que} de ${tienda.nombre}`, {
      titulo: `El Equipo PaseLibre quitó ${que} de tu tienda`,
    });
    return this.ficha(id, sesion);
  }

  // ── Publicaciones ────────────────────────────────────────────────────────

  async publicaciones(id: string): Promise<PublicacionDeTienda[]> {
    await this.existe(id);
    const ofertas = await this.prisma.oferta.findMany({
      where: { tiendaId: id, estado: { not: 'ELIMINADA' } },
      orderBy: { actualizadaEn: 'desc' },
      take: 100,
      select: {
        id: true,
        estado: true,
        stock: true,
        precioCentimos: true,
        moneda: true,
        actualizadaEn: true,
        producto: { select: { titulo: true } },
      },
    });
    return ofertas.map((oferta) => ({
      id: oferta.id,
      titulo: oferta.producto.titulo,
      precio:
        oferta.precioCentimos === null
          ? null
          : formatearPrecio(precioDe(Number(oferta.precioCentimos), oferta.moneda)),
      estado: oferta.estado === 'PAUSADA' ? 'PAUSADA' : 'ACTIVA',
      stock: oferta.stock,
      actualizada_en: oferta.actualizadaEn.toISOString(),
    }));
  }

  async estadoPublicacion(
    id: string,
    ofertaId: string,
    estado: 'ACTIVA' | 'PAUSADA',
    sesion: SesionActiva,
  ): Promise<PublicacionDeTienda[]> {
    const oferta = await this.prisma.oferta.findFirst({
      where: { id: ofertaId, tiendaId: id, estado: { not: 'ELIMINADA' } },
      select: { producto: { select: { titulo: true } }, tienda: { select: { nombre: true } } },
    });
    if (!oferta) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa publicación no es de esta tienda.',
      );
    }
    await this.prisma.oferta.update({ where: { id: ofertaId }, data: { estado } });
    const verbo = estado === 'PAUSADA' ? 'pausó' : 'reactivó';
    await this.cambio(
      sesion,
      id,
      `${verbo} la publicación «${oferta.producto.titulo}» de ${oferta.tienda.nombre}`,
      { titulo: `El Equipo PaseLibre ${verbo} tu publicación «${oferta.producto.titulo}»` },
    );
    return this.publicaciones(id);
  }

  // ── Conversaciones (solo lectura) ────────────────────────────────────────

  async conversaciones(id: string): Promise<RespuestaChatsDeTienda> {
    await this.existe(id);
    const deLaTienda = {
      OR: [{ tiendaCompradoraId: id }, { tiendaVendedoraId: id }],
      mensajes: { some: {} },
    } satisfies Prisma.ConversacionWhereInput;
    const [filas, total, hilo] = await Promise.all([
      this.prisma.conversacion.findMany({
        where: deLaTienda,
        orderBy: { ultimoMensajeEn: 'desc' },
        take: CHATS_EN_LA_FICHA,
        select: {
          id: true,
          ultimoMensajeEn: true,
          tiendaCompradoraId: true,
          tiendaCompradora: { select: { nombre: true } },
          tiendaVendedora: { select: { nombre: true } },
          oferta: { select: { producto: { select: { titulo: true } } } },
          mensajes: {
            orderBy: { creadoEn: 'desc' },
            take: 1,
            select: { texto: true, creadoEn: true },
          },
        },
      }),
      this.prisma.conversacion.count({ where: deLaTienda }),
      this.prisma.hiloEquipo.findUnique({
        where: { tiendaId: id },
        select: {
          ultimoMensajeEn: true,
          mensajes: { orderBy: { creadoEn: 'desc' }, take: 1, select: { texto: true } },
        },
      }),
    ]);
    return {
      chats: filas.map((fila) => ({
        id: fila.id,
        // La tienda del panel es una de las dos: se muestra la otra (el equipo ve todo).
        con:
          (fila.tiendaCompradoraId === id
            ? fila.tiendaVendedora?.nombre
            : fila.tiendaCompradora?.nombre) ?? TIENDA_ELIMINADA,
        producto: fila.oferta?.producto.titulo ?? 'Publicación eliminada',
        ultimo: fila.mensajes[0]?.texto ?? null,
        fecha: (fila.mensajes[0]?.creadoEn ?? fila.ultimoMensajeEn).toISOString(),
      })),
      total,
      equipo: hilo
        ? { ultimo: hilo.mensajes[0]?.texto ?? null, fecha: hilo.ultimoMensajeEn.toISOString() }
        : null,
    };
  }

  /**
   * Abre un chat de la tienda en solo lectura (mejoras 42 y 49): sin preguntar motivo, pero queda
   * anotado quién lo abrió y cuándo, en el «Historial de cambios» y en `auditoria`. A la tienda no
   * le llega aviso de esto. No marca nada como leído.
   *
   * Los textos de antes de editar y los mensajes borrados los guarda el chat (área A): si la
   * conversación no los tiene, se muestra lo que hay.
   */
  async leerChat(id: string, conversacionId: string, sesion: SesionActiva): Promise<LecturaDeChat> {
    const conversacion = await this.prisma.conversacion.findFirst({
      where: {
        id: conversacionId,
        OR: [{ tiendaCompradoraId: id }, { tiendaVendedoraId: id }],
      },
      select: {
        id: true,
        tiendaCompradoraId: true,
        tiendaCompradora: { select: { nombre: true } },
        tiendaVendedora: { select: { nombre: true } },
        oferta: { select: { producto: { select: { titulo: true } } } },
      },
    });
    if (!conversacion) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Ese chat no es de esta tienda.',
      );
    }
    const mensajes = await this.prisma.mensaje.findMany({
      where: { conversacionId },
      orderBy: { creadoEn: 'asc' },
      take: 300,
      select: {
        id: true,
        texto: true,
        foto: true,
        tipo: true,
        creadoEn: true,
        autor: { select: { nombre: true, tiendaId: true, tienda: { select: { nombre: true } } } },
      },
    });
    // Si la otra tienda se eliminó (doc 19 §9), su lado quedó vacío.
    const con =
      (conversacion.tiendaCompradoraId === id
        ? conversacion.tiendaVendedora?.nombre
        : conversacion.tiendaCompradora?.nombre) ?? TIENDA_ELIMINADA;
    const versiones = await this.versionesDe(mensajes.map((mensaje) => mensaje.id));
    await this.prisma.$transaction([
      this.prisma.registroEquipo.create({
        data: { autorId: sesion.usuario.id, tiendaId: id, accion: `abrió el chat con ${con}` },
      }),
      this.prisma.auditoria.create({
        data: {
          actorId: sesion.usuario.id,
          accion: 'leer_chat',
          objeto: 'conversacion',
          objetoId: conversacionId,
          datos: { tienda_id: id },
        },
      }),
    ]);
    return {
      id: conversacion.id,
      con,
      producto: conversacion.oferta?.producto.titulo ?? 'Publicación eliminada',
      mensajes: mensajes.map((mensaje) => {
        const deLaTienda = mensaje.autor?.tiendaId === id;
        const cambios = versiones.get(mensaje.id) ?? [];
        const borrado = cambios.find((cambio) => cambio.cambio === 'ELIMINADO');
        const editado = cambios.find((cambio) => cambio.cambio === 'EDITADO');
        const quien = deLaTienda
          ? primerNombre(mensaje.autor?.nombre ?? '')
          : (mensaje.autor?.tienda?.nombre ?? mensaje.autor?.nombre ?? '');
        return {
          id: mensaje.id,
          // Borrado para todos: el chat lo vació, el Equipo ve lo que decía.
          texto: borrado ? (borrado.texto ?? mensaje.texto) : mensaje.texto,
          foto: mensaje.foto,
          de_la_tienda: deLaTienda,
          autor:
            mensaje.tipo === 'SISTEMA' || !mensaje.autor
              ? null
              : deLaTienda
                ? primerNombre(mensaje.autor.nombre)
                : (mensaje.autor.tienda?.nombre ?? mensaje.autor.nombre),
          creado_en: mensaje.creadoEn.toISOString(),
          // El texto original, antes de la primera edición.
          antes: editado ? (editado.texto ?? '') : null,
          // Solo su autor lo puede borrar para todos.
          borrado_por: borrado ? quien : null,
        };
      }),
    };
  }

  /**
   * Lo que decían los mensajes antes de editarlos o borrarlos. Lo guarda el chat (área A, tabla
   * `mensaje_version`); se lee con SQL para no depender de su modelo, y si la tabla todavía no
   * existe se muestra lo que hay.
   */
  private async versionesDe(
    ids: string[],
  ): Promise<Map<string, Array<{ cambio: string; texto: string | null }>>> {
    const versiones = new Map<string, Array<{ cambio: string; texto: string | null }>>();
    if (ids.length === 0) return versiones;
    const [tabla] = await this.prisma.$queryRaw<Array<{ existe: boolean }>>`
      SELECT to_regclass('public.mensaje_version') IS NOT NULL AS existe`;
    if (!tabla?.existe) return versiones;
    const filas = await this.prisma.$queryRaw<
      Array<{ mensaje_id: string; cambio: string; texto: string | null }>
    >`
      SELECT mensaje_id::text, cambio::text, texto FROM mensaje_version
      WHERE mensaje_id = ANY(${ids}::uuid[])
      ORDER BY creada_en ASC`;
    for (const fila of filas) {
      versiones.set(fila.mensaje_id, [...(versiones.get(fila.mensaje_id) ?? []), fila]);
    }
    return versiones;
  }

  // ── Actividad (sin leer chats) ───────────────────────────────────────────

  /**
   * Resumen de 30 días por categoría (mejora 49): lo que la gente de la tienda buscó (la categoría
   * que nombró al buscar) y las publicaciones que vio. Es la misma base que usará el algoritmo.
   */
  async actividad(id: string): Promise<ActividadDeTienda> {
    await this.existe(id);
    const desde = new Date(Date.now() - DIAS_DE_ACTIVIDAD * DIA);
    const [vistas, busquedas, categorias] = await Promise.all([
      this.prisma.$queryRaw<Array<{ slug: string; cuantas: number }>>`
        SELECT c.slug, count(*)::int AS cuantas
        FROM vista_oferta v
        JOIN oferta o ON o.id = v.oferta_id
        JOIN producto p ON p.id = o.producto_id
        JOIN categoria c ON c.id = p.categoria_id
        WHERE v.tienda_id = ${id}::uuid AND v.dia >= ${desde}::date
        GROUP BY c.slug`,
      this.prisma.busqueda.findMany({
        where: { creadaEn: { gte: desde }, usuario: { tiendaId: id } },
        select: { texto: true },
        take: 5000,
      }),
      this.prisma.categoria.findMany({ select: { slug: true, nombre: true } }),
    ]);
    const nombreDe = new Map(categorias.map((c) => [c.slug, c.nombre]));
    const cuenta = new Map<string, { busquedas: number; vistas: number }>();
    const sumar = (slug: string, campo: 'busquedas' | 'vistas', n: number) => {
      if (!nombreDe.has(slug)) return;
      const actual = cuenta.get(slug) ?? { busquedas: 0, vistas: 0 };
      actual[campo] += n;
      cuenta.set(slug, actual);
    };
    for (const fila of vistas) sumar(fila.slug, 'vistas', fila.cuantas);
    for (const fila of busquedas) {
      const { categoria } = interpretarBusqueda(fila.texto);
      if (categoria) sumar(categoria, 'busquedas', 1);
    }
    return {
      dias: DIAS_DE_ACTIVIDAD,
      categorias: [...cuenta.entries()]
        .map(([slug, n]) => ({
          categoria: nombreDe.get(slug) ?? slug,
          busquedas: n.busquedas,
          vistas: n.vistas,
          total: n.busquedas + n.vistas,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    };
  }

  // ── Reportes y advertencias ──────────────────────────────────────────────

  async reportes(id: string): Promise<ReportesDeTienda> {
    await this.existe(id);
    const [advertencias, reportes] = await Promise.all([
      this.prisma.advertencia.findMany({
        where: { tiendaId: id },
        orderBy: { creadaEn: 'desc' },
        select: {
          id: true,
          motivo: true,
          creadaEn: true,
          autor: { select: { nombre: true } },
          denuncia: { select: { codigo: true } },
        },
      }),
      this.prisma.denuncia.findMany({
        where: { tiendaDenunciadaId: id },
        orderBy: { creadaEn: 'desc' },
        take: 50,
        select: {
          id: true,
          codigo: true,
          tipo: true,
          estado: true,
          creadaEn: true,
          denunciante: { select: { tienda: { select: { nombre: true } } } },
        },
      }),
    ]);
    return {
      advertencias: advertencias.map((fila) => ({
        id: fila.id,
        motivo: fila.motivo,
        caso: fila.denuncia ? `R-${fila.denuncia.codigo}` : null,
        por: primerNombre(fila.autor.nombre),
        fecha: fila.creadaEn.toISOString(),
      })),
      reportes: reportes.map((fila) => ({
        id: fila.id,
        codigo: `R-${fila.codigo}`,
        motivo: fila.tipo ? MOTIVO[fila.tipo] : 'Reporte',
        estado: fila.estado,
        de: fila.denunciante.tienda?.nombre ?? null,
        fecha: fila.creadaEn.toISOString(),
      })),
    };
  }

  // ── Acceso ───────────────────────────────────────────────────────────────

  /**
   * Nueva contraseña de la cuenta principal. Temporal: la arma la API y pide cambiarla al entrar.
   * Definitiva: la que dicta el dueño, sin pedir cambiarla. Las dos cierran todas sus sesiones y
   * le avisan. La contraseña no queda en ningún registro.
   */
  async clave(
    id: string,
    datos: ClaveTiendaEquipo,
    sesion: SesionActiva,
  ): Promise<RespuestaClaveTienda> {
    await this.existe(id);
    const dueno = await this.dueno(id);
    if (!dueno) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esta tienda no tiene cuenta principal.',
      );
    }
    if (dueno.estado === 'SUSPENDIDO') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'La cuenta está suspendida. Reactívala antes de darle una contraseña nueva.',
      );
    }
    const temporal = datos.tipo === 'TEMPORAL';
    const clave = temporal ? generarClaveTemporal() : datos.clave;
    if (!temporal && esClaveComprometida(clave)) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Esa contraseña es muy fácil de adivinar. Pídele otra al dueño.',
      );
    }
    const ahora = new Date();
    const [, cerradas] = await this.prisma.$transaction([
      this.prisma.usuario.update({
        where: { id: dueno.id },
        data: {
          claveHash: await cifrarClave(clave),
          debeCambiarClave: temporal,
          intentosFallidos: 0,
          intentosDesde: null,
          bloqueadoHasta: null,
        },
      }),
      this.prisma.sesion.updateMany({
        where: { usuarioId: dueno.id, revocadaEn: null },
        data: { revocadaEn: ahora },
      }),
      this.prisma.auditoria.create({
        data: {
          actorId: sesion.usuario.id,
          accion: temporal ? 'clave_temporal' : 'clave_definitiva',
          objeto: 'usuario',
          objetoId: dueno.id,
          datos: {},
        },
      }),
    ]);
    await this.tiempoReal.desconectarUsuario(dueno.id);
    await this.cambio(
      sesion,
      id,
      `le puso una contraseña ${temporal ? 'temporal' : 'definitiva'} a ${dueno.usuario}`,
      {
        titulo: 'El Equipo PaseLibre cambió tu contraseña',
        extracto: 'Si no lo pediste, escríbenos.',
      },
    );
    const web = this.config.get('WEB_URL', { infer: true }).replace(/\/$/, '');
    const mensaje = [
      `Hola ${dueno.nombre}, te dejamos una contraseña nueva para PaseLibre.`,
      `Entra en ${web}/ingresar`,
      `Usuario: ${dueno.usuario}`,
      ...(temporal
        ? [`Contraseña temporal: ${clave}`, 'Al entrar te pedirá crear tu propia contraseña.']
        : ['Usa la contraseña que nos dictaste.']),
    ].join('\n');
    const whatsapp = dueno.whatsapp ?? (await this.whatsappDe(id));
    return {
      tipo: datos.tipo,
      clave_temporal: temporal ? clave : null,
      cerradas: cerradas.count,
      enlace_whatsapp: whatsapp
        ? `https://wa.me/51${whatsapp}?text=${encodeURIComponent(mensaje)}`
        : null,
    };
  }

  /** «Cerrar» una sesión de la cuenta principal desde el panel. */
  async cerrarSesion(id: string, sesionId: string, sesion: SesionActiva): Promise<FichaTienda> {
    const dueno = await this.dueno(id);
    const fila = dueno
      ? await this.prisma.sesion.findFirst({
          where: { id: sesionId, usuarioId: dueno.id, revocadaEn: null },
          select: { agente: true },
        })
      : null;
    if (!dueno || !fila) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa sesión ya está cerrada.',
      );
    }
    await this.prisma.sesion.update({ where: { id: sesionId }, data: { revocadaEn: new Date() } });
    this.tiempoReal.desconectarSesion(sesionId);
    const dispositivo = dispositivoDe(fila.agente);
    await this.cambio(sesion, id, `cerró la sesión de ${dueno.usuario} en ${dispositivo}`, {
      titulo: `El Equipo PaseLibre cerró tu sesión en ${dispositivo}`,
    });
    return this.ficha(id, sesion);
  }

  /** «Cerrar todas». */
  async cerrarTodas(id: string, sesion: SesionActiva): Promise<FichaTienda> {
    const dueno = await this.dueno(id);
    if (!dueno) throw noExiste();
    const { count } = await this.prisma.sesion.updateMany({
      where: { usuarioId: dueno.id, revocadaEn: null },
      data: { revocadaEn: new Date() },
    });
    await this.tiempoReal.desconectarUsuario(dueno.id);
    if (count > 0) {
      await this.cambio(sesion, id, `cerró las ${count} sesiones de ${dueno.usuario}`, {
        titulo: 'El Equipo PaseLibre cerró todas tus sesiones',
      });
    }
    return this.ficha(id, sesion);
  }

  /** «Límite de dispositivos ▾»: el equipo lo sube (o lo baja) a pedido de la tienda. */
  async limite(id: string, limite: number, sesion: SesionActiva): Promise<FichaTienda> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id },
      select: { nombre: true, limiteDispositivos: true },
    });
    if (!tienda) throw noExiste();
    if (tienda.limiteDispositivos !== limite) {
      await this.prisma.tienda.update({ where: { id }, data: { limiteDispositivos: limite } });
      await this.cambio(
        sesion,
        id,
        `cambió el límite de dispositivos de ${tienda.nombre} de ${tienda.limiteDispositivos} a ${limite}`,
        {
          titulo: `Tu cuenta principal ahora puede estar abierta en ${limite} ${limite === 1 ? 'dispositivo' : 'dispositivos'}`,
        },
      );
    }
    return this.ficha(id, sesion);
  }

  // ── Historial de cambios ─────────────────────────────────────────────────

  async historial(id: string): Promise<CambioDelEquipo[]> {
    await this.existe(id);
    const filas = await this.prisma.registroEquipo.findMany({
      where: { tiendaId: id },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      select: { id: true, accion: true, creadoEn: true, autor: { select: { nombre: true } } },
    });
    return filas.map((fila) => ({
      id: fila.id,
      texto: `${primerNombre(fila.autor.nombre)} ${fila.accion}`,
      fecha: fila.creadoEn.toISOString(),
    }));
  }

  private async existe(id: string): Promise<void> {
    const tienda = await this.prisma.tienda.findUnique({ where: { id }, select: { id: true } });
    if (!tienda) throw noExiste();
  }

  private async whatsappDe(id: string): Promise<string | null> {
    const tienda = await this.prisma.tienda.findUnique({
      where: { id },
      select: { whatsapp: true },
    });
    return tienda?.whatsapp ?? null;
  }
}

/** «el nombre, el piso y el stand». */
function juntar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? 'los datos';
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}
