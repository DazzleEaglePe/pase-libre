import { slugDe, type AvisoGaleria } from '@paselibre/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Los avisos «Galería nueva: X» de Equipo › Galerías (docs/18 §3): solicitudes de registro que
 * eligieron «Otra galería», siguen sin galería y nadie del equipo resolvió todavía. Una
 * aprobada ya tiene galería (una tienda no puede quedar sin ella), y las rechazadas no cuentan.
 */
export const SOLICITUD_CON_GALERIA_NUEVA: Prisma.SolicitudWhereInput = {
  galeriaOtra: { not: null },
  galeriaId: null,
  galeriaOtraResueltaEn: null,
  estado: { in: ['PENDIENTE', 'REQUIERE_CAMBIOS'] },
};

/** Lo que escribieron dos tiendas es la misma galería si da la misma clave. */
export const claveDeGaleria = (texto: string): string => slugDe(texto);

type Fila = {
  id: string;
  galeriaOtra: string | null;
  nombreComercial: string;
  creadaEn: Date;
};

/** Junta en un aviso las que escribieron lo mismo; el más antiguo primero. */
export function agruparAvisos(filas: readonly Fila[]): AvisoGaleria[] {
  const grupos = new Map<string, AvisoGaleria>();
  const ordenadas = [...filas].sort((a, b) => a.creadaEn.getTime() - b.creadaEn.getTime());
  for (const fila of ordenadas) {
    const texto = fila.galeriaOtra?.trim();
    if (!texto) continue;
    const clave = claveDeGaleria(texto);
    if (!clave) continue;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.tiendas.push(fila.nombreComercial);
    } else {
      grupos.set(clave, {
        id: fila.id,
        nombre: texto,
        tiendas: [fila.nombreComercial],
        creada_en: fila.creadaEn.toISOString(),
      });
    }
  }
  return [...grupos.values()];
}

export async function avisosDeGalerias(
  prisma: Pick<PrismaClient, 'solicitud'>,
): Promise<AvisoGaleria[]> {
  const filas = await prisma.solicitud.findMany({
    where: SOLICITUD_CON_GALERIA_NUEVA,
    orderBy: { creadaEn: 'asc' },
    take: 500,
    select: { id: true, galeriaOtra: true, nombreComercial: true, creadaEn: true },
  });
  return agruparAvisos(filas);
}
