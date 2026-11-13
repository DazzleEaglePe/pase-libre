import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  DirectorioTiendasConsulta,
  OrdenDirectorio,
  RespuestaDirectorioTiendas,
  TiendaEnBuscador,
} from '@paselibre/contracts';
import { Prisma, type VisibilidadPerfil } from '@prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { comoLaEncuentra } from '../../shared/bloqueadas';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import type { Mirada } from '../../shared/guards/sesion-opcional.guard';
import { MiniaturasService } from '../archivos/miniaturas.service';
import { TiempoRealService } from '../tiempo-real/tiempo-real.service';
import { INDEPENDIENTES } from './catalogo.service';
import { galeriasEnOrden } from './galerias-en-orden';
import { reputacionCorta, type ReputacionConPuntaje } from './reputacion-corta';
import { conSesion } from './visibilidad';

/** Tiendas por tanda en la pestaña «Tiendas»: «Ver más tiendas» trae las siguientes. */
export const TIENDAS_POR_PAGINA = 24;
/** Tiendas en la sección «TIENDAS» del buscador de arriba. */
export const TIENDAS_EN_EL_BUSCADOR = 3;
/** «Tarjetas de video · Monitores»: las categorías que más publica a la vista. */
const CATEGORIAS_QUE_VENDE = 2;

/** Una tienda que se puede mostrar a quien mira (ver `listables`). */
interface FilaTienda {
  id: string;
  nombre: string;
  logo: string | null;
  stand: string | null;
  piso: string | null;
  creada_en: Date;
  galeria_slug: string | null;
  galeria: string | null;
  galeria_orden: number | null;
  /** Publicaciones con su nombre a la vista y con stock: para «Ordenar: Más productos». */
  con_stock: number;
  /** Privada que quien mira no sigue, buscada con su nombre exacto (doc 20, punto 5). */
  privada: boolean;
}

/** El logo chico de una privada, en píxeles: la web lo muestra borroso. */
const ANCHO_LOGO_BORROSO = 24;
/** Lo que se muestra de una privada que no sigues: solo el nombre (doc 20, punto 5). */
const SIN_DATOS = { galeria: null, stand: null, piso: null } as const;
const REPUTACION_OCULTA = { estrellas: null, opiniones: 0, nueva: true };

interface CategoriaDeTienda {
  tienda_id: string;
  slug: string;
  nombre: string;
  orden: number;
  publicaciones: number;
}

/** Sin tildes y en minúsculas, letra por letra (mismo largo): para comparar con lo escrito. */
export function sinTildes(texto: string): string {
  return [...texto]
    .map((letra) =>
      letra
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase(),
    )
    .join('');
}

/** `%`, `_` y `\` se buscan tal cual en un LIKE. */
function sinComodines(texto: string): string {
  return texto.replace(/[\\%_]/g, (letra) => `\\${letra}`);
}

/** «Sótano» primero, después los pisos con número y al final lo demás. */
function puestoDePiso(piso: string): [number, string] {
  if (/^\d+$/.test(piso)) return [Number(piso), ''];
  if (/s[oó]tano/i.test(piso)) return [-1, piso];
  return [10_000, piso];
}

/**
 * El directorio de tiendas (N13): la pestaña «Tiendas» de Wilson en vivo y la sección
 * «TIENDAS» del buscador de arriba. Todo con sesión: un visitante no ve tiendas.
 *
 * Qué tiendas salen lo decide `listables`, en el servidor y en un solo lugar: activas, sin las
 * ocultas, las privadas solo con su nombre exacto (o si las sigues), sin las que bloqueaste y
 * nunca las reservadas.
 */
@Injectable()
export class DirectorioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TiempoRealService) private readonly tiempoReal: TiempoRealService,
    @Inject(MiniaturasService) private readonly miniaturas: MiniaturasService,
  ) {}

  async directorio(
    consulta: DirectorioTiendasConsulta,
    mirada: Mirada,
  ): Promise<RespuestaDirectorioTiendas> {
    if (!conSesion(mirada)) {
      throw new ApiHttpException(
        HttpStatus.UNAUTHORIZED,
        'SIN_SESION',
        'Las tiendas de Wilson se ven al iniciar sesión.',
      );
    }
    const todas = await this.listables(mirada, consulta.q);
    // Una privada buscada con su nombre exacto sale sola: sin galería, piso ni lo que vende, así
    // que tampoco entra en esos filtros (la delatarían).
    const conFiltro = Boolean(consulta.galeria || consulta.piso || consulta.vende);
    const filas = todas.filter((fila) => !fila.privada);
    const privadas = conFiltro ? [] : todas.filter((fila) => fila.privada);
    const enGaleria = filas.filter(
      (fila) =>
        !consulta.galeria ||
        (consulta.galeria === INDEPENDIENTES.slug
          ? fila.galeria_slug === null
          : fila.galeria_slug === consulta.galeria),
    );
    const enPiso = enGaleria.filter((fila) => !consulta.piso || fila.piso === consulta.piso);
    const ids = enPiso.map((fila) => fila.id);
    const [categorias, reputaciones] = await Promise.all([
      this.categoriasDe(ids),
      reputacionCorta(this.prisma, ids),
    ]);

    const vende = new Map<string, CategoriaDeTienda[]>();
    for (const categoria of categorias) {
      vende.set(categoria.tienda_id, [...(vende.get(categoria.tienda_id) ?? []), categoria]);
    }
    for (const lista of vende.values()) {
      lista.sort(
        (a, b) => b.publicaciones - a.publicaciones || a.nombre.localeCompare(b.nombre, 'es'),
      );
    }
    const elegidas = [
      ...privadas,
      ...enPiso
        .filter(
          (fila) =>
            !consulta.vende ||
            (vende.get(fila.id) ?? []).some((categoria) => categoria.slug === consulta.vende),
        )
        .sort(comparar(consulta.orden, reputaciones)),
    ];
    const desde = (consulta.pagina - 1) * TIENDAS_POR_PAGINA;
    const pagina = elegidas.slice(desde, desde + TIENDAS_POR_PAGINA);
    const enLinea = await this.enLinea(
      pagina.filter((fila) => !fila.privada).map((fila) => fila.id),
    );

    return {
      tiendas: await Promise.all(
        pagina.map(async (fila) =>
          fila.privada
            ? {
                id: fila.id,
                nombre: fila.nombre,
                logo: null,
                ...SIN_DATOS,
                vende: [],
                reputacion: REPUTACION_OCULTA,
                en_linea: false,
                propia: false,
                privada: true,
                logo_borroso: await this.miniaturas.chica(fila.logo, ANCHO_LOGO_BORROSO),
              }
            : {
                id: fila.id,
                nombre: fila.nombre,
                logo: fila.logo,
                galeria: fila.galeria,
                stand: fila.stand,
                piso: fila.piso,
                vende: (vende.get(fila.id) ?? [])
                  .slice(0, CATEGORIAS_QUE_VENDE)
                  .map((categoria) => categoria.nombre),
                reputacion: sinPuntaje(reputaciones.get(fila.id)),
                en_linea: enLinea.has(fila.id),
                propia: fila.id === mirada.tiendaId,
              },
        ),
      ),
      total: elegidas.length,
      pagina: consulta.pagina,
      hay_mas: desde + TIENDAS_POR_PAGINA < elegidas.length,
      filtros: {
        galerias: opcionesDeGaleria(filas),
        pisos: [...new Set(enGaleria.map((fila) => fila.piso).filter((piso) => piso !== null))]
          .map((piso) => piso.trim())
          .filter(Boolean)
          .sort((a, b) => {
            const [puestoA, textoA] = puestoDePiso(a);
            const [puestoB, textoB] = puestoDePiso(b);
            return puestoA - puestoB || textoA.localeCompare(textoB, 'es');
          }),
        categorias: [...new Map(categorias.map((c) => [c.slug, c])).values()]
          .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
          .map((categoria) => ({ slug: categoria.slug, nombre: categoria.nombre })),
      },
    };
  }

  /**
   * La sección «TIENDAS» del buscador de arriba (N13): las que coinciden con lo escrito, las
   * que empiezan así primero. Sin sesión, ninguna.
   */
  async paraElBuscador(q: string, mirada: Mirada): Promise<TiendaEnBuscador[]> {
    const texto = q.trim();
    if (!conSesion(mirada) || texto.length < 2) return [];
    const filas = await this.listables(mirada, texto);
    if (filas.length === 0) return [];
    const reputaciones = await reputacionCorta(
      this.prisma,
      filas.map((fila) => fila.id),
    );
    const buscado = sinTildes(texto);
    const cercania = (nombre: string) => {
      const limpio = sinTildes(nombre);
      if (limpio.startsWith(buscado)) return 0;
      // Empieza así alguna palabra del nombre: «Computer» en «Pegaso Computer».
      return limpio.split(/[^\p{L}\p{N}]+/u).some((palabra) => palabra.startsWith(buscado)) ? 1 : 2;
    };
    const elegidas = filas
      .map((fila) => ({ fila, cerca: cercania(fila.nombre) }))
      .sort((a, b) => a.cerca - b.cerca || comparar('reputacion', reputaciones)(a.fila, b.fila))
      .slice(0, TIENDAS_EN_EL_BUSCADOR)
      .map(({ fila }) => fila);
    const enLinea = await this.enLinea(
      elegidas.filter((fila) => !fila.privada).map((fila) => fila.id),
    );
    return Promise.all(
      elegidas.map(async (fila) =>
        fila.privada
          ? {
              id: fila.id,
              nombre: fila.nombre,
              logo: null,
              galeria: null,
              stand: null,
              reputacion: REPUTACION_OCULTA,
              en_linea: false,
              privada: true,
              logo_borroso: await this.miniaturas.chica(fila.logo, ANCHO_LOGO_BORROSO),
            }
          : {
              id: fila.id,
              nombre: fila.nombre,
              logo: fila.logo,
              galeria: fila.galeria,
              stand: fila.stand,
              reputacion: sinPuntaje(reputaciones.get(fila.id)),
              en_linea: enLinea.has(fila.id),
            },
      ),
    );
  }

  /**
   * Las tiendas que se pueden mostrar a quien mira, con `q` como pedazo del nombre (sin
   * importar tildes ni mayúsculas). Fuera:
   *
   * - las suspendidas y las ocultas; las privadas que no sigue, solo con su nombre exacto
   *   (`comoLaEncuentra`, doc 20, punto 5), y entonces van marcadas como `privada`;
   * - las que bloqueó quien mira con su nombre a la vista. Las que bloqueó desde un chat de la
   *   tienda reservada siguen: si desaparecieran, delatarían cuál era;
   * - las reservadas: todo lo que tienen publicado está con «Tienda reservada» (como en
   *   «Tiendas que ya están» del inicio). Una tienda que aún no publica nada sí sale.
   */
  private async listables(mirada: Mirada, q?: string): Promise<FilaTienda[]> {
    const texto = q?.trim() ? sinComodines(q.trim()) : '';
    const porNombre = texto
      ? Prisma.sql`AND unaccent(lower(t.nombre)) LIKE '%' || unaccent(lower(${texto})) || '%'`
      : Prisma.empty;
    const filas = await this.prisma.$queryRaw<
      Array<Omit<FilaTienda, 'privada'> & { visibilidad: VisibilidadPerfil; sigo: boolean }>
    >`
      SELECT t.id, t.nombre, t.logo, t.stand, t.piso, t.creada_en,
             g.slug::text AS galeria_slug, g.nombre AS galeria, g.orden::int AS galeria_orden,
             count(o.id) FILTER (WHERE o.tienda_visible AND o.stock > 0)::int AS con_stock,
             t.visibilidad::text AS visibilidad,
             EXISTS (
               SELECT 1 FROM seguimiento s
               WHERE s.tienda_id = CAST(${mirada.tiendaId} AS uuid) AND s.seguida_id = t.id
             ) AS sigo
      FROM tienda t
      LEFT JOIN galeria g ON g.id = t.galeria_id
      LEFT JOIN oferta o ON o.tienda_id = t.id AND o.estado = 'ACTIVA'
      WHERE t.estado = 'ACTIVA'
        AND NOT EXISTS (
          SELECT 1 FROM bloqueo b
          WHERE b.usuario_id = CAST(${mirada.usuarioId} AS uuid)
            AND b.tienda_bloqueada_id = t.id
            AND NOT b.reservada
        )
        ${porNombre}
      GROUP BY t.id, g.id
      HAVING count(o.id) = 0 OR count(o.id) FILTER (WHERE o.tienda_visible) > 0`;
    return filas.flatMap(({ visibilidad, sigo, ...fila }) => {
      const como = comoLaEncuentra({ ...fila, visibilidad }, mirada, sigo, q);
      return como ? [{ ...fila, privada: como === 'privada' }] : [];
    });
  }

  /** Qué vende cada tienda: solo con lo que publica con su nombre a la vista. */
  private categoriasDe(ids: string[]): Promise<CategoriaDeTienda[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.$queryRaw<CategoriaDeTienda[]>`
      SELECT o.tienda_id::text AS tienda_id, c.slug::text AS slug, c.nombre,
             c.orden::int AS orden, count(*)::int AS publicaciones
      FROM oferta o
      JOIN producto p ON p.id = o.producto_id
      JOIN categoria c ON c.id = p.categoria_id
      WHERE o.estado = 'ACTIVA' AND o.tienda_visible AND o.tienda_id = ANY(${ids}::uuid[])
      GROUP BY o.tienda_id, c.slug, c.nombre, c.orden`;
  }

  /** El puntito verde: alguien de la tienda tiene PaseLibre abierto ahora. */
  private async enLinea(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const usuarios = await this.prisma.usuario.findMany({
      where: { tiendaId: { in: ids } },
      select: { id: true, tiendaId: true },
    });
    const conectadas = new Set<string>();
    for (const usuario of usuarios) {
      if (usuario.tiendaId && this.tiempoReal.enLinea(usuario.id)) {
        conectadas.add(usuario.tiendaId);
      }
    }
    return conectadas;
  }
}

function sinPuntaje(reputacion: ReputacionConPuntaje | undefined) {
  return {
    estrellas: reputacion?.estrellas ?? null,
    opiniones: reputacion?.opiniones ?? 0,
    nueva: reputacion?.nueva ?? true,
  };
}

function comparar(
  orden: OrdenDirectorio,
  reputaciones: Map<string, ReputacionConPuntaje>,
): (a: FilaTienda, b: FilaTienda) => number {
  const porNombre = (a: FilaTienda, b: FilaTienda) => a.nombre.localeCompare(b.nombre, 'es');
  switch (orden) {
    case 'reputacion':
      return (a, b) => {
        const ra = reputaciones.get(a.id);
        const rb = reputaciones.get(b.id);
        return (
          (rb?.puntaje ?? 0) - (ra?.puntaje ?? 0) ||
          (rb?.opiniones ?? 0) - (ra?.opiniones ?? 0) ||
          b.con_stock - a.con_stock ||
          porNombre(a, b)
        );
      };
    case 'productos':
      return (a, b) => b.con_stock - a.con_stock || porNombre(a, b);
    case 'recientes':
      return (a, b) => b.creada_en.getTime() - a.creada_en.getTime() || porNombre(a, b);
    case 'nombre':
      return porNombre;
  }
}

/** «Todas las galerías ▾»: las que tienen alguna tienda que mostrar, en su orden, e independientes. */
function opcionesDeGaleria(filas: FilaTienda[]): Array<{ slug: string; nombre: string }> {
  const galerias = new Map<string, { slug: string; nombre: string; orden: number }>();
  let independientes = false;
  for (const fila of filas) {
    if (fila.galeria_slug && fila.galeria) {
      galerias.set(fila.galeria_slug, {
        slug: fila.galeria_slug,
        nombre: fila.galeria,
        orden: fila.galeria_orden ?? 0,
      });
    } else {
      independientes = true;
    }
  }
  return [
    ...galeriasEnOrden([...galerias.values()]).map(({ slug, nombre }) => ({ slug, nombre })),
    ...(independientes ? [{ ...INDEPENDIENTES }] : []),
  ];
}
