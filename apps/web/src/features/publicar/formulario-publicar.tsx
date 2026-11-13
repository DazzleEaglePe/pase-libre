'use client';

import {
  centimosDeMonto,
  formatearPrecio,
  MAX_DESCRIPCION,
  MAX_TEXTO_OTRO,
  montoParaCampo,
  precioDe,
  preguntasDeCategoria,
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
  type PerfilMemoria,
  type ProductoResumen,
  type RespuestaPublicar,
  type RespuestaSugerencias,
  type SugerenciaProducto,
  type TiendaDeSesion,
  type VariantesOferta,
  variantesDeCategoria,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { PuntoQueLate } from '@/shared/ui/brasa';
import { Contador } from '@/shared/ui/contador';
import { botonPrincipal, botonSecundario, campo, etiqueta } from '@/shared/ui/estilos';
import { Interruptor } from '@/shared/ui/interruptor';
import { BurbujaSocio } from '@/shared/ui/tarjeta-producto';

import { alternarEnTexto, DETALLES_EN_TEXTO, tieneEnTexto } from './detalles';
import { FotosPublicacion, portadaElegida, portadaQueSeVe } from './fotos-publicacion';
import { BuscadorProducto, ProductoElegido } from './producto-catalogo';
import { PRODUCTO_NUEVO_VACIO, ProductoNuevo, type DatosProductoNuevo } from './producto-nuevo';
import { PreguntasVariantes } from './variantes';
import { VistaPrevia } from './vista-previa';

type Modo = 'buscar' | 'igual' | 'nuevo';

const SIN_VARIANTES: VariantesOferta = { perfil_memoria: null, empaque: null, oc: null };

/** «Estado» (COR9): con «Otro» se escribe. Reacondicionado sigue si una oferta ya lo tenía. */
const ESTADOS: Array<[EstadoDetalle, string]> = [
  ['SELLADO', 'Nuevo sellado'],
  ['OPEN_BOX', 'Open box'],
  ['USADO', 'Usado'],
  ['OTRO', 'Otro'],
];
/** «Garantía (opcional)» (COR9): sin elegir nada, la ficha no muestra garantía. */
const GARANTIAS_OPCIONES: Array<[Garantia, string]> = [
  ['SEIS_MESES', '6 meses'],
  ['UN_ANIO', '1 año'],
  ['OTRA', 'Otro'],
];
/** Las garantías de antes, por si una oferta ya tenía una. */
const GARANTIAS_ANTES: Partial<Record<Garantia, string>> = {
  SIN: 'Sin garantía',
  UN_MES: '1 mes',
  TRES_MESES: '3 meses',
  FABRICA: 'De fábrica',
};
const MODOS: Array<[ModoVenta, string, string]> = [
  ['PASE', 'Pase', 'Sin comprobante. El precio de siempre entre tiendas.'],
  ['FACTURADO', 'Facturado', 'Con factura. Pones el precio con IGV.'],
  ['AMBOS', 'Los dos', 'Pones los dos precios y la otra tienda elige.'],
];
/** «¿Quién ve tu precio?» (COR9): lo primero del precio, con su dibujito. */
const QUIEN_VE: Array<[QuienVePrecio, string, string, string]> = [
  ['TODOS', '👁️', 'Todas las tiendas', 'Las tiendas con sesión ven tu precio.'],
  ['SOCIOS', '🤝', 'Solo mis socios', 'Las demás te lo piden por chat.'],
  ['NADIE', '🔒', 'Al interno · por chat', 'Nadie lo ve: te lo piden con «Pedir precio».'],
];
/** «¿Cuánto menos?» del precio socio (COR9): en soles 5, 10 y 20; en dólares 1, 3 y 5. */
const DESCUENTOS: Record<Moneda, number[]> = { PEN: [5, 10, 20], USD: [1, 3, 5] };
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
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca text-nota font-bold text-white"
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

/**
 * Un campo de monto con su moneda delante. Con `alCambiarMoneda`, la moneda es un botón «S/ ▾»
 * que cambia a dólares y vuelve (COR9: soles por defecto).
 */
function CampoMonto({
  id,
  etiqueta: texto,
  moneda,
  valor,
  alCambiar,
  ayuda,
  alCambiarMoneda,
  derecha,
}: {
  id: string;
  etiqueta: string;
  moneda: Moneda;
  valor: string;
  alCambiar: (valor: string) => void;
  ayuda?: string;
  alCambiarMoneda?: () => void;
  /** Dentro del campo, a la derecha: «Precio fijo ▾» (N06). */
  derecha?: ReactNode;
}) {
  const invalido = valor.trim() !== '' && centimosDeMonto(valor) === null;
  return (
    <div className={etiqueta}>
      <label htmlFor={id} className="font-bold">
        {texto}
      </label>
      <span
        className={`flex h-[54px] items-center gap-1 rounded-[14px] border-[1.5px] border-borde bg-white pl-2 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta ${
          derecha ? 'pr-2' : ''
        }`}
      >
        {alCambiarMoneda ? (
          <button
            type="button"
            onClick={alCambiarMoneda}
            aria-label={`Moneda: ${moneda === 'PEN' ? 'soles' : 'dólares'}. Cambiar a ${moneda === 'PEN' ? 'dólares' : 'soles'}`}
            className="flex h-[38px] shrink-0 items-center gap-1 rounded-[10px] border-[1.5px] border-[#A7E3C3] bg-pase-suave px-3 text-cuerpo font-extrabold text-marca"
          >
            {SIMBOLO[moneda]} <span className="text-[11px]">▾</span>
          </button>
        ) : (
          <span className="pl-2 pr-1 font-medium text-secundario">{SIMBOLO[moneda]}</span>
        )}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          placeholder="0.00"
          className="h-full min-w-0 flex-1 bg-transparent pl-1.5 pr-3.5 text-[18px] font-bold placeholder:font-semibold placeholder:text-detalle focus-visible:outline-none"
        />
        {derecha}
      </span>
      {invalido ? (
        <span className="text-nota font-normal text-error">
          Escribe el monto con números, por ejemplo 250 o 1699.90.
        </span>
      ) : (
        ayuda && <span className="text-nota font-normal text-secundario">{ayuda}</span>
      )}
    </div>
  );
}

/**
 * «Precio fijo ▾» dentro del campo de precio, a la derecha (N06, elegido B): abre «✓ Precio
 * fijo / Negociable». Negociable suma la burbujita «Negociable» al precio.
 */
function PrecioFijo({
  negociable,
  alCambiar,
}: {
  negociable: boolean;
  alCambiar: (negociable: boolean) => void;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const afuera = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', afuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const opciones: Array<[boolean, string]> = [
    [false, 'Precio fijo'],
    [true, 'Negociable'],
  ];
  return (
    <span ref={caja} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={`${id}-opciones`}
        aria-label={`Tipo de precio: ${negociable ? 'negociable' : 'precio fijo'}`}
        onClick={() => setAbierto(!abierto)}
        className="flex h-[38px] items-center gap-1 whitespace-nowrap rounded-[10px] border-[1.5px] border-borde bg-white px-3 text-nota font-bold text-tinta hover:border-borde-control"
      >
        {negociable ? 'Negociable' : 'Precio fijo'} <span className="text-[11px]">▾</span>
      </button>
      {abierto && (
        <ul
          id={`${id}-opciones`}
          role="listbox"
          aria-label="Tipo de precio"
          className="absolute right-0 top-[46px] z-20 m-0 flex w-[180px] list-none flex-col rounded-[14px] border-[1.5px] border-borde bg-white p-1.5 shadow-[0_8px_24px_rgba(15,20,18,0.12)]"
        >
          {opciones.map(([valor, texto]) => (
            <li key={texto} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={negociable === valor}
                onClick={() => {
                  alCambiar(valor);
                  setAbierto(false);
                }}
                className={`flex w-full rounded-lg px-2.5 py-2 text-left text-apoyo ${
                  negociable === valor ? 'bg-pase-suave font-bold' : 'hover:bg-superficie'
                }`}
              >
                {negociable === valor ? `✓ ${texto}` : texto}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
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
  /** «¿Para qué procesador es?», empaque y OC (docs/19 §13): nada marcado de entrada. */
  const [variantes, setVariantes] = useState<VariantesOferta>(SIN_VARIANTES);
  /** Lo que dijo el catálogo cuando vino marcado solo: «✦ Ya viene marcado…». */
  const [delCatalogo, setDelCatalogo] = useState<PerfilMemoria | null>(null);
  const [conFactura, setConFactura] = useState(false);
  const [probado, setProbado] = useState(false);
  const [garantia, setGarantia] = useState<Garantia | null>(null);
  const [estadoOtro, setEstadoOtro] = useState('');
  const [garantiaOtra, setGarantiaOtra] = useState('');
  const [stock, setStock] = useState(1);
  const [enAlmacen, setEnAlmacen] = useState(false);
  const [modoVenta, setModoVenta] = useState<ModoVenta>('PASE');
  const [moneda, setMoneda] = useState<Moneda>(tienda.moneda_defecto);
  const [monto, setMonto] = useState('');
  const [montoFacturado, setMontoFacturado] = useState('');
  const [conSocio, setConSocio] = useState(false);
  const [descuento, setDescuento] = useState(tienda.moneda_defecto === 'USD' ? '3' : '10');
  const [otroDescuento, setOtroDescuento] = useState(false);
  const [quienVe, setQuienVe] = useState<QuienVePrecio>(
    tienda.precio_visible_defecto ? 'TODOS' : 'NADIE',
  );
  const [aceptaOfertas, setAceptaOfertas] = useState(true);
  const [negociable, setNegociable] = useState(false);
  const [socios, setSocios] = useState<RespuestaSocios | null>(null);
  const [tiendaVisible, setTiendaVisible] = useState(true);
  const [descripcion, setDescripcion] = useState('');
  /** Las fotos de la tienda (las del producto son del catálogo). */
  const [fotos, setFotos] = useState<ArchivoSubido[]>([]);
  /** Una de `fotos`, o nula: la del catálogo o, sin catálogo, la primera tuya (docs/17 §5). */
  const [portada, setPortada] = useState<string | null>(null);
  const [subiendoProducto, setSubiendoProducto] = useState(false);
  const [subiendoPropias, setSubiendoPropias] = useState(false);
  const [error, setError] = useState<ErrorPublicar | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState<RespuestaPublicar | null>(null);
  const [editando, setEditando] = useState<OfertaPropia | null>(null);
  const [cargando, setCargando] = useState(Boolean(igual || editar));

  /** Al elegir un producto: si el catálogo sabe para qué procesador es, viene marcado. */
  function marcarDelCatalogo(producto: ProductoResumen | null) {
    const perfil = producto?.perfil_memoria ?? null;
    setDelCatalogo(perfil);
    setVariantes({ ...SIN_VARIANTES, perfil_memoria: perfil });
  }

  async function elegirPorSlug(slug: string) {
    try {
      const { productos } = await llamarApi<RespuestaSugerencias>(
        `/catalogo/sugerencias?producto=${encodeURIComponent(slug)}`,
      );
      const [producto] = productos;
      if (producto) {
        setElegido(producto);
        marcarDelCatalogo(producto);
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
          setOtroDescuento(!DESCUENTOS[tienda.moneda_defecto].includes(defecto.centimos / 100));
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
          // Una publicación de antes, «Con caja» y sin empaque: queda marcado «Con caja».
          setVariantes({
            perfil_memoria: oferta.detalle.perfil_memoria,
            oc: oferta.detalle.oc,
            empaque:
              oferta.detalle.empaque ??
              (preguntasDeCategoria(oferta.producto.categoria.slug).empaque &&
              oferta.detalle.con_caja
                ? 'CAJA'
                : null),
          });
          setConFactura(oferta.detalle.con_factura);
          setProbado(oferta.detalle.probado);
          setGarantia(oferta.detalle.garantia);
          setEstadoOtro(oferta.detalle.estado_otro ?? '');
          setGarantiaOtra(oferta.detalle.garantia_otra ?? '');
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
            setOtroDescuento(!DESCUENTOS[oferta.moneda].includes(unidades));
          }
          setQuienVe(oferta.quien_ve_precio);
          setAceptaOfertas(oferta.acepta_ofertas);
          setNegociable(oferta.negociable);
          setTiendaVisible(oferta.tienda_visible);
          setDescripcion(oferta.descripcion ?? '');
          setFotos(
            oferta.fotos.map((f) => ({ ruta: f.ruta, ancho: f.ancho ?? 0, alto: f.alto ?? 0 })),
          );
          setPortada(oferta.portada);
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
  // A mano, la primera foto del producto nuevo queda como la del catálogo.
  const fotoCatalogo = (modo === 'nuevo' ? fotosProducto[0]?.ruta : producto?.foto) ?? null;
  const fotoPrevia = portadaQueSeVe(portada, fotoCatalogo, fotos);
  const categoriaPrevia =
    (modo === 'nuevo' ? nuevo.categoria : producto?.categoria.slug) || 'graficas';
  /** La categoría de verdad (sin la del dibujo): decide qué se pregunta (docs/19 §13). */
  const categoriaElegida =
    (!editando && modo === 'nuevo' ? nuevo.categoria : producto?.categoria.slug) || null;
  const listo = Boolean(editando) || modo !== 'buscar';
  const subiendo = subiendoProducto || subiendoPropias;

  function reiniciar() {
    setPublicado(null);
    setModo('buscar');
    setQ('');
    setElegido(null);
    setNuevo(PRODUCTO_NUEVO_VACIO);
    setFotosProducto([]);
    setVariantes(SIN_VARIANTES);
    setDelCatalogo(null);
    setEstadoOtro('');
    setGarantiaOtra('');
    setStock(1);
    setMonto('');
    setMontoFacturado('');
    setConSocio(false);
    setNegociable(false);
    setQuienVe(tienda.precio_visible_defecto ? 'TODOS' : 'NADIE');
    setTiendaVisible(true);
    setMoneda(tienda.moneda_defecto);
    setDescripcion('');
    setFotos([]);
    setPortada(null);
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
    const preguntas = preguntasDeCategoria(categoriaElegida);
    const oferta = {
      estado_detalle: estado,
      // Donde se pregunta el empaque, «Con caja» sale de ahí.
      con_caja: preguntas.empaque ? variantes.empaque === 'CAJA' : conCaja,
      ...variantesDeCategoria(categoriaElegida, variantes),
      con_factura: conFactura,
      probado,
      garantia,
      estado_otro: estado === 'OTRO' ? estadoOtro : null,
      garantia_otra: garantia === 'OTRA' ? garantiaOtra : null,
      en_almacen: enAlmacen,
      stock,
      moneda,
      modo_venta: modoVenta,
      precio: conPase ? monto : '',
      precio_facturado: conFacturado ? montoFacturado : '',
      descuento_socio: conSocio && conPase ? descuento : '',
      quien_ve_precio: quienVe,
      acepta_ofertas: aceptaOfertas,
      // «Negociable» solo tiene sentido con un precio a la vista.
      negociable: quienVe !== 'NADIE' && negociable,
      tienda_visible: tiendaVisible,
      descripcion,
      fotos: fotos.map((f) => f.ruta),
      portada: portadaElegida(portada, fotos),
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
  const aMano = !editando && modo === 'nuevo';
  const productoListo = aMano
    ? Boolean(nuevo.categoria && nuevo.marca.trim() && nuevo.modelo.trim().length >= 2)
    : listo;
  const alInterno = quienVe === 'NADIE';
  const precioListo = alInterno || principal !== null;
  const faltan = [!productoListo && 'producto', !precioListo && 'precio'].filter(Boolean);
  const descuentos = DESCUENTOS[moneda];
  const opcionesEstado: Array<[EstadoDetalle, string]> = ESTADOS.some(([e]) => e === estado)
    ? ESTADOS
    : [...ESTADOS.slice(0, 3), [estado, TEXTO_ESTADO_DETALLE[estado]], ESTADOS[3]!];
  const anterior = garantia ? GARANTIAS_ANTES[garantia] : undefined;
  const opcionesGarantia: Array<[Garantia, string]> =
    garantia && anterior ? [[garantia, anterior], ...GARANTIAS_OPCIONES] : GARANTIAS_OPCIONES;
  const estadoVista =
    estado === 'OTRO' && estadoOtro.trim() ? estadoOtro.trim() : TEXTO_ESTADO_DETALLE[estado];
  const garantiaVista = garantia
    ? garantia === 'OTRA'
      ? garantiaOtra.trim() && `garantía ${garantiaOtra.trim()}`
      : `garantía ${(GARANTIAS_OPCIONES.find(([g]) => g === garantia)?.[1] ?? anterior ?? '').toLowerCase()}`
    : '';
  const checks: Array<[boolean, string]> = [
    [productoListo, 'Producto elegido'],
    [true, 'Estado'],
    [stock >= (editando ? 0 : 1), 'Cantidad'],
    [
      precioListo,
      alInterno
        ? 'Precio: al interno · por chat'
        : precioTexto
          ? `Precio: ${precioTexto}`
          : 'Precio',
    ],
  ];
  const listos = checks.filter(([hecho]) => hecho).length;

  /**
   * Los detalles de N06. «Con caja», «Probada» y «Con comprobante» marcan la oferta (el
   * comprobante, boleta o factura, va en `con_factura` sin decirlo directo); «Accesorios
   * completos» y «Entrega inmediata» se escriben en el texto.
   */
  const marcas: Array<[string, boolean, (valor: boolean) => void]> = [
    // Donde se pregunta el empaque (docs/19 §13), «Con caja» ya está arriba.
    ...(preguntasDeCategoria(categoriaElegida).empaque
      ? []
      : [['Con caja', conCaja, setConCaja] as [string, boolean, (valor: boolean) => void]]),
    ['Probada', probado, setProbado],
    ['Con comprobante', conFactura, setConFactura],
    ...DETALLES_EN_TEXTO.map((frase): [string, boolean, (valor: boolean) => void] => [
      frase,
      tieneEnTexto(descripcion, frase),
      () => setDescripcion((actual) => alternarEnTexto(actual, frase)),
    ]),
  ];

  const preguntasVariantes = (
    <PreguntasVariantes
      categoria={categoriaElegida}
      titulo={titulo}
      variantes={variantes}
      alCambiar={setVariantes}
      delCatalogo={editando ? null : delCatalogo}
    />
  );

  function cambiarMoneda() {
    const otra: Moneda = moneda === 'PEN' ? 'USD' : 'PEN';
    setMoneda(otra);
    if (!otroDescuento) setDescuento(String(DESCUENTOS[otra][1]));
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">{editar ? 'Editar publicación' : 'Publicar un producto'}</h1>
          <p className="m-0 text-secundario">
            {editar
              ? 'Los datos del producto son del catálogo; aquí cambias lo tuyo.'
              : 'Elige arriba: rápida o a mano.'}
          </p>
        </div>
        {!editar && (
          <Link
            href="/pedidos-en-vivo/publicar"
            className="flex h-11 items-center gap-2 rounded-full bg-brasa px-5 text-apoyo font-bold text-tinta no-underline"
          >
            <PuntoQueLate tamano={8} />
            ¿Es urgente? Publicar en vivo
          </Link>
        )}
      </div>

      {!editando && !cargando && (
        <div
          role="tablist"
          aria-label="Cómo quieres publicar"
          className="mt-5 grid gap-1.5 rounded-[20px] border border-linea bg-white p-1.5 sm:grid-cols-2"
        >
          {(
            [
              [
                false,
                'Publicación rápida',
                'Búscalo y se llena casi todo · unos 30 s',
                <svg
                  key="r"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#006B47"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
                </svg>,
              ],
              [
                true,
                'A mano',
                'Para lo que no está en el catálogo · unos 3 min',
                <svg
                  key="m"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 20l4-1 11-11-3-3L5 16z" />
                </svg>,
              ],
            ] as const
          ).map(([mano, titulo, detalle, icono]) => {
            const activa = aMano === mano;
            return (
              <button
                key={titulo}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => {
                  setError(null);
                  setModo(mano ? 'nuevo' : elegido ? 'igual' : 'buscar');
                }}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left ${
                  activa ? 'border-pase bg-pase-suave' : 'border-transparent hover:bg-superficie'
                }`}
              >
                {/* Cada círculo tiene su color fijo (docs/18 §1): el rayo verde sobre verde clarito y
                    el lápiz blanco sobre negro, esté elegida o no su pestaña. */}
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    mano ? 'bg-tinta text-white' : 'bg-pase-medio'
                  }`}
                >
                  {icono}
                </span>
                <span className="flex min-w-0 flex-col">
                  <b
                    className={`text-[17px] font-bold ${activa ? 'text-tinta' : 'text-secundario'}`}
                  >
                    {titulo}
                  </b>
                  <span className="text-nota text-secundario">{detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-6">
        <form
          onSubmit={enviar}
          aria-busy={cargando}
          className="flex min-w-0 max-w-[880px] flex-[999_1_600px] flex-col gap-4"
        >
          {aMano ? (
            <Seccion numero={1} titulo="Producto y fotos">
              <ProductoNuevo
                datos={nuevo}
                alCambiar={setNuevo}
                fotos={fotosProducto}
                alCambiarFotos={setFotosProducto}
                alCargarFotos={setSubiendoProducto}
              />
              {preguntasVariantes}
            </Seccion>
          ) : (
            <Seccion numero={1} titulo="Producto">
              {cargando ? (
                <p className="text-secundario">Cargando…</p>
              ) : editando ? (
                <>
                  <ProductoElegido producto={editando.producto} condicion={condicionPrevia} />
                  {preguntasVariantes}
                </>
              ) : modo === 'igual' && elegido ? (
                <>
                  <ProductoElegido
                    producto={elegido}
                    propias={elegido.propias}
                    condicion={condicionPrevia}
                    alCambiar={() => setModo('buscar')}
                  />
                  {preguntasVariantes}
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <BuscadorProducto
                    q={q}
                    alEscribir={setQ}
                    alElegir={(p) => {
                      setElegido(p);
                      marcarDelCatalogo(p);
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
                </div>
              )}
            </Seccion>
          )}
          {!cargando && (
            <Seccion
              numero={2}
              titulo="Fotos de tu publicación"
              bajada="Toca una para usarla de portada."
            >
              <FotosPublicacion
                catalogo={fotoCatalogo}
                categoria={categoriaPrevia}
                fotos={fotos}
                alCambiar={setFotos}
                alCargar={setSubiendoPropias}
                portada={portada}
                alElegirPortada={setPortada}
              />
            </Seccion>
          )}

          <Seccion numero={3} titulo="Estado y garantía">
            <div className="flex flex-col gap-2">
              <span className="text-apoyo font-bold">Estado</span>
              <Chips
                etiqueta="Estado"
                opciones={opcionesEstado}
                valor={estado}
                alCambiar={setEstado}
              />
              {estado === 'OTRO' && (
                <input
                  aria-label="Escribe el estado"
                  maxLength={MAX_TEXTO_OTRO}
                  value={estadoOtro}
                  onChange={(evento) => setEstadoOtro(evento.target.value)}
                  placeholder="Escribe el estado (ej. reacondicionado)"
                  className={`${campo} max-w-[420px]`}
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-apoyo">
                <b className="font-bold">Garantía</b>{' '}
                <span className="text-secundario">(opcional)</span>
              </span>
              <Chips
                etiqueta="Garantía"
                opciones={opcionesGarantia}
                valor={garantia}
                alCambiar={(valor) => setGarantia(garantia === valor ? null : valor)}
              />
              {garantia === 'OTRA' && (
                <span className="flex max-w-[420px] flex-col gap-1">
                  <input
                    aria-label="Escribe la garantía"
                    maxLength={MAX_TEXTO_OTRO}
                    value={garantiaOtra}
                    onChange={(evento) => setGarantiaOtra(evento.target.value)}
                    placeholder="Escribe la garantía (ej. 2 años)"
                    className={campo}
                  />
                  <span className="self-end text-nota text-detalle">
                    {garantiaOtra.length} / {MAX_TEXTO_OTRO}
                  </span>
                </span>
              )}
              <span className="text-nota text-secundario">
                Si no eliges nada, en la ficha no se muestra garantía.
              </span>
            </div>
          </Seccion>

          <Seccion numero={4} titulo="Cantidad">
            <div className="flex flex-col items-start gap-2">
              <span className="text-apoyo font-bold">Cantidad disponible</span>
              <Contador valor={stock} minimo={editando ? 0 : 1} alCambiar={setStock} />
            </div>
          </Seccion>

          <Seccion numero={5} titulo="Precio">
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-tinta p-4">
              <span className="flex items-center gap-2">
                <b className="text-cuerpo font-bold">¿Quién ve tu precio?</b>
                <span className="rounded-full bg-tinta px-2 text-[11px] font-bold leading-5 text-white">
                  Importante
                </span>
              </span>
              <div
                role="radiogroup"
                aria-label="Quién ve tu precio"
                className="grid gap-2.5 sm:grid-cols-3"
              >
                {QUIEN_VE.map(([clave, dibujo, titulo, detalle]) => {
                  const elegida = quienVe === clave;
                  return (
                    <button
                      key={clave}
                      type="button"
                      role="radio"
                      aria-checked={elegida}
                      onClick={() => setQuienVe(clave)}
                      className={`flex flex-col items-start gap-1 rounded-[14px] px-3.5 py-3 text-left ${
                        elegida
                          ? 'border-[2.5px] border-pase bg-pase-suave'
                          : 'border border-borde bg-white'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[17px] ${
                          elegida ? 'bg-pase' : 'bg-superficie'
                        }`}
                      >
                        {dibujo}
                      </span>
                      <b className="text-apoyo font-bold">{titulo}</b>
                      <span className="text-nota text-secundario">{detalle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {alInterno ? (
              <p className="m-0 flex flex-col gap-1 rounded-2xl bg-pase-suave px-4 py-3.5 text-apoyo">
                <b className="font-bold text-marca">Listo: tu precio queda al interno</b>
                <span className="text-secundario">
                  Las tiendas te lo pedirán con el botón «Pedir precio» y se lo das por chat. No
                  tienes que llenar nada más aquí.
                </span>
              </p>
            ) : (
              <>
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
                        className={`flex flex-col gap-1 rounded-[14px] bg-white px-4 py-3 text-left ${
                          modoVenta === clave ? 'border-2 border-tinta' : 'border border-borde'
                        }`}
                      >
                        <b className="text-cuerpo font-bold">{titulo}</b>
                        <span className="text-nota text-secundario">{detalle}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {conPase && (
                  <CampoMonto
                    id={`${id}-monto`}
                    etiqueta="Precio pase"
                    moneda={moneda}
                    valor={monto}
                    alCambiar={setMonto}
                    alCambiarMoneda={cambiarMoneda}
                    ayuda={`Toca ${SIMBOLO[moneda]} para cambiar a ${moneda === 'PEN' ? 'dólares' : 'soles'}`}
                    derecha={<PrecioFijo negociable={negociable} alCambiar={setNegociable} />}
                  />
                )}
                {conFacturado && (
                  <CampoMonto
                    id={`${id}-facturado`}
                    etiqueta="Precio facturado"
                    moneda={moneda}
                    valor={montoFacturado}
                    alCambiar={setMontoFacturado}
                    alCambiarMoneda={conPase ? undefined : cambiarMoneda}
                    ayuda="Con factura e IGV incluido."
                    derecha={
                      conPase ? undefined : (
                        <PrecioFijo negociable={negociable} alCambiar={setNegociable} />
                      )
                    }
                  />
                )}

                {conPase && (
                  <div className="flex flex-col gap-3 rounded-2xl border-l-4 border-pase bg-pase-suave px-4 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-apoyo font-bold">Precio socio</b>
                        <BurbujaSocio />
                        <span className="text-nota text-secundario">(opcional)</span>
                      </span>
                      {cuantosSocios > 0 && (
                        <Interruptor
                          etiqueta="Precio socio"
                          activo={conSocio}
                          alCambiar={setConSocio}
                        />
                      )}
                    </div>
                    {cuantosSocios === 0 ? (
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-nota text-secundario">
                        Aún no tienes socios. Los socios ven un precio especial más bajo.
                        <Link href="/cuenta/socios" className="font-bold text-pase-texto">
                          + Agregar socios
                        </Link>
                      </span>
                    ) : (
                      conSocio && (
                        <>
                          <span className="flex items-center gap-2 text-nota text-secundario">
                            <span className="text-apoyo font-semibold text-tinta">
                              Descuento en
                            </span>
                            <span className="rounded-lg border border-[#A7E3C3] bg-white px-2 py-0.5 font-extrabold text-marca">
                              {SIMBOLO[moneda]}
                            </span>
                            (va junto con el precio)
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {descuentos.map((unidades) => {
                              const marcado = !otroDescuento && descuento === String(unidades);
                              return (
                                <button
                                  key={unidades}
                                  type="button"
                                  aria-pressed={marcado}
                                  onClick={() => {
                                    setOtroDescuento(false);
                                    setDescuento(String(unidades));
                                  }}
                                  className={`h-10 rounded-full border px-4 text-apoyo ${
                                    marcado
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
                          <span className="text-nota text-secundario">
                            Tus{' '}
                            {cuantosSocios === 1 ? 'socio verá' : `${cuantosSocios} socios verán`}{' '}
                            <b className="text-tinta">
                              {precioSocioTexto
                                ?.replace(/^Tus socios: /, '')
                                .replace(/ pase$/, '') ??
                                (centimosDescuento
                                  ? `${formatearPrecio(precioDe(centimosDescuento, moneda))} menos`
                                  : 'un precio menor')}
                            </b>{' '}
                            · {nombresSocios.join(', ')} ·{' '}
                            <Link href="/cuenta/socios" className="font-bold text-pase-texto">
                              Administrar
                            </Link>
                          </span>
                        </>
                      )
                    )}
                  </div>
                )}
              </>
            )}
          </Seccion>

          <Seccion numero={6} titulo="Detalles (opcional)">
            <label htmlFor={`${id}-descripcion`} className="flex flex-col gap-1">
              <span className="sr-only">Algo que deban saber</span>
              <textarea
                id={`${id}-descripcion`}
                rows={3}
                maxLength={MAX_DESCRIPCION}
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                placeholder="Ej.: viene con su caja, probada en el stand…"
                className={`${campo} h-auto resize-y py-3`}
              />
              <span className="self-end text-nota font-normal text-detalle">
                {descripcion.length} / {MAX_DESCRIPCION}
              </span>
            </label>
            <div className="-mt-2 flex flex-wrap gap-2">
              {marcas.map(([texto, marcada, alCambiar]) => (
                <button
                  key={texto}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => alCambiar(!marcada)}
                  className={`h-[34px] rounded-full border-[1.5px] px-3.5 text-nota font-semibold ${
                    marcada
                      ? 'border-tinta bg-tinta text-white'
                      : 'border-borde bg-white text-tinta'
                  }`}
                >
                  {marcada ? '✓' : '+'} {texto}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-linea pt-4">
              <span className="flex flex-col gap-0.5">
                <span className="text-apoyo font-bold">Mostrar el nombre de mi tienda</span>
                <span className="text-nota text-secundario">
                  {tiendaVisible
                    ? `Se verá «${tienda.nombre}»`
                    : 'Saldrás como «Tienda reservada», sin stand ni WhatsApp: te escriben solo por el chat.'}
                </span>
              </span>
              <Interruptor
                activo={tiendaVisible}
                alCambiar={setTiendaVisible}
                etiqueta="Mostrar el nombre de mi tienda"
              />
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1">
            <button
              type="submit"
              disabled={enviando || cargando}
              className={`inline-flex h-[54px] items-center rounded-full px-9 text-[17px] font-extrabold ${
                faltan.length === 0 && !subiendo ? 'bg-pase text-white' : 'bg-borde text-detalle'
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
            {faltan.length > 0 ? (
              <span className="rounded-full bg-aviso-fondo px-3 py-1.5 text-apoyo font-bold text-aviso">
                Te falta: {faltan.join(' y ')}
              </span>
            ) : (
              <span className="text-apoyo font-bold text-pase-texto">
                ¡Listo! Ya puedes publicar
              </span>
            )}
            <Link href="/mis-publicaciones" className="text-apoyo font-medium">
              Cancelar
            </Link>
          </div>
        </form>

        <VistaPrevia
          titulo={titulo}
          foto={fotoPrevia}
          categoria={categoriaPrevia}
          estado={[estadoVista, garantiaVista].filter(Boolean).join(' · ')}
          stock={stock}
          precio={principal ? precioDe(principal, moneda) : null}
          visible={quienVe !== 'NADIE'}
          soloSocios={quienVe === 'SOCIOS'}
          negociable={negociable}
          tiendaVisible={tiendaVisible}
          tienda={tienda}
          socio={quienVe !== 'NADIE' ? precioSocioTexto : null}
          enAlmacen={enAlmacen}
          variantes={variantesDeCategoria(categoriaElegida, variantes)}
        >
          <div className="flex flex-col gap-2.5 rounded-2xl border border-linea bg-white p-4">
            <span className="flex items-center justify-between gap-2">
              <b className="text-apoyo font-bold">Antes de publicar</b>
              <span className="text-nota font-bold text-pase-texto">
                {listos} de {checks.length} listos
              </span>
            </span>
            <span className="h-1.5 rounded-full bg-superficie">
              <span
                className="block h-full rounded-full bg-pase"
                style={{ width: `${Math.round((100 * listos) / checks.length)}%` }}
              />
            </span>
            {checks.map(([hecho, texto]) => (
              <span
                key={texto}
                className={`flex items-center gap-2 text-apoyo ${hecho ? '' : 'font-bold text-aviso'}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                    hecho ? 'bg-pase' : 'bg-contador'
                  }`}
                >
                  {hecho ? '✓' : '!'}
                </span>
                {texto}
                <span className="sr-only">{hecho ? ', listo' : ', falta'}</span>
              </span>
            ))}
          </div>
        </VistaPrevia>
      </div>
    </>
  );
}
