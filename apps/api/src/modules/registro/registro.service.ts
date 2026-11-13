import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  CATEGORIAS_REGISTRO,
  HORAS_DE_REVISION,
  horarioATexto,
  type CorregirSolicitud,
  type CrearSolicitud,
  type DatosRuc,
  type FiltroSolicitudes,
  type Horario,
  type RespuestaCodigo,
  type RespuestaOpcionesRegistro,
  type RespuestaRuc,
  type RespuestaSolicitud,
  type RespuestaSolicitudesEquipo,
  type RespuestaVerificacion,
  type SolicitudEquipo,
} from '@paselibre/contracts';
import { Prisma, type Solicitud } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { entrarSiHayLugar } from '../../shared/fundadoras';
import { RESPUESTAS_RAPIDAS_INICIALES } from '../cuenta/respuestas-rapidas';
import { cifrarClave, esClaveComprometida } from '../sesion/clave';
import { INTERRUPTOR_REGISTRO, type InterruptorRegistro } from './interruptor';
import { PROVEEDOR_RUC, PROVEEDOR_SMS, type ProveedorRuc, type ProveedorSms } from './proveedores';

const MINUTOS_DEL_CODIGO = 10;
const INTENTOS_DEL_CODIGO = 5;
const SEGUNDOS_PARA_REENVIAR = 60;
const CODIGOS_POR_HORA = 3;
const MINUTOS_DEL_TOKEN = 30;

const sha256 = (texto: string): string => createHash('sha256').update(texto).digest('hex');
const enMinutos = (minutos: number): Date => new Date(Date.now() + minutos * 60_000);
const comoJson = (valor: unknown): Prisma.InputJsonValue => valor as Prisma.InputJsonValue;

function igualesEnTiempoConstante(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function noEncontrada(): ApiHttpException {
  return new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esa solicitud no existe.');
}

/** Que el apuro de quien está llenando el formulario no choque con otra persona del equipo. */
function conflicto(mensaje: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', mensaje);
}

function invalido(mensaje: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', mensaje);
}

/**
 * Registro propio de tiendas (RF-01, RF-04; sección 3 del lienzo «Versión final», D-54).
 *
 * 1. Se pide un código por SMS y se confirma: el celular queda comprobado y se entrega un token
 *    de un solo uso.
 * 2. Con ese token se envía la solicitud. Con RUC activo y habido en SUNAT se aprueba sola; en
 *    los demás casos queda pendiente y una persona del equipo la revisa (máx. 3 h).
 * 3. Quien se registró consulta su estado con un código que solo ella conoce. Si el equipo
 *    pidió cambios, los corrige y vuelve a la cola.
 *
 * Entra con su celular como usuario y la contraseña que eligió. El DNI, si lo dio, se borra al
 * resolver la solicitud. Cada decisión queda en `auditoria`.
 */
@Injectable()
export class RegistroService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(INTERRUPTOR_REGISTRO) private readonly interruptor: InterruptorRegistro,
    @Inject(PROVEEDOR_SMS) private readonly sms: ProveedorSms,
    @Inject(PROVEEDOR_RUC) private readonly ruc: ProveedorRuc,
  ) {}

  private exigirActivo(): void {
    if (!this.interruptor.activo) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esa página no existe.');
    }
  }

  // ── Lo que ve quien se registra ───────────────────────────────────────────

  /** No falla apagado: la web lo consulta para decidir si ofrece «Crear cuenta». */
  async opciones(): Promise<RespuestaOpcionesRegistro> {
    if (!this.interruptor.activo) return { activo: false, galerias: [], categorias: [] };
    const galerias = await this.prisma.galeria.findMany({
      where: { activa: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { slug: true, nombre: true },
    });
    return { activo: true, galerias, categorias: CATEGORIAS_REGISTRO };
  }

  async pedirCodigo(celular: string): Promise<RespuestaCodigo> {
    this.exigirActivo();
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Un candado por celular: dos pedidos a la vez no pasan juntos el «3 por hora».
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'codigo:' + celular}))`;
      await this.revisarYCrearCodigo(tx, celular, codigo);
    });
    await this.sms.enviar(
      celular,
      `Tu código de PaseLibre es ${codigo}. Vale ${MINUTOS_DEL_CODIGO} minutos. No lo compartas.`,
    );
    return {
      enviado: true,
      reenviar_en_s: SEGUNDOS_PARA_REENVIAR,
      codigo_prueba: this.sms.simulado ? codigo : null,
    };
  }

  private async revisarYCrearCodigo(
    tx: Prisma.TransactionClient,
    celular: string,
    codigo: string,
  ): Promise<void> {
    const ultimos = await tx.codigoCelular.findMany({
      where: { celular, creadoEn: { gt: new Date(Date.now() - 60 * 60_000) } },
      orderBy: { creadoEn: 'desc' },
      select: { creadoEn: true },
    });
    const ultimo = ultimos[0];
    if (ultimo && Date.now() - ultimo.creadoEn.getTime() < SEGUNDOS_PARA_REENVIAR * 1000) {
      throw new ApiHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADAS_SOLICITUDES',
        'Espera un minuto antes de pedir otro código.',
      );
    }
    if (ultimos.length >= CODIGOS_POR_HORA) {
      throw new ApiHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADAS_SOLICITUDES',
        'Pediste varios códigos. Vuelve a intentarlo en una hora.',
      );
    }

    await tx.codigoCelular.create({
      data: {
        celular,
        codigoHash: sha256(`${celular}:${codigo}`),
        expiraEn: enMinutos(MINUTOS_DEL_CODIGO),
      },
    });
  }

  async verificarCodigo(celular: string, codigo: string): Promise<RespuestaVerificacion> {
    this.exigirActivo();
    const fila = await this.prisma.codigoCelular.findFirst({
      where: { celular, verificadoEn: null, expiraEn: { gt: new Date() } },
      orderBy: { creadoEn: 'desc' },
    });
    if (!fila) throw invalido('Ese código venció. Pide uno nuevo.');
    // Se cuenta el intento antes de comparar y en una sola sentencia: con 50 intentos a la vez
    // todos leerían «0 intentos» si se contara después.
    const contado = await this.prisma.codigoCelular.updateMany({
      where: { id: fila.id, intentos: { lt: INTENTOS_DEL_CODIGO } },
      data: { intentos: { increment: 1 } },
    });
    if (contado.count === 0) {
      throw new ApiHttpException(
        HttpStatus.TOO_MANY_REQUESTS,
        'DEMASIADAS_SOLICITUDES',
        'Demasiados intentos con este código. Pide uno nuevo.',
      );
    }
    if (!igualesEnTiempoConstante(fila.codigoHash, sha256(`${celular}:${codigo}`))) {
      const intentos = fila.intentos + 1;
      const quedan = INTENTOS_DEL_CODIGO - intentos;
      throw invalido(
        quedan > 0
          ? `Ese código no es. Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'}.`
          : 'Ese código no es y ya no te quedan intentos. Pide uno nuevo.',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expira = enMinutos(MINUTOS_DEL_TOKEN);
    await this.prisma.codigoCelular.update({
      where: { id: fila.id },
      data: { verificadoEn: new Date(), tokenHash: sha256(token), tokenExpiraEn: expira },
    });
    return { token_celular: token, expira_en: expira.toISOString() };
  }

  async consultarRuc(ruc: string): Promise<RespuestaRuc> {
    this.exigirActivo();
    const datos = await this.ruc.consultar(ruc);
    return { encontrado: datos !== null, apto: esApto(datos), datos };
  }

  async crear(entrada: CrearSolicitud): Promise<RespuestaSolicitud> {
    this.exigirActivo();
    const codigo = await this.prisma.codigoCelular.findUnique({
      where: { tokenHash: sha256(entrada.token_celular) },
    });
    if (
      !codigo ||
      codigo.consumidoEn ||
      !codigo.verificadoEn ||
      !codigo.tokenExpiraEn ||
      codigo.tokenExpiraEn < new Date()
    ) {
      throw invalido('Confirma tu celular otra vez: el código ya no vale.');
    }
    const celular = codigo.celular;

    if (await this.prisma.usuario.findUnique({ where: { usuario: celular } })) {
      throw conflicto('Ese celular ya tiene una cuenta. Inicia sesión.');
    }
    const abierta = await this.prisma.solicitud.findFirst({
      where: { celular, estado: { in: ['PENDIENTE', 'REQUIERE_CAMBIOS'] } },
    });
    if (abierta) {
      throw conflicto('Ya enviaste una solicitud con este celular y está en revisión.');
    }

    const campos = await this.campos(entrada);
    if (esClaveComprometida(entrada.clave)) {
      throw invalido('Esa contraseña es demasiado común. Elige otra.');
    }
    const claveHash = await cifrarClave(entrada.clave);
    const consulta = randomBytes(24).toString('base64url');
    const apta = seApruebaSola(campos);

    const resultado = await this.prisma
      .$transaction(async (tx) => {
        const creada = await tx.solicitud.create({
          data: {
            ...campos,
            consultaHash: sha256(consulta),
            celular,
            celularVerificadoEn: codigo.verificadoEn!,
            claveHash,
            aceptoTerminosEn: new Date(),
            venceEn: apta ? null : enMinutos(HORAS_DE_REVISION * 60),
          },
        });
        const gastado = await tx.codigoCelular.updateMany({
          where: { id: codigo.id, consumidoEn: null },
          data: { consumidoEn: new Date() },
        });
        if (gastado.count === 0) throw invalido('Confirma tu celular otra vez.');
        if (!apta) return creada;
        return this.aprobarEnTx(tx, creada, creada.galeriaId, null, true);
      })
      .catch(traducirDuplicado);

    return this.aRespuesta(resultado, consulta);
  }

  async estado(consulta: string): Promise<RespuestaSolicitud> {
    this.exigirActivo();
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { consultaHash: sha256(consulta) },
    });
    if (!solicitud) throw noEncontrada();
    return this.aRespuesta(solicitud, null);
  }

  async corregir(consulta: string, entrada: CorregirSolicitud): Promise<RespuestaSolicitud> {
    this.exigirActivo();
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { consultaHash: sha256(consulta) },
    });
    if (!solicitud) throw noEncontrada();
    if (solicitud.estado !== 'REQUIERE_CAMBIOS') {
      throw conflicto('Esta solicitud ya no se puede corregir.');
    }
    const campos = await this.campos(entrada);
    if (entrada.clave && esClaveComprometida(entrada.clave)) {
      throw invalido('Esa contraseña es demasiado común. Elige otra.');
    }
    const apta = seApruebaSola(campos);

    const resultado = await this.prisma
      .$transaction(async (tx) => {
        const actualizada = await tx.solicitud.update({
          where: { id: solicitud.id },
          data: {
            ...campos,
            // Quien cambia de «sin RUC» a RUC deja de tener DNI o recomendación, y al revés.
            dni: campos.dni ?? null,
            recomiendaTienda: campos.recomiendaTienda ?? null,
            ruc: campos.ruc ?? null,
            rucDatos: campos.rucDatos ?? Prisma.DbNull,
            ...(entrada.clave ? { claveHash: await cifrarClave(entrada.clave) } : {}),
            estado: 'PENDIENTE',
            mensajeEquipo: null,
            venceEn: apta ? null : enMinutos(HORAS_DE_REVISION * 60),
          },
        });
        await tx.auditoria.create({
          data: {
            accion: 'corregir_solicitud',
            objeto: 'solicitud',
            objetoId: solicitud.id,
            datos: {},
          },
        });
        if (!apta) return actualizada;
        return this.aprobarEnTx(tx, actualizada, actualizada.galeriaId, null, true);
      })
      .catch(traducirDuplicado);

    return this.aRespuesta(resultado, null);
  }

  // ── Panel del equipo ──────────────────────────────────────────────────────

  async listar(filtro: FiltroSolicitudes): Promise<RespuestaSolicitudesEquipo> {
    const [filas, conteos, vencidas, galerias] = await Promise.all([
      this.prisma.solicitud.findMany({
        where: filtro.estado ? { estado: filtro.estado } : {},
        orderBy: { creadaEn: 'desc' },
        take: 300,
      }),
      this.prisma.solicitud.groupBy({ by: ['estado'], _count: { _all: true } }),
      this.prisma.solicitud.count({ where: { estado: 'PENDIENTE', venceEn: { lt: new Date() } } }),
      this.galeriasPorId(),
    ]);
    const cuantas = (estado: string): number =>
      conteos.find((c) => c.estado === estado)?._count._all ?? 0;
    const prioridad = (s: Solicitud): number =>
      s.estado === 'PENDIENTE' ? 0 : s.estado === 'REQUIERE_CAMBIOS' ? 1 : 2;
    const ordenadas = [...filas].sort(
      (a, b) =>
        prioridad(a) - prioridad(b) ||
        (a.estado === 'PENDIENTE' && b.estado === 'PENDIENTE'
          ? (a.venceEn?.getTime() ?? Infinity) - (b.venceEn?.getTime() ?? Infinity)
          : b.creadaEn.getTime() - a.creadaEn.getTime()),
    );
    return {
      solicitudes: ordenadas.map((s) => aEquipo(s, galerias)),
      resumen: {
        pendientes: cuantas('PENDIENTE'),
        requieren_cambios: cuantas('REQUIERE_CAMBIOS'),
        aprobadas: cuantas('APROBADA'),
        rechazadas: cuantas('RECHAZADA'),
        vencidas,
      },
    };
  }

  async detalle(id: string): Promise<SolicitudEquipo> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });
    if (!solicitud) throw noEncontrada();
    return aEquipo(solicitud, await this.galeriasPorId());
  }

  async aprobar(
    id: string,
    galeriaSlug: string | undefined,
    actorId: string,
  ): Promise<SolicitudEquipo> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });
    if (!solicitud) throw noEncontrada();
    if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'REQUIERE_CAMBIOS') {
      throw conflicto('Esta solicitud ya fue resuelta.');
    }
    let galeriaId = solicitud.galeriaId;
    if (galeriaSlug) {
      const galeria = await this.prisma.galeria.findUnique({ where: { slug: galeriaSlug } });
      if (!galeria) throw invalido('Esa galería no existe.');
      galeriaId = galeria.id;
    }
    if (!galeriaId) {
      throw invalido(
        `Eligió «${solicitud.galeriaOtra ?? 'otra galería'}», que aún no está en la lista. Elige una galería para aprobarla.`,
      );
    }
    const aprobada = await this.prisma
      .$transaction((tx) => this.aprobarEnTx(tx, solicitud, galeriaId, actorId, false))
      .catch(traducirDuplicado);
    await this.sms.enviar(
      solicitud.celular,
      'Tu cuenta de PaseLibre fue aprobada. Entra con tu celular y la contraseña que elegiste.',
    );
    return aEquipo(aprobada, await this.galeriasPorId());
  }

  /**
   * Después de «Agregar» una galería nueva (docs/18 §3): la solicitud con RUC activo y habido
   * que solo esperaba su galería se aprueba sola, como si la hubiera elegido de la lista. Las
   * demás siguen en la cola del equipo. Devuelve si se aprobó.
   */
  async aprobarSiEsApta(id: string): Promise<boolean> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });
    if (
      !solicitud ||
      solicitud.estado !== 'PENDIENTE' ||
      !seApruebaSola({ ...solicitud, rucDatos: solicitud.rucDatos ?? undefined })
    ) {
      return false;
    }
    await this.prisma
      .$transaction((tx) => this.aprobarEnTx(tx, solicitud, solicitud.galeriaId, null, true))
      .catch(traducirDuplicado);
    await this.sms.enviar(
      solicitud.celular,
      'Tu cuenta de PaseLibre fue aprobada. Entra con tu celular y la contraseña que elegiste.',
    );
    return true;
  }

  async pedirCambios(id: string, mensaje: string, actorId: string): Promise<SolicitudEquipo> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });
    if (!solicitud) throw noEncontrada();
    if (solicitud.estado !== 'PENDIENTE') throw conflicto('Esta solicitud ya fue resuelta.');
    const actualizada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.solicitud.update({
        where: { id },
        data: {
          estado: 'REQUIERE_CAMBIOS',
          mensajeEquipo: mensaje,
          venceEn: null,
          revisadaPorId: actorId,
          revisadaEn: new Date(),
        },
      });
      await tx.auditoria.create({
        data: {
          actorId,
          accion: 'pedir_cambios_solicitud',
          objeto: 'solicitud',
          objetoId: id,
          datos: { mensaje },
        },
      });
      return fila;
    });
    await this.sms.enviar(
      solicitud.celular,
      'PaseLibre: tu solicitud necesita un cambio. Abre el enlace de tu solicitud para verlo y corregirlo.',
    );
    return aEquipo(actualizada, await this.galeriasPorId());
  }

  async rechazar(id: string, motivo: string, actorId: string): Promise<SolicitudEquipo> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });
    if (!solicitud) throw noEncontrada();
    if (solicitud.estado !== 'PENDIENTE' && solicitud.estado !== 'REQUIERE_CAMBIOS') {
      throw conflicto('Esta solicitud ya fue resuelta.');
    }
    const actualizada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.solicitud.update({
        where: { id },
        data: {
          estado: 'RECHAZADA',
          mensajeEquipo: motivo,
          venceEn: null,
          dni: null,
          revisadaPorId: actorId,
          revisadaEn: new Date(),
        },
      });
      await tx.auditoria.create({
        data: {
          actorId,
          accion: 'rechazar_solicitud',
          objeto: 'solicitud',
          objetoId: id,
          datos: { motivo },
        },
      });
      return fila;
    });
    return aEquipo(actualizada, await this.galeriasPorId());
  }

  // ── Adentro ───────────────────────────────────────────────────────────────

  /** Crea la tienda y la cuenta de la solicitud y la deja aprobada. `actorId` nulo = se aprobó sola. */
  private async aprobarEnTx(
    tx: Prisma.TransactionClient,
    solicitud: Solicitud,
    galeriaId: string | null,
    actorId: string | null,
    sola: boolean,
  ): Promise<Solicitud> {
    const tienda = await tx.tienda.create({
      data: {
        tipo: 'TIENDA',
        nombre: solicitud.nombreComercial,
        galeriaId,
        stand: solicitud.stand,
        piso: solicitud.piso,
        whatsapp: solicitud.celular,
        horario: solicitud.horario,
        // «Una referencia para llegar» del registro es su «Cómo llegar» en el chat (PCH_WebLlegar).
        indicaciones: solicitud.referencia,
      },
    });
    // Entra como fundadora si quedan lugares (doc 20b).
    await entrarSiHayLugar(tx, tienda.id);
    const usuario = await tx.usuario.create({
      data: {
        tiendaId: tienda.id,
        rol: 'DUENO',
        usuario: solicitud.celular,
        nombre: solicitud.encargado,
        whatsapp: solicitud.celular,
        claveHash: solicitud.claveHash,
        // La contraseña la eligió ella misma: no hay clave temporal que cambiar.
        debeCambiarClave: false,
        respuestasRapidas: {
          create: [...RESPUESTAS_RAPIDAS_INICIALES],
        },
      },
    });
    const aprobada = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: {
        estado: 'APROBADA',
        aprobadaSola: sola,
        mensajeEquipo: null,
        venceEn: null,
        dni: null,
        galeriaId,
        revisadaPorId: actorId,
        revisadaEn: new Date(),
        tiendaId: tienda.id,
        usuarioId: usuario.id,
      },
    });
    await tx.auditoria.create({
      data: {
        actorId,
        accion: sola ? 'aprobar_solicitud_por_ruc' : 'aprobar_solicitud',
        objeto: 'solicitud',
        objetoId: solicitud.id,
        datos: { tienda_id: tienda.id, usuario_id: usuario.id },
      },
    });
    return aprobada;
  }

  /** Valida lo que depende de la base (galería, SUNAT) y arma las columnas de la solicitud. */
  private async campos(entrada: CrearSolicitud | CorregirSolicitud) {
    let galeriaId: string | null = null;
    if (entrada.galeria) {
      const galeria = await this.prisma.galeria.findFirst({
        where: { slug: entrada.galeria, activa: true },
      });
      if (!galeria) throw invalido('Esa galería no existe.');
      galeriaId = galeria.id;
    }

    let rucDatos: DatosRuc | null = null;
    if (entrada.metodo === 'RUC') {
      rucDatos = await this.ruc.consultar(entrada.ruc);
      if (!rucDatos) throw invalido('SUNAT no encontró ese RUC. Revísalo o elige «Sin RUC».');
    }

    const horario: Horario = entrada.horario;
    return {
      metodo: entrada.metodo,
      ruc: entrada.metodo === 'RUC' ? entrada.ruc : null,
      rucDatos: rucDatos ? comoJson(rucDatos) : undefined,
      dni: entrada.metodo === 'SIN_RUC_DNI' ? entrada.dni : null,
      recomiendaTienda:
        entrada.metodo === 'SIN_RUC_RECOMENDACION' ? entrada.recomienda_tienda : null,
      nombreComercial: entrada.nombre_comercial,
      categorias: entrada.categorias,
      galeriaId,
      galeriaOtra: entrada.galeria_otra,
      // Al corregir con «Otra galería», el aviso de Equipo › Galerías vuelve a salir.
      galeriaOtraResueltaEn: null,
      piso: entrada.piso || null,
      stand: entrada.stand,
      referencia: entrada.referencia || null,
      horario: horarioATexto(horario),
      horarioDatos: comoJson(horario),
      encargado: entrada.encargado,
    };
  }

  private async galeriasPorId(): Promise<Map<string, { slug: string; nombre: string }>> {
    const galerias = await this.prisma.galeria.findMany({
      select: { id: true, slug: true, nombre: true },
    });
    return new Map(galerias.map((g) => [g.id, { slug: g.slug, nombre: g.nombre }]));
  }

  private async aRespuesta(
    solicitud: Solicitud,
    consulta: string | null,
  ): Promise<RespuestaSolicitud> {
    const galeria = solicitud.galeriaId
      ? (await this.galeriasPorId()).get(solicitud.galeriaId)
      : undefined;
    return {
      consulta,
      estado: solicitud.estado,
      aprobada_sola: solicitud.aprobadaSola,
      vence_en: solicitud.venceEn?.toISOString() ?? null,
      mensaje_equipo: solicitud.mensajeEquipo,
      usuario: solicitud.estado === 'APROBADA' ? solicitud.celular : null,
      datos: {
        metodo: solicitud.metodo,
        ruc: solicitud.ruc,
        recomienda_tienda: solicitud.recomiendaTienda,
        nombre_comercial: solicitud.nombreComercial,
        categorias: solicitud.categorias,
        galeria: galeria?.slug ?? null,
        galeria_otra: solicitud.galeriaOtra,
        piso: solicitud.piso,
        stand: solicitud.stand,
        referencia: solicitud.referencia,
        horario: solicitud.horarioDatos as unknown as Horario,
        encargado: solicitud.encargado,
        celular: solicitud.celular,
      },
    };
  }
}

/** Con SUNAT: activo y habido. */
function esApto(datos: DatosRuc | null | undefined): boolean {
  return !!datos && datos.estado === 'ACTIVO' && datos.condicion === 'HABIDO';
}

/**
 * Con RUC activo y habido se aprueba sola, pero solo si eligió una galería de la lista: una
 * tienda no puede quedar sin galería. Con «Otra galería» espera a que el equipo la agregue en
 * Equipo › Galerías (docs/18 §3) o le elija una.
 */
function seApruebaSola(campos: {
  metodo: string;
  rucDatos?: unknown;
  galeriaId: string | null;
}): boolean {
  return (
    campos.metodo === 'RUC' &&
    campos.galeriaId !== null &&
    esApto(campos.rucDatos as DatosRuc | undefined)
  );
}

function aEquipo(
  s: Solicitud,
  galerias: Map<string, { slug: string; nombre: string }>,
): SolicitudEquipo {
  return {
    id: s.id,
    estado: s.estado,
    metodo: s.metodo,
    aprobada_sola: s.aprobadaSola,
    nombre_comercial: s.nombreComercial,
    celular: s.celular,
    categorias: s.categorias,
    galeria: s.galeriaId ? (galerias.get(s.galeriaId)?.nombre ?? null) : null,
    galeria_otra: s.galeriaOtra,
    piso: s.piso,
    stand: s.stand,
    referencia: s.referencia,
    horario: s.horario,
    encargado: s.encargado,
    ruc: s.ruc,
    ruc_datos: (s.rucDatos as DatosRuc | null) ?? null,
    dni: s.dni,
    recomienda_tienda: s.recomiendaTienda,
    mensaje_equipo: s.mensajeEquipo,
    vence_en: s.venceEn?.toISOString() ?? null,
    creada_en: s.creadaEn.toISOString(),
    revisada_en: s.revisadaEn?.toISOString() ?? null,
    tienda_id: s.tiendaId,
  };
}

/** Dos solicitudes a la vez con el mismo celular chocan en el usuario único. */
function traducirDuplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw conflicto('Ese celular ya tiene una cuenta o una solicitud en revisión.');
  }
  throw error;
}
