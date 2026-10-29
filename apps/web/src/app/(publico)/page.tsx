import type { RespuestaPortada } from '@paselibre/contracts';
import Link from 'next/link';

import { TarjetaOfertaPortada } from '@/features/catalogo/tarjeta-oferta';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';
import { GlifoCategoria } from '@/shared/ui/glifo-categoria';
import { botonLista, botonPrincipal } from '@/shared/ui/estilos';

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
        <section
          aria-label="Bienvenida"
          className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6 rounded-2xl bg-superficie p-6 sm:p-8"
        >
          <div className="flex max-w-[620px] flex-col gap-3">
            <h1 className="text-titulo">Lo que hay para pase en las galerías de Wilson</h1>
            <p className="text-secundario">
              Busca componentes y mira en qué galería están. Los precios y el contacto con la tienda
              se ven al iniciar sesión; las cuentas las entrega el equipo de PaseLibre.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/ingresar" className={`${botonPrincipal} no-underline`}>
                Iniciar sesión
              </Link>
              <Link href="/ingresar?pestana=crear" className="text-apoyo font-medium">
                ¿Cómo pido una cuenta?
              </Link>
            </div>
          </div>
          <dl className="flex gap-8">
            {(
              [
                ['productos', portada.totales.productos],
                ['tiendas', portada.totales.tiendas],
                ['galerías', portada.totales.galerias],
              ] as const
            ).map(([nombre, cantidad]) => (
              <div key={nombre} className="flex flex-col-reverse">
                <dt className="text-nota text-detalle">{nombre}</dt>
                <dd className="text-[28px] font-semibold leading-9">{cantidad}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="recientes" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recientes" className="text-seccion">
            Recién publicado
          </h2>
          <Link href="/buscar" className="text-apoyo font-medium">
            Ver todo
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
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-apoyo font-medium no-underline ${
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
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {portada.recien_publicado.map((tarjeta) => (
              <TarjetaOfertaPortada
                key={tarjeta.oferta_id}
                tarjeta={tarjeta}
                audiencia={portada.audiencia}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="explora" className="flex flex-col gap-4">
        <h2 id="explora" className="text-seccion">
          Explora por categoría
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {portada.categorias.map((categoria) => (
            <Link
              key={categoria.slug}
              href={`/buscar?categoria=${categoria.slug}`}
              className="flex flex-col items-center gap-3 rounded-2xl border border-linea p-4 text-center no-underline hover:border-borde"
            >
              <span className="flex h-16 w-full items-center justify-center rounded-xl bg-superficie">
                <GlifoCategoria categoria={categoria.slug} ancho={68} grosor={2.6} />
              </span>
              <span className="flex flex-col">
                <span className="text-apoyo font-semibold text-tinta">{categoria.nombre}</span>
                <span className="text-nota text-detalle">
                  {categoria.productos === 1 ? '1 producto' : `${categoria.productos} productos`}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
