import { normalizarTexto } from '@paselibre/contracts';
import type { PrismaClient, VisibilidadPerfil } from '@prisma/client';

import type { Mirada } from './guards/sesion-opcional.guard';

/** Lo que hace falta saber de quien mira (una `Mirada`, o lo mismo armado desde la sesión). */
export type QuienMira = Pick<Mirada, 'audiencia' | 'tiendaId' | 'usuarioId'>;

type Prisma = Pick<PrismaClient, 'bloqueo' | 'tienda' | 'seguimiento'>;

/** Una tienda que no es pública (doc 20, punto 5). */
export interface TiendaCerrada {
  id: string;
  visibilidad: Exclude<VisibilidadPerfil, 'PUBLICO'>;
}

/**
 * La regla, sin base de datos: las tiendas cuyas publicaciones y pedidos en vivo no ve quien
 * mira.
 *
 * - Las que bloqueó (REP_WebBloqueadas): «Dejarás de ver sus publicaciones y sus pedidos en vivo».
 * - Las ocultas: nadie.
 * - Las privadas que su tienda no sigue (un visitante no sigue a ninguna).
 *
 * La propia nunca: su tienda siempre ve lo suyo. El Equipo ve todo, siempre: solo le quedan las
 * que bloqueó, como antes.
 */
export function calcularQueNoVeo(
  quien: QuienMira,
  bloqueadas: readonly string[],
  cerradas: readonly TiendaCerrada[],
  seguidas: ReadonlySet<string>,
): string[] {
  const noVeo = new Set(bloqueadas);
  if (quien.audiencia === 'equipo') return [...noVeo];
  for (const tienda of cerradas) {
    if (tienda.id === quien.tiendaId) continue;
    if (tienda.visibilidad === 'OCULTO' || !seguidas.has(tienda.id)) noVeo.add(tienda.id);
  }
  return [...noVeo];
}

/** Las tiendas privadas u ocultas (pocas: una lista corta). */
export async function tiendasCerradas(
  prisma: Pick<PrismaClient, 'tienda'>,
): Promise<TiendaCerrada[]> {
  const filas = await prisma.tienda.findMany({
    where: { visibilidad: { not: 'PUBLICO' } },
    select: { id: true, visibilidad: true },
  });
  return filas.filter((fila): fila is TiendaCerrada => fila.visibilidad !== 'PUBLICO');
}

/**
 * **El único lugar** que decide de qué tiendas no se muestran publicaciones ni pedidos en vivo a
 * quien mira (doc 20, punto 5): sus bloqueadas, las ocultas y las privadas que no sigue. Lo usan
 * el Inicio, la búsqueda, la ficha («Las tiendas que lo tienen»), Pedidos en vivo, Wilson y «De
 * tiendas que sigues». Reemplaza a `tiendasBloqueadasPor`. Ver `calcularQueNoVeo`.
 */
export async function tiendasQueNoVeo(prisma: Prisma, quien: QuienMira): Promise<string[]> {
  const [bloqueos, cerradas] = await Promise.all([
    quien.usuarioId
      ? prisma.bloqueo.findMany({
          where: { usuarioId: quien.usuarioId },
          select: { tiendaBloqueadaId: true },
        })
      : [],
    quien.audiencia === 'equipo' ? [] : tiendasCerradas(prisma),
  ]);
  const privadas = cerradas.filter((tienda) => tienda.visibilidad === 'PRIVADO');
  const seguidas =
    quien.tiendaId && privadas.length > 0
      ? await prisma.seguimiento.findMany({
          where: { tiendaId: quien.tiendaId, seguidaId: { in: privadas.map((t) => t.id) } },
          select: { seguidaId: true },
        })
      : [];
  return calcularQueNoVeo(
    quien,
    bloqueos.map((fila) => fila.tiendaBloqueadaId),
    cerradas,
    new Set(seguidas.map((fila) => fila.seguidaId)),
  );
}

/**
 * Si lo que no ve quien mira es justo lo que no ve un visitante (las privadas y las ocultas): en
 * ese caso la búsqueda puede leer `producto_resumen`, que solo cuenta las tiendas públicas.
 */
export function veComoVisitante(
  noVeo: readonly string[],
  cerradas: readonly TiendaCerrada[],
): boolean {
  const deVisitante = new Set(cerradas.map((tienda) => tienda.id));
  return noVeo.length === deVisitante.size && noVeo.every((id) => deVisitante.has(id));
}

/**
 * Para los avisos (seguidoras, alertas de búsqueda): de estas tiendas, las que pueden ver lo que
 * publica `tiendaId`. Pública: todas; privada: las que la siguen; oculta: ninguna.
 */
export async function tiendasQueLaVen(
  prisma: Pick<PrismaClient, 'tienda' | 'seguimiento'>,
  tiendaId: string,
  candidatas: readonly string[],
): Promise<Set<string>> {
  if (candidatas.length === 0) return new Set();
  const tienda = await prisma.tienda.findUnique({
    where: { id: tiendaId },
    select: { visibilidad: true },
  });
  if (!tienda || tienda.visibilidad === 'PUBLICO') return new Set(candidatas);
  if (tienda.visibilidad === 'OCULTO') return new Set();
  const siguen = await prisma.seguimiento.findMany({
    where: { seguidaId: tiendaId, tiendaId: { in: [...candidatas] } },
    select: { tiendaId: true },
  });
  return new Set(siguen.map((fila) => fila.tiendaId));
}

/**
 * Cómo sale una tienda en la búsqueda de tiendas (el directorio, el buscador de arriba y el de
 * socios; doc 20, punto 5), o nula si no sale:
 *
 * - `completa`: pública, la propia, una privada que su tienda sigue, o quien mira es el Equipo;
 * - `privada`: una privada que no sigue, solo si lo escrito es **igual** a su nombre (sin tildes,
 *   mayúsculas ni signos): «Tienda · Cuenta privada», sin stand ni datos y con el logo borroso;
 * - nula: una oculta (nunca, ni con su nombre exacto) o una privada buscada a medias.
 */
export function comoLaEncuentra(
  tienda: { id: string; nombre: string; visibilidad: VisibilidadPerfil },
  quien: QuienMira,
  sigue: boolean,
  escrito: string | undefined,
): 'completa' | 'privada' | null {
  if (quien.audiencia === 'equipo' || tienda.id === quien.tiendaId) return 'completa';
  if (tienda.visibilidad === 'PUBLICO') return 'completa';
  if (tienda.visibilidad === 'OCULTO') return null;
  if (sigue) return 'completa';
  const buscado = normalizarTexto(escrito ?? '');
  return buscado && buscado === normalizarTexto(tienda.nombre) ? 'privada' : null;
}

/**
 * Qué ve quien abre el perfil de una tienda (doc 20, punto 5):
 *
 * - `completo`: pública, la propia, una privada que su tienda sigue, o quien mira es el Equipo;
 * - `privado`: una privada que no sigue: el nombre, la galería y cuántas la siguen, con el logo y
 *   la portada borrosos y «Solicitar seguir»;
 * - `oculto`: no existe para quien mira («Esta tienda no existe»).
 *
 * Con `comoMeVen` («Cómo me ven»), la propia se ve como la vería otra tienda que no la sigue.
 */
export function accesoAlPerfil(
  tienda: { id: string; visibilidad: VisibilidadPerfil },
  quien: QuienMira,
  sigue: boolean,
  comoMeVen = false,
): 'completo' | 'privado' | 'oculto' {
  const comoOtra = comoMeVen && tienda.id === quien.tiendaId;
  if (!comoOtra && (quien.audiencia === 'equipo' || tienda.id === quien.tiendaId)) {
    return 'completo';
  }
  if (tienda.visibilidad === 'PUBLICO') return 'completo';
  if (tienda.visibilidad === 'OCULTO') return 'oculto';
  return sigue && !comoOtra ? 'completo' : 'privado';
}
