import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EVENTOS,
  normalizarTexto,
  type CambiarConversacion,
  type ConsultaHistorial,
  type ConversacionEnLista,
  type DenunciaDatos,
  type RespuestaDenuncia,
  type DetalleConversacion,
  type EnVivoEnChat,
  type EnviarMensajeDatos,
  type EventoMensajeNuevo,
  type FiltroConversaciones,
  type InteresadoOferta,
  type MensajeChat,
  type PersonaChat,
  type RespuestaContacto,
  type RespuestaConversaciones,
  type RespuestaMensajes,
  type RespuestaVendido,
  precioDe,
  TIENDA_RESERVADA,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
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
} satisfies Prisma.MensajeSelect;

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
      producto: {
        select: {
          slug: true,
          titulo: true,
          categoria: { select: { slug: true, nombre: true } },
          fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
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
    },
  };
}

export function mensajeChat(m: MensajeFila, usuarioId: string): MensajeChat {
  return {
    id: m.id,
    tipo: m.tipo,
    texto: m.texto,
    foto: m.foto,
    mio: m.autorId === usuarioId,
    creado_en: m.creadoEn.toISOString(),
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
export class MensajesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ArchivosService) private readonly archivos: ArchivosService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

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

    // RF-23: se registra el clic, nunca el contenido de la conversación.
    await this.prisma.contacto.create({ data: { ofertaId, usuarioId: usuario.id, canal } });

    if (canal === 'WHATSAPP') {
      // El número delataría a la tienda reservada: con ella se escribe solo por chat.
      if (!oferta.tiendaVisible) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Esta tienda atiende solo por el chat de PaseLibre.',
        );
      }
      const numero = oferta.responsable.whatsapp ?? oferta.tienda.whatsapp;
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
    const ultimos = await this.ultimos(participaciones.map((p) => p.conversacion.id));
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
    const ultimos = await this.ultimos([id]);
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
    const [hablanDe, venta, sobreTienda] = await Promise.all([
      this.hablanDe(id, usuario, otraTiendaId),
      this.ventaDelHilo(id, usuario),
      otraTiendaId ? this.sobreTienda(otraTiendaId) : null,
    ]);
    return {
      ...base,
      otro: {
        ...base.otro,
        en_linea: reservada ? false : this.tiempoReal.enLinea(otro.id),
        ultima_conexion: reservada ? null : (otro.ultimaConexionEn?.toISOString() ?? null),
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
            producto: {
              select: {
                titulo: true,
                categoria: { select: { slug: true } },
                fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
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
      foto: fila.oferta.producto.fotos[0]?.ruta ?? null,
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
        opiniones: { where: { autorTiendaId: usuario.tiendaId ?? '' }, select: { id: true } },
      },
    });
    if (!venta) return null;
    return {
      id: venta.id,
      precio:
        venta.precioCentimos === null || venta.moneda === null
          ? null
          : precioDe(Number(venta.precioCentimos), venta.moneda),
      fecha: venta.creadaEn.toISOString(),
      mi_lado: venta.tiendaCompradoraId === usuario.tiendaId ? 'comprador' : 'vendedor',
      calificaste: venta.opiniones.length > 0,
      reclamo_hasta: new Date(venta.creadaEn.getTime() + 48 * 3_600_000).toISOString(),
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

  /** El último mensaje de cada hilo: una consulta por el índice (conversacion_id, creado_en). */
  private async ultimos(ids: string[]): Promise<Map<string, MensajeFila>> {
    if (ids.length === 0) return new Map();
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT DISTINCT ON (conversacion_id) id::text AS id
      FROM mensaje
      WHERE conversacion_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
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
    return {
      id: c.id,
      rol,
      otro:
        rol === 'vendedor' ? persona(c.comprador) : persona(c.vendedor, !c.oferta.tiendaVisible),
      oferta: {
        id: c.oferta.id,
        condicion: c.oferta.condicion,
        producto: {
          slug: c.oferta.producto.slug,
          titulo: c.oferta.producto.titulo,
          foto: c.oferta.producto.fotos[0]?.ruta ?? null,
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

  async mensajes(
    id: string,
    consulta: ConsultaHistorial,
    usuarioId: string,
  ): Promise<RespuestaMensajes> {
    const { conversacion } = await this.participacion(id, usuarioId);
    const otroId =
      conversacion.compradorId === usuarioId ? conversacion.vendedorId : conversacion.compradorId;
    const [filas, yo, delOtro] = await Promise.all([
      this.prisma.mensaje.findMany({
        where: {
          conversacionId: id,
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
        select: { leidoHasta: true, usuario: { select: { mostrarVisto: true } } },
      }),
    ]);
    const hayMas = filas.length > consulta.limite;
    const pagina = filas.slice(0, consulta.limite).reverse();
    // El «Visto» se ve solo si los dos lo tienen activado (RF-57).
    const visto =
      yo.mostrarVisto && delOtro?.usuario.mostrarVisto ? (delOtro.leidoHasta ?? null) : null;
    return {
      mensajes: pagina.map((m) => mensajeChat(m, usuarioId)),
      hay_mas: hayMas,
      visto_hasta: visto?.toISOString() ?? null,
    };
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
    const otraTiendaId = otro.tienda?.id ?? '';

    const bloqueos = await this.prisma.bloqueo.findMany({
      where: {
        OR: [
          { usuarioId: otro.id, tiendaBloqueadaId: miTiendaId },
          { usuarioId: usuario.id, tiendaBloqueadaId: otraTiendaId },
        ],
      },
      select: { usuarioId: true },
    });
    // El bloqueado recibe el error; al otro no se le avisa nada (docs/05 §8).
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

    // Si escribe quien vende una oferta con la tienda reservada, el aviso no dice quién es.
    const remitente =
      !soyComprador && !conversacion.oferta.tiendaVisible
        ? TIENDA_RESERVADA
        : (usuario.tienda?.nombre ?? usuario.nombre);
    const { mensaje, aviso } = await this.prisma.$transaction(async (tx) => {
      if (datos.foto) await this.archivos.reclamar(tx, [datos.foto], miTiendaId);
      const mensaje = await tx.mensaje.create({
        data: {
          conversacionId: id,
          autorId: usuario.id,
          tipo: datos.foto ? 'FOTO' : 'TEXTO',
          texto: datos.texto ?? null,
          foto: datos.foto ?? null,
        },
        select: SELECT_MENSAJE,
      });
      await tx.conversacion.update({
        where: { id },
        data: { ultimoMensajeEn: mensaje.creadoEn },
      });
      // Quien escribe ya leyó todo; a quien recibe, el hilo le vuelve a la bandeja.
      await tx.participacion.update({
        where: { conversacionId_usuarioId: { conversacionId: id, usuarioId: usuario.id } },
        data: { leidoHasta: mensaje.creadoEn, noLeidaManual: false, archivada: false },
      });
      await tx.participacion.update({
        where: { conversacionId_usuarioId: { conversacionId: id, usuarioId: otro.id } },
        data: { archivada: false },
      });
      const aviso = await this.avisos.porMensaje(tx, {
        destinatarioId: otro.id,
        conversacionId: id,
        remitente,
        extracto: datos.texto ? `«${datos.texto}»` : 'Te envió una foto.',
      });
      return { mensaje, aviso };
    });

    this.difundir(id, mensaje, usuario.id, otro.id);
    if (aviso) this.tiempoReal.emitirAUsuario(otro.id, EVENTOS.avisoNuevo, aviso);
    return mensajeChat(mensaje, usuario.id);
  }

  /** `mensaje:nuevo` a las dos personas, cada una con su «mío». */
  private difundir(conversacionId: string, mensaje: MensajeFila, ...personas: string[]): void {
    for (const usuarioId of personas) {
      const evento: EventoMensajeNuevo = {
        conversacion_id: conversacionId,
        mensaje: mensajeChat(mensaje, usuarioId),
      };
      this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.mensajeNuevo, evento);
      this.tiempoReal.emitirAUsuario(usuarioId, EVENTOS.contadores);
    }
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
    if (cambios.leida === true) Object.assign(data, { leidoHasta: ahora, noLeidaManual: false });
    if (cambios.leida === false) data.noLeidaManual = true;
    await this.prisma.participacion.update({
      where: { conversacionId_usuarioId: { conversacionId: id, usuarioId: usuario.id } },
      data,
    });

    if (cambios.leida === true) {
      await this.avisos.leerDeConversacion(usuario.id, id);
      const otro =
        conversacion.compradorId === usuario.id ? conversacion.vendedor : conversacion.comprador;
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

    this.difundir(conversacionId, resultado.mensaje, usuario.id, resultado.compradorId);
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
}
