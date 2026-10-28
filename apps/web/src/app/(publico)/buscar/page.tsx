import type { CategoriaResumen, RespuestaBuscar } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';

import { FilaProducto } from '@/features/catalogo/fila-producto';
import { Filtrar } from '@/features/catalogo/filtros';
import { Ordenar } from '@/features/catalogo/ordenar';
import {
  alternar,
  con,
  hayFiltros,
  hrefBuscar,
  leerFiltros,
  sinFiltros,
  textoConsulta,
} from '@/features/catalogo/consulta';
import { cargarApi } from '@/shared/api/servidor';

type Parametros = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Parametros;
}): Promise<Metadata> {
  const { q } = leerFiltros(await searchParams);
  return { title: q ? `${q} · Buscar` : 'Buscar' };
}

/**
 * `/buscar` (F_Resultados): lo que se buscó, agrupado por producto. La búsqueda tolera
 * errores («rtx 3370» encuentra la 3070) y la página lo dice. Todo vive en la dirección:
 * filtros, orden y página.
 */
export default async function Resultados({ searchParams }: { searchParams: Parametros }) {
  const filtros = leerFiltros(await searchParams);
  const consulta = textoConsulta(filtros);
  const [resultado, categorias] = await Promise.all([
    cargarApi<RespuestaBuscar>(`/buscar${consulta ? `?${consulta}` : ''}`),
    filtros.categoria ? cargarApi<CategoriaResumen[]>('/categorias') : Promise.resolve(null),
  ]);
  const conSesion = resultado.audiencia !== 'visitante';
  const nombreCategoria =
    categorias?.find((categoria) => categoria.slug === filtros.categoria)?.nombre ?? null;
  const titulo = filtros.q || nombreCategoria || 'Todos los productos';
  const sinResultados = resultado.productos.length === 0;

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

          {sinResultados ? (
            <div className="mt-6 flex max-w-[520px] flex-col items-start gap-2 rounded-2xl bg-superficie p-6">
              <b className="text-tarjeta">
                {hayFiltros(filtros)
                  ? 'Ninguna oferta con estos filtros'
                  : `No encontramos «${titulo}»`}
              </b>
              <span className="text-secundario">
                {hayFiltros(filtros)
                  ? 'Quita alguno o limpia todos para ver más ofertas.'
                  : 'Revisa la ortografía o prueba con menos palabras, por ejemplo la marca y el modelo.'}
              </span>
              <Link
                href={hayFiltros(filtros) ? hrefBuscar(sinFiltros(filtros)) : '/'}
                className="text-apoyo font-medium"
              >
                {hayFiltros(filtros) ? 'Limpiar filtros' : 'Volver a la portada'}
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
        </section>
      </div>
    </div>
  );
}
