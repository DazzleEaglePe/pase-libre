import type { FuerzaDestacado, PrismaClient } from '@prisma/client';

/** Lo destacado ahora (COR16): tiendas con todas sus publicaciones y publicaciones sueltas. */
export interface Destacadas {
  /** Tiendas destacadas con todas sus publicaciones. */
  tiendas: Set<string>;
  /** Publicaciones elegidas una por una. */
  ofertas: Set<string>;
  /** Si una publicación de esta tienda está destacada. */
  incluye(oferta: { id: string; tiendaId: string }): boolean;
  /**
   * Con qué fuerza está destacada (doc 20, punto 4b), o nula si no lo está. Si le tocan dos, la
   * más fuerte.
   */
  fuerzaDe(oferta: { id: string; tiendaId: string }): FuerzaDestacado | null;
}

const ORDEN_FUERZA: Record<FuerzaDestacado, number> = { SUAVE: 1, MEDIA: 2, FUERTE: 3 };

function laMasFuerte(a: FuerzaDestacado | undefined, b: FuerzaDestacado): FuerzaDestacado {
  return a && ORDEN_FUERZA[a] >= ORDEN_FUERZA[b] ? a : b;
}

/** Las destacadas vigentes: «se apaga solo al terminar el tiempo». */
export async function destacadasAhora(
  prisma: Pick<PrismaClient, 'destacado'>,
  ahora = new Date(),
): Promise<Destacadas> {
  const filas = await prisma.destacado.findMany({
    where: { hasta: { gt: ahora }, quitadoEn: null },
    select: { tiendaId: true, ofertas: true, fuerza: true },
  });
  const tiendas = new Map<string, FuerzaDestacado>();
  const ofertas = new Map<string, FuerzaDestacado>();
  for (const fila of filas) {
    if (fila.ofertas.length === 0) {
      tiendas.set(fila.tiendaId, laMasFuerte(tiendas.get(fila.tiendaId), fila.fuerza));
    }
    for (const oferta of fila.ofertas) {
      ofertas.set(oferta, laMasFuerte(ofertas.get(oferta), fila.fuerza));
    }
  }
  return {
    tiendas: new Set(tiendas.keys()),
    ofertas: new Set(ofertas.keys()),
    incluye: (oferta) => tiendas.has(oferta.tiendaId) || ofertas.has(oferta.id),
    fuerzaDe: (oferta) => {
      const deTienda = tiendas.get(oferta.tiendaId);
      const suelta = ofertas.get(oferta.id);
      if (deTienda && suelta) return laMasFuerte(deTienda, suelta);
      return deTienda ?? suelta ?? null;
    },
  };
}

/**
 * «Mezcladas entre los 4 primeros lugares (no todas juntas)»: las destacadas van al 1.º y al
 * 3.º lugar, y si hay más, al 2.º y al 4.º. El resto sigue en su orden. Desde la 1.11.0 el Inicio
 * ya no la usa (destacar solo suma puntos, doc 20, punto 4b); queda para la portada.
 */
export function mezclarDestacadas<T>(lista: T[], esDestacada: (item: T) => boolean): T[] {
  const destacadas = lista.filter(esDestacada);
  if (destacadas.length === 0) return lista;
  const resto = lista.filter((item) => !esDestacada(item));
  const lugares = [0, 2, 1, 3];
  const resultado = [...resto];
  destacadas.slice(0, 4).forEach((item, i) => {
    resultado.splice(Math.min(lugares[i] ?? i, resultado.length), 0, item);
  });
  // Las que no entran en los 4 primeros siguen más arriba que el resto.
  resultado.splice(4, 0, ...destacadas.slice(4));
  return resultado;
}
