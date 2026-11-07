import type { CategoriaResumen, RespuestaBuscar, RespuestaMasBuscado } from '@paselibre/contracts';
import { IconZoomCancel } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FilaProducto } from '@/features/catalogo/fila-producto';
import { Filtrar } from '@/features/catalogo/filtros';
import { MasBuscado } from '@/features/catalogo/mas-buscado';
import { Ordenar } from '@/features/catalogo/ordenar';
import { TarjetaBusco } from '@/features/catalogo/tarjeta-busco';
import { TarjetaCategoria } from '@/features/catalogo/tarjeta-categoria';
import {
  alternar,
  con,
  hayFiltros,
  hrefBuscar,
  leerFiltros,
  sinFiltros,
  textoConsulta,
} from '@/features/catalogo/consulta';
import { cargarApi, consultarApi, consultarApiCompartida } from '@/shared/api/servidor';

type Parametros = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Parametros;
}): Promise<Metadata> {
  const { q } = leerFiltros(await searchParams);
  return { title: q ? `${q} · Buscar` : 'Buscar' };
}

/** «Lo más buscado» es un adorno: si la API falla, la página sale sin él. */
async function masBuscado(categoria: string | null): Promise<string[]> {
  const { cuerpo } = await consultarApi<RespuestaMasBuscado>(
    `/buscar/populares${categoria ? `?categoria=${encodeURIComponent(categoria)}` : ''}`,
  );
  return cuerpo?.terminos ?? [];
}

/**
 * `/buscar` (F_Resultados y J2): lo que se buscó, agrupado por producto. La búsqueda tolera
 * errores («rtx 3370» encuentra la 3070) y la página lo dice. Arriba, las categorías donde
 * hay resultados y lo más buscado en la elegida; al final, «Publicar un busco». Sin
 * resultados ni filtros, la página no es un callejón (G): lo más buscado, el busco y las
 * categorías. Todo vive en la dirección: filtros, orden y página.
 */
export default async function Resultados({ searchParams }: { searchParams: Parametros }) {
  const filtros = leerFiltros(await searchParams);
  const consulta = textoConsulta(filtros);
  const [resultado, { cuerpo: categorias }] = await Promise.all([
    cargarApi<RespuestaBuscar>(`/buscar${consulta ? `?${consulta}` : ''}`),
    consultarApiCompartida<CategoriaResumen[]>('/categorias'),
  ]);
  const conSesion = resultado.audiencia !== 'visitante';
  // El busco lo publica una tienda: al equipo no se le ofrece.
  const conBusco = resultado.audiencia !== 'equipo';
  const nombreCategoria =
    categorias?.find((categoria) => categoria.slug === filtros.categoria)?.nombre ?? null;
  const titulo = filtros.q || nombreCategoria || 'Todos los productos';
  const sinResultados = resultado.productos.length === 0;
  const callejon = sinResultados && !hayFiltros(filtros);
  const porCategoria = resultado.facetas.categorias;
  const populares =
    callejon || filtros.categoria ? await masBuscado(callejon ? null : filtros.categoria) : [];

  if (callejon) {
    return (
      <SinResultados
        filtros={filtros}
        titulo={titulo}
        nombreCategoria={nombreCategoria}
        populares={populares}
        categorias={(categorias ?? []).filter((categoria) => categoria.productos > 0)}
        enOtras={filtros.categoria ? porCategoria : []}
        conSesion={conSesion}
        conBusco={conBusco}
      />
    );
  }

  const nombres = new Map(
    [
      ...resultado.facetas.galerias,
      ...resultado.facetas.marcas,
      ...resultado.facetas.condiciones,
    ].map((faceta) => [faceta.slug, faceta.nombre]),
  );
  const chips = [
    ...filtros.galeria.map((valor) => ({
      texto: nombres.get(valor) ?? valor,
      quitar: hrefBuscar(alternar(filtros, 'galeria', valor)),
    })),
    ...filtros.marca.map((valor) => ({
      texto: nombres.get(valor) ?? valor,
      quitar: hrefBuscar(alternar(filtros, 'marca', valor)),
    })),
    ...filtros.condicion.map((valor) => ({
      texto: nombres.get(valor) ?? valor,
      quitar: hrefBuscar(alternar(filtros, 'condicion', valor)),
    })),
    ...(filtros.stock
      ? [{ texto: 'Solo con stock', quitar: hrefBuscar(con(filtros, { stock: false })) }]
      : []),
    ...(filtros.precioMin || filtros.precioMax
      ? [
          {
            texto: `${filtros.moneda === 'PEN' ? 'S/' : 'US$'} ${filtros.precioMin || '0'} a ${filtros.precioMax || 'sin límite'}`,
            quitar: hrefBuscar(con(filtros, { precioMin: '', precioMax: '' })),
          },
        ]
      : []),
  ];

  const opciones = [
    { valor: 'recientes', texto: 'Más recientes' },
    ...(conSesion
      ? [
          { valor: 'precio_asc', texto: 'Menor precio' },
          { valor: 'precio_desc', texto: 'Mayor precio' },
        ]
      : []),
  ].map((opcion) => ({
    ...opcion,
    href: hrefBuscar(con(filtros, { orden: opcion.valor as typeof filtros.orden })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        {nombreCategoria && filtros.q ? (
          <>
            <Link href={hrefBuscar(con(filtros, { q: '', pagina: 1 }))} className="text-secundario">
              {nombreCategoria}
            </Link>
            <span aria-hidden="true">›</span>
            <span>{filtros.q}</span>
          </>
        ) : (
          <span>{titulo}</span>
        )}
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">{titulo}</h1>
        {resultado.correccion && (
          <p className="text-secundario">
            Mostramos resultados para{' '}
            <b className="font-semibold">{resultado.correccion.mostramos}</b>. Buscaste «
            {resultado.correccion.buscaste}».
          </p>
        )}
      </div>

      {(porCategoria.length > 1 || populares.length > 0) && (
        <section aria-label="Categorías" className="flex flex-col gap-3">
          {porCategoria.length > 1 && (
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <TarjetaCategoria
                compacta
                href={hrefBuscar(sinFiltros(con(filtros, { categoria: null })))}
                slug={null}
                nombre="Todas"
                productos={porCategoria.reduce((total, c) => total + c.cantidad, 0)}
                elegida={!filtros.categoria}
              />
              {porCategoria.map((categoria) => (
                <TarjetaCategoria
                  key={categoria.slug}
                  compacta
                  href={hrefBuscar(sinFiltros(con(filtros, { categoria: categoria.slug })))}
                  slug={categoria.slug}
                  nombre={categoria.nombre}
                  productos={categoria.cantidad}
                  elegida={filtros.categoria === categoria.slug}
                />
              ))}
            </div>
          )}
          <MasBuscado
            terminos={populares}
            categoria={filtros.categoria}
            titulo={nombreCategoria ? `Lo más buscado en ${nombreCategoria}:` : null}
          />
        </section>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="lg:w-[248px] lg:shrink-0">
          {/* En el celular los filtros se abren con un botón, para que los resultados queden arriba. */}
          <input id="ver-filtros" type="checkbox" className="peer sr-only" />
          <label
            htmlFor="ver-filtros"
            className="flex h-11 cursor-pointer items-center justify-between rounded-full border border-borde px-4 text-apoyo font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tinta lg:hidden"
          >
            Filtros
            {chips.length > 0 && (
              <span className="rounded-full bg-pase px-2 text-nota leading-5 text-white">
                {chips.length}
              </span>
            )}
          </label>
          <div className="mt-4 hidden peer-checked:block lg:mt-0 lg:block">
            <Filtrar filtros={filtros} facetas={resultado.facetas} conSesion={conSesion} />
          </div>
        </div>

        <section aria-label="Resultados" className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-linea pb-3">
            <span className="text-apoyo text-secundario">
              <b className="font-semibold text-tinta">
                {resultado.total_ofertas === 1 ? '1 oferta' : `${resultado.total_ofertas} ofertas`}
              </b>{' '}
              de{' '}
              {resultado.total_productos === 1
                ? '1 producto'
                : `${resultado.total_productos} productos`}
              , agrupadas por producto
            </span>
            <Ordenar actual={filtros.orden} opciones={opciones} />
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 py-3">
              {chips.map((chip) => (
                <Link
                  key={chip.texto}
                  href={chip.quitar}
                  aria-label={`Quitar filtro ${chip.texto}`}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-pase-suave px-3 text-apoyo font-medium text-tinta no-underline"
                >
                  {chip.texto}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </Link>
              ))}
              <Link href={hrefBuscar(sinFiltros(filtros))} className="text-apoyo font-medium">
                Limpiar filtros
              </Link>
            </div>
          )}

          {/* Sin resultados y sin filtros la página es otra (SinResultados): aquí solo sobran filtros. */}
          {sinResultados ? (
            <div className="mt-6 flex max-w-[520px] flex-col items-start gap-2 rounded-2xl bg-superficie p-6">
              <b className="text-tarjeta">Ninguna oferta con estos filtros</b>
              <span className="text-secundario">
                Quita alguno o limpia todos para ver más ofertas.
              </span>
              <Link href={hrefBuscar(sinFiltros(filtros))} className="text-apoyo font-medium">
                Limpiar filtros
              </Link>
            </div>
          ) : (
            <div className="flex flex-col">
              {resultado.productos.map((producto) => (
                <FilaProducto key={producto.slug} producto={producto} conSesion={conSesion} />
              ))}
            </div>
          )}

          {resultado.paginas > 1 && (
            <nav aria-label="Páginas" className="flex items-center justify-between gap-4 pt-6">
              {filtros.pagina > 1 ? (
                <Link
                  href={hrefBuscar({ ...filtros, pagina: filtros.pagina - 1 })}
                  className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium no-underline"
                >
                  Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-apoyo text-secundario">
                Página {resultado.pagina} de {resultado.paginas}
              </span>
              {resultado.pagina < resultado.paginas ? (
                <Link
                  href={hrefBuscar({ ...filtros, pagina: filtros.pagina + 1 })}
                  className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium no-underline"
                >
                  Siguiente
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}

          {conBusco && !sinResultados && (
            <div className="pt-8">
              <TarjetaBusco
                titulo="¿No está lo que buscas?"
                texto="Publica un busco y te avisan las tiendas que lo tienen."
                conSesion={conSesion}
                que={filtros.q}
                categoria={filtros.categoria}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * G: sin resultados y sin filtros. En vez de un callejón, lo más buscado, «Publicar un
 * busco» con lo escrito y las categorías. Si se buscó dentro de una categoría y hay
 * resultados en otras, van primero.
 */
function SinResultados({
  filtros,
  titulo,
  nombreCategoria,
  populares,
  categorias,
  enOtras,
  conSesion,
  conBusco,
}: {
  filtros: ReturnType<typeof leerFiltros>;
  titulo: string;
  nombreCategoria: string | null;
  populares: string[];
  categorias: CategoriaResumen[];
  enOtras: RespuestaBuscar['facetas']['categorias'];
  conSesion: boolean;
  conBusco: boolean;
}) {
  const encabezado = filtros.q
    ? `No encontramos «${filtros.q}»${nombreCategoria ? ` en ${nombreCategoria}` : ''}`
    : `Todavía no hay productos en ${titulo}`;
  return (
    <div className="flex flex-col gap-10">
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        <span>{titulo}</span>
      </nav>

      <div className="flex flex-wrap items-start gap-x-12 gap-y-6">
        <div className="flex min-w-0 flex-[1_1_520px] items-start gap-5">
          <IconZoomCancel
            size={44}
            stroke={1.4}
            aria-hidden="true"
            className="shrink-0 text-secundario max-sm:hidden"
          />
          <div className="flex flex-col gap-2.5">
            <h1 className="text-titulo">{encabezado}</h1>
            <p className="text-secundario">
              {filtros.q
                ? 'Revisa cómo se escribe o prueba con menos palabras: con la marca y el modelo basta.'
                : 'Cuando una tienda publique algo aquí, lo verás en esta página.'}
            </p>
          </div>
        </div>
        {populares.length > 0 && (
          <aside className="flex max-w-[540px] flex-[1_1_380px] flex-col gap-3.5 rounded-[20px] border border-linea p-5 sm:px-6">
            <h2 className="text-tarjeta">Lo más buscado en la galería</h2>
            <MasBuscado terminos={populares} />
          </aside>
        )}
      </div>

      {enOtras.length > 0 && (
        <section aria-labelledby="en-otras" className="flex flex-col gap-4">
          <h2 id="en-otras" className="text-seccion">
            Sí está en otras categorías
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {enOtras.map((categoria) => (
              <TarjetaCategoria
                key={categoria.slug}
                compacta
                href={hrefBuscar(con(filtros, { categoria: categoria.slug }))}
                slug={categoria.slug}
                nombre={categoria.nombre}
                productos={categoria.cantidad}
              />
            ))}
          </div>
        </section>
      )}

      {conBusco && (
        <TarjetaBusco
          grande
          titulo="¿Lo necesitas para un cliente?"
          texto="Publica un busco y les avisamos a las tiendas que lo tienen. Te responden con «¡Lo tengo!» en el chat."
          conSesion={conSesion}
          que={filtros.q}
          categoria={filtros.categoria}
        />
      )}

      {categorias.length > 0 && (
        <section aria-labelledby="explora" className="flex flex-col gap-4">
          <h2 id="explora" className="text-seccion">
            O explora las categorías
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {categorias.map((categoria) => (
              <TarjetaCategoria
                key={categoria.slug}
                href={`/buscar?categoria=${categoria.slug}`}
                slug={categoria.slug}
                nombre={categoria.nombre}
                productos={categoria.productos}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
