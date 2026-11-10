import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { ResumenCuenta } from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { CatalogoService } from '../catalogo/catalogo.service';
import type { SesionActiva } from '../sesion/sesion.types';

/** «+51 987 654 482» → «+51 9•• ••• 482». */
function tapar(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  const local = digitos.startsWith('51') && digitos.length > 9 ? digitos.slice(2) : digitos;
  if (local.length < 6) return '•••';
  return `+51 ${local[0]}•• ••• ${local.slice(-3)}`;
}

/**
 * Lo que «Tu cuenta» (D_Cuenta) y tu perfil (P_WebCuentaD2) cuentan de tu tienda: desde cuándo
 * está, cómo vende y responde, qué vende y su WhatsApp tapado.
 */
@Injectable()
export class ResumenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
  ) {}

  async resumen(sesion: SesionActiva): Promise<ResumenCuenta> {
    const tiendaId = sesion.usuario.tiendaId;
    if (!tiendaId) {
      throw new ApiHttpException(HttpStatus.FORBIDDEN, 'PROHIBIDO', 'Tu cuenta no tiene tienda.');
    }
    const hace60 = new Date(Date.now() - 60 * 86_400_000);
    const hace30 = new Date(Date.now() - 30 * 86_400_000);
    const [tienda, registro, ventas, respondeEn, chats, opiniones, categorias, abiertos] =
      await Promise.all([
        this.prisma.tienda.findUniqueOrThrow({
          where: { id: tiendaId },
          select: { creadaEn: true, whatsapp: true },
        }),
        this.prisma.solicitud.count({ where: { tiendaId } }),
        this.prisma.venta.count({ where: { oferta: { tiendaId }, creadaEn: { gte: hace60 } } }),
        this.catalogo.respondeEn([tiendaId]),
        this.prisma.$queryRaw<Array<{ total: number; respondidos: number }>>`
          SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE EXISTS (
                   SELECT 1 FROM mensaje m JOIN usuario u ON u.id = m.autor_id
                   WHERE m.conversacion_id = c.id AND u.tienda_id = c.tienda_vendedora_id
                 ))::int AS respondidos
          FROM conversacion c
          WHERE c.tienda_vendedora_id = ${tiendaId}::uuid AND c.creada_en > ${hace60}
            AND EXISTS (SELECT 1 FROM mensaje m WHERE m.conversacion_id = c.id)`,
        this.prisma.opinion.aggregate({
          where: { tiendaId },
          _avg: { estrellas: true },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<Array<{ nombre: string }>>`
          SELECT c.nombre FROM oferta o
          JOIN producto p ON p.id = o.producto_id
          JOIN categoria c ON c.id = p.categoria_id
          WHERE o.tienda_id = ${tiendaId}::uuid AND o.estado = 'ACTIVA'
          GROUP BY c.nombre ORDER BY count(*) DESC, c.nombre LIMIT 3`,
        this.prisma.conversacion.count({
          where: {
            OR: [{ tiendaVendedoraId: tiendaId }, { tiendaCompradoraId: tiendaId }],
            ultimoMensajeEn: { gte: hace30 },
            mensajes: { some: {} },
          },
        }),
      ]);
    const [chat] = chats;
    const promedio = opiniones._avg.estrellas;
    return {
      miembro_desde: tienda.creadaEn.toISOString(),
      por_registro: registro > 0,
      ventas_60: ventas,
      responde_en: respondeEn.get(tiendaId) ?? null,
      respondidos:
        chat && chat.total > 0 ? Math.round((chat.respondidos / chat.total) * 100) : null,
      estrellas: promedio === null ? null : Math.round(promedio * 10) / 10,
      opiniones: opiniones._count._all,
      vende: categorias.map((fila) => fila.nombre),
      chats_abiertos: abiertos,
      whatsapp: tienda.whatsapp ? tapar(tienda.whatsapp) : null,
    };
  }
}
