import {
  interpretarBusqueda,
  type CategoriaResumen,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
  type RespuestaBuscar,
  type RespuestaMasBuscado,
} from '@paselibre/contracts';
import { IconZoomCancel } from '@tabler/icons-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BarraFiltros } from '@/features/catalogo/barra-filtros';
import { MasBuscado } from '@/features/catalogo/mas-buscado';
import { TarjetaBusco } from '@/features/catalogo/tarjeta-busco';
import { TarjetaCategoria } from '@/features/catalogo/tarjeta-categoria';
import { ExactoNoHay, SinResultados } from '@/features/catalogo/sin-resultados';
import { TarjetaResultado } from '@/features/catalogo/tarjeta-resultado';
import { Buscador } from '@/shared/ui/buscador';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import {
  alternar,
  con,
  hayFiltros,
  hrefBuscar,
  leerFiltros,
  sinFiltros,
  textoConsulta,
} from '@/features/catalogo/consulta';
import {
  cargarApi,
  consultarApi,
  consultarApiCompartida,
  obtenerSesion,
} from '@/shared/api/servidor';

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
 * `/buscar` (W2, K3 y J2): lo que se buscó, en tarjetas por producto con su oferta más barata. La búsqueda tolera
 * errores («rtx 3370» encuentra la 3070) y la página lo dice. Arriba, las categorías donde
 * hay resultados y lo más buscado en la elegida; al final, «Publicar un busco». Sin
 * resultados ni filtros, la página no es un callejón (G): lo más buscado, el busco y las
 * categorías. Todo vive en la dirección: filtros, orden y página.
 */
export default async function Resultados({ searchParams }: { searchParams: Parametros }) {
  const filtros = leerFiltros(await searchParams);
  // Con la clave temporal todavía se busca como visitante (docs/08 §2).
  const sesion = await obtenerSesion();
  const conSesionPropia = Boolean(sesion && !sesion.usuario.debe_cambiar_clave);
  // Quien cotiza quiere lo más barato arriba; quien solo mira, lo más nuevo.
  const orden = filtros.orden ?? (conSesionPropia ? 'precio_asc' : 'recientes');
  const consulta = textoConsulta({ ...filtros, orden }, true);
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
  const porCategoria = resultado.facetas.categorias;
  // Con «Solo con stock» prendido, lo que se agotó no sale: no es lo mismo que no existir.
  const ofertasSinStock = resultado.facetas.condiciones.reduce((total, c) => total + c.cantidad, 0);
  const soloAgotados =
    sinResultados && filtros.stock && !hayFiltros(filtros) && ofertasSinStock > 0;
  const callejon = sinResultados && !hayFiltros(filtros) && !soloAgotados;
  const populares =
    callejon || filtros.categoria ? await masBuscado(callejon ? null : filtros.categoria) : [];

  if (callejon) {
    return (
      <Callejon
        parecidas={resultado.parecidas}
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
    [...resultado.facetas.galerias, ...resultado.facetas.marcas].map((faceta) => [
      faceta.slug,
      faceta.nombre,
    ]),
  );
  // Los atajos de la fila (stock, nuevo, usado) ya muestran lo suyo: aquí solo lo demás.
  const chips = [
    ...filtros.galeria.map((valor) => ({
      texto: nombres.get(valor) ?? valor,
      quitar: hrefBuscar(alternar(filtros, 'galeria', valor)),
    })),
    ...filtros.marca.map((valor) => ({
      texto: nombres.get(valor) ?? valor,
      quitar: hrefBuscar(alternar(filtros, 'marca', valor)),
    })),
    ...(filtros.precioMin || filtros.precioMax
      ? [
          {
            texto: `${filtros.moneda === 'PEN' ? 'S/' : 'US$'} ${filtros.precioMin || '0'} a ${filtros.precioMax || 'sin límite'}`,
            quitar: hrefBuscar(con(filtros, { precioMin: '', precioMax: '' })),
          },
        ]
      : []),
  ];
  // «Más barato» solo compara cosas parecidas: con una sola categoría en los resultados.
  const mismaCategoria = Boolean(filtros.categoria) || porCategoria.length <= 1;

  const cuenta = (
    <>
      <b className="font-semibold text-tinta">
        {resultado.total_ofertas === 1 ? '1 oferta' : `${resultado.total_ofertas} ofertas`}
      </b>{' '}
      de {resultado.total_productos === 1 ? '1 producto' : `${resultado.total_productos} productos`}
    </>
  );

  return (
    <div className="flex flex-col gap-6 max-md:gap-3">
      {/* M_Resultados: en el celular, volver y el buscador en la cabecera verde. */}
      <CabeceraMovil centro={<Buscador sobreMarca className="min-w-0 flex-1 pr-2" />} />
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle max-md:hidden">
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
        <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1 max-md:hidden">
          <h1 className="text-titulo">{titulo}</h1>
          <span className="text-cuerpo text-secundario">{cuenta}</span>
        </div>
        {resultado.correccion && (
          // BUS_Web: lo que se entendió y cómo buscar lo escrito tal cual.
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-secundario">
            <span>
              Mostrando resultados para{' '}
              <b className="font-semibold text-tinta">{resultado.correccion.mostramos}</b>
              {resultado.correccion.categoria &&
              resultado.correccion.categoria.nombre !== resultado.correccion.mostramos
                ? ` en ${resultado.correccion.categoria.nombre}`
                : ''}
              .
            </span>
            <Link
              href={hrefBuscar({
                ...filtros,
                q: resultado.correccion.buscaste,
                pagina: 1,
                talCual: true,
              })}
              className="font-bold text-pase-texto"
            >
              Buscar «{resultado.correccion.buscaste}» tal cual
            </Link>
          </p>
        )}
        {filtros.talCual && filtros.q && (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-secundario">
            <span>Buscando «{filtros.q}» tal cual, sin corregir.</span>
            <Link
              href={hrefBuscar({ ...filtros, pagina: 1, talCual: false })}
              className="font-bold text-pase-texto"
            >
              Volver a la búsqueda inteligente
            </Link>
          </p>
        )}
        {/* «¿Era justo…?» solo si se corrigieron letras, no si se entendieron números o la
            categoría («treinta setenta» es 3070 sin duda). */}
        {resultado.correccion &&
          resultado.audiencia === 'vendedor' &&
          !resultado.correccion.categoria &&
          interpretarBusqueda(resultado.correccion.buscaste).texto !==
            resultado.correccion.mostramos && (
            <ExactoNoHay q={resultado.correccion.buscaste} conSesion />
          )}
      </div>

      {populares.length > 0 && (
        <MasBuscado
          terminos={populares}
          categoria={filtros.categoria}
          titulo={nombreCategoria ? `Lo más buscado en ${nombreCategoria}:` : null}
        />
      )}

      <section aria-label="Resultados" className="flex min-w-0 flex-col">
        <div className="border-b border-linea">
          <BarraFiltros
            filtros={filtros}
            facetas={resultado.facetas}
            conSesion={conSesion}
            orden={orden}
            totalOfertas={resultado.total_ofertas}
          />
        </div>
        <p className="pt-2 text-nota text-secundario md:hidden">{cuenta}</p>

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3">
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
            {soloAgotados ? (
              <>
                <b className="text-tarjeta">Por ahora todo está sin stock</b>
                <span className="text-secundario">
                  Hay {ofertasSinStock === 1 ? '1 oferta' : `${ofertasSinStock} ofertas`} de esto,
                  pero ya se agotaron.
                </span>
                <Link
                  href={hrefBuscar(con(filtros, { stock: false }))}
                  className="text-apoyo font-medium"
                >
                  Ver también las que no tienen stock
                </Link>
              </>
            ) : (
              <>
                <b className="text-tarjeta">Ninguna oferta con estos filtros</b>
                <span className="text-secundario">
                  Quita alguno o limpia todos para ver más ofertas.
                </span>
                <Link href={hrefBuscar(sinFiltros(filtros))} className="text-apoyo font-medium">
                  Limpiar filtros
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="grid pt-1 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))] sm:gap-4 sm:pt-4">
            {resultado.productos.map((producto) => (
              <TarjetaResultado
                key={producto.slug}
                producto={producto}
                puedeChatear={resultado.audiencia === 'vendedor'}
                conInsignia={mismaCategoria && resultado.total_productos > 1}
              />
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
  );
}

/**
 * G: sin resultados y sin filtros. En vez de un callejón, lo más buscado, «Publicar un
 * busco» con lo escrito y las categorías. Si se buscó dentro de una categoría y hay
 * resultados en otras, van primero.
 */
function Callejon({
  parecidas,
  filtros,
  titulo,
  nombreCategoria,
  populares,
  categorias,
  enOtras,
  conSesion,
  conBusco,
}: {
  parecidas: Array<ProductoEnLista | ProductoEnListaConPrecio>;
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
      <CabeceraMovil centro={<Buscador sobreMarca className="min-w-0 flex-1 pr-2" />} />
      <nav aria-label="Ruta" className="flex flex-wrap gap-2 text-nota text-detalle max-md:hidden">
        <Link href="/" className="text-secundario">
          Inicio
        </Link>
        <span aria-hidden="true">›</span>
        <span>{titulo}</span>
      </nav>

      {filtros.q ? (
        <SinResultados
          q={filtros.q}
          nombreCategoria={nombreCategoria}
          categoria={filtros.categoria}
          conSesion={conSesion}
          conBusco={conBusco}
          parecidas={parecidas}
        />
      ) : (
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
        </div>
      )}
      {populares.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-tarjeta">Lo más buscado en la galería</h2>
          <MasBuscado terminos={populares} />
        </section>
      )}

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

      {conBusco && !filtros.q && (
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
