import type { RespuestaInicio, RespuestaPortada } from '@paselibre/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BandaEnVivo } from '@/features/inicio/banda-en-vivo';
import { InicioTienda } from '@/features/inicio/inicio-tienda';

import { TarjetaOfertaPortada } from '@/features/catalogo/tarjeta-oferta';
import { TarjetaVerTodo } from '@/features/catalogo/tarjeta-ver-todo';
import { cargarApi, consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { enPlural } from '@/shared/plural';
import { Carrusel } from '@/shared/ui/carrusel';
import { botonLista, botonPrincipal, botonSecundario } from '@/shared/ui/estilos';

/**
 * La portada (F_Portada): la bienvenida o «Tu cuenta», lo recién publicado con
 * pestañas por galería (`?galeria=`) y las categorías en grande. Sin sesión, la API no manda
 * precios ni tiendas, así que aquí tampoco hay de dónde sacarlos.
 */
export default async function Portada({
  searchParams,
}: {
  searchParams: Promise<{ galeria?: string }>;
}) {
  const { galeria } = await searchParams;
  // paselibre.shop abre en «Inicia sesión» (guía y COR3 del lienzo final); con sesión, el inicio.
  const sesion = await obtenerSesion();
  if (!sesion) redirect('/ingresar');
  const portada = await cargarApi<RespuestaPortada>(
    `/portada${galeria ? `?galeria=${encodeURIComponent(galeria)}` : ''}`,
  );
  // La tienda tiene su propio inicio, que crece solo (sección 5 del lienzo final).
  if (sesion?.tienda && portada.audiencia !== 'visitante' && !galeria) {
    const inicio = await consultarApi<RespuestaInicio>('/inicio');
    if (inicio.estado === 200 && inicio.cuerpo) {
      return (
        <InicioTienda
          sesion={sesion}
          inicio={inicio.cuerpo}
          recientes={portada.recien_publicado}
          categorias={portada.categorias}
        />
      );
    }
  }

  const lugar = sesion?.tienda
    ? [sesion.tienda.galeria, sesion.tienda.stand && `Stand ${sesion.tienda.stand}`]
        .filter(Boolean)
        .join(' · ') || 'Independiente'
    : null;

  const galeriaElegida = galeria ? portada.galerias.find((g) => g.slug === galeria) : undefined;
  const verTodo = galeriaElegida
    ? {
        href: `/buscar?galeria=${encodeURIComponent(galeriaElegida.slug)}`,
        titulo:
          galeriaElegida.ofertas === 1
            ? 'Ver la publicación'
            : `Ver las ${galeriaElegida.ofertas} publicaciones`,
        detalle: `en ${galeriaElegida.nombre}`,
      }
    : {
        href: '/buscar',
        titulo:
          portada.totales.productos === 1
            ? 'Ver el producto'
            : `Ver los ${portada.totales.productos} productos`,
        detalle: 'en todas las galerías',
      };

  return (
    <div className="flex flex-col gap-12">
      {sesion ? (
        <section
          aria-label="Tu cuenta"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-titulo">Hola, {sesion.tienda?.nombre ?? sesion.usuario.nombre}</h1>
            <p className="text-apoyo text-secundario">{lugar ?? 'Equipo de PaseLibre'}</p>
          </div>
          {sesion.tienda ? (
            <div className="flex flex-wrap gap-3">
              <Link href="/publicar" className={`${botonPrincipal} no-underline`}>
                Publicar
              </Link>
              <Link href="/mis-publicaciones" className={`${botonLista} no-underline`}>
                Mis publicaciones
              </Link>
            </div>
          ) : (
            <Link href="/equipo/cuentas" className={`${botonLista} no-underline`}>
              Ir al panel del equipo
            </Link>
          )}
        </section>
      ) : (
        // D_PortadaVisitante: la bienvenida en su tarjeta gris.
        <section
          aria-label="Bienvenida"
          className="flex flex-col gap-3 rounded-[28px] bg-superficie px-5 py-7 sm:px-9 sm:py-9"
        >
          <h1 className="text-[28px] font-bold leading-9 sm:text-[36px] sm:leading-[44px]">
            Lo que hay para pase en las galerías de Wilson
          </h1>
          <p className="max-w-[640px] text-cuerpo text-secundario">
            Busca componentes y mira en qué galería están. Los precios y el contacto con la tienda
            se ven al iniciar sesión.
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Link href="/ingresar" className={`${botonPrincipal} no-underline`}>
              Iniciar sesión
            </Link>
            <Link href="/ingresar?pestana=crear" className={`${botonSecundario} no-underline`}>
              ¿Cómo pido una cuenta?
            </Link>
          </div>
          <p className="text-apoyo text-detalle">
            <b className="font-semibold text-tinta">{portada.totales.productos}</b>{' '}
            {enPlural(portada.totales.productos, 'producto', 'productos')} ·{' '}
            <b className="font-semibold text-tinta">{portada.totales.tiendas}</b>{' '}
            {enPlural(portada.totales.tiendas, 'tienda', 'tiendas')} ·{' '}
            <b className="font-semibold text-tinta">{portada.totales.galerias}</b>{' '}
            {enPlural(portada.totales.galerias, 'galería', 'galerías')}
          </p>
        </section>
      )}

      {!sesion && <BandaEnVivo visitante />}

      <section aria-labelledby="recientes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recientes" className="text-seccion">
            Recién publicado
          </h2>
          <Link href={verTodo.href} className="text-apoyo font-medium">
            {verTodo.titulo}
          </Link>
        </div>
        {portada.recien_publicado.length === 0 ? (
          <p className="rounded-2xl bg-superficie p-6 text-secundario">
            Todavía no hay publicaciones en esta galería.
          </p>
        ) : (
          // `key`: al cambiar de galería la fila vuelve al principio.
          <Carrusel key={galeria ?? 'todas'} etiqueta="Recién publicado">
            {portada.recien_publicado.map((tarjeta) => (
              <TarjetaOfertaPortada
                key={tarjeta.oferta_id}
                tarjeta={tarjeta}
                audiencia={portada.audiencia}
              />
            ))}
            <TarjetaVerTodo key="ver-todo" {...verTodo} />
          </Carrusel>
        )}
      </section>

      <section aria-labelledby="explora" className="flex flex-col gap-4">
        <h2 id="explora" className="text-seccion">
          Explora por categoría
        </h2>
        {!sesion ? (
          // D_PortadaVisitante: tarjetas con la inicial y cuántos productos tiene.
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-7">
            {portada.categorias
              .filter((categoria) => categoria.productos > 0)
              .slice(0, 14)
              .map((categoria) => (
                <li key={categoria.slug}>
                  <Link
                    href={`/categorias/${categoria.slug}`}
                    className="flex h-full flex-col gap-2 rounded-2xl border border-linea bg-white p-4 text-tinta no-underline hover:border-borde"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-pase-suave font-bold text-marca"
                    >
                      {categoria.nombre.charAt(0)}
                    </span>
                    <b className="mt-1 text-cuerpo font-bold leading-5">{categoria.nombre}</b>
                    <span className="text-nota text-secundario">
                      {categoria.productos === 1
                        ? '1 producto'
                        : `${categoria.productos} productos`}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {portada.categorias
              .filter((categoria) => categoria.productos > 0)
              .map((categoria) => (
                <li key={categoria.slug}>
                  <Link
                    href={`/buscar?categoria=${categoria.slug}`}
                    className="flex h-11 items-center gap-2 rounded-full border border-borde bg-white px-4 text-cuerpo font-semibold text-tinta no-underline hover:border-borde-control"
                  >
                    {categoria.nombre}
                    <span className="text-apoyo font-normal text-detalle">
                      {categoria.productos}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
