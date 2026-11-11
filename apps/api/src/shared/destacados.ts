import type { PrismaClient } from '@prisma/client';

/** Lo destacado ahora (COR16): tiendas con todas sus publicaciones y publicaciones sueltas. */
export interface Destacadas {
  /** Tiendas destacadas con todas sus publicaciones. */
  tiendas: Set<string>;
  /** Publicaciones elegidas una por una. */
  ofertas: Set<string>;
  /** Si una publicación de esta tienda está destacada. */
  incluye(oferta: { id: string; tiendaId: string }): boolean;
}

/** Las destacadas vigentes: «se apaga solo al terminar el tiempo». */
export async function destacadasAhora(
  prisma: Pick<PrismaClient, 'destacado'>,
  ahora = new Date(),
): Promise<Destacadas> {
  const filas = await prisma.destacado.findMany({
    where: { hasta: { gt: ahora }, quitadoEn: null },
    select: { tiendaId: true, ofertas: true },
  });
  const tiendas = new Set<string>();
  const ofertas = new Set<string>();
  for (const fila of filas) {
    if (fila.ofertas.length === 0) tiendas.add(fila.tiendaId);
    for (const oferta of fila.ofertas) ofertas.add(oferta);
  }
  return {
    tiendas,
    ofertas,
    incluye: (oferta) => tiendas.has(oferta.tiendaId) || ofertas.has(oferta.id),
  };
}

/**
 * «Mezcladas entre los 4 primeros lugares (no todas juntas)»: las destacadas van al 1.º y al
 * 3.º lugar, y si hay más, al 2.º y al 4.º. El resto sigue en su orden.
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
