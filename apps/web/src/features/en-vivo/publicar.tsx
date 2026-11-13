'use client';

import {
  formatearPrecio,
  HORA_CIERRE_EN_VIVO,
  MAX_EN_VIVO_POR_CUENTA,
  MAX_FOTOS_EN_VIVO,
  portadaDeOferta,
  type CategoriaResumen,
  type DuracionEnVivo,
  type EnVivoPropio,
  type Moneda,
  type OfertaPropia,
  type RespuestaAlcanceEnVivo,
  type RespuestaMisEnVivo,
  type RespuestaMisOfertas,
  type RespuestaSugerencias,
  type SugerenciaProducto,
  type TiendaDeSesion,
  type TipoEnVivo,
} from '@paselibre/contracts';
import { IconBell, IconClock, IconPencil, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { PuntoQueLate } from '@/shared/ui/brasa';
import { Contador } from '@/shared/ui/contador';
import { campo } from '@/shared/ui/estilos';
import { Interruptor } from '@/shared/ui/interruptor';
import { Miniatura } from '@/shared/ui/miniatura';
import { Segmentado } from '@/shared/ui/segmentado';

import { useAhora } from './datos';
import { FotosBusco, type FotoBusco } from './fotos-busco';
import { EtiquetaTipo } from './piezas';

const HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/** «4:40 p. m.»: a qué hora termina con la duración elegida (el cierre es a las 8:00 p. m.). */
function horaDeFin(duracion: DuracionEnVivo, ahora: number): string {
  const fin =
    duracion === '1h'
      ? new Date(ahora + 3_600_000)
      : duracion === '3h'
        ? new Date(ahora + 3 * 3_600_000)
        : new Date(
            `${DIA_LIMA.format(new Date(ahora))}T${String(HORA_CIERRE_EN_VIVO).padStart(2, '0')}:00:00-05:00`,
          );
  return HORA.format(fin).replace(/\s?([ap])\.?\s?m\.?/i, ' $1. m.');
}

/** Una tarjeta numerada del formulario (PUB_WebVivo): «1 ¿Busco o remato?». */
function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[24px] border border-linea bg-white p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-[20px] font-bold">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-tinta text-apoyo font-bold text-white"
        >
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

const chip = (activo: boolean) =>
  `h-10 rounded-full border px-4 text-apoyo ${
    activo
      ? 'border-tinta bg-tinta font-bold text-white'
      : 'border-borde bg-white font-medium text-tinta'
  }`;

type Condicion = 'CUALQUIERA' | 'NUEVO' | 'USADO';
/** El producto del busco: buscándolo en el catálogo, elegido de ahí o escrito a mano. */
type ModoProducto = 'buscar' | 'catalogo' | 'mano';

/** «8 tiendas lo tienen» (de `/en-vivo/alcance`). */
const tiendasQueLoTienen = (tiendas: number) =>
  tiendas === 0
    ? 'Ninguna tienda lo tiene'
    : tiendas === 1
      ? '1 tienda lo tiene'
      : `${tiendas} tiendas lo tienen`;

const DURACIONES: Array<[DuracionEnVivo, string]> = [
  ['1h', '1 hora'],
  ['3h', '3 horas'],
  ['cierre', 'Hasta el cierre'],
];
const MONEDAS: ReadonlyArray<readonly [Moneda, string]> = [
  ['USD', 'US$'],
  ['PEN', 'S/'],
];

/** Espera a que se deje de escribir antes de preguntar a la API. */
function useDemorado<T>(valor: T, ms = 250): T {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const reloj = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(reloj);
  }, [valor, ms]);
  return demorado;
}

/**
 * Publicar un pedido en vivo (EV_Publicar, RF-24, RF-72 y RF-73). El busco (doc 19, punto 21)
 * busca el producto en el catálogo con la misma lista de «Publicar» (foto, nombre y cuántas
 * tiendas lo tienen) o lo deja escribir a mano con su categoría; lleva hasta 3 fotos y va sin
 * precio. El remate sale de una de tus publicaciones. La vista previa dice a cuántas tiendas les
 * llegará el aviso del busco.
 */
export function FormularioEnVivo({
  categorias,
  usuarioId,
  tienda,
  inicial = { texto: '', categoria: '' },
}: {
  categorias: CategoriaResumen[];
  usuarioId: string;
  tienda: TiendaDeSesion;
  /** Lo buscado sin resultados, cuando se llega desde «Publicar un busco» de la búsqueda. */
  inicial?: { texto: string; categoria: string };
}) {
  const id = useId();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoEnVivo>('BUSCO');
  const [duracion, setDuracion] = useState<DuracionEnVivo>('1h');
  const [avisarSeguidores, setAvisarSeguidores] = useState(true);
  const [seguidores, setSeguidores] = useState<number | null>(null);
  const [activos, setActivos] = useState<number | null>(null);
  const ahora = useAhora();
  const [nota, setNota] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [moneda, setMoneda] = useState<Moneda>(tienda.moneda_defecto);
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busco. Desde «Publicar un busco» de una búsqueda sin resultados, empieza escrito a mano.
  const [modo, setModo] = useState<ModoProducto>(inicial.texto.trim() ? 'mano' : 'buscar');
  const [texto, setTexto] = useState(inicial.texto.slice(0, 120));
  const [producto, setProducto] = useState<SugerenciaProducto | null>(null);
  const [sugerencias, setSugerencias] = useState<SugerenciaProducto[] | null>(null);
  // «N tiendas lo tienen» de cada sugerencia.
  const [tienenlo, setTienenlo] = useState<Record<string, number>>({});
  const [categoria, setCategoria] = useState(() =>
    categorias.some((c) => c.slug === inicial.categoria) ? inicial.categoria : '',
  );
  const [condicion, setCondicion] = useState<Condicion>('CUALQUIERA');
  const [fotos, setFotos] = useState<FotoBusco[]>([]);
  const [subiendoFotos, setSubiendoFotos] = useState(false);

  useEffect(() => {
    llamarApi<RespuestaMisEnVivo>('/en-vivo/mios').then(
      (r) => setActivos(MAX_EN_VIVO_POR_CUENTA - r.disponibles),
      () => setActivos(null),
    );
  }, []);
  const [alcance, setAlcance] = useState<number | null>(null);

  // Oferta flash.
  const [filtro, setFiltro] = useState('');
  const [mias, setMias] = useState<OfertaPropia[] | null>(null);
  const [oferta, setOferta] = useState<OfertaPropia | null>(null);

  const textoDemorado = useDemorado(texto);
  // La lista desplegable del catálogo, como en «Publicar»: cada fila con «N tiendas lo tienen».
  useEffect(() => {
    if (tipo !== 'BUSCO' || modo !== 'buscar' || textoDemorado.trim().length < 2) {
      setSugerencias(null);
      return;
    }
    let vigente = true;
    llamarApi<RespuestaSugerencias>(
      `/catalogo/sugerencias?q=${encodeURIComponent(textoDemorado.trim())}`,
    ).then(
      (r) => {
        if (!vigente) return;
        const productos = r.productos.slice(0, 5);
        setSugerencias(productos);
        for (const p of productos) {
          llamarApi<RespuestaAlcanceEnVivo>(`/en-vivo/alcance?producto=${p.id}`).then(
            (a) => vigente && setTienenlo((antes) => ({ ...antes, [p.id]: a.tiendas })),
            () => undefined,
          );
        }
      },
      () => vigente && setSugerencias([]),
    );
    return () => {
      vigente = false;
    };
  }, [tipo, modo, textoDemorado]);

  // «Les avisamos a N tiendas»: con el producto elegido, o con el texto y la categoría.
  useEffect(() => {
    if (tipo !== 'BUSCO') return;
    const consulta =
      modo === 'catalogo' && producto
        ? `producto=${producto.id}`
        : modo === 'mano' && textoDemorado.trim().length >= 3
          ? `q=${encodeURIComponent(textoDemorado.trim())}${categoria ? `&categoria=${categoria}` : ''}`
          : null;
    if (!consulta) {
      setAlcance(null);
      return;
    }
    let vigente = true;
    llamarApi<RespuestaAlcanceEnVivo>(`/en-vivo/alcance?${consulta}`).then(
      (r) => {
        if (!vigente) return;
        setAlcance(r.tiendas);
        setSeguidores(r.seguidores);
      },
      () => vigente && setAlcance(null),
    );
    return () => {
      vigente = false;
    };
  }, [tipo, modo, producto, textoDemorado, categoria]);

  const filtroDemorado = useDemorado(filtro);
  useEffect(() => {
    if (tipo !== 'FLASH') return;
    let vigente = true;
    llamarApi<RespuestaMisOfertas>(
      `/mis-ofertas?estado=activas&q=${encodeURIComponent(filtroDemorado.trim())}`,
    ).then(
      // Solo las que atiendes tú: los «¡Lo quiero!» llegan a quien atiende la publicación.
      (r) => vigente && setMias(r.ofertas.filter((o) => o.responsable.id === usuarioId)),
      () => vigente && setMias([]),
    );
    return () => {
      vigente = false;
    };
  }, [tipo, filtroDemorado, usuarioId]);

  /** Del catálogo: la foto del catálogo va primero (se puede quitar) y la categoría se llena sola. */
  function elegirProducto(elegido: SugerenciaProducto) {
    setProducto(elegido);
    setCategoria(elegido.categoria.slug);
    setModo('catalogo');
    setFotos((anteriores) => {
      const propias = anteriores.filter((f) => !f.delCatalogo);
      const catalogo = elegido.foto ? [{ ruta: elegido.foto, delCatalogo: true }] : [];
      return [...catalogo, ...propias].slice(0, MAX_FOTOS_EN_VIVO);
    });
  }

  /** «Cambiar» o «Buscar en el catálogo»: vuelve a la lista; las fotos propias se quedan. */
  function buscarDeNuevo() {
    setProducto(null);
    setModo('buscar');
    setFotos((anteriores) => anteriores.filter((f) => !f.delCatalogo));
  }

  function escribirAMano() {
    setProducto(null);
    setModo('mano');
    setFotos((anteriores) => anteriores.filter((f) => !f.delCatalogo));
  }

  function elegirOferta(elegida: OfertaPropia) {
    setOferta(elegida);
    setMoneda(elegida.moneda);
    setCantidad('1');
  }

  async function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const comun = {
      duracion,
      nota,
      cantidad: Number(cantidad),
      moneda,
      avisar_seguidores: avisarSeguidores,
    };
    // El busco va sin precio (doc 19, punto 21).
    const cuerpo =
      tipo === 'BUSCO'
        ? {
            tipo,
            ...comun,
            ...(modo === 'catalogo' && producto
              ? { producto: producto.id }
              : { titulo: texto, categoria }),
            condicion: condicion === 'CUALQUIERA' ? null : condicion,
            fotos: fotos.map((foto) => foto.ruta),
          }
        : { tipo, ...comun, oferta: oferta?.id, precio: monto };
    try {
      const creado = await llamarApi<EnVivoPropio>('/en-vivo', { metodo: 'POST', cuerpo });
      router.push(`/pedidos-en-vivo?id=${creado.id}`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos publicarlo. Vuelve a intentarlo.');
      setEnviando(false);
    }
  }

  const delCatalogo = modo === 'catalogo' ? producto : null;
  const titulo =
    tipo === 'BUSCO'
      ? (delCatalogo?.titulo ?? (modo === 'mano' ? texto.trim() : ''))
      : (oferta?.producto.titulo ?? '');
  const listo =
    tipo === 'BUSCO'
      ? !subiendoFotos &&
        Boolean(delCatalogo || (modo === 'mano' && texto.trim().length >= 3 && categoria))
      : Boolean(oferta && monto.trim());
  // La foto con la que lo verán: la primera, o la del producto si quitó todas (como la API).
  const fotoVista = fotos[0]?.ruta ?? delCatalogo?.foto ?? null;

  const simbolo = moneda === 'USD' ? 'US$' : 'S/';
  const precioVista = monto.trim()
    ? `${simbolo} ${monto.trim()} · ${cantidad} disp.`
    : 'Precio de remate';
  const unidades = Number(cantidad) === 1 ? '1 unidad' : `${Number(cantidad) || 1} unidades`;
  const condicionVista =
    tipo === 'FLASH'
      ? oferta
        ? oferta.condicion === 'NUEVO'
          ? 'Nuevo'
          : 'Usado'
        : ''
      : condicion === 'NUEVO'
        ? 'Nuevo'
        : condicion === 'USADO'
          ? 'Usado'
          : 'Nuevo o usado';
  const fin = horaDeFin(duracion, ahora);
  const nombreCategoria =
    delCatalogo?.categoria.nombre ?? categorias.find((c) => c.slug === categoria)?.nombre ?? null;

  return (
    <form onSubmit={(evento) => void publicar(evento)} className="mt-3 flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Publicar en vivo</h1>
          <p className="m-0 text-secundario">
            Les llega al toque a las tiendas que lo tienen y se cierra solo cuando termina.
          </p>
        </div>
        {activos !== null && (
          <span className="flex h-10 items-center gap-2 rounded-full border border-linea bg-white px-4 text-apoyo font-bold">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
            Tienes {activos} de {MAX_EN_VIVO_POR_CUENTA} activos
          </span>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Paso numero={1} titulo={tipo === 'BUSCO' ? '¿Qué buscas?' : '¿Busco o remato?'}>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-apoyo font-bold">¿Qué es?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['BUSCO', 'Busco', 'Necesito algo que no tengo, para un cliente.'],
                    ['FLASH', 'Remato', 'Quiero vender rápido algo que tengo.'],
                  ] as const
                ).map(([valor, nombre, ayuda]) => (
                  <label
                    key={valor}
                    className={`flex cursor-pointer flex-col gap-0.5 rounded-2xl border-2 p-4 ${
                      tipo === valor
                        ? valor === 'BUSCO'
                          ? 'border-pase bg-pase-medio'
                          : 'border-aviso bg-aviso-fondo'
                        : 'border-linea'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${id}-tipo`}
                      checked={tipo === valor}
                      onChange={() => {
                        setTipo(valor);
                        setMonto('');
                        setCantidad('1');
                      }}
                      className="sr-only"
                    />
                    <b className="text-[17px] font-bold">{nombre}</b>
                    <span className="text-apoyo text-secundario">{ayuda}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {tipo === 'BUSCO' ? (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${id}-producto`} className="text-apoyo font-bold">
                    Producto
                  </label>
                  {modo === 'catalogo' && producto ? (
                    // Elegido del catálogo: foto, nombre, «N tiendas lo tienen» y «Cambiar».
                    <div className="flex items-center gap-3.5 rounded-[14px] border-2 border-tinta px-3.5 py-2.5">
                      <Miniatura
                        ruta={producto.foto}
                        categoria={producto.categoria.slug}
                        className="h-[52px] w-[52px] rounded-[10px]"
                        glifo={36}
                        grosor={4}
                      />
                      <span className="flex min-w-0 flex-1 flex-col leading-snug">
                        <b className="truncate text-cuerpo font-bold">{producto.titulo}</b>
                        <span className="text-nota text-detalle">
                          Del catálogo · {producto.categoria.nombre}
                          {alcance !== null && (
                            <>
                              {' · '}
                              <b className="font-bold text-pase">{tiendasQueLoTienen(alcance)}</b>
                            </>
                          )}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={buscarDeNuevo}
                        className="h-9 text-apoyo font-medium underline"
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : modo === 'mano' ? (
                    // Escrito a mano: la caja, la categoría (obligatoria) y «Buscar en el catálogo».
                    <>
                      <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-borde bg-white pl-3.5 pr-3 focus-within:border-tinta">
                        <IconPencil
                          size={17}
                          stroke={2}
                          className="shrink-0 text-detalle"
                          aria-hidden="true"
                        />
                        <input
                          id={`${id}-producto`}
                          value={texto}
                          onChange={(evento) => setTexto(evento.target.value)}
                          placeholder="Fuente modular 750W blanca"
                          maxLength={120}
                          autoComplete="off"
                          className="h-12 min-w-0 flex-1 bg-transparent text-cuerpo outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setModo('buscar')}
                          className="h-9 shrink-0 text-nota text-detalle underline"
                        >
                          Buscar en el catálogo
                        </button>
                      </div>
                      <label className="flex flex-col gap-1.5 text-apoyo font-bold">
                        Categoría
                        <select
                          value={categoria}
                          onChange={(evento) => setCategoria(evento.target.value)}
                          className={campo}
                        >
                          <option value="">Elige la categoría</option>
                          {categorias.map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : (
                    // Buscando: la misma lista desplegable de «Publicar», con foto.
                    <>
                      <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-borde bg-white pl-3.5 pr-3 focus-within:border-tinta">
                        <IconSearch
                          size={18}
                          stroke={2}
                          className="shrink-0 text-detalle"
                          aria-hidden="true"
                        />
                        <input
                          id={`${id}-producto`}
                          type="search"
                          value={texto}
                          onChange={(evento) => setTexto(evento.target.value)}
                          placeholder="Marca y modelo, por ejemplo «rtx 5060»"
                          maxLength={120}
                          autoComplete="off"
                          className="h-12 min-w-0 flex-1 bg-transparent text-cuerpo outline-none"
                        />
                      </div>
                      {sugerencias !== null && (
                        <div className="flex flex-col rounded-2xl border border-linea bg-white p-2 shadow-[0_16px_34px_rgba(15,20,18,0.14)]">
                          {sugerencias.length > 0 ? (
                            <>
                              <span className="px-2.5 pb-1.5 pt-1 text-[11.5px] font-extrabold uppercase tracking-[.06em] text-detalle">
                                Del catálogo
                              </span>
                              <ul className="m-0 flex list-none flex-col p-0">
                                {sugerencias.map((s) => (
                                  <li key={s.id}>
                                    <button
                                      type="button"
                                      onClick={() => elegirProducto(s)}
                                      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-[#F1F8F4] focus-visible:bg-[#F1F8F4]"
                                    >
                                      <Miniatura
                                        ruta={s.foto}
                                        categoria={s.categoria.slug}
                                        className="h-[46px] w-[46px] rounded-[10px]"
                                        glifo={32}
                                        grosor={4.5}
                                      />
                                      <span className="flex min-w-0 flex-col leading-snug">
                                        <b className="text-[14.5px] font-bold">{s.titulo}</b>
                                        <span className="text-nota text-detalle">
                                          {s.categoria.nombre}
                                          {tienenlo[s.id] !== undefined &&
                                            ` · ${tiendasQueLoTienen(tienenlo[s.id] ?? 0)}`}
                                        </span>
                                      </span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <span className="px-2.5 py-2 text-apoyo text-secundario">
                              No está en el catálogo.
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={escribirAMano}
                            className="mt-1.5 flex items-center gap-2.5 border-t border-linea px-2.5 pb-1.5 pt-3 text-left text-[14.5px] font-bold"
                          >
                            <IconPencil size={17} stroke={2} aria-hidden="true" />
                            ¿No está? Escríbelo a mano
                          </button>
                        </div>
                      )}
                      <span className="text-nota text-detalle">
                        Si eliges del catálogo, la foto y la categoría se llenan solas y el aviso
                        les llega justo a las tiendas que lo tienen.
                      </span>
                    </>
                  )}
                </div>
                {modo !== 'buscar' && (
                  <FotosBusco
                    fotos={fotos}
                    alCambiar={setFotos}
                    alCargar={setSubiendoFotos}
                    aMano={modo === 'mano'}
                  />
                )}
                <div className="flex flex-wrap gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="text-apoyo font-bold">Cantidad</span>
                    <Contador
                      valor={Number(cantidad) || 1}
                      minimo={1}
                      maximo={99}
                      alCambiar={(valor) => setCantidad(String(valor))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-apoyo font-bold">Condición</span>
                    <div role="radiogroup" aria-label="Condición" className="flex flex-wrap gap-2">
                      {(
                        [
                          ['NUEVO', 'Nuevo'],
                          ['USADO', 'Usado'],
                          ['CUALQUIERA', 'Me da igual'],
                        ] as const
                      ).map(([valor, texto]) => (
                        <button
                          key={valor}
                          type="button"
                          role="radio"
                          aria-checked={condicion === valor}
                          onClick={() => setCondicion(valor)}
                          className={chip(condicion === valor)}
                        >
                          {texto}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor={`${id}-filtro`} className="text-apoyo font-bold">
                    ¿Qué rematas? Elige una de tus publicaciones
                  </label>
                  <input
                    id={`${id}-filtro`}
                    value={filtro}
                    onChange={(evento) => setFiltro(evento.target.value)}
                    placeholder="Busca en tus publicaciones"
                    className={campo}
                  />
                  {mias === null && <p className="m-0 text-apoyo text-secundario">Cargando…</p>}
                  {mias?.length === 0 && (
                    <p className="m-0 rounded-xl bg-superficie p-3 text-apoyo text-secundario">
                      No tienes publicaciones activas que atiendas tú.{' '}
                      <Link href="/publicar" className="font-semibold">
                        Publica una
                      </Link>{' '}
                      y vuelve.
                    </p>
                  )}
                  <ul className="m-0 flex max-h-[280px] list-none flex-col overflow-y-auto rounded-xl border border-linea p-0 empty:hidden">
                    {mias
                      ?.filter((o) => o.stock > 0)
                      .map((o) => (
                        <li key={o.id} className="border-t border-linea first:border-t-0">
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-superficie">
                            <input
                              type="radio"
                              name={`${id}-oferta`}
                              checked={oferta?.id === o.id}
                              onChange={() => elegirOferta(o)}
                              className="h-4 w-4 accent-pase"
                            />
                            <Miniatura
                              ruta={portadaDeOferta(o)}
                              categoria={o.producto.categoria.slug}
                              className="h-9 w-11 rounded-lg"
                              glifo={30}
                              grosor={4.5}
                            />
                            <span className="flex min-w-0 flex-col">
                              <b className="truncate text-apoyo font-semibold">
                                {o.producto.titulo}
                              </b>
                              <span className="text-nota text-detalle">
                                {o.condicion === 'NUEVO' ? 'Nuevo' : 'Usado'} · {o.stock} en stock
                                {o.precio ? ` · hoy ${formatearPrecio(o.precio)}` : ' · al interno'}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-apoyo font-bold">Cantidad</span>
                  <Contador
                    valor={Number(cantidad) || 1}
                    minimo={1}
                    maximo={oferta?.stock ?? 99}
                    alCambiar={(valor) => setCantidad(String(valor))}
                  />
                  <span className="text-nota text-secundario">
                    Cada «Vendido» en el chat le resta una.
                  </span>
                </div>
              </>
            )}
          </Paso>

          {/* El busco va sin precio (doc 19, punto 21): «Precio» es solo del remate. */}
          {tipo === 'FLASH' && (
            <Paso numero={2} titulo="Precio">
              <div className="flex flex-col gap-2">
                <label htmlFor={`${id}-monto`} className="text-apoyo font-bold">
                  Precio de remate
                </label>
                <div className="flex items-center gap-3">
                  <Segmentado
                    etiqueta="Moneda"
                    valor={moneda}
                    alCambiar={setMoneda}
                    opciones={MONEDAS}
                  />
                  <input
                    id={`${id}-monto`}
                    value={monto}
                    onChange={(evento) => setMonto(evento.target.value)}
                    inputMode="decimal"
                    placeholder="289"
                    className={`${campo} min-w-0 flex-1 text-[18px] font-bold`}
                  />
                </div>
              </div>
              <span className="text-nota text-secundario">
                Las tiendas con sesión ven tu precio; sin sesión se ve «Precio con sesión».
              </span>
            </Paso>
          )}

          <Paso numero={tipo === 'BUSCO' ? 2 : 3} titulo="Tiempo">
            <div className="flex flex-col gap-2">
              <span className="text-apoyo font-bold">¿Cuánto dura?</span>
              <div role="radiogroup" aria-label="Cuánto dura" className="flex flex-wrap gap-2">
                {DURACIONES.map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={duracion === valor}
                    onClick={() => setDuracion(valor)}
                    className={chip(duracion === valor)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-apoyo font-bold text-aviso">
              <IconClock size={16} stroke={2} aria-hidden="true" />
              Termina a las {fin}
            </span>
            <span className="text-nota text-secundario">
              Se cierra solo. Puedes sumarle 1 hora mientras esté activo. Máximo{' '}
              {MAX_EN_VIVO_POR_CUENTA} a la vez.
            </span>
          </Paso>

          <Paso numero={tipo === 'BUSCO' ? 3 : 4} titulo="¿A quién le llega?">
            <div className="flex items-start gap-3 rounded-2xl bg-superficie p-4">
              <IconBell size={20} stroke={1.8} className="mt-0.5 text-marca" aria-hidden="true" />
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">
                  {tipo === 'BUSCO'
                    ? alcance === null
                      ? 'Les llega a las tiendas que lo tienen publicado'
                      : `Le llega a ${alcance === 1 ? '1 tienda que lo tiene' : `${alcance} tiendas que lo tienen`}`
                    : 'Lo ven todas las tiendas en Pedidos en vivo'}
                  {avisarSeguidores && seguidores ? ` + ${seguidores} que te siguen` : ''}
                </b>
                <span className="text-nota text-secundario">
                  {tipo === 'BUSCO'
                    ? `Por el producto${nombreCategoria ? ` (${nombreCategoria})` : ''}: avisamos a quienes lo tienen publicado con stock.`
                    : 'Y en la portada de todas, hasta que termine.'}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">Avisar a quienes me siguen</b>
                <span className="text-nota text-secundario">
                  {seguidores
                    ? `También les llega a ${seguidores === 1 ? 'la tienda que te sigue' : `las ${seguidores} tiendas que te siguen`}`
                    : 'También les llega a las tiendas que te siguen'}
                </span>
              </span>
              <Interruptor
                etiqueta="Avisar a quienes me siguen"
                activo={avisarSeguidores}
                alCambiar={setAvisarSeguidores}
              />
            </div>
            <label className="flex flex-col gap-1.5 text-apoyo font-bold">
              <span>
                Nota <span className="font-normal text-secundario">(opcional)</span>
              </span>
              <input
                value={nota}
                onChange={(evento) => setNota(evento.target.value)}
                maxLength={120}
                placeholder={
                  tipo === 'BUSCO'
                    ? 'Cliente esperando en el stand'
                    : 'Caja sellada, garantía de 1 año'
                }
                className={`${campo} font-normal`}
              />
            </label>
          </Paso>

          {error && (
            <p role="alert" className="m-0 rounded-xl bg-error-fondo p-3 text-apoyo text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!listo || enviando}
              className="flex h-[52px] items-center gap-2 rounded-full bg-brasa px-6 text-cuerpo font-bold text-tinta disabled:bg-borde disabled:bg-none disabled:text-white"
            >
              <PuntoQueLate tamano={8} />
              {enviando
                ? 'Publicando…'
                : tipo === 'BUSCO'
                  ? alcance === null
                    ? 'Pedir ahora'
                    : `Pedir ahora · les llega a ${alcance === 1 ? '1 tienda' : `${alcance} tiendas`}`
                  : 'Publicar en vivo'}
            </button>
            <Link href="/pedidos-en-vivo" className="text-apoyo font-bold text-secundario">
              Cancelar
            </Link>
          </div>
        </div>

        <aside
          aria-label="Así lo verán"
          className="flex flex-col gap-4 rounded-[24px] border border-linea bg-white p-5 lg:sticky lg:top-40"
        >
          <h2 className="text-[19px] font-bold">Así lo verán</h2>
          <div className="flex flex-col gap-3 rounded-[20px] bg-tinta p-3.5">
            <span className="flex items-center gap-2 text-apoyo font-bold text-white">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
              Pedidos en vivo
            </span>
            <div className="flex flex-col overflow-hidden rounded-2xl bg-white">
              {/* El busco sale con su foto (doc 19, punto 21). */}
              {tipo === 'BUSCO' && fotoVista && (
                <Miniatura
                  ruta={fotoVista}
                  categoria={delCatalogo?.categoria.slug ?? categoria}
                  className="h-[130px] w-full border-b-[1px] border-[#DDE4E0]"
                />
              )}
              <div className="flex flex-col gap-1.5 p-3.5">
                <span className="flex items-center justify-between gap-2">
                  <EtiquetaTipo tipo={tipo} />
                  <span className="flex items-center gap-1 text-nota font-bold text-aviso">
                    <IconClock size={13} stroke={2} aria-hidden="true" />
                    Termina a las {fin}
                  </span>
                </span>
                <b className="text-cuerpo font-bold">
                  {titulo || (tipo === 'BUSCO' ? 'Lo que buscas' : 'Lo que rematas')}
                </b>
                <span className="text-nota text-secundario">
                  {[
                    condicionVista,
                    tipo === 'BUSCO' ? unidades : null,
                    tienda.nombre,
                    tienda.galeria ?? 'Independiente',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {tipo === 'BUSCO' ? (
                  // Sin precio: solo el botón, a la derecha.
                  <span className="mt-1 flex h-8 items-center self-end rounded-full bg-contador px-3 text-nota font-bold text-tinta">
                    ¡Lo tengo!
                  </span>
                ) : (
                  <span className="mt-1 flex items-center justify-between gap-2 border-t border-linea pt-2.5">
                    <b className="text-apoyo font-bold">{precioVista}</b>
                    <span className="flex h-8 items-center rounded-full bg-contador px-3 text-nota font-bold text-tinta">
                      ¡Lo quiero!
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-linea pt-4">
            <h3 className="m-0 text-apoyo font-bold">Y así les llega el aviso</h3>
            <div className="flex items-center gap-3 rounded-2xl border border-linea p-3 shadow-[0_6px_16px_rgba(15,20,18,0.08)]">
              {tipo === 'BUSCO' && fotoVista ? (
                <Miniatura
                  ruta={fotoVista}
                  categoria={delCatalogo?.categoria.slug ?? categoria}
                  className="h-11 w-11 rounded-[10px]"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marca text-white">
                  <IconBell size={18} stroke={1.8} aria-hidden="true" />
                </span>
              )}
              <span className="flex flex-col gap-0.5 text-nota">
                <b className="flex items-center gap-1.5 font-bold">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-vivo" />
                  Pedido en vivo · ahora
                </b>
                <span className="text-tinta">
                  {tienda.nombre} {tipo === 'BUSCO' ? 'busca' : 'remata'}{' '}
                  {titulo || (tipo === 'BUSCO' ? 'lo que buscas' : 'lo que rematas')}
                  {tipo === 'FLASH' && monto.trim() ? ` · ${simbolo} ${monto.trim()}` : ''} ·
                  termina a las {fin}
                </span>
              </span>
            </div>
            {tipo === 'BUSCO' && alcance !== null && alcance > 0 && (
              <span className="text-nota font-semibold text-pase">
                {delCatalogo
                  ? alcance === 1
                    ? 'Le llega a la tienda que tiene este producto.'
                    : `Les llega a las ${alcance} tiendas que tienen este producto.`
                  : alcance === 1
                    ? 'Le llega a la tienda que lo tiene publicado.'
                    : `Les llega a las ${alcance} tiendas que lo tienen publicado.`}
              </span>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
