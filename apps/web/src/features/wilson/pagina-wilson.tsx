import {
  formatearPrecio,
  type GaleriaEnVivo,
  type NivelGaleria,
  type RespuestaWilson,
  textoEstadoDetalle,
} from '@paselibre/contracts';
import { IconMapPin } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PrecioConSesion } from '@/features/catalogo/precio-con-sesion';
import { haceRato } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Miniatura } from '@/shared/ui/miniatura';

import { hrefDirectorio, SIN_FILTROS } from './consulta-directorio';

/** Solo verde, sin rojo (N08): fondo, borde y texto de cada nivel. */
const TONO: Record<NivelGaleria, string> = {
  SIN: 'border-dashed border-borde bg-white text-tinta',
  POCOS: 'border-pase-medio bg-pase-medio text-tinta',
  VARIOS: 'border-[#7FD9A8] bg-[#7FD9A8] text-tinta',
  MUCHOS: 'border-pase bg-pase text-white',
};

/** La leyenda de abajo del mapa: el puntito de cada nivel. */
const LEYENDA: Array<[NivelGaleria, string, string]> = [
  ['SIN', 'Sin productos', 'border-dashed border-borde-control bg-white'],
  ['POCOS', 'Pocos', 'border-pase-medio bg-pase-medio'],
  ['VARIOS', 'Varios', 'border-[#7FD9A8] bg-[#7FD9A8]'],
  ['MUCHOS', 'Muchos', 'border-pase bg-pase'],
];

/** A dónde va la pestaña «Tiendas»: sin sesión, a iniciar sesión y de vuelta aquí. */
export function hrefPestanaTiendas(conSesion: boolean, destino = hrefDirectorio(SIN_FILTROS)) {
  return conSesion ? destino : `/ingresar?volver=${encodeURIComponent(destino)}`;
}

/**
 * «Wilson en vivo» (N08, N13): el título y las pestañas «Galerías · Tiendas». En el celular,
 * la cabecera verde con «Tu galería primero».
 */
export function MarcoWilson({
  pestana,
  conSesion,
  children,
}: {
  pestana: 'galerias' | 'tiendas';
  conSesion: boolean;
  children: ReactNode;
}) {
  const pastilla = (activa: boolean) =>
    `flex h-[38px] items-center rounded-full px-4 text-apoyo font-bold no-underline ${
      activa ? 'bg-tinta text-white' : 'border-[1.5px] border-borde bg-white text-tinta'
    }`;
  return (
    <div className="flex flex-col gap-5 max-md:gap-3.5">
      <CabeceraMovil
        centro={
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <b className="truncate text-[19px] font-bold leading-6">Wilson en vivo</b>
            <span className="truncate text-nota text-pase-medio">
              {pestana === 'tiendas' ? 'Todas las tiendas de la avenida' : 'Tu galería primero'}
            </span>
          </span>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex max-w-[760px] flex-col gap-1 max-md:hidden">
          <h1 className="tit m-0 text-[26px] leading-8">Wilson en vivo</h1>
          <p className="m-0 text-cuerpo text-secundario">
            {pestana === 'tiendas'
              ? 'Todas las tiendas de la avenida: por galería, piso y lo que venden.'
              : 'Mira en qué galería hay más de lo que buscas. Toca una para ver lo que publicaron.'}
          </p>
        </div>
        <nav aria-label="Wilson en vivo" className="flex items-center gap-2">
          <Link
            href="/wilson-en-vivo"
            aria-current={pestana === 'galerias' ? 'page' : undefined}
            className={pastilla(pestana === 'galerias')}
          >
            Galerías
          </Link>
          <Link
            href={hrefPestanaTiendas(conSesion)}
            aria-current={pestana === 'tiendas' ? 'page' : undefined}
            className={pastilla(pestana === 'tiendas')}
          >
            Tiendas
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}

/** «214» y «productos · 38 tiendas», o «Sin publicaciones aún». */
function Galeria({
  galeria,
  activa,
  href,
  cosas,
}: {
  galeria: GaleriaEnVivo;
  activa: boolean;
  href: string;
  cosas: (n: number) => string;
}) {
  return (
    <li className="relative">
      {galeria.mia && (
        <span className="absolute -top-3 right-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-tinta px-2.5 py-[3px] text-[12px] font-extrabold text-white">
          <IconMapPin size={13} stroke={1.8} aria-hidden="true" />
          Estás aquí
        </span>
      )}
      <Link
        href={href}
        scroll={false}
        aria-current={activa ? 'true' : undefined}
        className={`flex min-h-20 flex-col gap-1 rounded-2xl border-2 p-3.5 no-underline md:min-h-[110px] ${TONO[galeria.nivel]} ${
          galeria.mia ? '!border-solid !border-tinta outline outline-[3px] outline-tinta' : ''
        } ${activa ? 'shadow-[0_10px_22px_rgba(15,20,18,0.2)]' : 'hover:shadow-[0_6px_14px_rgba(15,20,18,0.12)]'}`}
      >
        <b className="text-cuerpo font-bold">{galeria.nombre}</b>
        {galeria.productos === 0 ? (
          <span className="text-[12px] leading-4 text-detalle">Sin publicaciones aún</span>
        ) : (
          <>
            <b className="text-[26px] font-bold leading-[1.1]">{galeria.productos}</b>
            <span className="text-[12px] leading-4 opacity-85">
              {cosas(galeria.productos)} · {conPlural(galeria.tiendas, 'tienda', 'tiendas')}
            </span>
          </>
        )}
      </Link>
    </li>
  );
}

/**
 * La pestaña «Galerías» (N08, CAT_Web3): todas las galerías de la avenida, la tuya primero, en
 * verde según cuánto tienen comparadas entre sí (lo decide la API: «Pocos / Varios / Muchos»),
 * y debajo lo último de la galería elegida. Todo se elige con enlaces: `?categoria=` y
 * `?galeria=`.
 */
export function VistaGalerias({ datos }: { datos: RespuestaWilson }) {
  // «tarjetas de video» con una categoría elegida; con una sola cosa, «producto».
  const cosas = datos.categoria ? datos.categoria.nombre.toLowerCase() : 'productos';
  const queCosa = (n: number) => (n === 1 ? 'producto' : cosas);
  const enlace = (cambios: { galeria?: string; categoria?: string | null }) => {
    const parametros = new URLSearchParams();
    const categoria = cambios.categoria === undefined ? datos.categoria?.slug : cambios.categoria;
    const galeria = cambios.galeria ?? datos.galeria?.slug;
    if (categoria) parametros.set('categoria', categoria);
    if (galeria) parametros.set('galeria', galeria);
    const texto = parametros.toString();
    return `/wilson-en-vivo${texto ? `?${texto}` : ''}`;
  };
  const chip = (activo: boolean) =>
    `flex h-10 shrink-0 items-center rounded-full border px-4 text-apoyo no-underline ${
      activo
        ? 'border-tinta bg-tinta font-bold text-white'
        : 'border-borde bg-white font-medium text-tinta'
    }`;
  const elegida = datos.galeria;
  const conSesion = datos.audiencia !== 'visitante';

  return (
    <>
      <nav
        aria-label="Categoría"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        <Link href={enlace({ categoria: null })} scroll={false} className={chip(!datos.categoria)}>
          Todo
        </Link>
        {datos.categorias.map((categoria) => (
          <Link
            key={categoria.slug}
            href={enlace({ categoria: categoria.slug })}
            scroll={false}
            aria-current={datos.categoria?.slug === categoria.slug ? 'true' : undefined}
            className={chip(datos.categoria?.slug === categoria.slug)}
          >
            {categoria.nombre}
          </Link>
        ))}
      </nav>

      <section
        aria-label="Las galerías de la avenida"
        className="flex flex-col gap-4 rounded-[14px] md:border-[1.5px] md:border-borde md:bg-superficie md:p-5"
      >
        <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 pt-3 md:gap-4 lg:grid-cols-4">
          {datos.galerias.map((galeria) => (
            <Galeria
              key={galeria.slug}
              galeria={galeria}
              activa={elegida?.slug === galeria.slug}
              href={enlace({ galeria: galeria.slug })}
              cosas={queCosa}
            />
          ))}
        </ul>
        <div
          aria-hidden="true"
          className="flex h-10 items-center justify-center rounded-[10px] bg-borde text-nota font-extrabold uppercase tracking-[0.1em] max-md:hidden"
        >
          Av. Garcilaso de la Vega (Wilson)
        </div>
        <ul aria-label="Leyenda" className="m-0 flex list-none flex-wrap items-center gap-4 p-0">
          {LEYENDA.map(([nivel, texto, punto]) => (
            <li key={nivel} className="inline-flex items-center gap-1.5 text-nota">
              <span
                aria-hidden="true"
                className={`h-3.5 w-3.5 rounded-full border-[1.5px] ${punto}`}
              />
              {texto}
            </li>
          ))}
        </ul>
      </section>

      {elegida && (
        <section aria-labelledby="de-la-galeria" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="de-la-galeria" className="text-seccion">
                Lo publicado en {elegida.nombre}
              </h2>
              <span className="text-apoyo text-secundario">
                {[
                  elegida.mia
                    ? 'Tu galería'
                    : elegida.minutos !== null
                      ? `A ${elegida.minutos} min caminando desde tu stand`
                      : null,
                  `${elegida.productos} ${queCosa(elegida.productos)}`,
                  'lo más nuevo primero',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
            {conSesion && (
              <Link
                href={hrefDirectorio(SIN_FILTROS, { galeria: elegida.slug })}
                className="text-apoyo font-bold text-pase-texto"
              >
                Ver las tiendas de {elegida.nombre} ›
              </Link>
            )}
          </div>

          {datos.ofertas.length === 0 ? (
            <p className="m-0 rounded-2xl border border-linea px-5 py-8 text-center text-secundario">
              Aún no hay {cosas} en {elegida.nombre}.
            </p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {datos.ofertas.map((oferta) => (
                <li key={oferta.oferta_id}>
                  <Link
                    href={`/p/${oferta.producto.slug}?oferta=${oferta.oferta_id}`}
                    className="flex h-full overflow-hidden rounded-2xl border border-linea bg-white text-tinta no-underline hover:border-borde max-sm:items-center max-sm:gap-3 max-sm:p-3 sm:flex-col"
                  >
                    <Miniatura
                      ruta={oferta.producto.foto}
                      categoria={oferta.producto.categoria.slug}
                      className="h-16 w-16 rounded-xl sm:h-[120px] sm:w-full sm:rounded-none sm:border-b-[1px] sm:border-[#DDE4E0] sm:shadow-none"
                      marco
                      glifo={56}
                      grosor={3}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:p-3.5">
                      <b className="line-clamp-2 text-apoyo font-bold leading-5">
                        {oferta.producto.titulo}
                      </b>
                      <span className="text-nota text-secundario">
                        {textoEstadoDetalle(oferta.detalle)}
                        {'tienda' in oferta
                          ? ` · ${oferta.tienda.nombre}${oferta.tienda.stand ? ` · Stand ${oferta.tienda.stand}` : ''}`
                          : ''}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        {'tienda' in oferta ? (
                          oferta.precio ? (
                            <span className="flex items-baseline gap-1.5">
                              <span className="text-[11px] font-bold tracking-wide text-detalle">
                                PASE
                              </span>
                              <b className="text-[17px] font-bold">
                                {formatearPrecio(oferta.precio)}
                              </b>
                            </span>
                          ) : (
                            <span className="text-apoyo font-semibold text-secundario">
                              Al interno
                            </span>
                          )
                        ) : (
                          <PrecioConSesion className="text-apoyo text-secundario" />
                        )}
                        <span className="text-nota font-bold text-pase-texto">
                          {haceRato(oferta.actualizada_en).toLowerCase()}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
