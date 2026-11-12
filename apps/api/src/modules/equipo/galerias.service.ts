import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  slugDe,
  type AgregarAvisoGaleriaDatos,
  type CrearGaleriaDatos,
  type EditarGaleriaDatos,
  type GaleriaEquipo,
  type RespuestaGaleriasEquipo,
} from '@paselibre/contracts';
import { Prisma, type Galeria } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import {
  avisosDeGalerias,
  claveDeGaleria,
  SOLICITUD_CON_GALERIA_NUEVA,
} from '../../shared/galerias-nuevas';
import { RegistroService } from '../registro/registro.service';
import type { SesionActiva } from '../sesion/sesion.types';

/** El slug de «Independientes» en los filtros: ninguna galería puede llamarse así. */
const SLUG_RESERVADO = 'independientes';

function noExiste(): ApiHttpException {
  return new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esa galería no existe.');
}

function conflicto(mensaje: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', mensaje);
}

function invalido(mensaje: string): ApiHttpException {
  return new ApiHttpException(HttpStatus.BAD_REQUEST, 'DATOS_INVALIDOS', mensaje);
}

/** El slug de un nombre nuevo, o un error si no sirve («!!!» o «Independientes»). */
function slugValido(nombre: string): string {
  const slug = slugDe(nombre);
  if (!slug) throw invalido('Escribe el nombre de la galería con letras o números.');
  if (slug === SLUG_RESERVADO) throw invalido('Ese nombre está reservado. Elige otro.');
  return slug.slice(0, 80);
}

/** Dos galerías con el mismo nombre o slug chocan en el índice único. */
function traducirDuplicado(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw conflicto('Ya hay una galería con ese nombre.');
  }
  throw error;
}

function aEquipo(galeria: Galeria, tiendas: number): GaleriaEquipo {
  return {
    id: galeria.id,
    nombre: galeria.nombre,
    slug: galeria.slug,
    activa: galeria.activa,
    orden: galeria.orden,
    metros: galeria.metros,
    tiendas,
  };
}

/**
 * Equipo › Galerías (docs/18 §3): la única lista de galerías del sitio. El orden es el de la
 * avenida; ocultar pone `activa = false` y la saca de Crear cuenta, Datos de la tienda y Wilson
 * en vivo. Una galería con tiendas no se borra. Cada cambio queda en la actividad del equipo.
 */
@Injectable()
export class GaleriasService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RegistroService) private readonly registro: RegistroService,
  ) {}

  async lista(): Promise<RespuestaGaleriasEquipo> {
    const [galerias, avisos] = await Promise.all([
      this.prisma.galeria.findMany({
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        include: { _count: { select: { tiendas: true } } },
      }),
      avisosDeGalerias(this.prisma),
    ]);
    return {
      galerias: galerias.map((galeria) => aEquipo(galeria, galeria._count.tiendas)),
      avisos,
    };
  }

  async crear(datos: CrearGaleriaDatos, sesion: SesionActiva): Promise<GaleriaEquipo> {
    const slug = slugValido(datos.nombre);
    const galeria = await this.prisma
      .$transaction(async (tx) => {
        await this.exigirNombreLibre(tx, datos.nombre, slug, null);
        const creada = await tx.galeria.create({
          data: {
            nombre: datos.nombre,
            slug,
            metros: datos.metros ?? null,
            orden: await this.siguienteOrden(tx),
          },
        });
        await this.anotar(tx, sesion, `agregó la galería ${creada.nombre}`);
        return creada;
      })
      .catch(traducirDuplicado);
    return aEquipo(galeria, 0);
  }

  async editar(
    id: string,
    datos: EditarGaleriaDatos,
    sesion: SesionActiva,
  ): Promise<GaleriaEquipo> {
    const antes = await this.prisma.galeria.findUnique({ where: { id } });
    if (!antes) throw noExiste();
    // El slug no cambia al renombrar: los enlaces con `?galeria=` siguen sirviendo.
    if (datos.nombre !== undefined && datos.nombre !== antes.nombre) {
      slugValido(datos.nombre);
    }
    const galeria = await this.prisma
      .$transaction(async (tx) => {
        if (datos.nombre !== undefined && datos.nombre !== antes.nombre) {
          await this.exigirNombreLibre(tx, datos.nombre, null, id);
        }
        const nueva = await tx.galeria.update({
          where: { id },
          data: {
            ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
            ...(datos.metros !== undefined ? { metros: datos.metros } : {}),
            ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
          },
        });
        const cambios: string[] = [];
        if (nueva.nombre !== antes.nombre) {
          cambios.push(`renombró la galería ${antes.nombre} a ${nueva.nombre}`);
        }
        if (nueva.metros !== antes.metros) {
          cambios.push(`cambió los metros de ${nueva.nombre}`);
        }
        if (nueva.activa !== antes.activa) {
          cambios.push(
            `${nueva.activa ? 'volvió a mostrar' : 'ocultó'} la galería ${nueva.nombre}`,
          );
        }
        for (const cambio of cambios) await this.anotar(tx, sesion, cambio);
        return nueva;
      })
      .catch(traducirDuplicado);
    return aEquipo(galeria, await this.prisma.tienda.count({ where: { galeriaId: id } }));
  }

  /** Arrastrar: llegan todas, en el orden nuevo. Si la lista cambió mientras tanto, no se toca. */
  async ordenar(ids: string[], sesion: SesionActiva): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Un candado: dos personas arrastrando a la vez no mezclan sus órdenes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('galerias:orden'))`;
      const todas = await tx.galeria.findMany({ select: { id: true } });
      const pedidas = new Set(ids);
      if (todas.length !== ids.length || todas.some((galeria) => !pedidas.has(galeria.id))) {
        throw conflicto('La lista de galerías cambió. Vuelve a cargar la página.');
      }
      for (const [indice, galeriaId] of ids.entries()) {
        await tx.galeria.update({ where: { id: galeriaId }, data: { orden: indice + 1 } });
      }
      await this.anotar(tx, sesion, 'cambió el orden de las galerías');
    });
  }

  /** Solo se borra una galería que nadie usa; con tiendas, se oculta. */
  async borrar(id: string, sesion: SesionActiva): Promise<void> {
    const galeria = await this.prisma.galeria.findUnique({
      where: { id },
      include: { _count: { select: { tiendas: true, enVivo: true, cambiosLugar: true } } },
    });
    if (!galeria) throw noExiste();
    if (galeria._count.tiendas > 0) {
      throw conflicto(
        `${galeria.nombre} tiene ${galeria._count.tiendas === 1 ? '1 tienda' : `${galeria._count.tiendas} tiendas`}: no se puede borrar. Puedes ocultarla.`,
      );
    }
    const solicitudes = await this.prisma.solicitud.count({ where: { galeriaId: id } });
    if (galeria._count.enVivo > 0 || galeria._count.cambiosLugar > 0 || solicitudes > 0) {
      throw conflicto(
        `${galeria.nombre} ya se usó en pedidos o solicitudes: no se puede borrar. Puedes ocultarla.`,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.galeria.delete({ where: { id } });
      await this.anotar(tx, sesion, `borró la galería ${galeria.nombre}`);
    });
  }

  /**
   * «Agregar» de un aviso «Galería nueva: X»: crea la galería (o usa la que ya tenga ese nombre)
   * y pone en ella a las solicitudes que la escribieron. Al aprobarse, su tienda queda ahí.
   */
  async agregarAviso(
    avisoId: string,
    datos: AgregarAvisoGaleriaDatos,
    sesion: SesionActiva,
  ): Promise<GaleriaEquipo> {
    const aviso = await this.avisoPendiente(avisoId);
    const nombre = datos.nombre ?? aviso.texto;
    const slug = slugValido(nombre);
    const resultado = await this.prisma
      .$transaction(async (tx) => {
        const existente = await tx.galeria.findFirst({
          where: { OR: [{ slug }, { nombre: { equals: nombre, mode: 'insensitive' } }] },
        });
        const galeria = existente
          ? await tx.galeria.update({
              where: { id: existente.id },
              data: {
                activa: true,
                ...(datos.metros !== undefined ? { metros: datos.metros } : {}),
              },
            })
          : await tx.galeria.create({
              data: {
                nombre,
                slug,
                metros: datos.metros ?? null,
                orden: await this.siguienteOrden(tx),
              },
            });
        if (!existente) await this.anotar(tx, sesion, `agregó la galería ${galeria.nombre}`);

        const grupo = await this.grupoDe(tx, aviso.clave);
        await tx.solicitud.updateMany({
          where: { id: { in: grupo.map((s) => s.id) } },
          data: { galeriaId: galeria.id, galeriaOtraResueltaEn: new Date() },
        });
        return { galeria, grupo };
      })
      .catch(traducirDuplicado);

    // Las que tenían RUC activo y habido solo esperaban su galería: se aprueban solas y su
    // tienda queda en la galería nueva. Las demás siguen en Solicitudes, ya con la galería.
    for (const solicitud of resultado.grupo) {
      if (!(await this.registro.aprobarSiEsApta(solicitud.id))) continue;
      const { tiendaId } = await this.prisma.solicitud.findUniqueOrThrow({
        where: { id: solicitud.id },
        select: { tiendaId: true },
      });
      await this.anotar(
        this.prisma,
        sesion,
        `con la galería ${resultado.galeria.nombre}, se aprobó sola ${solicitud.nombreComercial} (RUC)`,
        tiendaId,
      );
    }
    return aEquipo(
      resultado.galeria,
      await this.prisma.tienda.count({ where: { galeriaId: resultado.galeria.id } }),
    );
  }

  /** «Descartar»: el aviso se va; las tiendas siguen sin galería (el equipo la elige al aprobar). */
  async descartarAviso(avisoId: string, sesion: SesionActiva): Promise<void> {
    const aviso = await this.avisoPendiente(avisoId);
    await this.prisma.$transaction(async (tx) => {
      const grupo = await this.grupoDe(tx, aviso.clave);
      await tx.solicitud.updateMany({
        where: { id: { in: grupo.map((s) => s.id) } },
        data: { galeriaOtraResueltaEn: new Date() },
      });
      await this.anotar(tx, sesion, `descartó la galería nueva «${aviso.texto}»`);
    });
  }

  // ── Adentro ───────────────────────────────────────────────────────────────

  private async avisoPendiente(id: string): Promise<{ texto: string; clave: string }> {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, ...SOLICITUD_CON_GALERIA_NUEVA },
      select: { galeriaOtra: true },
    });
    const texto = solicitud?.galeriaOtra?.trim();
    if (!texto) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Ese aviso ya no está.');
    }
    return { texto, clave: claveDeGaleria(texto) };
  }

  /** Las solicitudes con aviso pendiente que escribieron la misma galería. */
  private async grupoDe(tx: Prisma.TransactionClient, clave: string) {
    const pendientes = await tx.solicitud.findMany({
      where: SOLICITUD_CON_GALERIA_NUEVA,
      select: { id: true, galeriaOtra: true, nombreComercial: true },
    });
    return pendientes.filter((s) => s.galeriaOtra && claveDeGaleria(s.galeriaOtra) === clave);
  }

  private async exigirNombreLibre(
    tx: Prisma.TransactionClient,
    nombre: string,
    slug: string | null,
    salvo: string | null,
  ): Promise<void> {
    const otra = await tx.galeria.findFirst({
      where: {
        ...(salvo ? { id: { not: salvo } } : {}),
        OR: [{ nombre: { equals: nombre, mode: 'insensitive' } }, ...(slug ? [{ slug }] : [])],
      },
      select: { id: true },
    });
    if (otra) throw conflicto('Ya hay una galería con ese nombre.');
  }

  /** Una galería nueva va al final de la lista. */
  private async siguienteOrden(tx: Prisma.TransactionClient): Promise<number> {
    const { _max } = await tx.galeria.aggregate({ _max: { orden: true } });
    return (_max.orden ?? 0) + 1;
  }

  private async anotar(
    tx: Pick<Prisma.TransactionClient, 'registroEquipo'>,
    sesion: SesionActiva,
    accion: string,
    tiendaId: string | null = null,
  ): Promise<void> {
    await tx.registroEquipo.create({
      data: { autorId: sesion.usuario.id, accion: accion.slice(0, 240), tiendaId },
    });
  }
}
