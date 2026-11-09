import type { RespuestaPortada } from '@paselibre/contracts';
import Link from 'next/link';

import { TarjetaOfertaPortada } from '@/features/catalogo/tarjeta-oferta';
import { TarjetaVerTodo } from '@/features/catalogo/tarjeta-ver-todo';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';
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
  const [sesion, portada] = await Promise.all([
    obtenerSesion(),
    cargarApi<RespuestaPortada>(
      `/portada${galeria ? `?galeria=${encodeURIComponent(galeria)}` : ''}`,
    ),
  ]);
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
        <section aria-label="Bienvenida" className="flex flex-col gap-3 sm:max-w-[720px]">
          <h1 className="text-titulo">Lo que hay para pase en las galerías de Wilson</h1>
          <p className="text-cuerpo text-secundario">
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
            <b className="font-semibold text-tinta">{portada.totales.productos}</b> productos ·{' '}
            <b className="font-semibold text-tinta">{portada.totales.tiendas}</b> tiendas ·{' '}
            <b className="font-semibold text-tinta">{portada.totales.galerias}</b> galerías
          </p>
        </section>
      )}

      <section aria-labelledby="recientes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recientes" className="text-seccion">
            Recién publicado
          </h2>
          <Link href={verTodo.href} className="text-apoyo font-medium">
            {verTodo.titulo}
          </Link>
        </div>
        <div aria-label="Galería" className="flex flex-wrap gap-2">
          {[{ slug: '', nombre: 'Todas', ofertas: null as number | null }, ...portada.galerias].map(
            (opcion) => {
              const activa = (galeria ?? '') === opcion.slug;
              return (
                <Link
                  key={opcion.slug || 'todas'}
                  href={opcion.slug ? `/?galeria=${opcion.slug}` : '/'}
                  aria-current={activa ? 'true' : undefined}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-apoyo font-medium no-underline md:h-9 ${
                    activa
                      ? 'border-tinta bg-tinta text-white'
                      : 'border-borde bg-white text-tinta hover:border-borde-control'
                  }`}
                >
                  {opcion.nombre}
                  {opcion.ofertas !== null && (
                    <span className={`text-nota ${activa ? 'text-white/80' : 'text-detalle'}`}>
                      {opcion.ofertas}
                    </span>
                  )}
                </Link>
              );
            },
          )}
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
        {/* En texto, con cuántos productos tiene (FI_WebNormal del lienzo «Versión final»). */}
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
                  <span className="text-apoyo font-normal text-detalle">{categoria.productos}</span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
