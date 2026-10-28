import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EVENTOS,
  normalizarTexto,
  type CambiarConversacion,
  type ConsultaHistorial,
  type ConversacionEnLista,
  type DenunciaDatos,
  type DetalleConversacion,
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
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { ArchivosService } from '../archivos/archivos.service';
import { precioPara } from '../catalogo/visibilidad';
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
  mensajes: {
    select: SELECT_MENSAJE,
    orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
    take: 1,
  },
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

function persona(u: PersonaFila): PersonaChat {
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
    const todas = participaciones.map((p) =>
      this.enLista(p, usuarioId, noLeidos.get(p.conversacion.id) ?? 0),
    );
    const sinLeer = (c: ConversacionEnLista) => c.no_leidos > 0 || c.no_leida;
    const conteos = {
      todas: todas.filter((c) => !c.archivada).length,
      no_leidas: todas.filter((c) => !c.archivada && sinLeer(c)).length,
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
          : !c.archivada && (filtro.filtro === 'todas' || sinLeer(c))) && coincide(c),
    );
    return { conversaciones, conteos };
  }

  async detalle(id: string, usuario: UsuarioConTienda): Promise<DetalleConversacion> {
    const participacion = await this.participacion(id, usuario.id);
    const noLeidos = await noLeidosPorConversacion(this.prisma, usuario.id, id);
    const base = this.enLista(participacion, usuario.id, noLeidos.get(id) ?? 0);
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

    return {
      ...base,
      otro: {
        ...base.otro,
        en_linea: this.tiempoReal.enLinea(otro.id),
        ultima_conexion: otro.ultimaConexionEn?.toISOString() ?? null,
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

  private enLista(p: ParticipacionFila, usuarioId: string, noLeidos: number): ConversacionEnLista {
    const c = p.conversacion;
    const rol = c.vendedorId === usuarioId ? 'vendedor' : 'comprador';
    const [ultimo] = c.mensajes;
    return {
      id: c.id,
      rol,
      otro: persona(rol === 'vendedor' ? c.comprador : c.vendedor),
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

    const remitente = usuario.tienda?.nombre ?? usuario.nombre;
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
      await this.prisma.bloqueo.upsert({
        where: { usuarioId_tiendaBloqueadaId: clave },
        update: {},
        create: clave,
      });
    } else {
      await this.prisma.bloqueo.deleteMany({ where: clave });
    }
  }

  /** Denunciar (RF-57, RNF-53). Se guarda el motivo y a qué se refiere, nunca los mensajes. */
  async denunciar(datos: DenunciaDatos, usuarioId: string): Promise<{ id: string }> {
    const existe =
      datos.objeto === 'CONVERSACION'
        ? await this.prisma.participacion.count({
            where: { conversacionId: datos.objeto_id, usuarioId },
          })
        : datos.objeto === 'OFERTA'
          ? await this.prisma.oferta.count({
              where: { id: datos.objeto_id, estado: { not: 'ELIMINADA' } },
            })
          : await this.prisma.tienda.count({ where: { id: datos.objeto_id } });
    if (!existe) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'No encontramos lo que quieres denunciar.',
      );
    }
    return this.prisma.denuncia.create({
      data: {
        denuncianteId: usuarioId,
        objeto: datos.objeto,
        objetoId: datos.objeto_id,
        motivo: datos.motivo,
      },
      select: { id: true },
    });
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
        Array<{ stock: number; tienda_id: string; estado: string }>
      >`
        SELECT stock, tienda_id::text AS tienda_id, estado::text AS estado
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
      await tx.venta.create({
        data: {
          ofertaId,
          compradorId: conversacion.compradorId,
          tiendaCompradoraId: conversacion.tiendaCompradoraId,
          conversacionId,
          stockAntes: antes,
          stockDespues: despues,
          registradaPorId: usuario.id,
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
      return { antes, despues, mensaje, compradorId: conversacion.compradorId };
    });

    this.difundir(conversacionId, resultado.mensaje, usuario.id, resultado.compradorId);
    this.tiempoReal.emitirATienda(tiendaId, EVENTOS.ofertaStock, {
      oferta_id: ofertaId,
      stock: resultado.despues,
    });
    return {
      stock_antes: resultado.antes,
      stock_despues: resultado.despues,
      mensaje: mensajeChat(resultado.mensaje, usuario.id),
    };
  }
}
