import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  MAX_DESTACADAS,
  type DestacadoActivo,
  type DestacarDatos,
  type RespuestaDestacados,
} from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { inicioDelDiaEnLima } from '../en-vivo/horario';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';

const HORA = 60 * 60 * 1000;
const HORA_LIMA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** «3:42 p. m.» */
export function horaLima(fecha: Date): string {
  return HORA_LIMA.format(fecha).replace(/\s/g, ' ');
}

/** «suave», «media» o «fuerte» para el registro del Equipo (doc 20, punto 4b). */
const FUERZA_EN_TEXTO: Record<DestacadoActivo['fuerza'], string> = {
  SUAVE: 'suave',
  MEDIA: 'media',
  FUERTE: 'fuerte',
};

const iniciales = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0] ?? '')
    .join('')
    .toUpperCase();

const SELECT_DESTACADO = {
  id: true,
  ofertas: true,
  hasta: true,
  avisada: true,
  fuerza: true,
  tienda: {
    select: {
      id: true,
      nombre: true,
      _count: { select: { ofertas: { where: { estado: 'ACTIVA' as const } } } },
    },
  },
  por: { select: { nombre: true } },
};

/**
 * «Destacar en silencio» (COR16 del lienzo final): el equipo sube las publicaciones de una tienda
 * un rato, con la fuerza que elija (doc 20, punto 4b: solo suma puntos en el Inicio). Nadie más lo nota; se apaga solo; hasta 3 tiendas a la vez. Si se elige, la tienda
 * recibe «Te dimos un empujoncito 🤫», que solo ve ella.
 */
@Injectable()
export class DestacadosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  private vigente(ahora = new Date()) {
    return { hasta: { gt: ahora }, quitadoEn: null };
  }

  private aActivo(fila: {
    id: string;
    ofertas: string[];
    hasta: Date;
    avisada: boolean;
    fuerza: DestacadoActivo['fuerza'];
    tienda: { id: string; nombre: string; _count: { ofertas: number } };
    por: { nombre: string };
  }): DestacadoActivo {
    return {
      id: fila.id,
      tienda: {
        id: fila.tienda.id,
        nombre: fila.tienda.nombre,
        iniciales: iniciales(fila.tienda.nombre),
      },
      publicaciones: fila.ofertas.length || fila.tienda._count.ofertas,
      todas: fila.ofertas.length === 0,
      hasta: fila.hasta.toISOString(),
      por: fila.por.nombre,
      avisada: fila.avisada,
      fuerza: fila.fuerza,
    };
  }

  async activos(): Promise<RespuestaDestacados> {
    const filas = await this.prisma.destacado.findMany({
      where: this.vigente(),
      orderBy: { hasta: 'asc' },
      select: SELECT_DESTACADO,
    });
    return { maximo: MAX_DESTACADAS, activas: filas.map((fila) => this.aActivo(fila)) };
  }

  async deTienda(tiendaId: string): Promise<DestacadoActivo | null> {
    const fila = await this.prisma.destacado.findFirst({
      where: { tiendaId, ...this.vigente() },
      orderBy: { hasta: 'desc' },
      select: SELECT_DESTACADO,
    });
    return fila ? this.aActivo(fila) : null;
  }

  async destacar(
    tiendaId: string,
    datos: DestacarDatos,
    sesion: SesionActiva,
  ): Promise<DestacadoActivo> {
    const ahora = new Date();
    const tienda = await this.prisma.tienda.findFirst({
      where: { id: tiendaId, estado: 'ACTIVA' },
      select: { nombre: true, usuarios: { where: { estado: 'ACTIVO' }, select: { id: true } } },
    });
    if (!tienda) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta tienda no existe.');
    }
    // Las elegidas tienen que ser publicaciones vigentes de esta tienda.
    if (datos.ofertas.length > 0) {
      const propias = await this.prisma.oferta.count({
        where: { id: { in: datos.ofertas }, tiendaId, estado: 'ACTIVA' },
      });
      if (propias !== new Set(datos.ofertas).size) {
        throw new ApiHttpException(
          HttpStatus.BAD_REQUEST,
          'DATOS_INVALIDOS',
          'Elige publicaciones activas de esta tienda.',
        );
      }
    }
    const hasta =
      datos.duracion === '1h'
        ? new Date(ahora.getTime() + HORA)
        : datos.duracion === '3h'
          ? new Date(ahora.getTime() + 3 * HORA)
          : new Date(inicioDelDiaEnLima(ahora).getTime() + 24 * HORA);

    const creado = await this.prisma.$transaction(async (tx) => {
      // Si ya estaba destacada, se reemplaza.
      await tx.destacado.updateMany({
        where: { tiendaId, ...this.vigente(ahora) },
        data: { quitadoEn: ahora },
      });
      const otras = await tx.destacado.count({ where: this.vigente(ahora) });
      if (otras >= MAX_DESTACADAS) {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          `Ya hay ${MAX_DESTACADAS} tiendas destacadas. Quita una o espera a que termine.`,
        );
      }
      const fila = await tx.destacado.create({
        data: {
          tiendaId,
          porId: sesion.usuario.id,
          ofertas: [...new Set(datos.ofertas)],
          hasta,
          avisada: datos.avisar,
          fuerza: datos.fuerza,
        },
        select: SELECT_DESTACADO,
      });
      const duracion =
        datos.duracion === '1h'
          ? 'por 1 hora'
          : datos.duracion === '3h'
            ? 'por 3 horas'
            : 'todo el día';
      await tx.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          accion: `destacó a ${tienda.nombre} ${duracion} (${FUERZA_EN_TEXTO[datos.fuerza]})`.slice(
            0,
            240,
          ),
        },
      });
      return fila;
    });

    if (datos.avisar) {
      await this.avisos.crear(
        tienda.usuarios.map((usuario) => usuario.id),
        {
          tipo: 'EQUIPO',
          titulo: '🤫 Te dimos un empujoncito',
          extracto: `Tus publicaciones salen primero hasta las ${horaLima(hasta).replace(/\.?$/, '.')} Es un regalo del equipo PaseLibre. ¡Disfrútalo!`,
          enlace: '/mis-publicaciones',
        },
      );
    }
    return this.aActivo(creado);
  }

  async quitar(id: string, sesion: SesionActiva): Promise<void> {
    const fila = await this.prisma.destacado.findFirst({
      where: { id, ...this.vigente() },
      select: { tienda: { select: { nombre: true } } },
    });
    if (!fila) return;
    await this.prisma.$transaction([
      this.prisma.destacado.update({ where: { id }, data: { quitadoEn: new Date() } }),
      this.prisma.registroEquipo.create({
        data: { autorId: sesion.usuario.id, accion: `quitó el destacado de ${fila.tienda.nombre}` },
      }),
    ]);
  }
}
