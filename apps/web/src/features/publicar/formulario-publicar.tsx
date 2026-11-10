'use client';

import {
  centimosDeMonto,
  formatearPrecio,
  MAX_DESCRIPCION,
  montoParaCampo,
  precioDe,
  TEXTO_ESTADO_DETALLE,
  tituloDeProducto,
  type ArchivoSubido,
  type EstadoDetalle,
  type Garantia,
  type ModoVenta,
  type Moneda,
  type QuienVePrecio,
  type RespuestaSocios,
  type OfertaPropia,
  type ProductoResumen,
  type RespuestaPublicar,
  type RespuestaSugerencias,
  type SugerenciaProducto,
  type TiendaDeSesion,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Contador } from '@/shared/ui/contador';
import { botonPrincipal, botonSecundario, campo, etiqueta } from '@/shared/ui/estilos';
import { Segmentado } from '@/shared/ui/segmentado';
import { Interruptor } from '@/shared/ui/interruptor';

import { BuscadorProducto, ProductoElegido } from './producto-catalogo';
import { PRODUCTO_NUEVO_VACIO, ProductoNuevo, type DatosProductoNuevo } from './producto-nuevo';
import { SelectorFotos } from './selector-fotos';
import { VistaPrevia } from './vista-previa';

type Modo = 'buscar' | 'igual' | 'nuevo';

const ESTADOS: Array<[EstadoDetalle, string]> = [
  ['SELLADO', 'Nuevo sellado'],
  ['OPEN_BOX', 'Open box'],
  ['USADO', 'Usado'],
  ['REACONDICIONADO', 'Reacondicionado'],
];
const GARANTIAS_OPCIONES: Array<[Garantia, string]> = [
  ['SIN', 'Sin garantía'],
  ['UN_MES', '1 mes'],
  ['TRES_MESES', '3 meses'],
  ['SEIS_MESES', '6 meses'],
  ['UN_ANIO', '1 año'],
  ['FABRICA', 'De fábrica'],
];
const MODOS: Array<[ModoVenta, string, string]> = [
  ['PASE', 'Pase', 'Sin comprobante. El precio de siempre entre tiendas.'],
  ['FACTURADO', 'Facturado', 'Con factura. Pones el precio con IGV.'],
  ['AMBOS', 'Los dos', 'Pones los dos precios y la otra tienda elige.'],
];
const QUIEN_VE: Array<[QuienVePrecio, string, string]> = [
  ['TODOS', 'Todas las tiendas con sesión', 'Tus socios ven además su precio especial.'],
  ['SOCIOS', 'Solo mis socios', 'Las demás ven «Precio por chat» y te lo piden con un botón.'],
  ['NADIE', 'Nadie: precio por chat', 'Todos te lo piden por chat con el botón «Pedir precio».'],
];
/** «Algo que deban saber»: un toque suma la frase al texto. */
const FRASES = ['Probada', 'Con factura', 'Incluye cables', 'Precio fijo'];
const MONEDAS = [
  ['PEN', 'S/'],
  ['USD', 'US$'],
] as const;
/** «¿Cuánto menos?» del precio socio, en unidades de la moneda. */
const DESCUENTOS = [1, 3, 5];
const SIMBOLO: Record<Moneda, string> = { USD: 'US$', PEN: 'S/' };

interface ErrorPublicar {
  mensaje: string;
  /** El producto nuevo ya existía: se ofrece publicar uno igual. */
  producto?: { slug: string; titulo: string };
  /** La tienda ya tenía esa oferta. */
  oferta?: boolean;
}

/** Una sección del formulario (PUB_WebProducto): tarjeta con su número en un círculo. */
function Seccion({
  numero,
  titulo,
  bajada,
  derecha,
  children,
}: {
  numero: number;
  titulo: string;
  bajada?: string;
  derecha?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-[20px] border border-linea bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tinta text-nota font-bold text-white"
          >
            {numero}
          </span>
          <div className="flex flex-col">
            <h2 id={id} className="text-[20px] font-bold leading-7">
              {titulo}
            </h2>
            {bajada && <span className="text-nota text-secundario">{bajada}</span>}
          </div>
        </div>
        {derecha}
      </div>
      {children}
    </section>
  );
}

/** Píldoras de una sola elección (estado, garantía, cuánto menos). */
function Chips<T extends string | number>({
  etiqueta,
  opciones,
  valor,
  alCambiar,
}: {
  etiqueta: string;
  opciones: Array<[T, string]>;
  valor: T | null;
  alCambiar: (valor: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {opciones.map(([clave, texto]) => (
        <button
          key={String(clave)}
          type="button"
          role="radio"
          aria-checked={valor === clave}
          onClick={() => alCambiar(clave)}
          className={`h-10 rounded-full border px-4 text-apoyo ${
            valor === clave
              ? 'border-tinta bg-tinta font-bold text-white'
              : 'border-borde bg-white font-medium text-tinta'
          }`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function Casilla({
  etiqueta,
  marcada,
  alCambiar,
}: {
  etiqueta: string;
  marcada: boolean;
  alCambiar: (marcada: boolean) => void;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2.5 text-apoyo">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(evento) => alCambiar(evento.target.checked)}
        className="h-5 w-5 accent-pase"
      />
      {etiqueta}
    </label>
  );
}

/** Un campo de monto con su moneda delante. */
function CampoMonto({
  id,
  etiqueta: texto,
  moneda,
  valor,
  alCambiar,
  ayuda,
}: {
  id: string;
  etiqueta: string;
  moneda: Moneda;
  valor: string;
  alCambiar: (valor: string) => void;
  ayuda?: string;
}) {
  const invalido = valor.trim() !== '' && centimosDeMonto(valor) === null;
  return (
    <label htmlFor={id} className={etiqueta}>
      <span className="font-bold">{texto}</span>
      <span className="flex h-12 items-center overflow-hidden rounded-xl border border-borde focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
        <span className="pl-3.5 pr-1 font-medium text-secundario">{SIMBOLO[moneda]}</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          placeholder="0"
          className="h-full min-w-0 flex-1 bg-transparent pl-1 pr-3.5 text-cuerpo font-bold placeholder:font-normal placeholder:text-detalle focus-visible:outline-none"
        />
      </span>
      {invalido ? (
        <span className="text-nota font-normal text-error">
          Escribe el monto con números, por ejemplo 250 o 1699.90.
        </span>
      ) : (
        ayuda && <span className="text-nota font-normal text-secundario">{ayuda}</span>
      )}
    </label>
  );
}

function resumenPublicado(publicado: RespuestaPublicar): string {
  const { oferta, otras_ofertas: otras } = publicado;
  if (publicado.producto_nuevo) {
    return 'Tu producto nuevo ya está en el catálogo. El equipo lo revisa por si estaba repetido.';
  }
  const junto =
    otras === 0 ? '' : ` junto a ${otras === 1 ? 'otra oferta' : `otras ${otras} ofertas`}`;
  const precio = oferta.precio_visible
    ? 'El precio lo ven los vendedores con sesión.'
    : 'El precio quedó al interno.';
  return `Tu oferta de ${oferta.producto.titulo} ya aparece en su ficha${junto}. ${precio}`;
}

/**
 * Publicar (PUB_WebProducto, PUB_CelProducto): la publicación rápida arriba y seis pasos:
 * producto, fotos, estado y garantía, stock, precio (pase, facturado, precio socio y quién lo
 * ve) y tu tienda, con «Así lo verán las tiendas». Con `editar` es la misma pantalla para
 * cambiar una oferta desde Mis publicaciones.
 */
export function FormularioPublicar({
  tienda,
  igual,
  editar,
}: {
  tienda: TiendaDeSesion;
  /** Slug de `?igual=`: llega desde «Publicar uno igual» en la ficha. */
  igual?: string;
  /** Id de `?editar=`: la oferta que se cambia. */
  editar?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [modo, setModo] = useState<Modo>('buscar');
  const [q, setQ] = useState('');
  const [elegido, setElegido] = useState<SugerenciaProducto | null>(null);
  const [nuevo, setNuevo] = useState<DatosProductoNuevo>(PRODUCTO_NUEVO_VACIO);
  const [fotosProducto, setFotosProducto] = useState<ArchivoSubido[]>([]);
  const [estado, setEstado] = useState<EstadoDetalle>('SELLADO');
  const [conCaja, setConCaja] = useState(true);
  const [conFactura, setConFactura] = useState(false);
  const [probado, setProbado] = useState(false);
  const [garantia, setGarantia] = useState<Garantia | null>(null);
  const [stock, setStock] = useState(1);
  const [enAlmacen, setEnAlmacen] = useState(false);
  const [modoVenta, setModoVenta] = useState<ModoVenta>('PASE');
  const [moneda, setMoneda] = useState<Moneda>(tienda.moneda_defecto);
  const [monto, setMonto] = useState('');
  const [montoFacturado, setMontoFacturado] = useState('');
  const [conSocio, setConSocio] = useState(false);
  const [descuento, setDescuento] = useState('3');
  const [otroDescuento, setOtroDescuento] = useState(false);
  const [quienVe, setQuienVe] = useState<QuienVePrecio>(
    tienda.precio_visible_defecto ? 'TODOS' : 'NADIE',
  );
  const [aceptaOfertas, setAceptaOfertas] = useState(true);
  const [socios, setSocios] = useState<RespuestaSocios | null>(null);
  const [tiendaVisible, setTiendaVisible] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  const [fotos, setFotos] = useState<ArchivoSubido[]>([]);
  const [subiendoProducto, setSubiendoProducto] = useState(false);
  const [subiendoPropias, setSubiendoPropias] = useState(false);
  const [error, setError] = useState<ErrorPublicar | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState<RespuestaPublicar | null>(null);
  const [editando, setEditando] = useState<OfertaPropia | null>(null);
  const [cargando, setCargando] = useState(Boolean(igual || editar));

  async function elegirPorSlug(slug: string) {
    try {
      const { productos } = await llamarApi<RespuestaSugerencias>(
        `/catalogo/sugerencias?producto=${encodeURIComponent(slug)}`,
      );
      const [producto] = productos;
      if (producto) {
        setElegido(producto);
        setModo('igual');
        setError(null);
      }
    } catch (e) {
      setError({ mensaje: e instanceof ErrorApi ? e.message : 'No pudimos traer el producto.' });
    }
  }

  useEffect(() => {
    llamarApi<RespuestaSocios>('/socios').then(
      (respuesta) => {
        setSocios(respuesta);
        // Al publicar, el precio socio arranca con el «Descuento por defecto» (PS_SociosWeb).
        const defecto = respuesta.descuento_defecto[tienda.moneda_defecto];
        if (!editar && defecto) {
          setDescuento(montoParaCampo(defecto.centimos));
          setOtroDescuento(!DESCUENTOS.includes(defecto.centimos / 100));
          setConSocio(respuesta.mis_socios.length > 0);
        }
      },
      () => undefined,
    );
    // Solo al abrir la página.
  }, []);

  useEffect(() => {
    if (editar) {
      llamarApi<OfertaPropia>(`/ofertas/${encodeURIComponent(editar)}`)
        .then((oferta) => {
          setEditando(oferta);
          setEstado(oferta.detalle.estado);
          setConCaja(oferta.detalle.con_caja);
          setConFactura(oferta.detalle.con_factura);
          setProbado(oferta.detalle.probado);
          setGarantia(oferta.detalle.garantia);
          setEnAlmacen(oferta.detalle.en_almacen);
          setStock(oferta.stock);
          setMoneda(oferta.moneda);
          setMonto(oferta.precio ? montoParaCampo(oferta.precio.centimos) : '');
          setModoVenta(oferta.modo_venta);
          setMontoFacturado(
            oferta.precio_facturado ? montoParaCampo(oferta.precio_facturado.centimos) : '',
          );
          setConSocio(oferta.descuento_socio !== null);
          if (oferta.descuento_socio) {
            const unidades = oferta.descuento_socio.centimos / 100;
            setDescuento(montoParaCampo(oferta.descuento_socio.centimos));
            setOtroDescuento(!DESCUENTOS.includes(unidades));
          }
          setQuienVe(oferta.quien_ve_precio);
          setAceptaOfertas(oferta.acepta_ofertas);
          setTiendaVisible(oferta.tienda_visible);
          setDescripcion(oferta.descripcion ?? '');
          setFotos(
            oferta.fotos.map((f) => ({ ruta: f.ruta, ancho: f.ancho ?? 0, alto: f.alto ?? 0 })),
          );
        })
        .catch((e: unknown) =>
          setError({
            mensaje: e instanceof ErrorApi ? e.message : 'No pudimos traer la publicación.',
          }),
        )
        .finally(() => setCargando(false));
    } else if (igual) {
      void elegirPorSlug(igual).finally(() => setCargando(false));
    }
    // Solo al abrir la página con ?igual= o ?editar=.
  }, []);

  const producto: ProductoResumen | null = editando?.producto ?? elegido;
  const centimos = monto.trim() ? centimosDeMonto(monto) : null;
  const centimosFacturado = montoFacturado.trim() ? centimosDeMonto(montoFacturado) : null;
  const conPase = modoVenta !== 'FACTURADO';
  const conFacturado = modoVenta !== 'PASE';
  const principal = conPase ? centimos : centimosFacturado;
  const precioTexto = principal ? formatearPrecio(precioDe(principal, moneda)) : null;
  const centimosDescuento = conSocio && conPase ? centimosDeMonto(descuento) : null;
  const precioSocioTexto =
    centimos && centimosDescuento && centimosDescuento < centimos
      ? `Tus socios: ${formatearPrecio(precioDe(centimos - centimosDescuento, moneda))} pase`
      : null;
  const cuantosSocios = socios?.mis_socios.length ?? 0;
  const nombresSocios = socios?.mis_socios.map((socio) => socio.nombre) ?? [];
  const titulo =
    modo === 'nuevo'
      ? tituloDeProducto(nuevo.marca, nuevo.modelo) || 'Producto nuevo'
      : (producto?.titulo ?? 'Elige el producto');
  const fotoPrevia =
    fotos[0]?.ruta ?? (modo === 'nuevo' ? fotosProducto[0]?.ruta : producto?.foto) ?? null;
  const categoriaPrevia =
    (modo === 'nuevo' ? nuevo.categoria : producto?.categoria.slug) || 'graficas';
  const listo = Boolean(editando) || modo !== 'buscar';
  const subiendo = subiendoProducto || subiendoPropias;

  function reiniciar() {
    setPublicado(null);
    setModo('buscar');
    setQ('');
    setElegido(null);
    setNuevo(PRODUCTO_NUEVO_VACIO);
    setFotosProducto([]);
    setStock(1);
    setMonto('');
    setMontoFacturado('');
    setConSocio(false);
    setQuienVe(tienda.precio_visible_defecto ? 'TODOS' : 'NADIE');
    setTiendaVisible(true);
    setMoneda(tienda.moneda_defecto);
    setDescripcion('');
    setFotos([]);
    setError(null);
    window.scrollTo({ top: 0 });
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!listo) {
      setError({ mensaje: 'Elige un producto del catálogo o crea uno nuevo para publicar.' });
      return;
    }
    if (subiendo) {
      setError({ mensaje: 'Espera a que terminen de subir las fotos.' });
      return;
    }
    setEnviando(true);
    setError(null);
    const oferta = {
      estado_detalle: estado,
      con_caja: conCaja,
      con_factura: conFactura,
      probado,
      garantia,
      en_almacen: enAlmacen,
      stock,
      moneda,
      modo_venta: modoVenta,
      precio: conPase ? monto : '',
      precio_facturado: conFacturado ? montoFacturado : '',
      descuento_socio: conSocio && conPase ? descuento : '',
      quien_ve_precio: quienVe,
      acepta_ofertas: aceptaOfertas,
      tienda_visible: tiendaVisible,
      descripcion,
      fotos: fotos.map((f) => f.ruta),
    };
    try {
      if (editando) {
        await llamarApi<OfertaPropia>(`/ofertas/${editando.id}`, {
          metodo: 'PATCH',
          cuerpo: oferta,
        });
        router.push('/mis-publicaciones');
        router.refresh();
        return;
      }
      const cuerpo =
        modo === 'igual' && elegido
          ? { ...oferta, producto_id: elegido.id }
          : { ...oferta, producto_nuevo: { ...nuevo, fotos: fotosProducto.map((f) => f.ruta) } };
      setPublicado(await llamarApi<RespuestaPublicar>('/ofertas', { metodo: 'POST', cuerpo }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (!(e instanceof ErrorApi)) {
        setError({ mensaje: 'No pudimos publicar. Vuelve a intentarlo.' });
      } else {
        const detalles = e.detalles as
          { producto?: { slug: string; titulo: string }; oferta_id?: string } | undefined;
        setError({
          mensaje: e.message,
          producto: detalles?.producto,
          oferta: Boolean(detalles?.oferta_id),
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (publicado) {
    const { oferta } = publicado;
    return (
      <section aria-label="Publicación lista" className="mt-8 flex max-w-[640px] flex-col gap-4">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#006B47"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <h1 className="text-titulo">Ya está publicado</h1>
        <p className="text-secundario">{resumenPublicado(publicado)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link
            href={`/p/${oferta.producto.slug}?oferta=${oferta.id}`}
            className={`${botonPrincipal} no-underline`}
          >
            Ver publicación
          </Link>
          <button type="button" onClick={reiniciar} className={botonSecundario}>
            Publicar otro
          </button>
          <Link href="/mis-publicaciones" className="text-apoyo font-medium">
            Ir a Mis publicaciones
          </Link>
        </div>
      </section>
    );
  }

  const condicionPrevia = estado === 'SELLADO' || estado === 'OPEN_BOX' ? 'NUEVO' : 'USADO';

  return (
    <>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">{editar ? 'Editar publicación' : 'Publicar un producto'}</h1>
          <p className="text-secundario">
            {editar
              ? 'Los datos del producto son del catálogo; aquí cambias lo tuyo.'
              : 'Llena los datos de tu artículo. Si ya existe en el catálogo, te lo llenamos en un toque.'}
          </p>
        </div>
        {!editar && (
          <Link
            href="/pedidos-en-vivo/publicar"
            className="flex h-10 items-center gap-2 rounded-full border border-borde px-4 text-apoyo font-semibold text-tinta no-underline"
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />
            ¿Es urgente? Publicar en vivo
          </Link>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-start gap-8">
        <form
          onSubmit={enviar}
          aria-busy={cargando}
          className="flex min-w-0 max-w-[880px] flex-[999_1_600px] flex-col gap-4"
        >
          {!editando && modo === 'buscar' && !cargando && (
            <section
              aria-labelledby={`${id}-rapida`}
              className="flex flex-col gap-3 rounded-[20px] border border-pase-medio bg-pase-suave p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pase text-white"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                  </svg>
                </span>
                <div className="flex flex-col">
                  <h2
                    id={`${id}-rapida`}
                    className="flex flex-wrap items-center gap-2 text-tarjeta font-bold"
                  >
                    Publicación rápida
                    <span className="rounded-full bg-ambar px-2 text-[11px] font-bold leading-5 text-ambar-texto">
                      Ahorra tiempo
                    </span>
                  </h2>
                  <span className="text-nota text-secundario">
                    Búscalo y toca «Usar»: te llenamos nombre, datos y fotos. Tú solo pones estado,
                    stock y precio.
                  </span>
                </div>
              </div>
              <BuscadorProducto
                q={q}
                alEscribir={setQ}
                alElegir={(p) => {
                  setElegido(p);
                  setModo('igual');
                  setError(null);
                }}
                alCrearNuevo={() => {
                  setModo('nuevo');
                  setError(null);
                }}
              />
              {q.trim() === '' && (
                <span className="flex flex-wrap items-center gap-2 text-nota text-secundario">
                  Prueba con:
                  {['gigabyte 30 60', '5070 tuf', 'ryzen 7800'].map((ejemplo) => (
                    <button
                      key={ejemplo}
                      type="button"
                      onClick={() => setQ(ejemplo)}
                      className="h-8 rounded-full border border-borde bg-white px-3 font-semibold text-tinta"
                    >
                      {ejemplo}
                    </button>
                  ))}
                </span>
              )}
            </section>
          )}

          <Seccion
            numero={1}
            titulo="Producto"
            bajada="Llénalo a mano o usa la publicación rápida de arriba."
          >
            {cargando ? (
              <p className="text-secundario">Cargando…</p>
            ) : editando ? (
              <ProductoElegido producto={editando.producto} condicion={condicionPrevia} />
            ) : modo === 'igual' && elegido ? (
              <ProductoElegido
                producto={elegido}
                propias={elegido.propias}
                condicion={condicionPrevia}
                alCambiar={() => setModo('buscar')}
              />
            ) : modo === 'nuevo' ? (
              <ProductoNuevo
                datos={nuevo}
                alCambiar={setNuevo}
                fotos={fotosProducto}
                alCambiarFotos={setFotosProducto}
                alCargarFotos={setSubiendoProducto}
                alVolver={() => setModo('buscar')}
              />
            ) : (
              <button
                type="button"
                onClick={() => setModo('nuevo')}
                className="flex h-12 items-center justify-center self-start rounded-full border border-borde px-5 font-bold text-tinta"
              >
                Llenarlo a mano
              </button>
            )}
          </Seccion>

          <Seccion
            numero={2}
            titulo="Fotos"
            bajada="Tuyas, del producto real. La primera es la portada."
          >
            <SelectorFotos
              variante="mosaico"
              titulo="Fotos tuyas"
              ayuda="Recomendado si es usado u open box: el producto real y la caja."
              fotos={fotos}
              alCambiar={setFotos}
              alCargar={setSubiendoPropias}
            />
          </Seccion>

          <Seccion numero={3} titulo="Estado y garantía">
            <div className="flex flex-col gap-2">
              <span className="text-apoyo font-bold">Estado</span>
              <Chips etiqueta="Estado" opciones={ESTADOS} valor={estado} alCambiar={setEstado} />
              <div className="flex flex-wrap gap-x-6">
                <Casilla etiqueta="Con caja" marcada={conCaja} alCambiar={setConCaja} />
                <Casilla
                  etiqueta="Con factura o boleta"
                  marcada={conFactura}
                  alCambiar={setConFactura}
                />
                <Casilla etiqueta="Probado en el stand" marcada={probado} alCambiar={setProbado} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-apoyo font-bold">Garantía</span>
              <Chips
                etiqueta="Garantía"
                opciones={GARANTIAS_OPCIONES}
                valor={garantia}
                alCambiar={setGarantia}
              />
            </div>
          </Seccion>

          <Seccion numero={4} titulo="Stock">
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div className="flex flex-col gap-2">
                <span className="text-apoyo font-bold">Cantidad disponible</span>
                <Contador valor={stock} minimo={editando ? 0 : 1} alCambiar={setStock} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-apoyo font-bold">¿Dónde está?</span>
                <Chips
                  etiqueta="Dónde está"
                  opciones={[
                    ['stand', 'En el stand'],
                    ['almacen', 'En almacén · ~30 min'],
                  ]}
                  valor={enAlmacen ? 'almacen' : 'stand'}
                  alCambiar={(valor) => setEnAlmacen(valor === 'almacen')}
                />
              </div>
            </div>
          </Seccion>

          <Seccion
            numero={5}
            titulo="Precio"
            bajada="Solo lo ven las tiendas con sesión. Quien no inicia sesión nunca ve precios."
          >
            <div className="flex flex-col gap-2">
              <span className="text-apoyo font-bold">¿Cómo lo vendes?</span>
              <div
                role="radiogroup"
                aria-label="Cómo lo vendes"
                className="grid gap-2.5 sm:grid-cols-3"
              >
                {MODOS.map(([clave, titulo, detalle]) => (
                  <button
                    key={clave}
                    type="button"
                    role="radio"
                    aria-checked={modoVenta === clave}
                    onClick={() => setModoVenta(clave)}
                    className={`flex flex-col gap-1 rounded-2xl border-2 px-4 py-3 text-left ${
                      modoVenta === clave ? 'border-tinta' : 'border-linea'
                    }`}
                  >
                    <b className="text-cuerpo font-bold">{titulo}</b>
                    <span className="text-nota text-secundario">{detalle}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-apoyo font-bold">Tus precios</span>
              <Segmentado
                etiqueta="Moneda"
                opciones={MONEDAS}
                valor={moneda}
                alCambiar={setMoneda}
                chico
              />
            </div>
            {conPase && (
              <CampoMonto
                id={`${id}-monto`}
                etiqueta="Precio pase"
                moneda={moneda}
                valor={monto}
                alCambiar={setMonto}
              />
            )}
            {conFacturado && (
              <CampoMonto
                id={`${id}-facturado`}
                etiqueta="Precio facturado"
                moneda={moneda}
                valor={montoFacturado}
                alCambiar={setMontoFacturado}
                ayuda="Con factura e IGV incluido."
              />
            )}

            {conPase && (
              <div className="flex flex-col gap-3 border-t border-linea pt-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex flex-col">
                    <b className="text-apoyo font-bold">Precio socio</b>
                    <span className="text-nota text-secundario">
                      {cuantosSocios === 0
                        ? 'Aún no tienes socios: agrégalos en Tus socios.'
                        : `Tus ${cuantosSocios === 1 ? 'socio verá' : `${cuantosSocios} socios verán`} ${
                            centimosDescuento
                              ? `${formatearPrecio(precioDe(centimosDescuento, moneda))} menos`
                              : 'un precio menor'
                          }`}
                    </span>
                  </span>
                  <Interruptor etiqueta="Precio socio" activo={conSocio} alCambiar={setConSocio} />
                </div>
                {conSocio && (
                  <>
                    <span className="text-apoyo font-bold">¿Cuánto menos?</span>
                    <div className="flex flex-wrap gap-2">
                      {DESCUENTOS.map((unidades) => {
                        const elegido = !otroDescuento && descuento === String(unidades);
                        return (
                          <button
                            key={unidades}
                            type="button"
                            aria-pressed={elegido}
                            onClick={() => {
                              setOtroDescuento(false);
                              setDescuento(String(unidades));
                            }}
                            className={`h-10 rounded-full border px-4 text-apoyo ${
                              elegido
                                ? 'border-tinta bg-tinta font-bold text-white'
                                : 'border-borde bg-white font-medium'
                            }`}
                          >
                            {SIMBOLO[moneda]} {unidades} menos
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        aria-pressed={otroDescuento}
                        onClick={() => setOtroDescuento(true)}
                        className={`h-10 rounded-full border px-4 text-apoyo ${
                          otroDescuento
                            ? 'border-tinta bg-tinta font-bold text-white'
                            : 'border-borde bg-white font-medium'
                        }`}
                      >
                        Otro monto
                      </button>
                    </div>
                    {otroDescuento && (
                      <CampoMonto
                        id={`${id}-descuento`}
                        etiqueta="Cuánto menos para tus socios"
                        moneda={moneda}
                        valor={descuento}
                        alCambiar={setDescuento}
                      />
                    )}
                    <span className="flex flex-wrap items-center gap-2 rounded-xl bg-pase-suave px-3 py-2.5 text-nota">
                      <span className="rounded-full bg-marca px-2 text-[11px] font-bold leading-5 text-white">
                        Socio
                      </span>
                      {nombresSocios.length > 0 ? nombresSocios.join(', ') : 'Todavía nadie'}
                      <Link href="/cuenta/socios" className="font-bold text-pase-texto">
                        Administrar ›
                      </Link>
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2.5 border-t border-linea pt-4">
              <span className="text-apoyo font-bold">¿Quién ve el precio?</span>
              <div
                role="radiogroup"
                aria-label="Quién ve el precio"
                className="flex flex-col gap-2.5"
              >
                {QUIEN_VE.map(([clave, titulo, detalle]) => {
                  const elegida = quienVe === clave;
                  return (
                    <button
                      key={clave}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      onClick={() => setQuienVe(clave)}
                      className={`grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 rounded-xl border-2 bg-white px-4 py-3 text-left ${
                        elegida ? 'border-tinta' : 'border-linea'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-px h-5 w-5 rounded-full ${
                          elegida
                            ? 'border-[6px] border-pase'
                            : 'border-[1.5px] border-borde-control'
                        }`}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-apoyo font-bold">{titulo}</span>
                        <span className="text-nota text-secundario">{detalle}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <Casilla
                etiqueta="Acepto ofertas en el chat"
                marcada={aceptaOfertas}
                alCambiar={setAceptaOfertas}
              />
            </div>
          </Seccion>

          <Seccion numero={6} titulo="Tu tienda y detalles">
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col gap-0.5">
                <span className="text-apoyo font-bold">Mostrar el nombre de mi tienda</span>
                <span className="text-nota text-secundario">
                  {tiendaVisible
                    ? `Se verá «${tienda.nombre}».`
                    : 'Saldrás como «Tienda reservada», sin stand ni WhatsApp: te escriben solo por el chat.'}
                </span>
              </span>
              <Interruptor
                activo={tiendaVisible}
                alCambiar={setTiendaVisible}
                etiqueta="Mostrar el nombre de mi tienda"
              />
            </div>
            <label htmlFor={`${id}-descripcion`} className={etiqueta}>
              <span>
                <span className="font-bold">Algo que deban saber</span>{' '}
                <span className="font-normal text-secundario">(opcional)</span>
              </span>
              <textarea
                id={`${id}-descripcion`}
                rows={3}
                maxLength={MAX_DESCRIPCION}
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                placeholder="Incluye cables de poder. Sin minería."
                className={`${campo} h-auto resize-y py-3`}
              />
              <span className="self-end text-nota font-normal text-detalle">
                {descripcion.length} / {MAX_DESCRIPCION}
              </span>
            </label>
            <div className="-mt-2 flex flex-wrap gap-2">
              {FRASES.map((frase) => (
                <button
                  key={frase}
                  type="button"
                  onClick={() =>
                    setDescripcion((actual) =>
                      `${actual.trim()}${actual.trim() ? '. ' : ''}${frase}.`.slice(
                        0,
                        MAX_DESCRIPCION,
                      ),
                    )
                  }
                  className="h-8 rounded-full border border-borde px-3 text-nota font-semibold text-tinta"
                >
                  + {frase}
                </button>
              ))}
            </div>
          </Seccion>

          {error && (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
            >
              {error.mensaje}
              {error.producto && (
                <button
                  type="button"
                  onClick={() => error.producto && void elegirPorSlug(error.producto.slug)}
                  className="font-medium underline"
                >
                  Publicar uno igual: {error.producto.titulo}
                </button>
              )}
              {error.oferta && (
                <Link href="/mis-publicaciones" className="font-medium text-error">
                  Ir a Mis publicaciones
                </Link>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
            <button
              type="submit"
              disabled={enviando || cargando}
              className={`inline-flex h-12 items-center rounded-full px-8 text-cuerpo font-bold text-white ${
                listo && !subiendo ? 'bg-pase' : 'bg-borde-control'
              }`}
            >
              {enviando
                ? editando
                  ? 'Guardando…'
                  : 'Publicando…'
                : editando
                  ? 'Guardar cambios'
                  : 'Publicar'}
            </button>
            <Link href="/mis-publicaciones" className="text-apoyo font-medium">
              Cancelar
            </Link>
          </div>
        </form>

        <VistaPrevia
          titulo={titulo}
          foto={fotoPrevia}
          categoria={categoriaPrevia}
          estado={TEXTO_ESTADO_DETALLE[estado]}
          stock={stock}
          precio={precioTexto}
          visible={quienVe !== 'NADIE'}
          tiendaVisible={tiendaVisible}
          tienda={tienda}
          socio={precioSocioTexto}
          enAlmacen={enAlmacen}
        >
          <div className="flex flex-col gap-2 border-t border-linea pt-3.5">
            <b className="text-apoyo font-bold">Antes de publicar</b>
            {(
              [
                [listo, 'Producto elegido'],
                [fotos.length > 0, 'Una foto tuya (recomendado si es usado)'],
                [principal !== null, 'Precio puesto'],
              ] as const
            ).map(([hecho, texto]) => (
              <span key={texto} className="flex items-center gap-2 text-nota">
                <span
                  aria-hidden="true"
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    hecho ? 'bg-pase text-white' : 'border border-borde-control'
                  }`}
                >
                  {hecho ? '✓' : ''}
                </span>
                {texto}
                <span className="sr-only">{hecho ? ', listo' : ', falta'}</span>
              </span>
            ))}
            <span className="text-nota text-secundario">
              Quien no inicia sesión ve el producto y la galería, pero nunca tu precio ni tu tienda.
            </span>
          </div>
        </VistaPrevia>
      </div>
    </>
  );
}
