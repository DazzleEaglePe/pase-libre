'use client';

import {
  formatearPrecio,
  type CategoriaResumen,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
  type RespuestaMasBuscado,
  type RespuestaSugerenciasConTiendas,
  type TiendaEnBuscador,
} from '@paselibre/contracts';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { llamarApi } from '@/shared/api/cliente';
import {
  lugarDeTienda,
  partirCoincidencia,
  reputacionParaLeer,
  textoReputacion,
} from '@/shared/tiendas';

import { AvatarTienda } from './avatar-tienda';
import { Miniatura } from './miniatura';

const CLAVE_RECIENTES = 'paselibre:busquedas-recientes';
const MAX_RECIENTES = 5;
/** Lo que se espera después de la última tecla antes de pedir sugerencias. */
const ESPERA_MS = 200;

/** Las búsquedas recientes viven en el navegador de cada persona, no en la API. */
function leerRecientes(): string[] {
  try {
    const guardadas: unknown = JSON.parse(localStorage.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(guardadas)
      ? guardadas.filter((t): t is string => typeof t === 'string').slice(0, MAX_RECIENTES)
      : [];
  } catch {
    return [];
  }
}

function guardarRecientes(lista: string[]): void {
  try {
    localStorage.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
  } catch {
    // Sin almacenamiento (navegación privada): las recientes no se guardan.
  }
}

// «Lo más buscado» cambia poco: se pide una vez por visita.
let populares: Promise<string[]> | null = null;
function pedirPopulares(): Promise<string[]> {
  populares ??= llamarApi<RespuestaMasBuscado>('/buscar/populares').then(
    (respuesta) => respuesta.terminos,
    () => [],
  );
  return populares;
}

function hrefBuscar(q: string, categoria: string): string {
  const consulta = new URLSearchParams({ q });
  if (categoria) consulta.set('categoria', categoria);
  return `/buscar?${consulta.toString()}`;
}

/**
 * «Tarjetas de video · desde US$ 285 · 6 ofertas» con sesión (BUS_WebSug); sin sesión, en qué
 * galerías está.
 */
function detalleProducto(producto: ProductoEnLista | ProductoEnListaConPrecio): string {
  const { cantidad } = producto.ofertas;
  const ofertas = cantidad === 1 ? '1 oferta' : `${cantidad} ofertas`;
  if ('oferta_destacada' in producto) {
    const desde = producto.ofertas.precios_desde[0];
    return [producto.categoria.nombre, desde && `desde ${formatearPrecio(desde)}`, ofertas]
      .filter(Boolean)
      .join(' · ');
  }
  return [producto.categoria.nombre, ofertas, producto.ofertas.galerias.join(', ')].join(' · ');
}

interface Opcion {
  href: string;
  /** Si es una búsqueda, se guarda en las recientes al elegirla. */
  busqueda?: string;
}

/** Una opción del desplegable: un enlace normal que también se elige con el teclado. */
function OpcionLista({
  id,
  opcion,
  activa,
  alElegir,
  className,
  children,
}: {
  id: string;
  opcion: Opcion;
  activa: boolean;
  alElegir: (opcion: Opcion) => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <Link
      id={id}
      role="option"
      aria-selected={activa}
      href={opcion.href}
      onClick={(evento) => {
        evento.preventDefault();
        alElegir(opcion);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

const iconoReloj = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-detalle"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const tituloGrupo = 'px-3 pb-1 pt-2 text-etiqueta uppercase text-detalle';
const separador = <span aria-hidden="true" className="mx-3 my-1 h-px shrink-0 bg-linea" />;

/** «Ver todas las tiendas ›»: la pestaña «Tiendas» de Wilson en vivo (N13). */
const DIRECTORIO = '/wilson-en-vivo?pestana=tiendas';

/** El nombre con lo escrito subrayado: «<u>Pega</u>sus5000». */
function NombreResaltado({ nombre, buscado }: { nombre: string; buscado: string }) {
  const partes = partirCoincidencia(nombre, buscado);
  if (!partes) return <>{nombre}</>;
  const [antes, igual, despues] = partes;
  return (
    <>
      {antes}
      <u className="decoration-[1.5px] underline-offset-2">{igual}</u>
      {despues}
    </>
  );
}

/**
 * «Ver productos de …» (N13): con una sola tienda, su perfil (abre en sus productos); con
 * varias, el directorio con las que se llaman así. La búsqueda de productos no mira el nombre
 * de la tienda.
 */
function productosDeTiendas(tiendas: TiendaEnBuscador[], escrito: string) {
  const [una] = tiendas;
  if (tiendas.length === 1 && una) {
    return { href: `/tiendas/${una.id}`, texto: `Ver productos de ${una.nombre}` };
  }
  return {
    href: `${DIRECTORIO}&q=${encodeURIComponent(escrito)}`,
    texto: `Ver productos de tiendas «${escrito}…»`,
  };
}

const iconoLupa = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0 text-detalle"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const iconoTienda = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="shrink-0"
  >
    <path d="M4 10l1-6h14l1 6M5 10v10h14V10M4 10h16" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

function Formulario({
  className,
  categorias,
  sobreMarca,
  conSesion,
}: {
  className: string;
  categorias: CategoriaResumen[];
  sobreMarca: boolean;
  conSesion: boolean;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const idLista = useId();
  const caja = useRef<HTMLFormElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const pedido = useRef(0);

  // Quien llega a los resultados ve en la barra lo que buscó, y en qué categoría.
  const enResultados = ruta === '/buscar';
  const enUrl = enResultados ? (parametros.get('q') ?? '') : '';
  const categoriaEnUrl = enResultados ? (parametros.get('categoria') ?? '') : '';

  const [texto, setTexto] = useState(enUrl);
  const [categoria, setCategoria] = useState(categoriaEnUrl);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [recientes, setRecientes] = useState<string[]>([]);
  const [masBuscado, setMasBuscado] = useState<string[]>([]);
  const [sugerencias, setSugerencias] = useState<RespuestaSugerenciasConTiendas | null>(null);
  const [cargando, setCargando] = useState(false);

  // Al navegar, la barra muestra lo que dice la dirección.
  useEffect(() => {
    setTexto(enUrl);
    setCategoria(categoriaEnUrl);
    setAbierto(false);
    setActiva(-1);
  }, [enUrl, categoriaEnUrl, ruta]);

  const escrito = texto.trim();
  const escribiendo = escrito.length >= 2;

  // Sugerencias mientras se escribe, cuando se deja de teclear.
  useEffect(() => {
    if (!abierto || !escribiendo) {
      setSugerencias(null);
      setCargando(false);
      return;
    }
    const numero = ++pedido.current;
    setCargando(true);
    const espera = setTimeout(() => {
      const consulta = new URLSearchParams({ q: escrito });
      if (categoria) consulta.set('categoria', categoria);
      llamarApi<RespuestaSugerenciasConTiendas>(`/buscar/sugerencias?${consulta.toString()}`).then(
        (respuesta) => {
          if (numero !== pedido.current) return;
          setSugerencias(respuesta);
          setCargando(false);
        },
        () => {
          if (numero !== pedido.current) return;
          setSugerencias(null);
          setCargando(false);
        },
      );
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [abierto, escribiendo, escrito, categoria]);

  // Se cierra al hacer clic afuera.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, [abierto]);

  function abrir() {
    setRecientes(leerRecientes());
    void pedirPopulares().then(setMasBuscado);
    setAbierto(true);
  }

  function recordar(busqueda: string) {
    const limpia = busqueda.trim().replace(/\s+/g, ' ');
    if (!limpia) return;
    const otras = leerRecientes().filter((r) => r.toLowerCase() !== limpia.toLowerCase());
    guardarRecientes([limpia, ...otras].slice(0, MAX_RECIENTES));
  }

  function quitarReciente(busqueda: string) {
    const lista = leerRecientes().filter((r) => r !== busqueda);
    guardarRecientes(lista);
    setRecientes(lista);
    setActiva(-1);
  }

  function ir(opcion: Opcion) {
    if (opcion.busqueda) recordar(opcion.busqueda);
    setAbierto(false);
    setActiva(-1);
    router.push(opcion.href);
  }

  // Las opciones en el orden en que se ven, para moverse con las flechas.
  const productos = escribiendo ? (sugerencias?.productos ?? []) : [];
  const correccion = escribiendo ? (sugerencias?.correccion ?? null) : null;
  // Doc 20 §11: sin uno con todas las palabras, el grupo dice que son los más parecidos.
  const tituloProductos =
    escribiendo && sugerencias?.lo_mas_parecido
      ? 'No hay uno igual. Lo más parecido:'
      : 'Productos';
  // «TIENDAS» (N13): solo llegan con sesión; las reservadas las quita la API.
  const tiendas = escribiendo ? (sugerencias?.tiendas ?? []) : [];
  const opciones: Opcion[] = [];
  const agregar = (opcion: Opcion) => opciones.push(opcion) - 1;
  const iTiendas = tiendas.map((tienda) => agregar({ href: `/tiendas/${tienda.id}` }));
  const iCorreccion = correccion
    ? agregar({
        href: hrefBuscar(correccion.mostramos, categoria),
        busqueda: correccion.mostramos,
      })
    : -1;
  const iProductos = productos.map((producto) => agregar({ href: `/p/${producto.slug}` }));
  const deTiendas = tiendas.length > 0 ? productosDeTiendas(tiendas, escrito) : null;
  const iDeTiendas = deTiendas ? agregar({ href: deTiendas.href }) : -1;
  // «Ver todo en Tarjetas de video» cuando una palabra nombró la categoría (BUS_WebSug).
  const categoriaEntendida = correccion?.categoria ?? null;
  const iCategoria = categoriaEntendida
    ? agregar({ href: `/buscar?categoria=${categoriaEntendida.slug}` })
    : -1;
  const iBuscar = escribiendo
    ? agregar({ href: hrefBuscar(escrito, categoria), busqueda: escrito })
    : -1;
  const iDirectorio = tiendas.length > 0 ? agregar({ href: DIRECTORIO }) : -1;
  const iRecientes = escribiendo
    ? []
    : recientes.map((r) => agregar({ href: hrefBuscar(r, categoria), busqueda: r }));
  const iMasBuscado = escribiendo
    ? []
    : masBuscado.map((t) => agregar({ href: hrefBuscar(t, categoria), busqueda: t }));

  const hayPanel = abierto && (escribiendo || recientes.length > 0 || masBuscado.length > 0);
  const idOpcion = (indice: number) => `${idLista}-${indice}`;
  const claseOpcion = (indice: number) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-cuerpo text-tinta no-underline ${
      activa === indice ? 'bg-superficie' : 'hover:bg-superficie'
    }`;
  const propiedades = (indice: number) => ({
    id: idOpcion(indice),
    opcion: opciones[indice]!,
    activa: activa === indice,
    alElegir: ir,
  });

  function teclas(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault();
      if (!abierto) {
        abrir();
        return;
      }
      const paso = evento.key === 'ArrowDown' ? 1 : -1;
      const total = opciones.length;
      // −1 es el campo: desde ahí se baja a la primera opción o se sube a la última.
      setActiva((actual) => {
        const siguiente = actual + paso;
        if (siguiente < -1) return total - 1;
        if (siguiente >= total) return -1;
        return siguiente;
      });
    } else if (evento.key === 'Enter' && hayPanel && activa >= 0 && opciones[activa]) {
      evento.preventDefault();
      ir(opciones[activa]);
    } else if (evento.key === 'Escape') {
      setAbierto(false);
      setActiva(-1);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    // Sin JavaScript el formulario va solo a /buscar; con él, sin recargar la página.
    evento.preventDefault();
    if (!escrito && !categoria) return;
    ir({ href: hrefBuscar(escrito, categoria), busqueda: escrito });
  }

  const total = sugerencias?.total_productos ?? 0;

  return (
    <form
      action="/buscar"
      role="search"
      onSubmit={enviar}
      ref={caja}
      // `relative`: el desplegable ocupa todo el ancho del buscador, botón incluido.
      className={`relative flex items-center gap-2.5 text-tinta ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div
          className={
            sobreMarca
              ? 'flex h-12 items-center gap-2 rounded-full bg-white pl-4 pr-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-white'
              : 'flex h-[52px] items-center gap-2 rounded-full border-2 border-tinta bg-white pl-4 pr-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pase'
          }
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0 text-tinta"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="buscar-q" className="sr-only">
            {conSesion ? 'Buscar productos o tiendas' : 'Buscar productos'}
          </label>
          <input
            ref={campo}
            id="buscar-q"
            name="q"
            type="search"
            role="combobox"
            aria-expanded={hayPanel}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={hayPanel && activa >= 0 ? idOpcion(activa) : undefined}
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              setActiva(-1);
              if (!abierto) abrir();
            }}
            onFocus={abrir}
            onKeyDown={teclas}
            autoComplete="off"
            placeholder={
              sobreMarca
                ? `Busca por modelo, marca${conSesion ? ', código o tienda' : ' o código'}`
                : `Modelo, marca${conSesion ? ', código o tienda' : ' o código'}`
            }
            className="h-full min-w-0 flex-1 bg-transparent text-cuerpo text-tinta outline-none placeholder:text-detalle [&::-webkit-search-cancel-button]:hidden"
          />
          {texto && (
            <button
              type="button"
              aria-label="Borrar búsqueda"
              onClick={() => {
                setTexto('');
                setActiva(-1);
                campo.current?.focus();
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[20px] text-detalle hover:bg-superficie hover:text-tinta"
            >
              ×
            </button>
          )}
          {/* En la barra verde (D_Barra) «Buscar» va dentro de la píldora. */}
          {sobreMarca && (
            <button
              type="submit"
              className="flex h-[38px] shrink-0 items-center rounded-full bg-tinta px-5 text-apoyo font-semibold text-white max-md:hidden"
            >
              Buscar
            </button>
          )}
          {!sobreMarca && categorias.length > 0 && (
            <>
              <label htmlFor="buscar-categoria" className="sr-only">
                Categoría
              </label>
              {/* En el celular no entra: ahí la categoría se elige en la banda de abajo. */}
              <select
                id="buscar-categoria"
                name="categoria"
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                className="hidden h-8 max-w-[180px] shrink-0 cursor-pointer border-l border-linea bg-transparent pl-3 pr-2 text-apoyo text-tinta outline-none sm:block"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((opcion) => (
                  <option key={opcion.slug} value={opcion.slug}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {hayPanel && (
          <div
            id={idLista}
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            // Que el clic en el panel no le quite el foco al campo.
            onMouseDown={(evento) => evento.preventDefault()}
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(70vh,560px)] flex-col overflow-y-auto rounded-[20px] border border-linea bg-white p-2 shadow-[0_18px_40px_rgba(15,20,18,0.16)]"
          >
            {escribiendo ? (
              <>
                {tiendas.length > 0 && (
                  <>
                    <span className={tituloGrupo}>Tiendas</span>
                    {tiendas.map((tienda, n) => (
                      <OpcionLista
                        key={tienda.id}
                        {...propiedades(iTiendas[n]!)}
                        className={`${claseOpcion(iTiendas[n]!)} py-2`}
                      >
                        <AvatarTienda
                          nombre={tienda.nombre}
                          logo={tienda.logo}
                          enLinea={tienda.en_linea}
                          letra={14}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <b className="truncate font-bold">
                            <NombreResaltado nombre={tienda.nombre} buscado={escrito} />
                          </b>
                          <span className="truncate text-nota text-detalle">
                            {lugarDeTienda(tienda, true)}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-nota text-detalle"
                          aria-label={reputacionParaLeer(tienda.reputacion)}
                        >
                          {textoReputacion(tienda.reputacion, true)}
                        </span>
                      </OpcionLista>
                    ))}
                    {separador}
                    <span className={tituloGrupo}>{tituloProductos}</span>
                  </>
                )}
                {correccion && (
                  <OpcionLista {...propiedades(iCorreccion)} className={claseOpcion(iCorreccion)}>
                    <span className="text-secundario">
                      Entendimos <b className="font-semibold text-tinta">{correccion.mostramos}</b>
                      {categoriaEntendida && categoriaEntendida.nombre !== correccion.mostramos
                        ? ` en ${categoriaEntendida.nombre}`
                        : ''}
                    </span>
                  </OpcionLista>
                )}
                {productos.length > 0 && tiendas.length === 0 && (
                  <span className={tituloGrupo}>{tituloProductos}</span>
                )}
                {productos.map((producto, n) => (
                  <OpcionLista
                    key={producto.slug}
                    {...propiedades(iProductos[n]!)}
                    className={`${claseOpcion(iProductos[n]!)} py-1.5`}
                  >
                    <Miniatura
                      ruta={producto.foto}
                      categoria={producto.categoria.slug}
                      className="h-11 w-11 rounded-lg"
                      glifo={30}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{producto.titulo}</span>
                      <span className="truncate text-nota text-detalle">
                        {detalleProducto(producto)}
                      </span>
                    </span>
                  </OpcionLista>
                ))}
                {deTiendas && (
                  <OpcionLista {...propiedades(iDeTiendas)} className={claseOpcion(iDeTiendas)}>
                    {iconoLupa}
                    <span className="truncate">{deTiendas.texto}</span>
                  </OpcionLista>
                )}
                {!cargando &&
                  sugerencias &&
                  productos.length === 0 &&
                  tiendas.length === 0 &&
                  !correccion && (
                    <p className="px-3 py-2 text-apoyo text-secundario">
                      Nadie lo tiene publicado. Pulsa Buscar y te damos opciones.
                    </p>
                  )}
                {categoriaEntendida && (
                  <OpcionLista
                    {...propiedades(iCategoria)}
                    className={`${claseOpcion(iCategoria)} font-semibold text-pase-texto`}
                  >
                    Ver todo en {categoriaEntendida.nombre}
                  </OpcionLista>
                )}
                {cargando && !sugerencias && (
                  <p className="px-3 py-2 text-apoyo text-detalle">Buscando…</p>
                )}
                <OpcionLista
                  {...propiedades(iBuscar)}
                  className={`${claseOpcion(iBuscar)} mt-1 font-semibold`}
                >
                  {total > productos.length
                    ? `Ver todos los resultados de «${escrito}»`
                    : `Buscar «${escrito}»`}
                </OpcionLista>
                {tiendas.length > 0 && (
                  <>
                    {separador}
                    <OpcionLista
                      {...propiedades(iDirectorio)}
                      className={`${claseOpcion(iDirectorio)} font-bold text-marca`}
                    >
                      {iconoTienda}
                      Ver todas las tiendas ›
                    </OpcionLista>
                  </>
                )}
              </>
            ) : (
              <>
                {recientes.length > 0 && <span className={tituloGrupo}>Búsquedas recientes</span>}
                {recientes.map((reciente, n) => (
                  <div key={reciente} className="flex items-center gap-1">
                    <OpcionLista
                      {...propiedades(iRecientes[n]!)}
                      className={`${claseOpcion(iRecientes[n]!)} min-w-0 flex-1`}
                    >
                      {iconoReloj}
                      <span className="truncate">{reciente}</span>
                    </OpcionLista>
                    <button
                      type="button"
                      aria-label={`Quitar «${reciente}» de las recientes`}
                      onClick={() => quitarReciente(reciente)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[20px] text-detalle hover:bg-superficie hover:text-tinta"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {masBuscado.length > 0 && (
                  <>
                    <span className={tituloGrupo}>Lo más buscado</span>
                    <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1">
                      {masBuscado.map((termino, n) => (
                        <OpcionLista
                          key={termino}
                          {...propiedades(iMasBuscado[n]!)}
                          className={`flex h-9 items-center rounded-full border px-3.5 text-apoyo font-medium text-tinta no-underline ${
                            activa === iMasBuscado[n]
                              ? 'border-tinta bg-superficie'
                              : 'border-borde hover:border-borde-control'
                          }`}
                        >
                          {termino}
                        </OpcionLista>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {!sobreMarca && (
        <button
          type="submit"
          className="h-[52px] shrink-0 rounded-full bg-pase px-6 text-cuerpo font-semibold text-white sm:px-7"
        >
          Buscar
        </button>
      )}
    </form>
  );
}

/**
 * El buscador de la barra (C_Header): texto, categoría y «Buscar». Al enfocarlo muestra las
 * búsquedas recientes y lo más buscado; mientras se escribe, sugiere productos con la misma
 * búsqueda tolerante y avisa «¿Quisiste decir…?». Con sesión, arriba van las tiendas que se
 * llaman así («TIENDAS», N13) y «Ver todas las tiendas ›». Sin JavaScript sigue llevando a
 * `/buscar`.
 */
export function Buscador({
  className = '',
  categorias = [],
  sobreMarca = false,
  conSesion = false,
}: {
  className?: string;
  categorias?: CategoriaResumen[];
  /** La píldora blanca de la barra verde (D_Barra), con «Buscar» adentro y sin categoría. */
  sobreMarca?: boolean;
  /**
   * Con sesión también busca tiendas («Busca por modelo, marca, código o tienda», N13). Solo
   * cambia el texto: las tiendas las manda la API, y nunca a un visitante.
   */
  conSesion?: boolean;
}) {
  return (
    <Suspense fallback={<div className={`${sobreMarca ? 'h-12' : 'h-[52px]'} ${className}`} />}>
      <Formulario
        className={className}
        categorias={categorias}
        sobreMarca={sobreMarca}
        conSesion={conSesion}
      />
    </Suspense>
  );
}
