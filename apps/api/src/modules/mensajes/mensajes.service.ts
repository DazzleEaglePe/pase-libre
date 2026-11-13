import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  EVENTOS,
  MINUTOS_PARA_CAMBIAR_MENSAJE,
  normalizarTexto,
  type AvisoCampanita,
  type CambiarConversacion,
  type ConsultaHistorial,
  type ConversacionEnLista,
  type DenunciaDatos,
  type RespuestaDenuncia,
  type DetalleConversacion,
  type EnVivoEnChat,
  type EnviarMensajeDatos,
  type EventoMensajeCambio,
  type EventoMensajeNuevo,
  type EventoMensajeRecibido,
  type EventoPresencia,
  type FiltroConversaciones,
  type InteresadoOferta,
  type MensajeChat,
  type PersonaChat,
  type RespuestaContacto,
  type RespuestaConversaciones,
  type RespuestaMensajes,
  type RespuestaPedidoWhatsapp,
  type RespuestaVendido,
  precioDe,
  TIENDA_RESERVADA,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { FOTO_DEL_PRODUCTO, PORTADA_DE_OFERTA, portadaDe } from '../../shared/portada';
import { ArchivosService } from '../archivos/archivos.service';
import { precioPara } from '../catalogo/visibilidad';
import { estadoEfectivo } from '../en-vivo/horario';
import type { UsuarioConTienda } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { AvisosService, noLeidosPorConversacion } from './avisos.service';

const MAX_CONVERSACIONES = 300;

const SELECT_PERSONA = {
  id: true,
  nombre: true,
  mostrarVisto: true,
  ultimaConexionEn: true,
  tienda: {
    select: {
      id: true,
      nombre: true,
      tipo: true,
      stand: true,
      logo: true,
      galeria: { select: { nombre: true } },
    },
  },
} satisfies Prisma.UsuarioSelect;

const SELECT_MENSAJE = {
  id: true,
  tipo: true,
  texto: true,
  foto: true,
  autorId: true,
  creadoEn: true,
  editadoEn: true,
  eliminadoEn: true,
  pedidoEstado: true,
  whatsapp: true,
  autor: { select: { nombre: true, tiendaId: true } },
  respondeA: {
    select: { id: true, texto: true, foto: true, autorId: true, eliminadoEn: true },
  },
} satisfies Prisma.MensajeSelect;

/** Editar y «Eliminar para todos»: hasta 15 minutos después de enviar (N01). */
const PLAZO_CAMBIAR_MS = MINUTOS_PARA_CAMBIAR_MENSAJE * 60_000;
/** «Deshacer» la venta (N02): el mismo plazo que tiene quien compró para reclamar. */
const PLAZO_DESHACER_VENTA_MS = 48 * 3_600_000;

const SELECT_CONVERSACION = {
  id: true,
  compradorId: true,
  vendedorId: true,
  ultimoMensajeEn: true,
  enVivoId: true,
  comprador: { select: SELECT_PERSONA },
  vendedor: { select: SELECT_PERSONA },
  oferta: {
    select: {
      id: true,
      condicion: true,
      stock: true,
      estado: true,
      tiendaId: true,
      precioCentimos: true,
      moneda: true,
      precioVisible: true,
      tiendaVisible: true,
      ...PORTADA_DE_OFERTA,
      producto: {
        select: {
          slug: true,
          titulo: true,
          categoria: { select: { slug: true, nombre: true } },
          ...FOTO_DEL_PRODUCTO,
        },
      },
    },
  },
  // El último mensaje NO va aquí: con un `take: 1` anidado Prisma trae todos los mensajes de
  // cada hilo y corta en memoria. Lo busca `ultimos()` con DISTINCT ON.
} satisfies Prisma.ConversacionSelect;

const SELECT_PARTICIPACION = {
  archivada: true,
  silenciada: true,
  noLeidaManual: true,
  conversacion: { select: SELECT_CONVERSACION },
} satisfies Prisma.ParticipacionSelect;

type PersonaFila = Prisma.UsuarioGetPayload<{ select: typeof SELECT_PERSONA }>;
type MensajeFila = Prisma.MensajeGetPayload<{ select: typeof SELECT_MENSAJE }>;
type ParticipacionFila = Prisma.ParticipacionGetPayload<{ select: typeof SELECT_PARTICIPACION }>;

/**
 * El otro del chat. `reservada`: es quien vende una oferta con la tienda reservada y mira
 * quien compra; no ve su nombre, ni el de su tienda, ni el stand. La galería sí.
 */
function persona(u: PersonaFila, reservada = false): PersonaChat {
  if (reservada) {
    return {
      // Ni el id: cruzándolo con los chats de sus ofertas visibles delataría a la tienda.
      id: '',
      nombre: TIENDA_RESERVADA,
      tienda: {
        id: '',
        nombre: TIENDA_RESERVADA,
        tipo: u.tienda?.tipo ?? 'INDEPENDIENTE',
        galeria: u.tienda?.galeria?.nombre ?? null,
        stand: null,
        // Ni el logo: es la tienda a la vista.
        logo: null,
      },
    };
  }
  return {
    id: u.id,
    nombre: u.nombre,
    tienda: {
      id: u.tienda?.id ?? '',
      nombre: u.tienda?.nombre ?? u.nombre,
      tipo: u.tienda?.tipo ?? 'INDEPENDIENTE',
      galeria: u.tienda?.galeria?.nombre ?? null,
      stand: u.tienda?.stand ?? null,
      logo: u.tienda?.logo ?? null,
    },
  };
}

/** Lo que hace falta saber del hilo para armar cada mensaje como lo ve una persona. */
export interface ContextoMensajes {
  /** La venta más reciente del hilo: lo escrito hasta ahí ya no se edita ni se elimina. */
  cerradaEn?: Date | null;
  /** Tiendas con asesores: sus mensajes dicen quién los escribió («17:20 · Luis»). */
  conAsesores?: ReadonlySet<string>;
  /** Quien mira habla con una tienda reservada: no se nombra a nadie de ella. */
  sinNombres?: boolean;
  ahora?: Date;
}

/** «Luis Quispe» → «Luis». */
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre;

export function mensajeChat(
  m: MensajeFila,
  usuarioId: string,
  contexto: ContextoMensajes = {},
): MensajeChat {
  const mio = m.autorId === usuarioId;
  const eliminado = m.eliminadoEn !== null;
  const ahora = contexto.ahora ?? new Date();
  const hasta = new Date(m.creadoEn.getTime() + PLAZO_CAMBIAR_MS);
  const cambiable =
    mio &&
    !eliminado &&
    (m.tipo === 'TEXTO' || m.tipo === 'FOTO') &&
    hasta > ahora &&
    !(contexto.cerradaEn && m.creadoEn <= contexto.cerradaEn);
  const tiendaDelAutor = m.autor?.tiendaId;
  const cita = m.respondeA;
  return {
    id: m.id,
    tipo: m.tipo,
    texto: eliminado ? null : m.texto,
    foto: eliminado ? null : m.foto,
    mio,
    creado_en: m.creadoEn.toISOString(),
    editado: m.editadoEn !== null && !eliminado,
    eliminado,
    cambiable_hasta: cambiable ? hasta.toISOString() : null,
    autor:
      !mio && m.autor && tiendaDelAutor && !contexto.sinNombres
        ? contexto.conAsesores?.has(tiendaDelAutor)
          ? primerNombre(m.autor.nombre)
          : null
        : null,
    responde_a: cita
      ? {
          id: cita.id,
          texto: cita.eliminadoEn ? null : cita.texto,
          foto: cita.eliminadoEn ? null : cita.foto,
          mio: cita.autorId === usuarioId,
          eliminado: cita.eliminadoEn !== null,
        }
      : null,
    pedido: m.tipo === 'PEDIDO_WHATSAPP' ? (m.pedidoEstado ?? 'PENDIENTE') : null,
    whatsapp: m.tipo === 'WHATSAPP' && !eliminado ? m.whatsapp : null,
  };
}

const noExiste = () =>
  new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta conversación no existe.');

/**
 * Mensajes (docs/05 §8, RF-39, RF-55 a RF-57, RF-71). Cada hilo es entre quien pregunta
 * por una oferta y su responsable: nadie más lo ve, ni el dueño de la tienda ni el equipo
 * (RNF-44). Todo se busca a partir de la participación de quien mira, así una
 * conversación ajena responde 404.
 */
@Injectable()
export class MensajesService implements OnModuleInit {
  private readonly logger = new Logger(MensajesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  onModuleInit(): void {
    this.tiempoReal.alCambiarPresencia((tiendaId, enLinea) => {
      this.difundirPresencia(tiendaId, enLinea).catch((error: unknown) =>
        this.logger.warn(`No se pudo avisar la presencia: ${String(error)}`),
      );
    });
    this.tiempoReal.alConectar((usuarioId) => {
      this.marcarRecibidos(usuarioId).catch((error: unknown) =>
        this.logger.warn(`No se pudieron marcar los mensajes recibidos: ${String(error)}`),
      );
    });
  }

  // ── En línea y «le llegó» (N01) ───────────────────────────────────────────

  /**
   * El puntito verde y «Activo hace 2 min» de una tienda, solo a las tiendas que hablan con
   * ella y la conocen: quien le pregunta por una publicación reservada nunca recibe su id.
   */
  private async difundirPresencia(tiendaId: string, enLinea: boolean): Promise<void> {
    const [comoVendedora, comoCompradora, ultima] = await Promise.all([
      this.prisma.conversacion.findMany({
        where: { tiendaVendedoraId: tiendaId, oferta: { tiendaVisible: true } },
        distinct: ['tiendaCompradoraId'],
        select: { tiendaCompradoraId: true },
      }),
      this.prisma.conversacion.findMany({
        where: { tiendaCompradoraId: tiendaId },
        distinct: ['tiendaVendedoraId'],
        select: { tiendaVendedoraId: true },
      }),
      enLinea ? null : this.ultimaConexion(tiendaId),
    ]);
    const destinos = new Set([
      ...comoVendedora.map((c) => c.tiendaCompradoraId),
      ...comoCompradora.map((c) => c.tiendaVendedoraId),
    ]);
    destinos.delete(tiendaId);
    const evento: EventoPresencia = {
      tienda_id: tiendaId,
      en_linea: enLinea,
      ultima_conexion: ultima?.toISOString() ?? null,
    };
    for (const destino of destinos) {
      this.tiempoReal.emitirATienda(destino, EVENTOS.presencia, evento);
    }
  }

  /** La última vez que alguien de la tienda tuvo PaseLibre abierto. */
  private async ultimaConexion(tiendaId: string): Promise<Date | null> {
    const fila = await this.prisma.usuario.aggregate({
      where: { tiendaId },
      _max: { ultimaConexionEn: true },
    });
    return fila._max.ultimaConexionEn;
  }

  /**
   * Al conectarse, todo lo que le habían escrito ya le llegó: dos checks grises para quien lo
   * envió, al momento.
   */
  private async marcarRecibidos(usuarioId: string): Promise<void> {
    const filas = await this.prisma.$queryRaw<
      Array<{ conversacion_id: string; otro_id: string; recibido_hasta: Date }>
    >`
      UPDATE participacion p SET recibido_hasta = now()
      FROM conversacion c
      WHERE p.usuario_id = ${usuarioId}::uuid
        AND c.id = p.conversacion_id
        AND c.ultimo_mensaje_en > coalesce(p.recibido_hasta, '-infinity'::timestamptz)
      RETURNING p.conversacion_id::text AS conversacion_id,
        (CASE WHEN c.comprador_id = p.usuario_id THEN c.vendedor_id ELSE c.comprador_id END)::text
          AS otro_id,
        p.recibido_hasta`;
    for (const fila of filas) {
      const evento: EventoMensajeRecibido = {
        conversacion_id: fila.conversacion_id,
        recibido_hasta: fila.recibido_hasta.toISOString(),
      };
      this.tiempoReal.emitirAUsuario(fila.otro_id, EVENTOS.mensajeRecibido, evento);
    }
  }

  // ── Contactar desde la ficha (RF-21, RF-23) ────────────────────────────────

  async contactar(
    ofertaId: string,
    canal: 'CHAT' | 'WHATSAPP',
    usuario: UsuarioConTienda,
  ): Promise<RespuestaContacto> {
    const tiendaId = usuario.tiendaId ?? '';
    const oferta = await this.prisma.oferta.findFirst({
      where: { id: ofertaId, estado: 'ACTIVA', tienda: { estado: 'ACTIVA' } },
      select: {
        tiendaId: true,
        responsableId: true,
        tiendaVisible: true,
        tienda: { select: { whatsapp: true } },
        responsable: { select: { whatsapp: true } },
        producto: { select: { titulo: true } },
      },
    });
    if (!oferta) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esta publicación ya no está disponible.',
      );
    }
    if (oferta.tiendaId === tiendaId) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Es una publicación de tu tienda.',
      );
    }
    const bloqueo = await this.prisma.bloqueo.findUnique({
      where: {
        usuarioId_tiendaBloqueadaId: {
          usuarioId: oferta.responsableId,
          tiendaBloqueadaId: tiendaId,
        },
      },
    });
    if (bloqueo) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'BLOQUEADO',
        'No puedes contactar a esta tienda.',
      );
    }

    // El WhatsApp de la tienda es opcional desde la 1.10.0 (doc 19, punto 6): sin él, por chat.
    const numero = oferta.responsable.whatsapp ?? oferta.tienda.whatsapp;
    if (canal === 'WHATSAPP' && oferta.tiendaVisible && !numero) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esta tienda todavía no tiene WhatsApp. Escríbele por el chat.',
      );
    }

    // RF-23: se registra el clic, nunca el contenido de la conversación.
    await this.prisma.contacto.create({ data: { ofertaId, usuarioId: usuario.id, canal } });

    if (canal === 'WHATSAPP') {
      // El número delataría a la tienda reservada: con ella se escribe solo por chat.
      if (!oferta.tiendaVisible || !numero) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Esta tienda atiende solo por el chat de PaseLibre.',
        );
      }
      const texto = `Vi que tienes ${oferta.producto.titulo} publicado en PaseLibre, ¿a qué precio lo tienes?`;
      return { canal, enlace: `https://wa.me/51${numero}?text=${encodeURIComponent(texto)}` };
    }

    const existente = await this.prisma.conversacion.findUnique({
      where: { ofertaId_compradorId: { ofertaId, compradorId: usuario.id } },
      select: { id: true },
    });
    if (existente) {
      await this.prisma.participacion.updateMany({
        where: { conversacionId: existente.id, usuarioId: usuario.id },
        data: { archivada: false },
      });
      return { canal, conversacion_id: existente.id };
    }
    try {
      const creada = await this.prisma.conversacion.create({
        data: {
          ofertaId,
          compradorId: usuario.id,
          vendedorId: oferta.responsableId,
          tiendaCompradoraId: tiendaId,
          tiendaVendedoraId: oferta.tiendaId,
          participaciones: {
            create: [{ usuarioId: usuario.id }, { usuarioId: oferta.responsableId }],
          },
        },
        select: { id: true },
      });
      return { canal, conversacion_id: creada.id };
    } catch (error) {
      // Dos clics a la vez: el segundo encuentra la que creó el primero.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const otra = await this.prisma.conversacion.findUniqueOrThrow({
          where: { ofertaId_compradorId: { ofertaId, compradorId: usuario.id } },
          select: { id: true },
        });
        return { canal, conversacion_id: otra.id };
      }
      throw error;
    }
  }

  // ── Lista y detalle ───────────────────────────────────────────────────────

  /**
   * Mensajes · lista (RF-55). Solo hilos con al menos un mensaje: abrir el chat y no
   * escribir no le llena la bandeja a nadie.
   */
  async lista(filtro: FiltroConversaciones, usuarioId: string): Promise<RespuestaConversaciones> {
    const [participaciones, noLeidos] = await Promise.all([
      this.prisma.participacion.findMany({
        where: { usuarioId, conversacion: { mensajes: { some: {} } } },
        select: SELECT_PARTICIPACION,
        orderBy: { conversacion: { ultimoMensajeEn: 'desc' } },
        take: MAX_CONVERSACIONES,
      }),
      noLeidosPorConversacion(this.prisma, usuarioId),
    ]);
    const ultimos = await this.ultimos(
      participaciones.map((p) => p.conversacion.id),
      usuarioId,
    );
    const todas = participaciones.map((p) =>
      this.enLista(
        p,
        usuarioId,
        noLeidos.get(p.conversacion.id) ?? 0,
        ultimos.get(p.conversacion.id),
      ),
    );
    const sinLeer = (c: ConversacionEnLista) => c.no_leidos > 0 || c.no_leida;
    const conteos = {
      todas: todas.filter((c) => !c.archivada).length,
      no_leidas: todas.filter((c) => !c.archivada && sinLeer(c)).length,
      pases: todas.filter((c) => !c.archivada && c.pase_del_dia).length,
      archivadas: todas.filter((c) => c.archivada).length,
    };

    const palabras = normalizarTexto(filtro.q).split(' ').filter(Boolean);
    const coincide = (c: ConversacionEnLista) => {
      const texto = ` ${normalizarTexto(`${c.otro.tienda.nombre} ${c.otro.nombre} ${c.oferta.producto.titulo}`)}`;
      return palabras.every((p) => texto.includes(` ${p}`));
    };
    const conversaciones = todas.filter(
      (c) =>
        (filtro.filtro === 'archivadas'
          ? c.archivada
          : !c.archivada &&
            (filtro.filtro === 'todas' ||
              (filtro.filtro === 'pases' ? c.pase_del_dia : sinLeer(c)))) && coincide(c),
    );
    return { conversaciones, conteos };
  }

  async detalle(id: string, usuario: UsuarioConTienda): Promise<DetalleConversacion> {
    const participacion = await this.participacion(id, usuario.id);
    const noLeidos = await noLeidosPorConversacion(this.prisma, usuario.id, id);
    const ultimos = await this.ultimos([id], usuario.id);
    const base = this.enLista(participacion, usuario.id, noLeidos.get(id) ?? 0, ultimos.get(id));
    const { conversacion } = participacion;
    const otro = base.rol === 'vendedor' ? conversacion.comprador : conversacion.vendedor;
    const { oferta } = conversacion;

    const bloqueo = otro.tienda
      ? await this.prisma.bloqueo.findUnique({
          where: {
            usuarioId_tiendaBloqueadaId: {
              usuarioId: usuario.id,
              tiendaBloqueadaId: otro.tienda.id,
            },
          },
        })
      : null;

    // «En línea» y «Activo hace 2 h» también servirían para adivinar quién es.
    const reservada = base.rol === 'comprador' && !oferta.tiendaVisible;
    const otraTiendaId = reservada ? null : (otro.tienda?.id ?? null);
    const [hablanDe, venta, sobreTienda, ultimaConexion, whatsapp] = await Promise.all([
      this.hablanDe(id, usuario, otraTiendaId),
      this.ventaDelHilo(id, usuario),
      otraTiendaId ? this.sobreTienda(otraTiendaId) : null,
      // N01: la tienda está activa si alguna de sus personas lo está.
      otraTiendaId ? this.ultimaConexion(otraTiendaId) : null,
      this.whatsappDelHilo(id, usuario.id, otro.id, {
        reservadaElOtro: reservada,
        reservadaYo: base.rol === 'vendedor' && !oferta.tiendaVisible,
      }),
    ]);
    return {
      ...base,
      otro: {
        ...base.otro,
        en_linea: otraTiendaId ? this.tiempoReal.tiendaEnLinea(otraTiendaId) : false,
        ultima_conexion: ultimaConexion?.toISOString() ?? null,
      },
      oferta: {
        ...base.oferta,
        stock: oferta.stock,
        estado: oferta.estado,
        precio: precioPara(oferta, {
          audiencia: 'vendedor',
          tiendaId: usuario.tiendaId,
          usuarioId: usuario.id,
        }),
        precio_visible: oferta.precioVisible,
      },
      bloqueaste: Boolean(bloqueo),
      puede_vender: base.rol === 'vendedor' && oferta.estado !== 'ELIMINADA' && oferta.stock > 0,
      en_vivo: conversacion.enVivoId
        ? await this.enVivoDelHilo(conversacion.enVivoId, usuario.id)
        : null,
      hablan_de: hablanDe,
      venta,
      sobre_tienda: sobreTienda,
      whatsapp,
    };
  }

  /** «Pedir WhatsApp» / «Compartir mi WhatsApp» (N01): qué se puede hacer en este hilo. */
  private async whatsappDelHilo(
    id: string,
    usuarioId: string,
    otroId: string,
    reservas: { reservadaElOtro: boolean; reservadaYo: boolean },
  ): Promise<DetalleConversacion['whatsapp']> {
    const [suyo, pendientes] = await Promise.all([
      this.prisma.mensaje.findFirst({
        where: { conversacionId: id, tipo: 'WHATSAPP', autorId: otroId, eliminadoEn: null },
        orderBy: { creadoEn: 'desc' },
        select: { whatsapp: true },
      }),
      this.prisma.mensaje.count({
        where: {
          conversacionId: id,
          tipo: 'PEDIDO_WHATSAPP',
          autorId: usuarioId,
          pedidoEstado: 'PENDIENTE',
        },
      }),
    ]);
    const numero = suyo?.whatsapp ?? null;
    return {
      suyo: numero,
      pedido_pendiente: pendientes > 0,
      puedes_pedir: !reservas.reservadaElOtro && !numero,
      puedes_compartir: !reservas.reservadaYo,
    };
  }

  /**
   * «Hablan de» (PCH_WebTienda): los hilos de quien mira con esa tienda, de un lado o del otro,
   * del más reciente al más viejo y con este primero. Lo que esa tienda vende en reservado no
   * entra: la delataría.
   */
  private async hablanDe(
    id: string,
    usuario: UsuarioConTienda,
    otraTiendaId: string | null,
  ): Promise<DetalleConversacion['hablan_de']> {
    const miTienda = usuario.tiendaId ?? '';
    const filas = await this.prisma.conversacion.findMany({
      where: otraTiendaId
        ? {
            participaciones: { some: { usuarioId: usuario.id } },
            OR: [
              { id },
              {
                tiendaCompradoraId: miTienda,
                tiendaVendedoraId: otraTiendaId,
                oferta: { tiendaVisible: true },
              },
              { tiendaVendedoraId: miTienda, tiendaCompradoraId: otraTiendaId },
            ],
          }
        : { id },
      orderBy: { ultimoMensajeEn: 'desc' },
      take: 8,
      select: {
        id: true,
        ultimoMensajeEn: true,
        oferta: {
          select: {
            tiendaId: true,
            precioCentimos: true,
            moneda: true,
            precioVisible: true,
            ...PORTADA_DE_OFERTA,
            producto: {
              select: {
                titulo: true,
                categoria: { select: { slug: true } },
                ...FOTO_DEL_PRODUCTO,
              },
            },
          },
        },
      },
    });
    const mirada = {
      audiencia: 'vendedor' as const,
      tiendaId: usuario.tiendaId,
      usuarioId: usuario.id,
    };
    const lista = filas.map((fila) => ({
      conversacion_id: fila.id,
      titulo: fila.oferta.producto.titulo,
      foto: portadaDe(fila.oferta),
      categoria: fila.oferta.producto.categoria.slug,
      precio: precioPara(fila.oferta, mirada),
      actualizada_en: fila.ultimoMensajeEn.toISOString(),
    }));
    return [
      ...lista.filter((hilo) => hilo.conversacion_id === id),
      ...lista.filter((hilo) => hilo.conversacion_id !== id),
    ];
  }

  /** «Venta cerrada» (PCH_WebPorConfirmar) y si quien mira ya calificó (PCH_WebCalificar). */
  private async ventaDelHilo(
    id: string,
    usuario: UsuarioConTienda,
  ): Promise<DetalleConversacion['venta']> {
    const venta = await this.prisma.venta.findFirst({
      where: { conversacionId: id },
      orderBy: { creadaEn: 'desc' },
      select: {
        id: true,
        creadaEn: true,
        precioCentimos: true,
        moneda: true,
        tiendaCompradoraId: true,
        conversacion: { select: { vendedorId: true } },
        opiniones: { select: { autorTiendaId: true, lado: true } },
      },
    });
    if (!venta) return null;
    const miLado = venta.tiendaCompradoraId === usuario.tiendaId ? 'comprador' : 'vendedor';
    return {
      id: venta.id,
      precio:
        venta.precioCentimos === null || venta.moneda === null
          ? null
          : precioDe(Number(venta.precioCentimos), venta.moneda),
      fecha: venta.creadaEn.toISOString(),
      mi_lado: miLado,
      calificaste: venta.opiniones.some((o) => o.autorTiendaId === usuario.tiendaId),
      reclamo_hasta: new Date(venta.creadaEn.getTime() + 48 * 3_600_000).toISOString(),
      puede_deshacer:
        miLado === 'vendedor' &&
        venta.conversacion?.vendedorId === usuario.id &&
        Date.now() - venta.creadaEn.getTime() < PLAZO_DESHACER_VENTA_MS &&
        !venta.opiniones.some((o) => o.lado === 'COMPRADOR'),
    };
  }

  /** «Cyberplaza · Piso 2 · Stand 118», horario, cómo llegar y sus estrellas. */
  private async sobreTienda(tiendaId: string): Promise<DetalleConversacion['sobre_tienda']> {
    const [tienda, opiniones] = await Promise.all([
      this.prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: {
          piso: true,
          stand: true,
          horario: true,
          indicaciones: true,
          galeria: { select: { nombre: true } },
        },
      }),
      this.prisma.opinion.aggregate({
        where: { tiendaId },
        _avg: { estrellas: true },
        _count: { _all: true },
      }),
    ]);
    if (!tienda) return null;
    const promedio = opiniones._avg.estrellas;
    return {
      galeria: tienda.galeria?.nombre ?? null,
      piso: tienda.piso,
      stand: tienda.stand,
      horario: tienda.horario,
      indicaciones: tienda.indicaciones,
      estrellas: promedio === null ? null : Math.round(promedio * 10) / 10,
      opiniones: opiniones._count._all,
    };
  }

  /** La tarjeta del busco o la oferta flash de la que nació el hilo (D-53). */
  private async enVivoDelHilo(id: string, usuarioId: string): Promise<EnVivoEnChat | null> {
    const fila = await this.prisma.enVivo.findUnique({
      where: { id },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        estado: true,
        venceEn: true,
        cantidad: true,
        precioCentimos: true,
        moneda: true,
        autorId: true,
      },
    });
    if (!fila) return null;
    const estado = estadoEfectivo(fila, new Date());
    return {
      id: fila.id,
      tipo: fila.tipo,
      titulo: fila.titulo,
      estado,
      vence_en: fila.venceEn.toISOString(),
      cantidad: fila.cantidad,
      precio:
        fila.precioCentimos === null ? null : precioDe(Number(fila.precioCentimos), fila.moneda),
      puede_cerrar: fila.autorId === usuarioId && estado === 'VIVO',
    };
  }

  private async participacion(
    conversacionId: string,
    usuarioId: string,
  ): Promise<ParticipacionFila> {
    const participacion = await this.prisma.participacion.findUnique({
      where: { conversacionId_usuarioId: { conversacionId, usuarioId } },
      select: SELECT_PARTICIPACION,
    });
    if (!participacion) throw noExiste();
    return participacion;
  }

  /**
   * El último mensaje de cada hilo que la persona todavía ve («Eliminar para mí» lo saca): una
   * consulta por el índice (conversacion_id, creado_en).
   */
  private async ultimos(ids: string[], usuarioId: string): Promise<Map<string, MensajeFila>> {
    if (ids.length === 0) return new Map();
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ON (conversacion_id) id::text AS id
      FROM mensaje
      WHERE conversacion_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        AND NOT (${usuarioId}::uuid = ANY(coalesce(oculto_para, '{}')))
      ORDER BY conversacion_id, creado_en DESC, id DESC`;
    if (filas.length === 0) return new Map();
    const mensajes = await this.prisma.mensaje.findMany({
      where: { id: { in: filas.map((f) => f.id) } },
      select: { ...SELECT_MENSAJE, conversacionId: true },
    });
    return new Map(mensajes.map((m) => [m.conversacionId, m]));
  }

  private enLista(
    p: ParticipacionFila,
    usuarioId: string,
    noLeidos: number,
    ultimo: MensajeFila | undefined,
  ): ConversacionEnLista {
    const c = p.conversacion;
    const rol = c.vendedorId === usuarioId ? 'vendedor' : 'comprador';
    const reservada = rol === 'comprador' && !c.oferta.tiendaVisible;
    const otro = rol === 'vendedor' ? c.comprador : c.vendedor;
    return {
      id: c.id,
      rol,
      otro: {
        ...persona(otro, reservada),
        // El puntito verde también serviría para adivinar quién es la reservada.
        en_linea:
          !reservada && Boolean(otro.tienda && this.tiempoReal.tiendaEnLinea(otro.tienda.id)),
      },
      oferta: {
        id: c.oferta.id,
        condicion: c.oferta.condicion,
        producto: {
          slug: c.oferta.producto.slug,
          titulo: c.oferta.producto.titulo,
          foto: portadaDe(c.oferta),
          categoria: c.oferta.producto.categoria,
        },
      },
      ultimo_mensaje: ultimo ? mensajeChat(ultimo, usuarioId) : null,
      no_leidos: noLeidos,
      no_leida: p.noLeidaManual,
      silenciada: p.silenciada,
      archivada: p.archivada,
      pase_del_dia: c.enVivoId !== null,
      actualizada_en: c.ultimoMensajeEn.toISOString(),
    };
  }

  // ── Historial y envío (RF-39) ─────────────────────────────────────────────

  /**
   * Cómo ve una persona los mensajes de este hilo (N01, N12): desde cuándo ya no se cambian
   * (la última venta) y si los de la otra tienda dicen quién los escribió.
   */
  private async contexto(
    conversacion: ParticipacionFila['conversacion'],
    usuarioId: string,
  ): Promise<ContextoMensajes> {
    const soyComprador = conversacion.compradorId === usuarioId;
    const otro = soyComprador ? conversacion.vendedor : conversacion.comprador;
    const sinNombres = soyComprador && !conversacion.oferta.tiendaVisible;
    const [venta, conAsesores] = await Promise.all([
      this.prisma.venta.findFirst({
        where: { conversacionId: conversacion.id },
        orderBy: { creadaEn: 'desc' },
        select: { creadaEn: true },
      }),
      sinNombres || !otro.tienda ? new Set<string>() : this.tiendasConAsesores([otro.tienda.id]),
    ]);
    return { cerradaEn: venta?.creadaEn ?? null, conAsesores, sinNombres };
  }

  /** «Cada mensaje dice quién lo escribió» (N12): en las tiendas con más de una persona. */
  private async tiendasConAsesores(tiendaIds: string[]): Promise<Set<string>> {
    const filas = await this.prisma.usuario.groupBy({
      by: ['tiendaId'],
      where: { tiendaId: { in: tiendaIds } },
      _count: { _all: true },
    });
    return new Set(
      filas.filter((f) => f.tiendaId && f._count._all > 1).map((f) => f.tiendaId as string),
    );
  }

  async mensajes(
    id: string,
    consulta: ConsultaHistorial,
    usuarioId: string,
  ): Promise<RespuestaMensajes> {
    const { conversacion } = await this.participacion(id, usuarioId);
    const otroId =
      conversacion.compradorId === usuarioId ? conversacion.vendedorId : conversacion.compradorId;
    const [filas, yo, delOtro, contexto] = await Promise.all([
      this.prisma.mensaje.findMany({
        where: {
          conversacionId: id,
          NOT: { ocultoPara: { has: usuarioId } },
          ...(consulta.antes ? { creadoEn: { lt: new Date(consulta.antes) } } : {}),
        },
        orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
        take: consulta.limite + 1,
        select: SELECT_MENSAJE,
      }),
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: usuarioId },
        select: { mostrarVisto: true },
      }),
      this.prisma.participacion.findUnique({
        where: { conversacionId_usuarioId: { conversacionId: id, usuarioId: otroId } },
        select: {
          leidoHasta: true,
          recibidoHasta: true,
          usuario: { select: { mostrarVisto: true } },
        },
      }),
      this.contexto(conversacion, usuarioId),
    ]);
    const hayMas = filas.length > consulta.limite;
    const pagina = filas.slice(0, consulta.limite).reverse();
    // El «Visto» se ve solo si los dos lo tienen activado (RF-57).
    const visto =
      yo.mostrarVisto && delOtro?.usuario.mostrarVisto ? (delOtro.leidoHasta ?? null) : null;
    // Leer es haber recibido: con el «Visto» apagado, sus checks quedan en dos grises (N01).
    const recibido = [delOtro?.recibidoHasta, delOtro?.leidoHasta]
      .filter((fecha): fecha is Date => fecha instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      mensajes: pagina.map((m) => mensajeChat(m, usuarioId, contexto)),
      hay_mas: hayMas,
      visto_hasta: visto?.toISOString() ?? null,
      recibido_hasta: recibido?.toISOString() ?? null,
    };
  }

  /** Bloqueos de los dos lados (docs/05 §8): el bloqueado recibe el error; al otro no se le avisa nada. */
  private async revisarBloqueos(
    conversacion: ParticipacionFila['conversacion'],
    usuario: UsuarioConTienda,
  ): Promise<void> {
    const otro =
      conversacion.compradorId === usuario.id ? conversacion.vendedor : conversacion.comprador;
    const bloqueos = await this.prisma.bloqueo.findMany({
      where: {
        OR: [
          { usuarioId: otro.id, tiendaBloqueadaId: usuario.tiendaId ?? '' },
          { usuarioId: usuario.id, tiendaBloqueadaId: otro.tienda?.id ?? '' },
        ],
      },
      select: { usuarioId: true },
    });
    if (bloqueos.some((b) => b.usuarioId === otro.id)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'BLOQUEADO',
        'No puedes escribir en esta conversación.',
      );
    }
    if (bloqueos.length > 0) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Bloqueaste a esta tienda. Desbloquéala para escribirle.',
      );
    }
  }

  /** Si escribe quien vende una oferta con la tienda reservada, el aviso no dice quién es. */
  private remitente(
    conversacion: ParticipacionFila['conversacion'],
    usuario: UsuarioConTienda,
  ): string {
    return conversacion.vendedorId === usuario.id && !conversacion.oferta.tiendaVisible
      ? TIENDA_RESERVADA
      : (usuario.tienda?.nombre ?? usuario.nombre);
  }

  async enviar(
    id: string,
    datos: EnviarMensajeDatos,
    usuario: UsuarioConTienda,
  ): Promise<MensajeChat> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const soyComprador = conversacion.compradorId === usuario.id;
    const otro = soyComprador ? conversacion.vendedor : conversacion.comprador;
    const miTiendaId = usuario.tiendaId ?? '';
    await this.revisarBloqueos(conversacion, usuario);

    // «Responder» (N01): a un mensaje de este mismo hilo que todavía se ve.
    if (datos.responde_a) {
      const citado = await this.prisma.mensaje.count({
        where: {
          id: datos.responde_a,
          conversacionId: id,
          eliminadoEn: null,
          NOT: { ocultoPara: { has: usuario.id } },
        },
      });
      if (!citado) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ese mensaje ya no está. Escribe sin responderlo.',
        );
      }
    }

    const remitente = this.remitente(conversacion, usuario);
    const leLlega = this.tiempoReal.tieneSocket(otro.id);
    const { mensaje, aviso } = await this.prisma.$transaction(async (tx) => {
      if (datos.foto) await this.archivos.reclamar(tx, [datos.foto], miTiendaId);
      const mensaje = await tx.mensaje.create({
        data: {
          conversacionId: id,
          autorId: usuario.id,
          tipo: datos.foto ? 'FOTO' : 'TEXTO',
          texto: datos.texto ?? null,
          foto: datos.foto ?? null,
          respondeAId: datos.responde_a ?? null,
        },
        select: SELECT_MENSAJE,
      });
      const aviso = await this.registrarEnvio(tx, {
        conversacionId: id,
        mensaje,
        usuarioId: usuario.id,
        otroId: otro.id,
        leLlega,
        remitente,
        extracto: datos.texto ? `«${datos.texto}»` : 'Te envió una foto.',
      });
      return { mensaje, aviso };
    });

    await this.difundir(conversacion, mensaje, usuario, otro.id, leLlega);
    if (aviso) this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.avisoNuevo, aviso);
    return mensajeChat(mensaje, usuario.id);
  }

  /**
   * Lo que pasa con cada mensaje nuevo de una persona, dentro de su transacción: el hilo sube,
   * quien escribe ya leyó todo, a quien recibe el hilo le vuelve a la bandeja (y le llegó si
   * tiene PaseLibre abierto), y su aviso en la campanita.
   */
  private async registrarEnvio(
    tx: Prisma.TransactionClient,
    datos: {
      conversacionId: string;
      mensaje: MensajeFila;
      usuarioId: string;
      otroId: string;
      leLlega: boolean;
      remitente: string;
      extracto: string;
    },
  ): Promise<AvisoCampanita | null> {
    const { conversacionId, mensaje } = datos;
    await tx.conversacion.update({
      where: { id: conversacionId },
      data: { ultimoMensajeEn: mensaje.creadoEn },
    });
    await tx.participacion.update({
      where: { conversacionId_usuarioId: { conversacionId, usuarioId: datos.usuarioId } },
      data: { leidoHasta: mensaje.creadoEn, noLeidaManual: false, archivada: false },
    });
    await tx.participacion.update({
      where: { conversacionId_usuarioId: { conversacionId, usuarioId: datos.otroId } },
      data: { archivada: false, ...(datos.leLlega ? { recibidoHasta: mensaje.creadoEn } : {}) },
    });
    return this.avisos.porMensaje(tx, {
      destinatarioId: datos.otroId,
      conversacionId,
      remitente: datos.remitente,
      extracto: datos.extracto,
    });
  }

  /**
   * `mensaje:nuevo` a las dos personas, cada una con su «mío» (y quien lo recibe, con el nombre
   * de quien lo escribió si su tienda tiene asesores). Si ya le llegó, dos checks grises.
   */
  private async difundir(
    conversacion: ParticipacionFila['conversacion'],
    mensaje: MensajeFila,
    usuario: UsuarioConTienda,
    otroId: string,
    leLlega: boolean,
  ): Promise<void> {
    const conAsesores = usuario.tiendaId
      ? await this.tiendasConAsesores([usuario.tiendaId])
      : new Set<string>();
    const sinNombres = conversacion.vendedorId === usuario.id && !conversacion.oferta.tiendaVisible;
    this.emitirNuevo(conversacion.id, mensaje, usuario.id);
    this.emitirNuevo(conversacion.id, mensaje, otroId, { conAsesores, sinNombres });
    if (leLlega) {
      const evento: EventoMensajeRecibido = {
        conversacion_id: conversacion.id,
        recibido_hasta: mensaje.creadoEn.toISOString(),
      };
      this.tiempoReal.emitirAUsuario(usuario.id, EVENTOS.mensajeRecibido, evento);
    }
  }

  private emitirNuevo(
    conversacionId: string,
    mensaje: MensajeFila,
    usuarioId: string,
    contexto: ContextoMensajes = {},
  ): void {
    const evento: EventoMensajeNuevo = {
      conversacion_id: conversacionId,
      mensaje: mensajeChat(mensaje, usuarioId, contexto),
    };
    this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.mensajeNuevo, evento);
    this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.contadores);
  }

  /** `mensaje:cambio` a las dos personas (o solo a una, con «Eliminar para mí»). */
  private emitirCambio(
    conversacion: ParticipacionFila['conversacion'],
    mensaje: MensajeFila,
    personas: string[],
  ): void {
    for (const usuarioId of personas) {
      const sinNombres =
        conversacion.compradorId === usuarioId && !conversacion.oferta.tiendaVisible;
      const evento: EventoMensajeCambio = {
        conversacion_id: conversacion.id,
        mensaje_id: mensaje.id,
        // Los asesores no cambian al editar: el nombre lo vuelve a poner el historial.
        mensaje: mensajeChat(mensaje, usuarioId, { sinNombres }),
      };
      this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.mensajeCambio, evento);
    }
  }

  // ── Editar y eliminar (N01) ───────────────────────────────────────────────

  /** Un mensaje del hilo que la persona todavía ve. */
  private async mensajeDelHilo(
    conversacionId: string,
    mensajeId: string,
    usuarioId: string,
  ): Promise<MensajeFila> {
    const mensaje = await this.prisma.mensaje.findFirst({
      where: { id: mensajeId, conversacionId, NOT: { ocultoPara: { has: usuarioId } } },
      select: SELECT_MENSAJE,
    });
    if (!mensaje) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Este mensaje ya no está.');
    }
    return mensaje;
  }

  /**
   * Editar y «Eliminar para todos» (N01): solo lo propio, dentro de los 15 minutos, y nunca lo
   * que ya es de una venta cerrada.
   */
  private async revisarQueSeCambia(
    conversacion: ParticipacionFila['conversacion'],
    mensaje: MensajeFila,
    usuarioId: string,
  ): Promise<void> {
    if (mensaje.autorId !== usuarioId || (mensaje.tipo !== 'TEXTO' && mensaje.tipo !== 'FOTO')) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'Solo puedes cambiar los mensajes que escribiste.',
      );
    }
    if (mensaje.eliminadoEn) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya eliminaste este mensaje.');
    }
    const venta = await this.prisma.venta.findFirst({
      where: { conversacionId: conversacion.id, creadaEn: { gte: mensaje.creadoEn } },
      select: { id: true },
    });
    if (venta) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Es parte de una venta cerrada: ya no se puede cambiar.',
      );
    }
    if (Date.now() - mensaje.creadoEn.getTime() > PLAZO_CAMBIAR_MS) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        `Pasaron más de ${MINUTOS_PARA_CAMBIAR_MENSAJE} minutos: ya no se puede cambiar.`,
      );
    }
  }

  /** Lo de antes queda en `mensaje_version` para el Equipo; el chat muestra «editado ·». */
  async editar(
    id: string,
    mensajeId: string,
    texto: string,
    usuario: UsuarioConTienda,
  ): Promise<MensajeChat> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const anterior = await this.mensajeDelHilo(id, mensajeId, usuario.id);
    await this.revisarQueSeCambia(conversacion, anterior, usuario.id);
    if (anterior.tipo !== 'TEXTO') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Una foto no se edita: elimínala y envía otra.',
      );
    }
    if (anterior.texto === texto) return mensajeChat(anterior, usuario.id);
    const otroId =
      conversacion.compradorId === usuario.id ? conversacion.vendedorId : conversacion.compradorId;
    const mensaje = await this.prisma.$transaction(async (tx) => {
      await tx.mensajeVersion.create({
        data: { mensajeId, cambio: 'EDITADO', texto: anterior.texto, foto: anterior.foto },
      });
      // El aviso que todavía muestra el texto de antes, con el nuevo.
      if (anterior.texto) {
        await tx.aviso.updateMany({
          where: { usuarioId: otroId, conversacionId: id, extracto: `«${anterior.texto}»` },
          data: { extracto: `«${texto}»`.slice(0, 240) },
        });
      }
      return tx.mensaje.update({
        where: { id: mensajeId },
        data: { texto, editadoEn: new Date() },
        select: SELECT_MENSAJE,
      });
    });
    this.emitirCambio(conversacion, mensaje, [usuario.id, otroId]);
    return mensajeChat(mensaje, usuario.id);
  }

  /**
   * «Eliminar para todos» (dentro de los 15 minutos): queda «Eliminaste este mensaje» y, para
   * el otro, «Se eliminó este mensaje»; lo de antes queda para el Equipo. «Eliminar para mí»
   * (cuando sea, también lo del otro): deja de verlo solo quien lo pide.
   */
  async eliminar(
    id: string,
    mensajeId: string,
    para: 'todos' | 'mi',
    usuario: UsuarioConTienda,
  ): Promise<MensajeChat | null> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const anterior = await this.mensajeDelHilo(id, mensajeId, usuario.id);
    if (para === 'mi') {
      if (anterior.tipo === 'SISTEMA') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Los avisos de PaseLibre en el chat no se eliminan.',
        );
      }
      const mensaje = await this.prisma.mensaje.update({
        where: { id: mensajeId },
        data: { ocultoPara: { push: usuario.id } },
        select: SELECT_MENSAJE,
      });
      // Sus otras pestañas también lo sacan.
      const evento: EventoMensajeCambio = {
        conversacion_id: id,
        mensaje_id: mensaje.id,
        mensaje: null,
      };
      this.tiempoReal.emitirAUsuario(usuario.id, EVENTOS.mensajeCambio, evento);
      return null;
    }

    await this.revisarQueSeCambia(conversacion, anterior, usuario.id);
    const otroId =
      conversacion.compradorId === usuario.id ? conversacion.vendedorId : conversacion.compradorId;
    const mensaje = await this.prisma.$transaction(async (tx) => {
      await tx.mensajeVersion.create({
        data: { mensajeId, cambio: 'ELIMINADO', texto: anterior.texto, foto: anterior.foto },
      });
      if (anterior.texto) {
        await tx.aviso.updateMany({
          where: { usuarioId: otroId, conversacionId: id, extracto: `«${anterior.texto}»` },
          data: { extracto: 'Se eliminó este mensaje.' },
        });
      }
      return tx.mensaje.update({
        where: { id: mensajeId },
        data: { texto: null, foto: null, eliminadoEn: new Date() },
        select: SELECT_MENSAJE,
      });
    });
    this.emitirCambio(conversacion, mensaje, [usuario.id, otroId]);
    return mensajeChat(mensaje, usuario.id);
  }

  // ── Pedir y compartir el WhatsApp (N01) ───────────────────────────────────

  /**
   * «Pedir WhatsApp»: a la otra tienda le llega la tarjeta «Aceptar / Ahora no». Nadie ve un
   * número que no se aceptó. A una tienda reservada no se le pide: el número la delataría.
   */
  async pedirWhatsapp(id: string, usuario: UsuarioConTienda): Promise<MensajeChat> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const soyComprador = conversacion.compradorId === usuario.id;
    const otro = soyComprador ? conversacion.vendedor : conversacion.comprador;
    if (soyComprador && !conversacion.oferta.tiendaVisible) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esta tienda atiende solo por el chat de PaseLibre.',
      );
    }
    await this.revisarBloqueos(conversacion, usuario);
    const [yaLoTienes, pendiente] = await Promise.all([
      this.prisma.mensaje.count({
        where: { conversacionId: id, tipo: 'WHATSAPP', autorId: otro.id, eliminadoEn: null },
      }),
      this.prisma.mensaje.findFirst({
        where: {
          conversacionId: id,
          tipo: 'PEDIDO_WHATSAPP',
          autorId: usuario.id,
          pedidoEstado: 'PENDIENTE',
        },
        select: SELECT_MENSAJE,
      }),
    ]);
    if (yaLoTienes) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Ya te compartió su WhatsApp: está en este chat.',
      );
    }
    // Dos toques seguidos no le mandan dos tarjetas.
    if (pendiente) return mensajeChat(pendiente, usuario.id);

    const leLlega = this.tiempoReal.tieneSocket(otro.id);
    const { mensaje, aviso } = await this.prisma.$transaction(async (tx) => {
      const mensaje = await tx.mensaje.create({
        data: {
          conversacionId: id,
          autorId: usuario.id,
          tipo: 'PEDIDO_WHATSAPP',
          pedidoEstado: 'PENDIENTE',
        },
        select: SELECT_MENSAJE,
      });
      const aviso = await this.registrarEnvio(tx, {
        conversacionId: id,
        mensaje,
        usuarioId: usuario.id,
        otroId: otro.id,
        leLlega,
        remitente: this.remitente(conversacion, usuario),
        extracto: 'Te pidió tu WhatsApp.',
      });
      return { mensaje, aviso };
    });
    await this.difundir(conversacion, mensaje, usuario, otro.id, leLlega);
    if (aviso) this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.avisoNuevo, aviso);
    return mensajeChat(mensaje, usuario.id);
  }

  /** «Aceptar» comparte el WhatsApp de la tienda; «Ahora no» solo cierra el pedido. */
  async responderPedidoWhatsapp(
    id: string,
    mensajeId: string,
    aceptar: boolean,
    usuario: UsuarioConTienda,
  ): Promise<RespuestaPedidoWhatsapp> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const pedido = await this.mensajeDelHilo(id, mensajeId, usuario.id);
    if (pedido.tipo !== 'PEDIDO_WHATSAPP' || !pedido.autorId || pedido.autorId === usuario.id) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Este pedido de WhatsApp no es para ti.',
      );
    }
    if (pedido.pedidoEstado !== 'PENDIENTE') {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya respondiste este pedido.');
    }
    if (aceptar) {
      const compartido = await this.compartirWhatsapp(id, usuario);
      const respondido = await this.mensajeDelHilo(id, mensajeId, usuario.id);
      return { pedido: mensajeChat(respondido, usuario.id), compartido };
    }
    const { count } = await this.prisma.mensaje.updateMany({
      where: { id: mensajeId, pedidoEstado: 'PENDIENTE' },
      data: { pedidoEstado: 'RECHAZADO' },
    });
    if (count === 0) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya respondiste este pedido.');
    }
    const respondido = await this.mensajeDelHilo(id, mensajeId, usuario.id);
    this.emitirCambio(conversacion, respondido, [usuario.id, pedido.autorId]);
    return { pedido: mensajeChat(respondido, usuario.id), compartido: null };
  }

  /**
   * «Compartir mi WhatsApp» (desde ⋯ arriba del chat, o al aceptar un pedido): queda en el chat
   * «WhatsApp de X · +51 … · Abrir». Es el número de la tienda. Quien vende algo con la tienda
   * reservada no lo comparte: se sabría quién es.
   */
  async compartirWhatsapp(id: string, usuario: UsuarioConTienda): Promise<MensajeChat> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const soyVendedor = conversacion.vendedorId === usuario.id;
    const otro = soyVendedor ? conversacion.comprador : conversacion.vendedor;
    if (soyVendedor && !conversacion.oferta.tiendaVisible) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Publicaste esto con la tienda reservada: tu WhatsApp diría quién eres.',
      );
    }
    const numero = usuario.tienda?.whatsapp;
    if (!numero) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Tu tienda todavía no tiene WhatsApp. Agrégalo en Configuración.',
      );
    }
    await this.revisarBloqueos(conversacion, usuario);

    const leLlega = this.tiempoReal.tieneSocket(otro.id);
    const { mensaje, nuevo, aviso, aceptados } = await this.prisma.$transaction(async (tx) => {
      // Los pedidos que tenía de la otra tienda quedan aceptados.
      const pendientes = await tx.mensaje.findMany({
        where: {
          conversacionId: id,
          tipo: 'PEDIDO_WHATSAPP',
          autorId: otro.id,
          pedidoEstado: 'PENDIENTE',
        },
        select: { id: true },
      });
      await tx.mensaje.updateMany({
        where: { id: { in: pendientes.map((p) => p.id) } },
        data: { pedidoEstado: 'ACEPTADO' },
      });
      const aceptados = await tx.mensaje.findMany({
        where: { id: { in: pendientes.map((p) => p.id) } },
        select: SELECT_MENSAJE,
      });
      // Si ya está en el chat con el mismo número, no se repite la tarjeta.
      const yaEsta = await tx.mensaje.findFirst({
        where: {
          conversacionId: id,
          tipo: 'WHATSAPP',
          autorId: usuario.id,
          whatsapp: numero,
          eliminadoEn: null,
        },
        select: SELECT_MENSAJE,
      });
      if (yaEsta) return { mensaje: yaEsta, nuevo: false, aviso: null, aceptados };
      const mensaje = await tx.mensaje.create({
        data: { conversacionId: id, autorId: usuario.id, tipo: 'WHATSAPP', whatsapp: numero },
        select: SELECT_MENSAJE,
      });
      const aviso = await this.registrarEnvio(tx, {
        conversacionId: id,
        mensaje,
        usuarioId: usuario.id,
        otroId: otro.id,
        leLlega,
        remitente: this.remitente(conversacion, usuario),
        extracto: 'Te compartió su WhatsApp.',
      });
      return { mensaje, nuevo: true, aviso, aceptados };
    });
    for (const aceptado of aceptados) {
      this.emitirCambio(conversacion, aceptado, [usuario.id, otro.id]);
    }
    if (nuevo) await this.difundir(conversacion, mensaje, usuario, otro.id, leLlega);
    if (aviso) this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.avisoNuevo, aviso);
    return mensajeChat(mensaje, usuario.id);
  }

  // ── Acciones de la conversación (RF-57) ───────────────────────────────────

  async cambiar(
    id: string,
    cambios: CambiarConversacion,
    usuario: UsuarioConTienda,
  ): Promise<DetalleConversacion> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const ahora = new Date();
    const data: Prisma.ParticipacionUpdateInput = {
      silenciada: cambios.silenciada,
      archivada: cambios.archivada,
    };
    // Leer es también haberlo recibido (N01).
    if (cambios.leida === true) {
      Object.assign(data, { leidoHasta: ahora, recibidoHasta: ahora, noLeidaManual: false });
    }
    if (cambios.leida === false) data.noLeidaManual = true;
    await this.prisma.participacion.update({
      where: { conversacionId_usuarioId: { conversacionId: id, usuarioId: usuario.id } },
      data,
    });

    if (cambios.leida === true) {
      await this.avisos.leerDeConversacion(usuario.id, id);
      const otro =
        conversacion.compradorId === usuario.id ? conversacion.vendedor : conversacion.comprador;
      const recibido: EventoMensajeRecibido = {
        conversacion_id: id,
        recibido_hasta: ahora.toISOString(),
      };
      this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.mensajeRecibido, recibido);
      if (usuario.mostrarVisto && otro.mostrarVisto) {
        this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.mensajeVisto, {
          conversacion_id: id,
          visto_hasta: ahora.toISOString(),
        });
      }
    }
    this.tiempoReal.emitirAUsuario(usuario.id, EVENTOS.contadores);
    return this.detalle(id, usuario);
  }

  /** Bloquear a la tienda entera del otro (docs/05 §8): no podrá volver a escribir desde otra cuenta. */
  async bloquear(id: string, bloquear: boolean, usuario: UsuarioConTienda): Promise<void> {
    const { conversacion } = await this.participacion(id, usuario.id);
    const otro =
      conversacion.compradorId === usuario.id ? conversacion.vendedor : conversacion.comprador;
    if (!otro.tienda) throw noExiste();
    const clave = { usuarioId: usuario.id, tiendaBloqueadaId: otro.tienda.id };
    if (bloquear) {
      // Desde el chat de una oferta con la tienda reservada, la lista de bloqueadas tampoco la nombra.
      const reservada =
        conversacion.compradorId === usuario.id && !conversacion.oferta.tiendaVisible;
      await this.prisma.bloqueo.upsert({
        where: { usuarioId_tiendaBloqueadaId: clave },
        update: {},
        create: { ...clave, reservada },
      });
    } else {
      await this.prisma.bloqueo.deleteMany({ where: clave });
    }
  }

  /**
   * Reportar (RF-57, RNF-53, REP_Web): una publicación, una tienda, un chat o un pedido en vivo,
   * con uno de los tres motivos. Se guarda a qué tienda se refiere (para la cola del equipo) y,
   * solo si se marcó «Adjuntar este chat», qué conversación puede leer el equipo. Con
   * «Bloquear también», se bloquea en el mismo paso. La tienda reportada nunca sabe quién fue.
   */
  async denunciar(datos: DenunciaDatos, usuario: UsuarioConTienda): Promise<RespuestaDenuncia> {
    const noEncontrado = () =>
      new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'No encontramos lo que quieres reportar.',
      );
    let tiendaId: string | null = null;
    let reservada = false;
    if (datos.objeto === 'CONVERSACION') {
      const { conversacion } = await this.participacion(datos.objeto_id, usuario.id);
      const otro =
        conversacion.compradorId === usuario.id ? conversacion.vendedor : conversacion.comprador;
      tiendaId = otro.tienda?.id ?? null;
      reservada = conversacion.compradorId === usuario.id && !conversacion.oferta.tiendaVisible;
    } else if (datos.objeto === 'OFERTA') {
      const oferta = await this.prisma.oferta.findFirst({
        where: { id: datos.objeto_id, estado: { not: 'ELIMINADA' } },
        select: { tiendaId: true, tiendaVisible: true },
      });
      if (!oferta) throw noEncontrado();
      tiendaId = oferta.tiendaId;
      reservada = !oferta.tiendaVisible;
    } else if (datos.objeto === 'EN_VIVO') {
      const enVivo = await this.prisma.enVivo.findUnique({
        where: { id: datos.objeto_id },
        select: { tiendaId: true },
      });
      if (!enVivo) throw noEncontrado();
      tiendaId = enVivo.tiendaId;
    } else {
      const existe = await this.prisma.tienda.count({ where: { id: datos.objeto_id } });
      if (!existe) throw noEncontrado();
      tiendaId = datos.objeto_id;
    }
    if (tiendaId && tiendaId === usuario.tiendaId) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'No puedes reportar a tu propia tienda.',
      );
    }
    // El chat que se adjunta tiene que ser de quien reporta.
    if (datos.conversacion_id) await this.participacion(datos.conversacion_id, usuario.id);

    const denuncia = await this.prisma.denuncia.create({
      data: {
        denuncianteId: usuario.id,
        objeto: datos.objeto,
        objetoId: datos.objeto_id,
        tiendaDenunciadaId: tiendaId,
        tipo: datos.tipo,
        motivo: datos.motivo ?? null,
        conversacionAdjuntaId: datos.conversacion_id ?? null,
        reservada,
      },
      select: { codigo: true, creadaEn: true },
    });
    let bloqueada = false;
    if (datos.bloquear && tiendaId) {
      await this.prisma.bloqueo.upsert({
        where: {
          usuarioId_tiendaBloqueadaId: { usuarioId: usuario.id, tiendaBloqueadaId: tiendaId },
        },
        update: {},
        create: { usuarioId: usuario.id, tiendaBloqueadaId: tiendaId, reservada },
      });
      bloqueada = true;
    }
    return {
      codigo: `R-${denuncia.codigo}`,
      bloqueada,
      revisar_antes_de: new Date(denuncia.creadaEn.getTime() + 3 * 3_600_000).toISOString(),
    };
  }

  // ── «Vendido» (RF-47) ─────────────────────────────────────────────────────

  /** Quienes escribieron por la oferta en los hilos de quien vende. */
  async interesados(ofertaId: string, usuario: UsuarioConTienda): Promise<InteresadoOferta[]> {
    const oferta = await this.prisma.oferta.findFirst({
      where: { id: ofertaId, tiendaId: usuario.tiendaId ?? '', estado: { not: 'ELIMINADA' } },
      select: { id: true },
    });
    if (!oferta) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa publicación no existe o ya se eliminó.',
      );
    }
    const conversaciones = await this.prisma.conversacion.findMany({
      where: { ofertaId, vendedorId: usuario.id, mensajes: { some: {} } },
      orderBy: { ultimoMensajeEn: 'desc' },
      select: { id: true, ultimoMensajeEn: true, comprador: { select: SELECT_PERSONA } },
    });
    return conversaciones.map((c) => ({
      conversacion_id: c.id,
      persona: persona(c.comprador),
      ultimo_mensaje_en: c.ultimoMensajeEn.toISOString(),
    }));
  }

  /**
   * Una sola transacción (docs/05 §8): se bloquea la fila de la oferta, se valida que
   * quede stock, se resta 1, se guarda la venta y queda el aviso en el chat. Dos «Vendido»
   * al mismo tiempo no dejan el stock en negativo.
   */
  async vendido(
    ofertaId: string,
    conversacionId: string,
    usuario: UsuarioConTienda,
  ): Promise<RespuestaVendido> {
    const tiendaId = usuario.tiendaId ?? '';
    const resultado = await this.prisma.$transaction(async (tx) => {
      const [fila] = await tx.$queryRaw<
        Array<{
          stock: number;
          tienda_id: string;
          estado: string;
          precio_centimos: bigint | null;
          moneda: 'USD' | 'PEN';
        }>
      >`
        SELECT stock, tienda_id::text AS tienda_id, estado::text AS estado,
               precio_centimos, moneda::text AS moneda
        FROM oferta WHERE id = ${ofertaId}::uuid FOR UPDATE`;
      if (!fila || fila.tienda_id !== tiendaId || fila.estado === 'ELIMINADA') {
        throw new ApiHttpException(
          HttpStatus.NOT_FOUND,
          'NO_ENCONTRADO',
          'Esa publicación no existe o ya se eliminó.',
        );
      }
      const conversacion = await tx.conversacion.findFirst({
        where: { id: conversacionId, ofertaId, vendedorId: usuario.id },
        select: {
          compradorId: true,
          tiendaCompradoraId: true,
          tiendaCompradora: { select: { nombre: true } },
          enVivoId: true,
        },
      });
      if (!conversacion) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Elige a alguien que te escribió por esta publicación.',
        );
      }
      if (fila.stock <= 0) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ya no queda stock de esta publicación. Si te llegó más, repónlo en Mis publicaciones.',
        );
      }

      const antes = fila.stock;
      const despues = antes - 1;
      const ahora = new Date();
      await tx.oferta.update({
        where: { id: ofertaId },
        data: { stock: despues, actualizadaEn: ahora },
      });
      // Si el hilo nació de una oferta flash de esta publicación, también le resta una
      // unidad; sin unidades, la oferta se cierra sola (RF-27).
      const flash = conversacion.enVivoId
        ? await tx.enVivo.findFirst({
            where: {
              id: conversacion.enVivoId,
              ofertaId,
              tipo: 'FLASH',
              estado: 'VIVO',
              venceEn: { gt: ahora },
            },
            select: { id: true, cantidad: true },
          })
        : null;
      if (flash) {
        const quedan = Math.max(0, flash.cantidad - 1);
        await tx.enVivo.update({
          where: { id: flash.id },
          data: {
            cantidad: quedan,
            vendidas: { increment: 1 },
            ...(quedan === 0 ? { estado: 'VENDIDO' as const, cerradoEn: ahora } : {}),
          },
        });
      }
      await tx.venta.create({
        data: {
          ofertaId,
          compradorId: conversacion.compradorId,
          tiendaCompradoraId: conversacion.tiendaCompradoraId,
          conversacionId,
          stockAntes: antes,
          stockDespues: despues,
          registradaPorId: usuario.id,
          // Para «Mis ventas y compras» (HI_A2_Web): el precio de ese momento.
          precioCentimos: fila.precio_centimos,
          moneda: fila.moneda,
        },
      });
      const mensaje = await tx.mensaje.create({
        data: {
          conversacionId,
          autorId: null,
          tipo: 'SISTEMA',
          texto:
            `1 unidad vendida a ${conversacion.tiendaCompradora.nombre} · stock ${antes} → ${despues}` +
            (despues === 0 ? ' · ahora figura «Sin stock»' : ''),
        },
        select: SELECT_MENSAJE,
      });
      await tx.conversacion.update({
        where: { id: conversacionId },
        data: { ultimoMensajeEn: mensaje.creadoEn },
      });
      // Quien marcó la venta ya vio el aviso; para el comprador queda como no leído.
      await tx.participacion.update({
        where: { conversacionId_usuarioId: { conversacionId, usuarioId: usuario.id } },
        data: { leidoHasta: mensaje.creadoEn },
      });
      return {
        antes,
        despues,
        mensaje,
        compradorId: conversacion.compradorId,
        flashId: flash?.id ?? null,
      };
    });

    this.emitirNuevo(conversacionId, resultado.mensaje, usuario.id);
    this.emitirNuevo(conversacionId, resultado.mensaje, resultado.compradorId);
    this.tiempoReal.emitirATienda(tiendaId, EVENTOS.ofertaStock, {
      oferta_id: ofertaId,
      stock: resultado.despues,
    });
    if (resultado.flashId) {
      this.tiempoReal.emitirATodos(EVENTOS.enVivoCambio, { id: resultado.flashId });
    }
    return {
      stock_antes: resultado.antes,
      stock_despues: resultado.despues,
      mensaje: mensajeChat(resultado.mensaje, usuario.id),
    };
  }
  /**
   * «Deshacer» junto a «Vendido» (N02): quien vendió, hasta 48 h y mientras quien compró no lo
   * haya calificado. El stock vuelve (y la unidad de la oferta flash, si el hilo nació de una),
   * la venta se borra y queda el aviso en el chat. Queda anotado en la auditoría.
   */
  async deshacerVenta(ventaId: string, usuario: UsuarioConTienda): Promise<RespuestaVendido> {
    const tiendaId = usuario.tiendaId ?? '';
    const noExisteVenta = () =>
      new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta venta no existe.');
    const resultado = await this.prisma.$transaction(async (tx) => {
      const venta = await tx.venta.findFirst({
        where: { id: ventaId, conversacion: { vendedorId: usuario.id } },
        select: {
          ofertaId: true,
          creadaEn: true,
          conversacionId: true,
          compradorId: true,
          opiniones: { select: { lado: true } },
          conversacion: { select: { enVivoId: true } },
        },
      });
      if (!venta || !venta.conversacionId) throw noExisteVenta();
      if (Date.now() - venta.creadaEn.getTime() > PLAZO_DESHACER_VENTA_MS) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Pasaron más de 48 horas: esta venta ya no se puede deshacer.',
        );
      }
      if (venta.opiniones.some((o) => o.lado === 'COMPRADOR')) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ya te calificó por esta venta: no se puede deshacer.',
        );
      }
      const [fila] = await tx.$queryRaw<Array<{ stock: number; tienda_id: string }>>`
        SELECT stock, tienda_id::text AS tienda_id
        FROM oferta WHERE id = ${venta.ofertaId}::uuid FOR UPDATE`;
      if (!fila || fila.tienda_id !== tiendaId) throw noExisteVenta();

      const antes = fila.stock;
      const despues = antes + 1;
      const ahora = new Date();
      await tx.oferta.update({
        where: { id: venta.ofertaId },
        data: { stock: despues, actualizadaEn: ahora },
      });
      // La oferta flash de la que nació el hilo recupera su unidad (y vuelve si aún no vence).
      const flash = venta.conversacion?.enVivoId
        ? await tx.enVivo.findFirst({
            where: {
              id: venta.conversacion.enVivoId,
              ofertaId: venta.ofertaId,
              tipo: 'FLASH',
              vendidas: { gt: 0 },
            },
            select: { id: true, estado: true, venceEn: true },
          })
        : null;
      if (flash) {
        const vuelve = flash.estado === 'VENDIDO' && flash.venceEn > ahora;
        await tx.enVivo.update({
          where: { id: flash.id },
          data: {
            cantidad: { increment: 1 },
            vendidas: { decrement: 1 },
            ...(vuelve ? { estado: 'VIVO' as const, cerradoEn: null } : {}),
          },
        });
      }
      await tx.venta.delete({ where: { id: ventaId } });
      await tx.auditoria.create({
        data: {
          actorId: usuario.id,
          accion: 'VENTA_DESHECHA',
          objeto: 'venta',
          objetoId: ventaId,
          datos: {
            oferta_id: venta.ofertaId,
            conversacion_id: venta.conversacionId,
            stock_antes: antes,
            stock_despues: despues,
          },
        },
      });
      const mensaje = await tx.mensaje.create({
        data: {
          conversacionId: venta.conversacionId,
          autorId: null,
          tipo: 'SISTEMA',
          texto: `Se deshizo la venta · stock ${antes} → ${despues}`,
        },
        select: SELECT_MENSAJE,
      });
      await tx.conversacion.update({
        where: { id: venta.conversacionId },
        data: { ultimoMensajeEn: mensaje.creadoEn },
      });
      await tx.participacion.update({
        where: {
          conversacionId_usuarioId: {
            conversacionId: venta.conversacionId,
            usuarioId: usuario.id,
          },
        },
        data: { leidoHasta: mensaje.creadoEn },
      });
      return {
        antes,
        despues,
        mensaje,
        ofertaId: venta.ofertaId,
        conversacionId: venta.conversacionId,
        compradorId: venta.compradorId,
        flashId: flash?.id ?? null,
      };
    });

    this.emitirNuevo(resultado.conversacionId, resultado.mensaje, usuario.id);
    if (resultado.compradorId) {
      this.emitirNuevo(resultado.conversacionId, resultado.mensaje, resultado.compradorId);
    }
    this.tiempoReal.emitirATienda(tiendaId, EVENTOS.ofertaStock, {
      oferta_id: resultado.ofertaId,
      stock: resultado.despues,
    });
    if (resultado.flashId) {
      this.tiempoReal.emitirATodos(EVENTOS.enVivoCambio, { id: resultado.flashId });
    }
    return {
      stock_antes: resultado.antes,
      stock_despues: resultado.despues,
      mensaje: mensajeChat(resultado.mensaje, usuario.id),
    };
  }
}
