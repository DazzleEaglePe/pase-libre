'use client';

import type {
  CategoriaResumen,
  ProductoEnLista,
  RespuestaMasBuscado,
  RespuestaSugerenciasBusqueda,
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

function detalleProducto(producto: ProductoEnLista): string {
  const { cantidad, galerias } = producto.ofertas;
  return [
    producto.categoria.nombre,
    cantidad === 1 ? '1 oferta' : `${cantidad} ofertas`,
    galerias.join(', '),
  ].join(' · ');
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

function Formulario({
  className,
  categorias,
}: {
  className: string;
  categorias: CategoriaResumen[];
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
  const [sugerencias, setSugerencias] = useState<RespuestaSugerenciasBusqueda | null>(null);
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
      llamarApi<RespuestaSugerenciasBusqueda>(`/buscar/sugerencias?${consulta.toString()}`).then(
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
  const opciones: Opcion[] = [];
  const agregar = (opcion: Opcion) => opciones.push(opcion) - 1;
  const iCorreccion = correccion
    ? agregar({
        href: hrefBuscar(correccion.mostramos, categoria),
        busqueda: correccion.mostramos,
      })
    : -1;
  const iProductos = productos.map((producto) => agregar({ href: `/p/${producto.slug}` }));
  const iBuscar = escribiendo
    ? agregar({ href: hrefBuscar(escrito, categoria), busqueda: escrito })
    : -1;
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
      className={`relative flex items-center gap-2.5 ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex h-[52px] items-center gap-2 rounded-full border-2 border-tinta bg-white pl-4 pr-1.5">
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
            Buscar productos
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
            placeholder="Busca por modelo, marca o código"
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
          {categorias.length > 0 && (
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
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(70vh,560px)] flex-col overflow-y-auto rounded-[20px] border border-linea bg-white p-2 shadow-[0_18px_40px_rgba(10,22,51,0.16)]"
          >
            {escribiendo ? (
              <>
                {correccion && (
                  <OpcionLista {...propiedades(iCorreccion)} className={claseOpcion(iCorreccion)}>
                    <span className="text-secundario">
                      ¿Quisiste decir{' '}
                      <b className="font-semibold text-tinta">{correccion.mostramos}</b>?
                    </span>
                  </OpcionLista>
                )}
                {productos.length > 0 && <span className={tituloGrupo}>Productos</span>}
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
                {!cargando && sugerencias && productos.length === 0 && !correccion && (
                  <p className="px-3 py-2 text-apoyo text-secundario">
                    No encontramos «{escrito}». Prueba con menos palabras: solo la marca y el
                    modelo.
                  </p>
                )}
                {cargando && !sugerencias && (
                  <p className="px-3 py-2 text-apoyo text-detalle">Buscando…</p>
                )}
                <OpcionLista
                  {...propiedades(iBuscar)}
                  className={`${claseOpcion(iBuscar)} mt-1 font-semibold`}
                >
                  {total > productos.length
                    ? `Ver los ${total} resultados de «${escrito}»`
                    : `Buscar «${escrito}»`}
                </OpcionLista>
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
      <button
        type="submit"
        className="h-[52px] shrink-0 rounded-full bg-pase px-6 text-cuerpo font-semibold text-white sm:px-7"
      >
        Buscar
      </button>
    </form>
  );
}

/**
 * El buscador de la barra (C_Header): texto, categoría y «Buscar». Al enfocarlo muestra las
 * búsquedas recientes y lo más buscado; mientras se escribe, sugiere productos con la misma
 * búsqueda tolerante y avisa «¿Quisiste decir…?». Sin JavaScript sigue llevando a `/buscar`.
 */
export function Buscador({
  className = '',
  categorias = [],
}: {
  className?: string;
  categorias?: CategoriaResumen[];
}) {
  return (
    <Suspense fallback={<div className={`h-[52px] ${className}`} />}>
      <Formulario className={className} categorias={categorias} />
    </Suspense>
  );
}
