import { Inject, Injectable } from '@nestjs/common';
import { calcularReputacion, type ReputacionDetallada } from '@paselibre/contracts';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogoService } from '../catalogo/catalogo.service';

const DIAS_RECIENTES = 60;

/**
 * La reputación de una o varias tiendas (N03, N04): el promedio de estrellas, el nivel de «Baja»
 * a «Excelente» (`calcularReputacion`, en los contratos) y los tres datos que se muestran: pases
 * cerrados en 60 días, minutos para responder y porcentaje de chats respondidos.
 *
 * Se puede usar desde otros módulos (el directorio de tiendas la ordena por esto): importa
 * `TiendasModule` y pide `ReputacionService.deVarias(ids)`, que hace pocas consultas para todas.
 */
@Injectable()
export class ReputacionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
  ) {}

  async de(tiendaId: string): Promise<ReputacionDetallada> {
    const reputaciones = await this.deVarias([tiendaId]);
    return reputaciones.get(tiendaId) ?? vacia();
  }

  async deVarias(todas: readonly string[]): Promise<Map<string, ReputacionDetallada>> {
    const ids = [...new Set(todas)];
    const resultado = new Map<string, ReputacionDetallada>();
    if (ids.length === 0) return resultado;
    const lista = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
    const desde = new Date(Date.now() - DIAS_RECIENTES * 86_400_000);
    const [opiniones, ventas, chats, respondeEn] = await Promise.all([
      this.prisma.opinion.findMany({
        where: { tiendaId: { in: ids } },
        orderBy: { creadaEn: 'desc' },
        select: { tiendaId: true, estrellas: true, creadaEn: true },
      }),
      this.prisma.$queryRaw<Array<{ tienda_id: string; total: number; recientes: number }>>`
        SELECT o.tienda_id::text AS tienda_id, count(*)::int AS total,
               count(*) FILTER (WHERE v.creada_en > ${desde})::int AS recientes
        FROM venta v JOIN oferta o ON o.id = v.oferta_id
        WHERE o.tienda_id IN (${lista})
        GROUP BY o.tienda_id`,
      // Chats de los últimos 60 días donde la tienda vende y alguien escribió: ¿contestó alguien de ella?
      this.prisma.$queryRaw<Array<{ tienda_id: string; total: number; respondidos: number }>>`
        SELECT c.tienda_vendedora_id::text AS tienda_id, count(*)::int AS total,
               count(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM mensaje m JOIN usuario u ON u.id = m.autor_id
                 WHERE m.conversacion_id = c.id AND u.tienda_id = c.tienda_vendedora_id
               ))::int AS respondidos
        FROM conversacion c
        WHERE c.tienda_vendedora_id IN (${lista}) AND c.creada_en > ${desde}
          AND EXISTS (SELECT 1 FROM mensaje m WHERE m.conversacion_id = c.id)
        GROUP BY c.tienda_vendedora_id`,
      this.catalogo.respondeEn(ids),
    ]);

    const porTienda = new Map<string, Array<{ estrellas: number; creada_en: Date }>>();
    for (const opinion of opiniones) {
      const suyas = porTienda.get(opinion.tiendaId) ?? [];
      suyas.push({ estrellas: opinion.estrellas, creada_en: opinion.creadaEn });
      porTienda.set(opinion.tiendaId, suyas);
    }
    const ventasDe = new Map(ventas.map((fila) => [fila.tienda_id, fila]));
    const chatsDe = new Map(chats.map((fila) => [fila.tienda_id, fila]));

    for (const id of ids) {
      const suyas = porTienda.get(id) ?? [];
      const chat = chatsDe.get(id);
      const pases = ventasDe.get(id)?.recientes ?? 0;
      const responde = respondeEn.get(id) ?? null;
      const respondidos =
        chat && chat.total > 0 ? Math.round((chat.respondidos / chat.total) * 100) : null;
      const promedio =
        suyas.length === 0
          ? null
          : Math.round((suyas.reduce((suma, una) => suma + una.estrellas, 0) / suyas.length) * 10) /
            10;
      resultado.set(id, {
        promedio,
        opiniones: suyas.length,
        ventas: ventasDe.get(id)?.total ?? 0,
        nivel: calcularReputacion({
          opiniones: suyas,
          pases_60: pases,
          responde_en: responde,
          respondidos,
        }).nivel,
        pases_60: pases,
        responde_en: responde,
        respondidos,
      });
    }
    return resultado;
  }
}

function vacia(): ReputacionDetallada {
  return {
    promedio: null,
    opiniones: 0,
    ventas: 0,
    nivel: null,
    pases_60: 0,
    responde_en: null,
    respondidos: null,
  };
}
