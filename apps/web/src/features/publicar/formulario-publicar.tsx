'use client';

import {
  centimosDeMonto,
  formatearPrecio,
  MAX_DESCRIPCION,
  montoParaCampo,
  precioDe,
  tituloDeProducto,
  type ArchivoSubido,
  type Condicion,
  type Moneda,
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

import { BuscadorProducto, ProductoElegido } from './producto-catalogo';
import { PRODUCTO_NUEVO_VACIO, ProductoNuevo, type DatosProductoNuevo } from './producto-nuevo';
import { SelectorFotos } from './selector-fotos';
import { VistaPrevia } from './vista-previa';

type Modo = 'buscar' | 'igual' | 'nuevo';

const CONDICIONES = [
  ['NUEVO', 'Nuevo'],
  ['USADO', 'Usado'],
] as const;
const MONEDAS = [
  ['USD', 'US$'],
  ['PEN', 'S/'],
] as const;
const SIMBOLO: Record<Moneda, string> = { USD: 'US$', PEN: 'S/' };

interface ErrorPublicar {
  mensaje: string;
  /** El producto nuevo ya existía: se ofrece publicar uno igual. */
  producto?: { slug: string; titulo: string };
  /** La tienda ya tenía esa oferta. */
  oferta?: boolean;
}

function Seccion({
  titulo,
  opcional,
  derecha,
  children,
  ultima = false,
}: {
  titulo: string;
  opcional?: boolean;
  derecha?: ReactNode;
  children: ReactNode;
  ultima?: boolean;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col gap-4 py-7 first:pt-0 ${ultima ? '' : 'border-b border-linea'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-seccion">
          {titulo}
          {opcional && <span className="font-normal text-detalle"> (opcional)</span>}
        </h2>
        {derecha}
      </div>
      {children}
    </section>
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
 * Publicar (F_Publicar, F_MovilPublicar): 1. Producto, 2. Estado y stock, 3. Precio de
 * pase y 4. Descripción y fotos tuyas, con la vista previa «Así lo verán». Con `editar`
 * es la misma pantalla para cambiar una oferta desde Mis publicaciones.
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
  const [condicion, setCondicion] = useState<Condicion>('NUEVO');
  const [stock, setStock] = useState(1);
  const [moneda, setMoneda] = useState<Moneda>(tienda.moneda_defecto);
  const [monto, setMonto] = useState('');
  const [visible, setVisible] = useState(tienda.precio_visible_defecto);
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
    if (editar) {
      llamarApi<OfertaPropia>(`/ofertas/${encodeURIComponent(editar)}`)
        .then((oferta) => {
          setEditando(oferta);
          setCondicion(oferta.condicion);
          setStock(oferta.stock);
          setMoneda(oferta.moneda);
          setMonto(oferta.precio ? montoParaCampo(oferta.precio.centimos) : '');
          setVisible(oferta.precio_visible);
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
  const precioTexto = centimos ? formatearPrecio(precioDe(centimos, moneda)) : null;
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
    setVisible(tienda.precio_visible_defecto);
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
      condicion,
      stock,
      moneda,
      precio: monto,
      precio_visible: visible,
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
          stroke="#0B6B4A"
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

  return (
    <>
      <div className="mt-4 flex flex-col gap-1">
        <h1 className="text-titulo">{editar ? 'Editar publicación' : 'Publicar un producto'}</h1>
        <p className="text-secundario">
          {editar
            ? 'Los datos del producto son del catálogo; aquí cambias lo tuyo.'
            : 'Si ya está en PaseLibre, usas sus fotos y datos y solo pones lo tuyo: estado, stock y precio.'}
        </p>
      </div>

      <div className="mt-7 flex flex-wrap items-start gap-12">
        <form
          onSubmit={enviar}
          aria-busy={cargando}
          className="flex min-w-0 max-w-[760px] flex-[999_1_600px] flex-col"
        >
          <Seccion titulo="1. Producto">
            {cargando ? (
              <p className="text-secundario">Cargando…</p>
            ) : editando ? (
              <ProductoElegido producto={editando.producto} condicion={condicion} />
            ) : modo === 'igual' && elegido ? (
              <ProductoElegido
                producto={elegido}
                propias={elegido.propias}
                condicion={condicion}
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
            )}
          </Seccion>

          <Seccion titulo="2. Estado y stock">
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div className="flex flex-col gap-2">
                <span className="text-apoyo font-medium">Estado</span>
                <Segmentado
                  etiqueta="Estado"
                  opciones={CONDICIONES}
                  valor={condicion}
                  alCambiar={setCondicion}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-apoyo font-medium">Cantidad disponible</span>
                <Contador valor={stock} minimo={editando ? 0 : 1} alCambiar={setStock} />
              </div>
            </div>
          </Seccion>

          <Seccion
            titulo="3. Precio de pase"
            derecha={
              <span className="text-nota text-detalle">
                Por defecto: {tienda.precio_visible_defecto ? 'visible' : 'oculto'} y en{' '}
                {SIMBOLO[tienda.moneda_defecto]} ·{' '}
                <Link href="/cuenta/configuracion?seccion=preferencias" className="text-secundario">
                  cambiar en Configuración
                </Link>
              </span>
            }
          >
            <div className="flex flex-wrap items-end gap-4">
              <Segmentado
                etiqueta="Moneda"
                opciones={MONEDAS}
                valor={moneda}
                alCambiar={setMoneda}
              />
              <label htmlFor={`${id}-monto`} className={etiqueta}>
                Monto
                <span className="flex h-12 w-[220px] items-center overflow-hidden rounded-xl border border-borde focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
                  <span className="pl-3.5 pr-1 font-medium text-secundario">{SIMBOLO[moneda]}</span>
                  <input
                    id={`${id}-monto`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={monto}
                    onChange={(evento) => setMonto(evento.target.value)}
                    placeholder="0"
                    className="h-full min-w-0 flex-1 bg-transparent pl-1 pr-3.5 text-cuerpo font-normal placeholder:text-detalle focus-visible:outline-none"
                  />
                </span>
              </label>
            </div>
            {monto.trim() !== '' && centimos === null && (
              <p className="text-nota text-error">
                Escribe el monto con números, por ejemplo 250 o 1699.90.
              </p>
            )}
            <div
              role="radiogroup"
              aria-label="Quién ve el precio"
              className="flex flex-col gap-2.5"
            >
              {(
                [
                  [
                    false,
                    'Al interno (oculto)',
                    'Nadie ve el precio: te lo consultan por mensaje o WhatsApp.',
                  ],
                  [true, 'Visible para vendedores con sesión', 'Los visitantes nunca ven precios.'],
                ] as const
              ).map(([valor, tituloOpcion, descripcionOpcion]) => {
                const elegida = visible === valor;
                return (
                  <button
                    key={String(valor)}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => setVisible(valor)}
                    className={`grid w-full grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 rounded-xl border bg-white px-4 py-3.5 text-left ${
                      elegida ? 'border-tinta' : 'border-linea'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-px h-5 w-5 rounded-full ${
                        elegida
                          ? 'border-[6px] border-tinta'
                          : 'border-[1.5px] border-borde-control'
                      }`}
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-semibold">{tituloOpcion}</span>
                      <span className="text-apoyo text-secundario">{descripcionOpcion}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Seccion>

          <Seccion titulo="4. Descripción y fotos tuyas" opcional ultima>
            <label htmlFor={`${id}-descripcion`} className={etiqueta}>
              Descripción
              <textarea
                id={`${id}-descripcion`}
                rows={4}
                maxLength={MAX_DESCRIPCION}
                value={descripcion}
                onChange={(evento) => setDescripcion(evento.target.value)}
                placeholder="Garantía, tiempo de uso, si incluye caja o cables…"
                className={`${campo} h-auto resize-y py-3`}
              />
              <span className="self-end text-nota font-normal text-detalle">
                {descripcion.length} / {MAX_DESCRIPCION}
              </span>
            </label>
            <SelectorFotos
              variante="mosaico"
              titulo="Fotos tuyas"
              ayuda="Recomendado si es usado: una foto del producto real y otra de la caja."
              fotos={fotos}
              alCambiar={setFotos}
              alCargar={setSubiendoPropias}
            />
          </Seccion>

          {error && (
            <div
              role="alert"
              className="mb-3 flex flex-col items-start gap-2 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
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
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-linea pt-5">
            <button
              type="submit"
              disabled={enviando || cargando}
              className={`inline-flex h-12 items-center rounded-full px-8 text-cuerpo font-semibold text-white ${
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
          condicion={condicion}
          stock={stock}
          precio={precioTexto}
          visible={visible}
          tienda={tienda}
        />
      </div>
    </>
  );
}
