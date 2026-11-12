import type { ReputacionCorta } from '@paselibre/contracts';
import type { PrismaClient } from '@prisma/client';

/**
 * Hasta cuántas opiniones una tienda sale «Nueva» en vez de «4,9 ★ · 31 opiniones». Hoy, sin
 * opiniones (como «Sin opiniones todavía» del perfil). La reputación nueva del área B
 * («🌱 Nueva en PaseLibre» hasta 5 opiniones) lo cambia aquí al unir.
 */
const OPINIONES_DE_NUEVA = 0;

/** Lo que vale una tienda nueva al ordenar por «Mejor reputación»: ni arriba ni al fondo. */
const PUNTAJE_SIN_HISTORIA = 3.5;
/** Cuántas opiniones «imaginarias» de PUNTAJE_SIN_HISTORIA suaviza el promedio de pocas. */
const PESO_SIN_HISTORIA = 2;

export type ReputacionConPuntaje = ReputacionCorta & {
  /** Para «Ordenar: Mejor reputación»: más alto, más arriba. No se manda a la web. */
  puntaje: number;
};

/**
 * La reputación de varias tiendas para el directorio y el buscador (N13), en una sola función
 * del servidor: lo que se muestra («4,9 ★ · 31 opiniones» o «Nueva») y cómo se ordena. Usa lo
 * que hay hoy: el promedio de estrellas y cuántas opiniones tiene.
 */
export async function reputacionCorta(
  prisma: Pick<PrismaClient, 'opinion'>,
  tiendaIds: readonly string[],
): Promise<Map<string, ReputacionConPuntaje>> {
  const filas =
    tiendaIds.length === 0
      ? []
      : await prisma.opinion.groupBy({
          by: ['tiendaId'],
          where: { tiendaId: { in: [...tiendaIds] } },
          _avg: { estrellas: true },
          _count: { _all: true },
        });
  const porTienda = new Map(filas.map((fila) => [fila.tiendaId, fila]));
  return new Map(
    tiendaIds.map((id) => {
      const fila = porTienda.get(id);
      const opiniones = fila?._count._all ?? 0;
      const promedio = fila?._avg.estrellas ?? null;
      const nueva = opiniones <= OPINIONES_DE_NUEVA || promedio === null;
      return [
        id,
        {
          estrellas: nueva || promedio === null ? null : Math.round(promedio * 10) / 10,
          opiniones,
          nueva,
          puntaje:
            nueva || promedio === null
              ? PUNTAJE_SIN_HISTORIA
              : (promedio * opiniones + PUNTAJE_SIN_HISTORIA * PESO_SIN_HISTORIA) /
                (opiniones + PESO_SIN_HISTORIA),
        },
      ];
    }),
  );
}
