import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  EVENTOS,
  MAX_EN_VIVO_POR_CUENTA,
  formatearPrecio,
  normalizarTexto,
  precioDe,
  type AlcanceEnVivoConsulta,
  type AvisoCampanita,
  type CambiarEnVivo,
  type EnVivoConsulta,
  type EnVivoConVendedor,
  type EnVivoPropio,
  type EnVivoPublico,
  type PublicarEnVivoDatos,
  type RespuestaAlcanceEnVivo,
  type RespuestaEnVivo,
  type RespuestaMisEnVivo,
  type RespuestaOpcionesEnVivo,
  type RespuestaResponderEnVivo,
  type ResponderEnVivoDatos,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { conSesion, precioPara } from '../catalogo/visibilidad';
import { MensajesService } from '../mensajes/mensajes.service';
import { visibleDesde } from '../mensajes/no-molestar';
import type { UsuarioConTienda } from '../sesion/sesion.types';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { estadoEfectivo, inicioDelDiaEnLima, sumarHora, vencimiento } from './horario';

const MAX_EN_LISTA = 50;
const MAX_CERRADOS = 20;
const MAX_OPCIONES = 20;
/** Tope de avisos por busco: con más tiendas que esto, el aviso deja de ser útil. */
const MAX_AVISADOS = 200;
/** Palabras que no sirven para encontrar un producto. */
const VACIAS = new Set(['con', 'del', 'las', 'los', 'para', 'por', 'que', 'una', 'uno']);

const SELECT_PUBLICO = {
  id: true,
  tipo: true,
  titulo: true,
  cantidad: true,
  condicion: true,
  venceEn: true,
  estado: true,
  cerradoEn: true,
  creadoEn: true,
  categoria: { select: { slug: true, nombre: true } },
  galeria: { select: { nombre: true } },
  producto: {
    select: {
      slug: true,
      fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
    },
  },
} satisfies Prisma.EnVivoSelect;

/** Lo de arriba más tienda, precio y nota: solo para consultas con sesión (A-06). */
const SELECT_CON_VENDEDOR = {
  ...SELECT_PUBLICO,
  autorId: true,
  tiendaId: true,
  precioCentimos: true,
  moneda: true,
  nota: true,
  avisadas: true,
  vendidas: true,
  tienda: { select: { nombre: true, stand: true } },
  _count: { select: { respuestas: true } },
} satisfies Prisma.EnVivoSelect;

type FilaPublica = Prisma.EnVivoGetPayload<{ select: typeof SELECT_PUBLICO }>;
type FilaConVendedor = Prisma.EnVivoGetPayload<{ select: typeof SELECT_CON_VENDEDOR }>;

const noExiste = () =>
  new ApiHttpException(
    HttpStatus.NOT_FOUND,
    'NO_ENCONTRADO',
    'Este pase del día ya se cerró o venció.',
  );

/** Lo que sigue en vivo: sin vencer, de una tienda activa y de una cuenta activa. */
function vigentes(ahora: Date): Prisma.EnVivoWhereInput {
  return {
    estado: 'VIVO',
    venceEn: { gt: ahora },
    tienda: { estado: 'ACTIVA' },
    autor: { estado: 'ACTIVO' },
  };
}

/** Lo que se cerró o venció desde la medianoche de Lima. */
function cerradosHoy(ahora: Date): Prisma.EnVivoWhereInput {
  const inicio = inicioDelDiaEnLima(ahora);
  return {
    tienda: { estado: 'ACTIVA' },
    autor: { estado: 'ACTIVO' },
    OR: [
      { estado: { not: 'VIVO' }, cerradoEn: { gte: inicio } },
      { estado: 'VIVO', venceEn: { gte: inicio, lte: ahora } },
    ],
  };
}

function filtros(consulta: EnVivoConsulta): Prisma.EnVivoWhereInput {
  return {
    ...(consulta.tipo === 'busco' ? { tipo: 'BUSCO' as const } : {}),
    ...(consulta.tipo === 'flash' ? { tipo: 'FLASH' as const } : {}),
    ...(consulta.categoria ? { categoria: { slug: consulta.categoria } } : {}),
    ...(consulta.galeria ? { galeria: { slug: consulta.galeria } } : {}),
  };
}

/** Lo que va primero en «Cerrados hoy»: lo último que se cerró o venció. */
const cuandoTermino = (f: { cerradoEn: Date | null; venceEn: Date }) =>
  (f.cerradoEn ?? f.venceEn).getTime();

/**
 * En vivo (D-53, RF-24 a RF-27 y RF-72 a RF-77): busco y ofertas flash que duran unas
 * horas. La respuesta abre un hilo de Mensajes con la tarjeta arriba, y la campanita avisa
 * del busco a las tiendas que tienen ese producto publicado.
 */
@Injectable()
export class EnVivoService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MensajesService) private readonly mensajes: MensajesService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
  ) {}

  // ── Lista (RF-25, RF-75, RF-77) ───────────────────────────────────────────

  async lista(consulta: EnVivoConsulta, mirada: Mirada): Promise<RespuestaEnVivo> {
    const ahora = new Date();
    const enVivo = { AND: [vigentes(ahora), filtros(consulta)] };
    const cerrados = { AND: [cerradosHoy(ahora), filtros(consulta)] };
    const orden = { venceEn: 'asc' } as const;

    if (!conSesion(mirada)) {
      const [vivas, terminadas] = await Promise.all([
        this.prisma.enVivo.findMany({
          where: enVivo,
          select: SELECT_PUBLICO,
          orderBy: orden,
          take: MAX_EN_LISTA,
        }),
        this.prisma.enVivo.findMany({
          where: cerrados,
          select: SELECT_PUBLICO,
          take: MAX_CERRADOS,
        }),
      ]);
      return {
        audiencia: 'visitante',
        en_vivo: vivas.map((f) => this.publico(f, ahora)),
        cerrados_hoy: terminadas
          .sort((a, b) => cuandoTermino(b) - cuandoTermino(a))
          .map((f) => this.publico(f, ahora)),
      };
    }

    const [vivas, terminadas] = await Promise.all([
      this.prisma.enVivo.findMany({
        where: enVivo,
        select: SELECT_CON_VENDEDOR,
        orderBy: orden,
        take: MAX_EN_LISTA,
      }),
      this.prisma.enVivo.findMany({
        where: cerrados,
        select: SELECT_CON_VENDEDOR,
        take: MAX_CERRADOS,
      }),
    ]);
    const respuestas = await this.respuestasDeMiTienda(
      [...vivas, ...terminadas].map((f) => f.id),
      mirada.tiendaId,
    );
    const armar = (f: FilaConVendedor) => this.conVendedor(f, ahora, mirada, respuestas);
    return {
      audiencia: mirada.audiencia === 'equipo' ? 'equipo' : 'vendedor',
      en_vivo: vivas.map(armar),
      cerrados_hoy: terminadas.sort((a, b) => cuandoTermino(b) - cuandoTermino(a)).map(armar),
    };
  }

  /** «Lo tuyo en vivo» (RF-75): lo vigente y lo cerrado hoy, con sus respuestas. */
  async mios(usuario: UsuarioConTienda): Promise<RespuestaMisEnVivo> {
    const ahora = new Date();
    const [vivas, terminadas] = await Promise.all([
      this.prisma.enVivo.findMany({
        where: { ...vigentes(ahora), autorId: usuario.id },
        select: { id: true },
        orderBy: { venceEn: 'asc' },
      }),
      this.prisma.enVivo.findMany({
        where: { ...cerradosHoy(ahora), autorId: usuario.id },
        select: { id: true, cerradoEn: true, venceEn: true },
      }),
    ]);
    const ordenadas = terminadas.sort((a, b) => cuandoTermino(b) - cuandoTermino(a));
    return {
      en_vivo: await this.propios(
        vivas.map((f) => f.id),
        usuario,
        ahora,
      ),
      cerrados_hoy: await this.propios(
        ordenadas.map((f) => f.id),
        usuario,
        ahora,
      ),
      disponibles: Math.max(0, MAX_EN_VIVO_POR_CUENTA - vivas.length),
    };
  }

  // ── Publicar (RF-24, RF-72, RF-73) ─────────────────────────────────────────

  async publicar(datos: PublicarEnVivoDatos, usuario: UsuarioConTienda): Promise<EnVivoPropio> {
    const tiendaId = usuario.tiendaId ?? '';
    const ahora = new Date();
    const venceEn = vencimiento(datos.duracion, ahora);
    if (!venceEn) {
      throw new ApiHttpException(
        HttpStatus.BAD_REQUEST,
        'DATOS_INVALIDOS',
        'Falta poco para el cierre: elige 1 hora o 3 horas.',
      );
    }
    const tienda = await this.prisma.tienda.findUniqueOrThrow({
      where: { id: tiendaId },
      select: { galeriaId: true },
    });
    const contenido =
      datos.tipo === 'BUSCO'
        ? await this.contenidoBusco(datos)
        : await this.contenidoFlash(datos, usuario, ahora);

    const { id } = await this.prisma.$transaction(async (tx) => {
      // Dos publicaciones a la vez de la misma persona esperan su turno: el límite de 3
      // se cuenta y se respeta dentro de la misma transacción.
      await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${usuario.id}))`;
      const vivas = await tx.enVivo.count({
        where: { autorId: usuario.id, estado: 'VIVO', venceEn: { gt: ahora } },
      });
      if (vivas >= MAX_EN_VIVO_POR_CUENTA) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'LIMITE_EN_VIVO',
          `Ya tienes ${MAX_EN_VIVO_POR_CUENTA} pases del día publicados. Cierra uno o espera a que venza.`,
        );
      }
      return tx.enVivo.create({
        data: {
          ...contenido,
          autorId: usuario.id,
          tiendaId,
          galeriaId: tienda.galeriaId,
          nota: datos.nota,
          venceEn,
          creadoEn: ahora,
        },
        select: { id: true },
      });
    });

    if (datos.tipo === 'BUSCO') await this.avisarBusco(id, usuario);
    this.tiempoReal.emitirATodos(EVENTOS.enVivoCambio, { id });
    const [propio] = await this.propios([id], usuario, new Date());
    return propio as EnVivoPropio;
  }

  private async contenidoBusco(datos: Extract<PublicarEnVivoDatos, { tipo: 'BUSCO' }>) {
    const comun = {
      tipo: 'BUSCO' as const,
      cantidad: datos.cantidad,
      condicion: datos.condicion,
      precioCentimos: datos.presupuesto === null ? null : BigInt(datos.presupuesto),
      moneda: datos.moneda,
      ofertaId: null,
    };
    if (datos.producto) {
      const producto = await this.prisma.producto.findFirst({
        where: { id: datos.producto, fusionadoEnId: null },
        select: { id: true, titulo: true, categoriaId: true },
      });
      if (!producto) {
        throw new ApiHttpException(
          HttpStatus.NOT_FOUND,
          'NO_ENCONTRADO',
          'Ese producto ya no está en PaseLibre.',
        );
      }
      return {
        ...comun,
        productoId: producto.id,
        titulo: producto.titulo,
        categoriaId: producto.categoriaId,
      };
    }
    const categoria = await this.prisma.categoria.findUnique({
      where: { slug: datos.categoria ?? '' },
      select: { id: true },
    });
    if (!categoria) {
      throw new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', 'Elige la categoría.');
    }
    return {
      ...comun,
      productoId: null,
      titulo: datos.titulo ?? '',
      categoriaId: categoria.id,
    };
  }

  private async contenidoFlash(
    datos: Extract<PublicarEnVivoDatos, { tipo: 'FLASH' }>,
    usuario: UsuarioConTienda,
    ahora: Date,
  ) {
    const oferta = await this.prisma.oferta.findFirst({
      where: { id: datos.oferta, tiendaId: usuario.tiendaId ?? '', estado: 'ACTIVA' },
      select: {
        id: true,
        stock: true,
        condicion: true,
        responsableId: true,
        productoId: true,
        producto: { select: { titulo: true, categoriaId: true } },
      },
    });
    if (!oferta) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esa publicación no existe o está pausada.',
      );
    }
    // Los «¡Lo quiero!» llegan a quien atiende la publicación (A-11).
    if (oferta.responsableId !== usuario.id) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esa publicación la atiende otra persona de tu tienda: que la remate ella.',
      );
    }
    if (oferta.stock < datos.cantidad) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        oferta.stock === 0
          ? 'Esa publicación no tiene stock.'
          : `Tienes ${oferta.stock} en stock: la oferta puede tener hasta esa cantidad.`,
      );
    }
    const yaEnOferta = await this.prisma.enVivo.count({
      where: { ofertaId: oferta.id, tipo: 'FLASH', estado: 'VIVO', venceEn: { gt: ahora } },
    });
    if (yaEnOferta > 0) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Esa publicación ya está en remate.',
      );
    }
    return {
      tipo: 'FLASH' as const,
      productoId: oferta.productoId,
      ofertaId: oferta.id,
      titulo: oferta.producto.titulo,
      categoriaId: oferta.producto.categoriaId,
      cantidad: datos.cantidad,
      condicion: oferta.condicion,
      precioCentimos: BigInt(datos.precio ?? 0),
      moneda: datos.moneda,
    };
  }

  // ── Sumar una hora y cerrar (RF-27) ───────────────────────────────────────

  async cambiar(id: string, { accion }: CambiarEnVivo, usuario: UsuarioConTienda) {
    const ahora = new Date();
    const fila = await this.prisma.enVivo.findFirst({
      where: { id, autorId: usuario.id },
      select: { tipo: true, estado: true, venceEn: true, creadoEn: true },
    });
    if (!fila) throw noExiste();
    const estado = estadoEfectivo(fila, ahora);
    if (estado !== 'VIVO') {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        estado === 'VENCIDO'
          ? 'Ya venció. Si todavía lo necesitas, publícalo de nuevo.'
          : 'Ya está cerrado.',
      );
    }
    if (accion === 'sumar_hora') {
      const nueva = sumarHora(fila.venceEn, fila.creadoEn);
      if (!nueva) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Ya llegó al máximo de 12 horas. Si todavía lo necesitas, publícalo de nuevo.',
        );
      }
      await this.prisma.enVivo.update({ where: { id }, data: { venceEn: nueva } });
    } else {
      await this.prisma.enVivo.update({
        where: { id },
        data: { estado: fila.tipo === 'BUSCO' ? 'CONSEGUIDO' : 'CERRADO', cerradoEn: ahora },
      });
    }
    this.tiempoReal.emitirATodos(EVENTOS.enVivoCambio, { id });
    const [propio] = await this.propios([id], usuario, new Date());
    return propio as EnVivoPropio;
  }

  // ── Responder (RF-26) ─────────────────────────────────────────────────────

  /** Tus publicaciones que sirven para responder «¡Lo tengo!» a un busco. */
  async opciones(id: string, usuario: UsuarioConTienda): Promise<RespuestaOpcionesEnVivo> {
    const tiendaId = usuario.tiendaId ?? '';
    const busco = await this.prisma.enVivo.findFirst({
      where: { id, tipo: 'BUSCO', ...vigentes(new Date()) },
      select: { productoId: true, titulo: true, categoriaId: true, tiendaId: true },
    });
    if (!busco) throw noExiste();
    if (busco.tiendaId === tiendaId) return { ofertas: [] };
    const coincide = this.coincidencia(busco);
    if (!coincide) return { ofertas: [] };

    const primeroElMismo = busco.productoId
      ? Prisma.sql`(o.producto_id = ${busco.productoId}::uuid) DESC,`
      : Prisma.empty;
    const filas = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o.id::text AS id
      FROM oferta o
      JOIN producto p ON p.id = o.producto_id
      WHERE o.tienda_id = ${tiendaId}::uuid AND o.responsable_id = ${usuario.id}::uuid
        AND o.estado = 'ACTIVA' AND o.stock > 0 AND ${coincide}
      ORDER BY ${primeroElMismo} o.actualizada_en DESC
      LIMIT ${MAX_OPCIONES}`;
    const ofertas = await this.prisma.oferta.findMany({
      where: { id: { in: filas.map((f) => f.id) } },
      select: {
        id: true,
        tiendaId: true,
        condicion: true,
        stock: true,
        precioCentimos: true,
        moneda: true,
        precioVisible: true,
        producto: {
          select: {
            titulo: true,
            fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
          },
        },
      },
    });
    const porId = new Map(ofertas.map((o) => [o.id, o]));
    const mirada: Mirada = { audiencia: 'vendedor', tiendaId, usuarioId: usuario.id };
    return {
      ofertas: filas.flatMap(({ id: ofertaId }) => {
        const o = porId.get(ofertaId);
        if (!o) return [];
        return [
          {
            oferta_id: o.id,
            titulo: o.producto.titulo,
            condicion: o.condicion,
            stock: o.stock,
            precio: precioPara(o, mirada),
            precio_visible: o.precioVisible,
            foto: o.producto.fotos[0]?.ruta ?? null,
          },
        ];
      }),
    };
  }

  /**
   * «¡Lo tengo!» a un busco o «¡Lo quiero!» a una oferta flash. Abre (o reutiliza) el hilo
   * de la publicación con la tarjeta en vivo arriba, deja el aviso en el chat y manda el
   * mensaje, que llega a la campanita como cualquier otro.
   */
  async responder(
    id: string,
    datos: ResponderEnVivoDatos,
    usuario: UsuarioConTienda,
  ): Promise<RespuestaResponderEnVivo> {
    const tiendaId = usuario.tiendaId ?? '';
    const enVivo = await this.prisma.enVivo.findFirst({
      where: { id, ...vigentes(new Date()) },
      select: {
        tipo: true,
        titulo: true,
        autorId: true,
        tiendaId: true,
        ofertaId: true,
        oferta: { select: { responsableId: true, estado: true } },
      },
    });
    if (!enVivo) throw noExiste();
    if (enVivo.tiendaId === tiendaId) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Es de tu tienda.');
    }
    await this.siYaRespondio(id, usuario);

    const bloqueos = await this.prisma.bloqueo.findMany({
      where: {
        OR: [
          { usuarioId: enVivo.autorId, tiendaBloqueadaId: tiendaId },
          { usuarioId: usuario.id, tiendaBloqueadaId: enVivo.tiendaId },
        ],
      },
      select: { usuarioId: true },
    });
    if (bloqueos.some((b) => b.usuarioId === enVivo.autorId)) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'BLOQUEADO',
        'No puedes responderle a esta tienda.',
      );
    }
    if (bloqueos.length > 0) {
      throw new ApiHttpException(
        HttpStatus.CONFLICT,
        'CONFLICTO',
        'Bloqueaste a esta tienda. Desbloquéala para responderle.',
      );
    }

    // En el busco vende quien responde; en la oferta flash, quien la publicó.
    let hilo: {
      ofertaId: string;
      compradorId: string;
      vendedorId: string;
      tiendaCompradoraId: string;
      tiendaVendedoraId: string;
    };
    let ofertaOfrecida: string | null = null;
    if (enVivo.tipo === 'BUSCO') {
      const oferta = datos.oferta
        ? await this.prisma.oferta.findFirst({
            where: {
              id: datos.oferta,
              tiendaId,
              responsableId: usuario.id,
              estado: 'ACTIVA',
              stock: { gt: 0 },
            },
            select: { id: true },
          })
        : null;
      if (!oferta) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Elige cuál de tus publicaciones ofreces. Tiene que estar activa y con stock.',
        );
      }
      ofertaOfrecida = oferta.id;
      hilo = {
        ofertaId: oferta.id,
        compradorId: enVivo.autorId,
        vendedorId: usuario.id,
        tiendaCompradoraId: enVivo.tiendaId,
        tiendaVendedoraId: tiendaId,
      };
    } else {
      if (!enVivo.ofertaId || enVivo.oferta?.estado !== 'ACTIVA') {
        throw new ApiHttpException(
          HttpStatus.NOT_FOUND,
          'NO_ENCONTRADO',
          'Este remate ya no está disponible.',
        );
      }
      hilo = {
        ofertaId: enVivo.ofertaId,
        compradorId: usuario.id,
        vendedorId: enVivo.oferta.responsableId,
        tiendaCompradoraId: tiendaId,
        tiendaVendedoraId: enVivo.tiendaId,
      };
    }

    const remitente = usuario.tienda?.nombre ?? usuario.nombre;
    const respuesta = enVivo.tipo === 'BUSCO' ? '¡Lo tengo!' : '¡Lo quiero!';
    const destino = enVivo.tipo === 'BUSCO' ? 'al busco' : 'al remate';
    let conversacionId: string;
    try {
      conversacionId = await this.prisma.$transaction(async (tx) => {
        const existente = await tx.conversacion.findUnique({
          where: {
            ofertaId_compradorId: { ofertaId: hilo.ofertaId, compradorId: hilo.compradorId },
          },
          select: { id: true },
        });
        const conversacion = existente
          ? await tx.conversacion.update({
              where: { id: existente.id },
              data: { enVivoId: id },
              select: { id: true },
            })
          : await tx.conversacion.create({
              data: {
                ...hilo,
                enVivoId: id,
                participaciones: {
                  create: [{ usuarioId: hilo.compradorId }, { usuarioId: hilo.vendedorId }],
                },
              },
              select: { id: true },
            });
        if (existente) {
          await tx.participacion.updateMany({
            where: { conversacionId: existente.id },
            data: { archivada: false },
          });
        }
        await tx.enVivoRespuesta.create({
          data: {
            enVivoId: id,
            usuarioId: usuario.id,
            tiendaId,
            ofertaId: ofertaOfrecida,
            conversacionId: conversacion.id,
          },
        });
        // «¡Lo quiero!» es contactar la publicación (RF-23).
        if (enVivo.tipo === 'FLASH') {
          await tx.contacto.create({
            data: { ofertaId: hilo.ofertaId, usuarioId: usuario.id, canal: 'CHAT' },
          });
        }
        await tx.mensaje.create({
          data: {
            conversacionId: conversacion.id,
            autorId: null,
            tipo: 'SISTEMA',
            texto: `${remitente} respondió «${respuesta}» ${destino} «${enVivo.titulo}»`,
          },
        });
        return conversacion.id;
      });
    } catch (error) {
      // Dos personas de la misma tienda a la vez: la segunda llega tarde.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        await this.siYaRespondio(id, usuario);
      }
      throw error;
    }

    await this.mensajes.enviar(conversacionId, { texto: datos.texto, foto: undefined }, usuario);
    this.tiempoReal.emitirATodos(EVENTOS.enVivoCambio, { id });
    return { conversacion_id: conversacionId };
  }

  /** Una respuesta por tienda: si ya respondió, 409 con el chat (si fue esta persona). */
  private async siYaRespondio(id: string, usuario: UsuarioConTienda): Promise<void> {
    const previa = await this.prisma.enVivoRespuesta.findUnique({
      where: { enVivoId_tiendaId: { enVivoId: id, tiendaId: usuario.tiendaId ?? '' } },
      select: { usuarioId: true, conversacionId: true },
    });
    if (!previa) return;
    const tuya = previa.usuarioId === usuario.id;
    throw new ApiHttpException(
      HttpStatus.CONFLICT,
      'YA_RESPONDISTE',
      tuya ? 'Ya respondiste. Sigue la conversación en el chat.' : 'Tu tienda ya respondió.',
      { conversacion_id: tuya ? previa.conversacionId : null },
    );
  }

  // ── Avisos del busco (RF-76) ──────────────────────────────────────────────

  /** «Les avisamos a 3 tiendas»: la vista previa de Publicar. */
  async alcance(
    consulta: AlcanceEnVivoConsulta,
    usuario: UsuarioConTienda,
  ): Promise<RespuestaAlcanceEnVivo> {
    let base: { productoId: string | null; titulo: string; categoriaId: string | null };
    if (consulta.producto) {
      const producto = await this.prisma.producto.findFirst({
        where: { id: consulta.producto, fusionadoEnId: null },
        select: { id: true, titulo: true, categoriaId: true },
      });
      if (!producto) return { tiendas: 0 };
      base = {
        productoId: producto.id,
        titulo: producto.titulo,
        categoriaId: producto.categoriaId,
      };
    } else {
      const categoria = consulta.categoria
        ? await this.prisma.categoria.findUnique({
            where: { slug: consulta.categoria },
            select: { id: true },
          })
        : null;
      base = { productoId: null, titulo: consulta.q, categoriaId: categoria?.id ?? null };
    }
    const destinatarios = await this.destinatarios(base, usuario.tiendaId ?? '');
    return { tiendas: new Set(destinatarios.map((d) => d.tiendaId)).size };
  }

  /**
   * Cómo se reconoce el producto de un busco: el mismo producto, o los de su categoría que
   * tienen su número de modelo («4060» en «RTX 4060 o 5060»). Sin números, todas sus
   * palabras. Nulo si no queda nada con qué buscar.
   */
  private coincidencia(busco: {
    productoId: string | null;
    titulo: string;
    categoriaId: string | null;
  }): Prisma.Sql | null {
    const palabras = normalizarTexto(busco.titulo).split(' ').filter(Boolean);
    const modelos = palabras.filter((p) => /\d/.test(p) && p.length >= 3);
    const claves = palabras.filter((p) => p.length >= 3 && !VACIAS.has(p));
    // Las palabras normalizadas solo tienen letras y números: no hay comodines que escapar.
    const empieza = (p: string) => Prisma.sql`(' ' || p.texto_busqueda) LIKE ${`% ${p}%`}`;
    const partes: Prisma.Sql[] = [];
    if (modelos.length > 0) partes.push(Prisma.join(modelos.map(empieza), ' OR '));
    else if (claves.length > 0) partes.push(Prisma.join(claves.map(empieza), ' AND '));

    const enCategoria = busco.categoriaId
      ? Prisma.sql` AND p.categoria_id = ${busco.categoriaId}::uuid`
      : Prisma.empty;
    const porTexto = partes[0] ? Prisma.sql`((${partes[0]})${enCategoria})` : null;
    const porProducto = busco.productoId ? Prisma.sql`p.id = ${busco.productoId}::uuid` : null;
    const alguna = [porProducto, porTexto].filter((c): c is Prisma.Sql => c !== null);
    if (alguna.length === 0) return null;
    return Prisma.sql`p.fusionado_en_id IS NULL AND (${Prisma.join(alguna, ' OR ')})`;
  }

  /** Quienes atienden una publicación activa y con stock de ese producto, en otras tiendas. */
  private async destinatarios(
    busco: { productoId: string | null; titulo: string; categoriaId: string | null },
    excluirTiendaId: string,
  ): Promise<Array<{ tiendaId: string; usuarioId: string }>> {
    const coincide = this.coincidencia(busco);
    if (!coincide) return [];
    const filas = await this.prisma.$queryRaw<Array<{ tienda_id: string; usuario_id: string }>>`
      SELECT DISTINCT o.tienda_id::text AS tienda_id, o.responsable_id::text AS usuario_id
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id
      JOIN usuario u ON u.id = o.responsable_id
      JOIN producto p ON p.id = o.producto_id
      WHERE o.estado = 'ACTIVA' AND o.stock > 0 AND t.estado = 'ACTIVA' AND u.estado = 'ACTIVO'
        AND o.tienda_id <> ${excluirTiendaId}::uuid AND ${coincide}
      LIMIT ${MAX_AVISADOS}`;
    return filas.map((f) => ({ tiendaId: f.tienda_id, usuarioId: f.usuario_id }));
  }

  /**
   * Un aviso por persona en la campanita (tipo EN_VIVO), salvo a quien lo apagó en
   * Configuración. Con «No molestar», aparece al terminar el horario.
   */
  private async avisarBusco(id: string, usuario: UsuarioConTienda): Promise<void> {
    const busco = await this.prisma.enVivo.findUniqueOrThrow({
      where: { id },
      select: {
        productoId: true,
        titulo: true,
        categoriaId: true,
        cantidad: true,
        precioCentimos: true,
        moneda: true,
      },
    });
    const destinatarios = await this.destinatarios(busco, usuario.tiendaId ?? '');
    if (destinatarios.length === 0) return;

    const ids = [...new Set(destinatarios.map((d) => d.usuarioId))];
    const [apagados, personas] = await Promise.all([
      this.prisma.preferenciaAviso.findMany({
        where: { usuarioId: { in: ids }, tipo: 'EN_VIVO', campanita: false },
        select: { usuarioId: true },
      }),
      this.prisma.usuario.findMany({
        where: { id: { in: ids } },
        select: { id: true, noMolestarDesde: true, noMolestarHasta: true },
      }),
    ]);
    const sinAviso = new Set(apagados.map((a) => a.usuarioId));
    const reciben = personas.filter((p) => !sinAviso.has(p.id));
    const tiendas = new Set(
      destinatarios.filter((d) => !sinAviso.has(d.usuarioId)).map((d) => d.tiendaId),
    );

    const ahora = new Date();
    const quien = usuario.tienda?.nombre ?? usuario.nombre;
    const extracto = [
      busco.cantidad > 1 ? `${busco.cantidad} unidades` : null,
      busco.precioCentimos !== null
        ? `Paga hasta ${formatearPrecio(precioDe(Number(busco.precioCentimos), busco.moneda))}`
        : null,
      'Respóndele antes de que venza.',
    ]
      .filter(Boolean)
      .join(' · ');
    const avisos = await this.prisma.aviso.createManyAndReturn({
      data: reciben.map((p) => ({
        usuarioId: p.id,
        tipo: 'EN_VIVO' as const,
        titulo: `${quien} busca ${busco.titulo}`.slice(0, 160),
        extracto,
        enlace: `/pases-del-dia?id=${id}`,
        visibleDesde: visibleDesde(p.noMolestarDesde, p.noMolestarHasta, ahora),
      })),
    });
    await this.prisma.enVivo.update({ where: { id }, data: { avisadas: tiendas.size } });

    for (const aviso of avisos) {
      if (aviso.visibleDesde > ahora) continue;
      const campanita: AvisoCampanita = {
        id: aviso.id,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        extracto: aviso.extracto,
        enlace: aviso.enlace,
        leido: false,
        actualizado_en: aviso.actualizadoEn.toISOString(),
      };
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.avisoNuevo, campanita);
      this.tiempoReal.emitirAUsuario(aviso.usuarioId, EVENTOS.contadores);
    }
  }

  // ── Armar las respuestas ──────────────────────────────────────────────────

  private publico(f: FilaPublica, ahora: Date): EnVivoPublico {
    return {
      id: f.id,
      tipo: f.tipo,
      titulo: f.titulo,
      categoria: f.categoria,
      producto: f.producto
        ? { slug: f.producto.slug, foto: f.producto.fotos[0]?.ruta ?? null }
        : null,
      cantidad: f.cantidad,
      condicion: f.condicion,
      galeria: f.galeria?.nombre ?? null,
      vence_en: f.venceEn.toISOString(),
      creado_en: f.creadoEn.toISOString(),
      estado: estadoEfectivo(f, ahora),
      cerrado_en: f.cerradoEn?.toISOString() ?? null,
    };
  }

  private conVendedor(
    f: FilaConVendedor,
    ahora: Date,
    mirada: Mirada,
    respuestas: Map<string, { usuarioId: string; conversacionId: string }>,
  ): EnVivoConVendedor {
    const respuesta = respuestas.get(f.id);
    return {
      ...this.publico(f, ahora),
      tienda: { nombre: f.tienda.nombre, stand: f.tienda.stand },
      precio: f.precioCentimos === null ? null : precioDe(Number(f.precioCentimos), f.moneda),
      nota: f.nota,
      propio: f.tiendaId === mirada.tiendaId,
      mio: f.autorId === mirada.usuarioId,
      respondiste: Boolean(respuesta),
      conversacion_id:
        respuesta && respuesta.usuarioId === mirada.usuarioId ? respuesta.conversacionId : null,
      respuestas: f._count.respuestas,
    };
  }

  private async respuestasDeMiTienda(
    ids: string[],
    tiendaId: string | null,
  ): Promise<Map<string, { usuarioId: string; conversacionId: string }>> {
    if (!tiendaId || ids.length === 0) return new Map();
    const filas = await this.prisma.enVivoRespuesta.findMany({
      where: { enVivoId: { in: ids }, tiendaId },
      select: { enVivoId: true, usuarioId: true, conversacionId: true },
    });
    return new Map(filas.map((r) => [r.enVivoId, r]));
  }

  /** Los de quien mira, en el orden de `ids`, con quién respondió a cada uno. */
  private async propios(
    ids: string[],
    usuario: UsuarioConTienda,
    ahora: Date,
  ): Promise<EnVivoPropio[]> {
    if (ids.length === 0) return [];
    const filas = await this.prisma.enVivo.findMany({
      where: { id: { in: ids }, autorId: usuario.id },
      select: {
        ...SELECT_CON_VENDEDOR,
        respuestas: {
          select: {
            creadaEn: true,
            conversacionId: true,
            tienda: { select: { nombre: true } },
          },
          orderBy: { creadaEn: 'desc' },
        },
      },
    });
    const mirada: Mirada = {
      audiencia: 'vendedor',
      tiendaId: usuario.tiendaId,
      usuarioId: usuario.id,
    };
    const porId = new Map(filas.map((f) => [f.id, f]));
    return ids.flatMap((id) => {
      const f = porId.get(id);
      if (!f) return [];
      return [
        {
          ...this.conVendedor(f, ahora, mirada, new Map()),
          avisadas: f.avisadas,
          vendidas: f.vendidas,
          respuestas_recibidas: f.respuestas.map((r) => ({
            tienda: r.tienda.nombre,
            conversacion_id: r.conversacionId,
            creada_en: r.creadaEn.toISOString(),
          })),
        },
      ];
    });
  }
}
