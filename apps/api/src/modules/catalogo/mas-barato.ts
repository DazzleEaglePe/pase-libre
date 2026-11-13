import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * «Más barato de la galería» (doc 20, punto 22; la usa también el perfil de la tienda, punto
 * 20): una oferta lo es si su precio de pase es el más bajo de las ofertas vigentes de ese
 * producto en su galería, y hay al menos 2 para comparar.
 *
 * - Solo cuentan las vigentes con stock y con el precio a la vista de todas (`precio_visible`):
 *   un precio al interno o «Solo mis socios» no se compara, para no delatarlo.
 * - Un precio en S/ y uno en US$ se comparan en la misma vara con `TIPO_CAMBIO` (como «Más
 *   barato» de la búsqueda); nunca se convierte lo que se muestra.
 * - La galería es la de la tienda; las tiendas independientes (sin galería) no compiten.
 * - Si dos empatan en el precio más bajo, ninguna es «la más barata».
 *
 * `filtro` solo achica lo que se devuelve (por ejemplo, las de una tienda): la comparación es
 * siempre contra todas las de la galería.
 */
export async function ofertasMasBaratasDeLaGaleria(
  prisma: Pick<PrismaClient, '$queryRaw'>,
  tipoCambio: number,
  filtro: { ofertaIds?: readonly string[]; tiendaId?: string } = {},
): Promise<Set<string>> {
  if (filtro.ofertaIds && filtro.ofertaIds.length === 0) return new Set();
  const condiciones: Prisma.Sql[] = [
    Prisma.sql`g.cuantas >= 2`,
    Prisma.sql`g.rango = 1`,
    Prisma.sql`g.empatadas = 1`,
  ];
  if (filtro.ofertaIds) {
    condiciones.push(
      Prisma.sql`g.id IN (${Prisma.join(filtro.ofertaIds.map((id) => Prisma.sql`${id}::uuid`))})`,
    );
  }
  if (filtro.tiendaId) condiciones.push(Prisma.sql`g.tienda_id = ${filtro.tiendaId}::uuid`);
  const filas = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH vigentes AS (
      SELECT o.id, o.tienda_id, o.producto_id, t.galeria_id,
             o.precio_centimos::numeric
               / CASE WHEN o.moneda::text = 'PEN' THEN CAST(${tipoCambio} AS numeric) ELSE 1 END
               AS precio_eq
      FROM oferta o
      JOIN tienda t ON t.id = o.tienda_id AND t.estado = 'ACTIVA'
      JOIN producto p ON p.id = o.producto_id AND p.fusionado_en_id IS NULL
      WHERE o.estado = 'ACTIVA' AND o.stock > 0 AND o.precio_visible
        AND o.precio_centimos IS NOT NULL AND t.galeria_id IS NOT NULL
    ),
    grupos AS (
      SELECT v.id, v.tienda_id,
             count(*) OVER (PARTITION BY v.producto_id, v.galeria_id) AS cuantas,
             rank() OVER (PARTITION BY v.producto_id, v.galeria_id ORDER BY v.precio_eq) AS rango,
             count(*) OVER (PARTITION BY v.producto_id, v.galeria_id, v.precio_eq) AS empatadas
      FROM vigentes v
    )
    SELECT g.id::text AS id FROM grupos g WHERE ${Prisma.join(condiciones, ' AND ')}`;
  return new Set(filas.map((fila) => fila.id));
}
