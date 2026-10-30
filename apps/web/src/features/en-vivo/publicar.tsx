'use client';

import {
  formatearPrecio,
  type CategoriaResumen,
  type DuracionEnVivo,
  type EnVivoPropio,
  type Moneda,
  type OfertaPropia,
  type RespuestaAlcanceEnVivo,
  type RespuestaMisOfertas,
  type RespuestaSugerencias,
  type SugerenciaProducto,
  type TiendaDeSesion,
  type TipoEnVivo,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, botonSecundario, campo, etiqueta } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Segmentado } from '@/shared/ui/segmentado';

import { EtiquetaTipo } from './piezas';

type Condicion = 'CUALQUIERA' | 'NUEVO' | 'USADO';

const DURACIONES: ReadonlyArray<readonly [DuracionEnVivo, string]> = [
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
 * Publicar un pase del día (EV_Publicar, RF-24, RF-72 y RF-73). El busco pide un producto
 * del catálogo o un texto («RTX 4060 o 5060, 8 GB»); el remate sale de una de tus
 * publicaciones. La vista previa dice a cuántas tiendas les llegará el aviso del busco.
 */
export function FormularioEnVivo({
  categorias,
  usuarioId,
  tienda,
}: {
  categorias: CategoriaResumen[];
  usuarioId: string;
  tienda: TiendaDeSesion;
}) {
  const id = useId();
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoEnVivo>('BUSCO');
  const [duracion, setDuracion] = useState<DuracionEnVivo>('3h');
  const [nota, setNota] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [moneda, setMoneda] = useState<Moneda>(tienda.moneda_defecto);
  const [monto, setMonto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busco.
  const [texto, setTexto] = useState('');
  const [producto, setProducto] = useState<SugerenciaProducto | null>(null);
  const [sugerencias, setSugerencias] = useState<SugerenciaProducto[]>([]);
  const [categoria, setCategoria] = useState('');
  const [condicion, setCondicion] = useState<Condicion>('CUALQUIERA');
  const [alcance, setAlcance] = useState<number | null>(null);

  // Oferta flash.
  const [filtro, setFiltro] = useState('');
  const [mias, setMias] = useState<OfertaPropia[] | null>(null);
  const [oferta, setOferta] = useState<OfertaPropia | null>(null);

  const textoDemorado = useDemorado(texto);
  useEffect(() => {
    if (tipo !== 'BUSCO' || producto || textoDemorado.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    let vigente = true;
    llamarApi<RespuestaSugerencias>(
      `/catalogo/sugerencias?q=${encodeURIComponent(textoDemorado.trim())}`,
    ).then(
      (r) => vigente && setSugerencias(r.productos.slice(0, 5)),
      () => vigente && setSugerencias([]),
    );
    return () => {
      vigente = false;
    };
  }, [tipo, producto, textoDemorado]);

  // «Les avisamos a N tiendas»: con el producto elegido, o con el texto y la categoría.
  useEffect(() => {
    if (tipo !== 'BUSCO') return;
    const consulta = producto
      ? `producto=${producto.id}`
      : textoDemorado.trim().length >= 3
        ? `q=${encodeURIComponent(textoDemorado.trim())}${categoria ? `&categoria=${categoria}` : ''}`
        : null;
    if (!consulta) {
      setAlcance(null);
      return;
    }
    let vigente = true;
    llamarApi<RespuestaAlcanceEnVivo>(`/en-vivo/alcance?${consulta}`).then(
      (r) => vigente && setAlcance(r.tiendas),
      () => vigente && setAlcance(null),
    );
    return () => {
      vigente = false;
    };
  }, [tipo, producto, textoDemorado, categoria]);

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

  function elegirOferta(elegida: OfertaPropia) {
    setOferta(elegida);
    setMoneda(elegida.moneda);
    setCantidad('1');
  }

  async function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    const comun = { duracion, nota, cantidad: Number(cantidad), moneda };
    const cuerpo =
      tipo === 'BUSCO'
        ? {
            tipo,
            ...comun,
            ...(producto ? { producto: producto.id } : { titulo: texto, categoria }),
            condicion: condicion === 'CUALQUIERA' ? null : condicion,
            presupuesto: monto,
          }
        : { tipo, ...comun, oferta: oferta?.id, precio: monto };
    try {
      const creado = await llamarApi<EnVivoPropio>('/en-vivo', { metodo: 'POST', cuerpo });
      router.push(`/pases-del-dia?id=${creado.id}`);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos publicarlo. Vuelve a intentarlo.');
      setEnviando(false);
    }
  }

  const titulo =
    tipo === 'BUSCO' ? (producto?.titulo ?? texto.trim()) : (oferta?.producto.titulo ?? '');
  const listo =
    tipo === 'BUSCO'
      ? Boolean(producto || (texto.trim().length >= 3 && categoria))
      : Boolean(oferta && monto.trim());

  return (
    <form
      onSubmit={(evento) => void publicar(evento)}
      className="mt-4 flex flex-wrap items-start gap-8"
    >
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <div>
          <h1 className="text-titulo">Publicar un pase del día</h1>
          <p className="text-secundario">
            Sale en la portada al instante y dura lo que elijas. Puedes tener hasta 3 a la vez.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-apoyo font-medium">¿Qué quieres publicar?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                [
                  'BUSCO',
                  'Busco un producto',
                  'Para un cliente que lo necesita hoy. Las tiendas que lo tienen te responden «¡Lo tengo!».',
                ],
                [
                  'FLASH',
                  'Remato',
                  'Vendes hoy a precio de pase. Las tiendas interesadas te responden «¡Lo quiero!».',
                ],
              ] as const
            ).map(([valor, nombre, ayuda]) => (
              <label
                key={valor}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${
                  tipo === valor ? 'border-tinta' : 'border-linea'
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
                  className="mt-1 h-4 w-4 accent-pase"
                />
                <span className="flex flex-col gap-0.5">
                  <b className="font-semibold">{nombre}</b>
                  <span className="text-apoyo text-secundario">{ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {tipo === 'BUSCO' ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-producto`} className="text-apoyo font-medium">
                Producto
              </label>
              {producto ? (
                <div className="flex items-center gap-3 rounded-xl border border-tinta p-2.5">
                  <Miniatura
                    ruta={producto.foto}
                    categoria={producto.categoria.slug}
                    className="h-10 w-12 rounded-lg"
                    glifo={34}
                    grosor={4}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-apoyo font-semibold">{producto.titulo}</b>
                    <span className="text-nota text-detalle">
                      Ya está en PaseLibre · {producto.categoria.nombre}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setProducto(null)}
                    className="h-9 text-apoyo font-medium underline"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id={`${id}-producto`}
                    value={texto}
                    onChange={(evento) => setTexto(evento.target.value)}
                    placeholder="RTX 4060 o 5060, 8 GB"
                    maxLength={120}
                    autoComplete="off"
                    className={campo}
                  />
                  {sugerencias.length > 0 && (
                    <ul className="flex flex-col rounded-xl border border-linea">
                      {sugerencias.map((s) => (
                        <li key={s.id} className="border-t border-linea first:border-t-0">
                          <button
                            type="button"
                            onClick={() => {
                              setProducto(s);
                              setCategoria(s.categoria.slug);
                            }}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-superficie"
                          >
                            <Miniatura
                              ruta={s.foto}
                              categoria={s.categoria.slug}
                              className="h-9 w-11 rounded-lg"
                              glifo={30}
                              grosor={4.5}
                            />
                            <span className="flex min-w-0 flex-col">
                              <b className="truncate text-apoyo font-semibold">{s.titulo}</b>
                              <span className="text-nota text-detalle">{s.categoria.nombre}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className="text-nota text-detalle">
                    Elige uno del catálogo o déjalo escrito. Si te sirve más de uno, escríbelo así:
                    «RTX 4060 o 5060, 8 GB».
                  </span>
                </>
              )}
            </div>
            {!producto && (
              <label className={etiqueta}>
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
            )}
            <div className="flex flex-wrap gap-5">
              <label className={`${etiqueta} w-28`}>
                Cantidad
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={cantidad}
                  onChange={(evento) => setCantidad(evento.target.value)}
                  className={campo}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-apoyo font-medium">Condición</span>
                <Segmentado
                  etiqueta="Condición"
                  valor={condicion}
                  alCambiar={setCondicion}
                  opciones={[
                    ['CUALQUIERA', 'Cualquiera'],
                    ['NUEVO', 'Nuevo'],
                    ['USADO', 'Usado'],
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-monto`} className="text-apoyo font-medium">
                Presupuesto máximo <span className="font-normal text-detalle">(opcional)</span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
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
                  placeholder="300"
                  className={`${campo} w-40`}
                />
              </div>
              <span className="text-nota text-detalle">
                Solo lo ven las tiendas con sesión. Sin presupuesto, te ofrecen su precio.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${id}-filtro`} className="text-apoyo font-medium">
                ¿Cuál de tus publicaciones?
              </label>
              <input
                id={`${id}-filtro`}
                value={filtro}
                onChange={(evento) => setFiltro(evento.target.value)}
                placeholder="Busca en tus publicaciones"
                className={campo}
              />
              {mias === null && <p className="text-apoyo text-secundario">Cargando…</p>}
              {mias?.length === 0 && (
                <p className="rounded-xl bg-superficie p-3 text-apoyo text-secundario">
                  No tienes publicaciones activas que atiendas tú.{' '}
                  <Link href="/publicar" className="font-semibold">
                    Publica una
                  </Link>{' '}
                  y vuelve.
                </p>
              )}
              <ul className="flex max-h-[320px] flex-col overflow-y-auto rounded-xl border border-linea empty:hidden">
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
                          ruta={o.producto.foto}
                          categoria={o.producto.categoria.slug}
                          className="h-9 w-11 rounded-lg"
                          glifo={30}
                          grosor={4.5}
                        />
                        <span className="flex min-w-0 flex-col">
                          <b className="truncate text-apoyo font-semibold">{o.producto.titulo}</b>
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
            <div className="flex flex-wrap gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-monto`} className="text-apoyo font-medium">
                  Precio de pase
                </label>
                <div className="flex flex-wrap items-center gap-3">
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
                    placeholder="465"
                    className={`${campo} w-40`}
                  />
                </div>
                <span className="text-nota text-detalle">
                  Sin sesión se ve «Precio con sesión».
                </span>
              </div>
              <label className={`${etiqueta} w-36`}>
                Unidades en oferta
                <input
                  type="number"
                  min={1}
                  max={oferta?.stock ?? 99}
                  value={cantidad}
                  onChange={(evento) => setCantidad(evento.target.value)}
                  className={campo}
                />
                <span className="text-nota font-normal text-detalle">«Vendido» las baja.</span>
              </label>
            </div>
          </>
        )}

        <label className={etiqueta}>
          <span>
            Nota <span className="font-normal text-detalle">(opcional, hasta 120 letras)</span>
          </span>
          <input
            value={nota}
            onChange={(evento) => setNota(evento.target.value)}
            maxLength={120}
            placeholder={
              tipo === 'BUSCO'
                ? 'Cliente esperando en el stand.'
                : 'Caja sellada, garantía de 1 año.'
            }
            className={campo}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-apoyo font-medium">¿Cuánto dura?</span>
          <Segmentado
            etiqueta="Cuánto dura"
            valor={duracion}
            alCambiar={setDuracion}
            opciones={DURACIONES}
          />
          <span className="text-nota text-detalle">
            «Hasta el cierre» es hasta las 8:00 p. m. Al vencer pasa a «Cerrados»; puedes volver a
            publicarlo.
          </span>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-error-fondo p-3 text-apoyo text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={!listo || enviando} className={botonPrincipal}>
            {enviando ? 'Publicando…' : 'Publicar'}
          </button>
          <Link href="/pases-del-dia" className={`${botonSecundario} no-underline`}>
            Cancelar
          </Link>
        </div>
      </div>

      <aside
        aria-label="Así se verá"
        className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl bg-superficie p-5"
      >
        <h2 className="text-etiqueta uppercase text-detalle">Así se verá</h2>
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-linea bg-white p-3.5">
          <EtiquetaTipo tipo={tipo} />
          <b className="text-tarjeta">
            {titulo || (tipo === 'BUSCO' ? 'Lo que buscas' : 'Tu publicación')}
          </b>
          {nota.trim() && <p className="text-apoyo text-secundario">{nota.trim()}</p>}
          <span className="text-nota text-detalle">
            {tienda.nombre} · {tienda.galeria ?? 'Independiente'}
            {Number(cantidad) > 1
              ? ` · ${cantidad} ${tipo === 'BUSCO' ? 'unidades' : 'disponibles'}`
              : ''}
          </span>
          <b className="border-t border-linea pt-2 text-cuerpo font-semibold">
            {monto.trim()
              ? `${tipo === 'BUSCO' ? 'Paga hasta ' : ''}${moneda === 'USD' ? 'US$' : 'S/'} ${monto.trim()}`
              : tipo === 'BUSCO'
                ? 'Sin presupuesto'
                : 'Precio de pase'}
          </b>
        </div>
        <h2 className="pt-2 text-etiqueta uppercase text-detalle">Quién lo verá</h2>
        <p className="text-apoyo text-secundario">
          Todas las tiendas, en la portada y en Pases del día.
          {tipo === 'BUSCO' &&
            alcance !== null &&
            (alcance === 0
              ? ' Ahora ninguna otra tienda tiene ese producto publicado con stock.'
              : ` Les avisamos a ${alcance === 1 ? 'la tienda que lo tiene' : `las ${alcance} tiendas que lo tienen`} publicado.`)}
        </p>
        <p className="text-apoyo text-secundario">
          Sin sesión se ve el producto, la galería y cuánto falta: sin tu tienda ni el precio.
        </p>
      </aside>
    </form>
  );
}
