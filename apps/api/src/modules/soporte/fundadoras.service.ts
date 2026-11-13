import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  DIAS_FUNDADORA,
  MAX_FUNDADORAS,
  type AgregarFundadoraDatos,
  type CambiarFundadoraDatos,
  type FundadoraEnPanel,
  type RespuestaFundadoras,
} from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { candadoDeFundadoras, lugaresDeFundadoras } from '../../shared/fundadoras';
import type { SesionActiva } from '../sesion/sesion.types';

const SELECT_FUNDADORA = {
  id: true,
  nombre: true,
  stand: true,
  galeria: { select: { nombre: true } },
  fundadoraDesde: true,
  fundadoraDia: true,
  fundadoraSello: true,
  fundadoraPrioridad: true,
} satisfies Prisma.TiendaSelect;

type FilaFundadora = Prisma.TiendaGetPayload<{ select: typeof SELECT_FUNDADORA }>;

const ES_FUNDADORA = { fundadoraDesde: { not: null } } satisfies Prisma.TiendaWhereInput;

function aFundadora(fila: FilaFundadora): FundadoraEnPanel {
  return {
    tienda_id: fila.id,
    nombre: fila.nombre,
    galeria: fila.galeria?.nombre ?? null,
    stand: fila.stand,
    dia: fila.fundadoraDia,
    sello: fila.fundadoraSello,
    prioridad: fila.fundadoraPrioridad,
    desde: (fila.fundadoraDesde ?? new Date()).toISOString(),
  };
}

const nombreDelDia = (dia: number) => DIAS_FUNDADORA.find((d) => d.dia === dia)?.nombre ?? '';

/**
 * Equipo › Tiendas › Fundadoras (doc 20, punto 7): agregar o quitar fundadoras (15 como máximo),
 * su día destacado, el sello en su perfil y la prioridad en el chat. Cada cambio queda en el
 * registro del Equipo.
 */
@Injectable()
export class FundadorasService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async lista(): Promise<RespuestaFundadoras> {
    const filas = await this.prisma.tienda.findMany({
      where: ES_FUNDADORA,
      orderBy: [{ fundadoraDesde: 'asc' }, { nombre: 'asc' }],
      select: SELECT_FUNDADORA,
    });
    return { maximo: MAX_FUNDADORAS, fundadoras: filas.map(aFundadora) };
  }

  /**
   * «+ Agregar fundadora». El tope de 15 se cuenta dentro de una transacción serializable y con el
   * candado de las fundadoras: ni dos personas del Equipo a la vez ni una tienda que se registra en
   * ese momento pasan de 15. Sin día, le toca el que tenga menos.
   */
  async agregar(datos: AgregarFundadoraDatos, sesion: SesionActiva): Promise<FundadoraEnPanel> {
    try {
      return aFundadora(await this.agregarEnTransaccion(datos, sesion));
    } catch (error) {
      // Dos a la vez: la otra transacción ganó. Se vuelve a intentar con lo que quedó.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ApiHttpException(
          HttpStatus.CONFLICT,
          'CONFLICTO',
          'Alguien del Equipo cambió las fundadoras recién. Vuelve a intentarlo.',
        );
      }
      throw error;
    }
  }

  private agregarEnTransaccion(
    datos: AgregarFundadoraDatos,
    sesion: SesionActiva,
  ): Promise<FilaFundadora> {
    return this.prisma.$transaction(
      async (tx) => {
        await candadoDeFundadoras(tx);
        const tienda = await tx.tienda.findFirst({
          where: { id: datos.tienda_id, estado: 'ACTIVA' },
          select: { nombre: true, fundadoraDesde: true },
        });
        if (!tienda) {
          throw new ApiHttpException(
            HttpStatus.NOT_FOUND,
            'NO_ENCONTRADO',
            'Esta tienda no existe.',
          );
        }
        if (tienda.fundadoraDesde) {
          throw new ApiHttpException(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            `${tienda.nombre} ya es fundadora.`,
          );
        }
        const { yaSon, diaConMenos } = await lugaresDeFundadoras(tx);
        if (yaSon >= MAX_FUNDADORAS) {
          throw new ApiHttpException(
            HttpStatus.CONFLICT,
            'CONFLICTO',
            `Ya están las ${MAX_FUNDADORAS}. Quita una para agregar otra.`,
          );
        }
        const dia = datos.dia ?? diaConMenos;
        const creada = await tx.tienda.update({
          where: { id: datos.tienda_id },
          data: {
            fundadoraDesde: new Date(),
            fundadoraDia: dia,
            fundadoraSello: true,
            fundadoraPrioridad: true,
          },
          select: SELECT_FUNDADORA,
        });
        await tx.registroEquipo.create({
          data: {
            autorId: sesion.usuario.id,
            accion:
              `agregó a ${tienda.nombre} a las tiendas fundadoras (su día: ${nombreDelDia(dia)})`.slice(
                0,
                240,
              ),
          },
        });
        return creada;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /** Su día destacado, «Sello en su perfil» o «Prioridad en el chat». */
  async cambiar(
    tiendaId: string,
    datos: CambiarFundadoraDatos,
    sesion: SesionActiva,
  ): Promise<FundadoraEnPanel> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id: tiendaId, ...ES_FUNDADORA },
      select: { nombre: true },
    });
    if (!tienda) {
      throw new ApiHttpException(
        HttpStatus.NOT_FOUND,
        'NO_ENCONTRADO',
        'Esta tienda no es fundadora.',
      );
    }
    const cambios = [
      datos.dia !== undefined ? `su día pasa al ${nombreDelDia(datos.dia)}` : null,
      datos.sello !== undefined ? (datos.sello ? 'prendió el sello' : 'apagó el sello') : null,
      datos.prioridad !== undefined
        ? datos.prioridad
          ? 'prendió la prioridad en el chat'
          : 'apagó la prioridad en el chat'
        : null,
    ].filter(Boolean);
    const [fila] = await this.prisma.$transaction([
      this.prisma.tienda.update({
        where: { id: tiendaId },
        data: {
          ...(datos.dia !== undefined ? { fundadoraDia: datos.dia } : {}),
          ...(datos.sello !== undefined ? { fundadoraSello: datos.sello } : {}),
          ...(datos.prioridad !== undefined ? { fundadoraPrioridad: datos.prioridad } : {}),
        },
        select: SELECT_FUNDADORA,
      }),
      this.prisma.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          accion: `fundadora ${tienda.nombre}: ${cambios.join(', ')}`.slice(0, 240),
        },
      }),
    ]);
    return aFundadora(fila);
  }

  /** «Quitar»: deja de ser fundadora y libera su lugar. */
  async quitar(tiendaId: string, sesion: SesionActiva): Promise<void> {
    const tienda = await this.prisma.tienda.findFirst({
      where: { id: tiendaId, ...ES_FUNDADORA },
      select: { nombre: true },
    });
    if (!tienda) return;
    await this.prisma.$transaction([
      this.prisma.tienda.update({
        where: { id: tiendaId },
        data: {
          fundadoraDesde: null,
          fundadoraDia: null,
          fundadoraSello: true,
          fundadoraPrioridad: true,
        },
      }),
      this.prisma.registroEquipo.create({
        data: {
          autorId: sesion.usuario.id,
          accion: `quitó a ${tienda.nombre} de las tiendas fundadoras`.slice(0, 240),
        },
      }),
    ]);
  }
}
