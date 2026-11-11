import {
  formatearPrecio,
  type GaleriaEnVivo,
  type RespuestaWilson,
  textoEstadoDetalle,
} from '@paselibre/contracts';
import { IconMapPin } from '@tabler/icons-react';
import Link from 'next/link';

import { PrecioConSesion } from '@/features/catalogo/precio-con-sesion';
import { haceRato } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Miniatura } from '@/shared/ui/miniatura';

/** Más oscuro = más publicado (CAT_Web3): fondo, texto y texto chico. */
function tono(productos: number, mayor: number): [string, string, string] {
  const parte = mayor === 0 ? 0 : productos / mayor;
  if (parte > 0.85) return ['bg-marca', 'text-white', 'text-pase-medio'];
  if (parte > 0.6) return ['bg-pase', 'text-white', 'text-pase-suave'];
  if (parte > 0.45) return ['bg-[#A7E3C3]', 'text-tinta', 'text-secundario'];
  return ['bg-pase-medio', 'text-tinta', 'text-secundario'];
}

function distancia(galeria: GaleriaEnVivo): string | null {
  if (galeria.mia) return 'Aquí estás';
  if (galeria.minutos === null) return null;
  return `a ${galeria.minutos} min caminando`;
}

/**
 * «Wilson en vivo» (CAT_Web3, CAT_Cel3, sección 8 del lienzo final): la avenida como mapa de
 * calor (más oscuro, más publicado), lo último de la galería elegida y sus tiendas por piso.
 * Todo se elige con enlaces: `?categoria=`, `?galeria=` y `?vista=tiendas`.
 */
export function PaginaWilson({
  datos,
  vista,
}: {
  datos: RespuestaWilson;
  vista: 'publicado' | 'tiendas';
}) {
  const mayor = Math.max(0, ...datos.galerias.map((galeria) => galeria.productos));
  // «tarjetas de video» con una categoría elegida; con una sola cosa, «producto» (la categoría ya
  // se ve elegida arriba).
  const cosas = datos.categoria ? datos.categoria.nombre.toLowerCase() : 'productos';
  const queCosa = (n: number) => (n === 1 ? 'producto' : cosas);
  const enlace = (cambios: { galeria?: string; categoria?: string | null; vista?: string }) => {
    const parametros = new URLSearchParams();
    const categoria = cambios.categoria === undefined ? datos.categoria?.slug : cambios.categoria;
    const galeria = cambios.galeria ?? datos.galeria?.slug;
    if (categoria) parametros.set('categoria', categoria);
    if (galeria) parametros.set('galeria', galeria);
    if (cambios.vista === 'tiendas') parametros.set('vista', 'tiendas');
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

  return (
    <div className="flex flex-col gap-6">
      <CabeceraMovil
        centro={
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <b className="truncate text-[20px] font-bold leading-6">Wilson en vivo</b>
            <span className="truncate text-nota text-white/85">
              Dónde hay más y qué tan lejos está
            </span>
          </span>
        }
      />
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="flex max-w-[760px] flex-col gap-1 max-md:hidden">
          <h1 className="text-titulo">Wilson en vivo</h1>
          <p className="m-0 text-cuerpo text-secundario">
            Mira en qué galería hay más de lo que buscas y qué tan lejos está de tu stand. Toca una
            para ver lo que publicaron.
          </p>
        </div>
        <nav
          aria-label="Categoría"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          <Link href={enlace({ categoria: null })} className={chip(!datos.categoria)}>
            Todo
          </Link>
          {datos.categorias.map((categoria) => (
            <Link
              key={categoria.slug}
              href={enlace({ categoria: categoria.slug })}
              aria-current={datos.categoria?.slug === categoria.slug ? 'true' : undefined}
              className={chip(datos.categoria?.slug === categoria.slug)}
            >
              {categoria.nombre}
            </Link>
          ))}
        </nav>
      </div>

      <section
        aria-label="Las galerías de la avenida"
        className="flex flex-col gap-3 rounded-[28px] bg-superficie p-3.5 sm:p-5"
      >
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
          {datos.galerias.map((galeria) => {
            const [fondo, texto, chico] = tono(galeria.productos, mayor);
            const activa = elegida?.slug === galeria.slug;
            const lejos = distancia(galeria);
            return (
              <li key={galeria.slug} className="relative">
                {galeria.mia && (
                  <span className="absolute -top-2.5 right-3 z-10 flex h-7 items-center gap-1 rounded-full bg-tinta px-2.5 text-[12px] font-bold text-white">
                    <IconMapPin size={13} stroke={2} aria-hidden="true" />
                    Estás aquí
                  </span>
                )}
                <Link
                  href={enlace({ galeria: galeria.slug })}
                  aria-current={activa ? 'true' : undefined}
                  className={`flex min-h-[140px] flex-col justify-between gap-1.5 rounded-2xl border-[3px] p-3.5 no-underline ${fondo} ${texto} ${
                    activa
                      ? 'border-tinta shadow-[0_8px_18px_rgba(15,20,18,0.18)]'
                      : 'border-transparent'
                  }`}
                >
                  <b className="text-cuerpo font-bold">{galeria.nombre}</b>
                  <span className="flex flex-col">
                    <b className="text-[28px] font-bold leading-9">{galeria.productos}</b>
                    <span className={`text-nota ${chico}`}>
                      {queCosa(galeria.productos)} ·{' '}
                      {conPlural(galeria.tiendas, 'tienda', 'tiendas')}
                    </span>
                    {lejos && <span className={`text-nota ${chico}`}>{lejos}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex h-9 items-center justify-center rounded-lg bg-[#C9D1CC] text-nota font-bold uppercase tracking-[0.12em] text-secundario">
          Av. Garcilaso de la Vega (Wilson)
        </div>
        <span className="text-nota text-secundario">
          Más oscuro = más productos publicados. Toca una galería para ver qué hay.
        </span>
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
            <div role="tablist" className="flex rounded-full bg-superficie p-1">
              {(
                [
                  ['publicado', 'Lo publicado'],
                  ['tiendas', 'Tiendas por piso'],
                ] as const
              ).map(([clave, texto]) => (
                <Link
                  key={clave}
                  role="tab"
                  aria-selected={vista === clave}
                  href={enlace({ vista: clave })}
                  scroll={false}
                  className={`flex h-[38px] items-center rounded-full px-4 text-apoyo no-underline ${
                    vista === clave
                      ? 'bg-tinta font-bold text-white'
                      : 'font-medium text-secundario'
                  }`}
                >
                  {texto}
                </Link>
              ))}
            </div>
          </div>

          {vista === 'tiendas' ? (
            datos.audiencia === 'visitante' ? (
              <p className="m-0 rounded-2xl border border-linea px-5 py-8 text-center text-secundario">
                Las tiendas de cada piso se ven al{' '}
                <Link href="/ingresar" className="font-bold text-pase-texto">
                  iniciar sesión
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {datos.pisos.map((piso) => (
                  <section key={piso.piso} aria-label={piso.piso} className="flex flex-col gap-2">
                    <h3 className="m-0 text-etiqueta uppercase text-detalle">{piso.piso}</h3>
                    <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
                      {piso.tiendas.map((tienda) => (
                        <li key={tienda.id}>
                          <Link
                            href={tienda.mia ? '/mis-publicaciones' : `/tiendas/${tienda.id}`}
                            className="flex flex-col gap-0.5 rounded-2xl border border-linea bg-white px-4 py-3 text-tinta no-underline hover:border-borde"
                          >
                            <b className="text-cuerpo font-bold">{tienda.nombre}</b>
                            <span className="text-nota text-secundario">
                              {tienda.stand ? `Stand ${tienda.stand}` : 'Sin stand'}
                            </span>
                            <span
                              className={`text-nota font-bold ${tienda.mia ? 'text-pase-texto' : 'text-secundario'}`}
                            >
                              {tienda.mia
                                ? 'Tu tienda'
                                : conPlural(tienda.productos, 'publicación', 'publicaciones')}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : datos.ofertas.length === 0 ? (
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
                      className="h-16 w-16 rounded-xl sm:h-[120px] sm:w-full sm:rounded-none"
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
    </div>
  );
}
