import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizarTexto, type FaseInicio, type RespuestaInicio } from '@paselibre/contracts';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { tiendasBloqueadasPor } from '../../shared/bloqueadas';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { BusquedaService } from './busqueda.service';
import { CatalogoService, OFERTA_VIGENTE } from './catalogo.service';

/** «Con 20 tiendas, aquí vas a encontrar casi todo» (FI_Web): la meta del piloto. */
export const META_TIENDAS = 20;
/** Desde cuántas publicaciones de otras tiendas el inicio es el de todos los días. */
export const PUBLICACIONES_NORMAL = 12;
const MAS_PEDIDO = 4;

/**
 * El inicio de una tienda (sección 5 del lienzo final): crece solo. El primer día, sin nada
 * publicado por las demás, invita a pedir en vivo, explica que los precios están protegidos y
 * guía con «Primeros pasos»; con pocas publicaciones las muestra en fila; con 12 o más, el
 * inicio normal (eso ya lo trae la portada).
 */
@Injectable()
export class InicioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CatalogoService) private readonly catalogo: CatalogoService,
    @Inject(BusquedaService) private readonly busqueda: BusquedaService,
  ) {}

  async inicio(mirada: Mirada): Promise<RespuestaInicio> {
    const tiendaId = mirada.tiendaId;
    if (!tiendaId || !mirada.usuarioId) {
      throw new ApiHttpException(
        HttpStatus.FORBIDDEN,
        'PROHIBIDO',
        'El inicio de tienda es para cuentas con tienda.',
      );
    }
    const bloqueadas = await tiendasBloqueadasPor(this.prisma, mirada.usuarioId);
    const [deOtras, deSeguidas, masPedido, tiendas, pasos] = await Promise.all([
      this.prisma.oferta.count({
        where: {
          AND: [
            OFERTA_VIGENTE,
            { stock: { gt: 0 } },
            { tiendaId: { notIn: [tiendaId, ...bloqueadas] } },
          ],
        },
      }),
      this.catalogo.deSeguidas(mirada),
      this.masPedido(tiendaId),
      this.tiendas(tiendaId, bloqueadas),
      this.pasos(tiendaId),
    ]);
    const fase: FaseInicio =
      deOtras === 0 ? 'DIA_1' : deOtras < PUBLICACIONES_NORMAL ? 'POCAS' : 'NORMAL';
    return { fase, de_seguidas: deSeguidas, mas_pedido: masPedido, tiendas, pasos };
  }

  /**
   * «Lo que más se pide en la galería»: lo buscado al menos dos veces en 30 días, con el
   * producto del catálogo que mejor le calza. Lo que tu tienda ya publica no sale.
   */
  private async masPedido(tiendaId: string): Promise<RespuestaInicio['mas_pedido']> {
    const terminos = (await this.busqueda.terminosRepetidos()).slice(0, 20);
    const lista: RespuestaInicio['mas_pedido'] = [];
    const vistos = new Set<string>();
    for (const termino of terminos) {
      if (lista.length === MAS_PEDIDO) break;
      const palabras = normalizarTexto(termino).split(' ').filter(Boolean);
      if (palabras.length === 0) continue;
      const producto = await this.prisma.producto.findFirst({
        where: {
          fusionadoEnId: null,
          AND: palabras.map((palabra) => ({ textoBusqueda: { contains: palabra } })),
        },
        orderBy: { ofertas: { _count: 'desc' } },
        select: {
          id: true,
          slug: true,
          titulo: true,
          categoria: { select: { nombre: true } },
          ofertas: {
            where: { tiendaId, estado: { not: 'ELIMINADA' } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (producto && producto.ofertas.length > 0) continue;
      const clave = producto?.slug ?? normalizarTexto(termino);
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      lista.push(
        producto
          ? {
              texto: producto.titulo,
              categoria: producto.categoria.nombre,
              producto: producto.slug,
            }
          : { texto: termino, categoria: null, producto: null },
      );
    }
    return lista;
  }

  /** «Tiendas que ya están»: las activas, con su categoría fuerte y su galería. */
  private async tiendas(
    tiendaId: string,
    bloqueadas: string[],
  ): Promise<RespuestaInicio['tiendas']> {
    const filas = await this.prisma.$queryRaw<
      Array<{
        id: string;
        nombre: string;
        galeria: string | null;
        ofertas: number;
        visibles: number;
        categoria: string | null;
      }>
    >`
      SELECT t.id, t.nombre, g.nombre AS galeria,
             count(o.id)::int AS ofertas,
             count(o.id) FILTER (WHERE o.tienda_visible)::int AS visibles,
             (SELECT c.nombre FROM oferta o2
                JOIN producto p ON p.id = o2.producto_id
                JOIN categoria c ON c.id = p.categoria_id
               WHERE o2.tienda_id = t.id AND o2.estado = 'ACTIVA'
               GROUP BY c.nombre ORDER BY count(*) DESC, c.nombre LIMIT 1) AS categoria
      FROM tienda t
      LEFT JOIN galeria g ON g.id = t.galeria_id
      LEFT JOIN oferta o ON o.tienda_id = t.id AND o.estado = 'ACTIVA'
      WHERE t.estado = 'ACTIVA'
      GROUP BY t.id, g.nombre
      ORDER BY t.creada_en, t.nombre`;
    // Con todo en reservado, la tienda cuenta pero no se nombra.
    const reservada = (fila: (typeof filas)[number]) => fila.ofertas > 0 && fila.visibles === 0;
    const otras = filas.filter((fila) => fila.id !== tiendaId && !bloqueadas.includes(fila.id));
    return {
      visibles: otras
        .filter((fila) => !reservada(fila))
        .map((fila) => ({
          id: fila.id,
          nombre: fila.nombre,
          detalle: [fila.categoria, fila.galeria ?? 'Independiente'].filter(Boolean).join(' · '),
        })),
      reservadas: otras.filter(reservada).length,
      activas: filas.length,
      meta: META_TIENDAS,
    };
  }

  private async pasos(tiendaId: string): Promise<RespuestaInicio['pasos']> {
    const [tienda, publicadas, enVivo] = await Promise.all([
      this.prisma.tienda.findUnique({
        where: { id: tiendaId },
        select: { horario: true, descripcion: true },
      }),
      this.prisma.oferta.count({ where: { tiendaId, estado: { not: 'ELIMINADA' } } }),
      this.prisma.enVivo.count({ where: { tiendaId } }),
    ]);
    return {
      perfil: Boolean(tienda?.horario && tienda.descripcion),
      publicadas,
      en_vivo: enVivo > 0,
    };
  }
}
