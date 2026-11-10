'use client';

import {
  formatearPrecio,
  TIENDA_RESERVADA,
  urlFoto,
  type Audiencia,
  type Precio,
  type ProductoDetalle,
  type RespuestaContacto,
} from '@paselibre/contracts';
import { IconBrandWhatsapp, IconChevronRight, IconMessageCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';
import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { BotonCompartir } from '@/shared/ui/boton-compartir';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { MenuOpciones } from '@/features/reportes/menu-opciones';
import { useReservarAbajo } from '@/shared/ui/reservar-abajo';

import type { OfertaVista } from './ofertas';
import { PrecioConSesion } from './precio-con-sesion';
import { textoEstado, textoStock } from './textos';

/** «responde en ~10 min» o «~2 h», redondeado: es una idea, no un reloj. */
const respondeEn = (minutos: number): string =>
  minutos < 60 ? `responde en ~${minutos} min` : `responde en ~${Math.round(minutos / 60)} h`;

const lugarDe = (oferta: OfertaVista): string =>
  [
    oferta.galeria ?? 'Independiente',
    oferta.tienda?.stand && `Stand ${oferta.tienda.stand}`,
    oferta.respondeEnMin !== null && respondeEn(oferta.respondeEnMin),
  ]
    .filter(Boolean)
    .join(' · ');

const nombreDe = (oferta: OfertaVista): string =>
  oferta.tienda
    ? `${oferta.tienda.nombre}${oferta.propia ? (oferta.tiendaVisible ? ' (tú)' : ' (tú · reservada)') : ''}`
    : `Tienda de ${oferta.galeria ?? 'independiente'}`;

/** La tienda no quiso mostrar su nombre: se lee en cursiva, como en el lienzo. */
const esReservada = (oferta: OfertaVista): boolean => oferta.tienda?.nombre === TIENDA_RESERVADA;

/** «CS» para «Computer Shock», «A» para «Tienda A»; «·» si no se ve la tienda. */
const inicialDe = (oferta: OfertaVista): string =>
  oferta.tienda && !esReservada(oferta)
    ? oferta.tienda.nombre
        .replace(/^tienda\s+/i, '')
        .split(/\s+/)
        .slice(0, 2)
        .map((palabra) => palabra[0] ?? '')
        .join('')
        .toUpperCase() || '·'
    : '·';

const disponibles = (stock: number) => (stock === 0 ? 'Sin stock' : textoStock(stock));

/** El precio visible más bajo, en la moneda pedida (o en cualquiera, si no hay una). */
function masBarata(ofertas: OfertaVista[], moneda?: Precio['moneda']): OfertaVista | null {
  return ofertas.reduce<OfertaVista | null>((mejor, oferta) => {
    if (!oferta.precio || (moneda && oferta.precio.moneda !== moneda)) return mejor;
    if (!mejor?.precio || oferta.precio.centimos < mejor.precio.centimos) return oferta;
    return mejor;
  }, null);
}

function Avatar({ oferta, chico = false }: { oferta: OfertaVista; chico?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white ${
        chico ? 'h-9 w-9 text-apoyo' : 'h-[42px] w-[42px] text-apoyo font-bold'
      }`}
    >
      {inicialDe(oferta)}
    </span>
  );
}

/**
 * La ficha de un producto (D_Ficha, M_Ficha): las fotos con sus miniaturas; a la derecha el
 * producto y la caja de la oferta que se mira (estado, precio de pase, stock, la tienda y
 * «Chatear ahora»); «¿Tienes este producto?»; «Las tiendas que lo tienen» y las
 * características. Elegir otra tienda cambia el precio, la tienda, las fotos y la descripción.
 * Contactar abre el chat o WhatsApp (RF-21, RF-23).
 *
 * Lo de la fase 2 que muestra el lienzo (pedir pase, favoritos, seguir, reputación y
 * preguntas) no aparece hasta que exista.
 */
export function FichaProducto({
  producto,
  ofertas,
  audiencia,
  ofertaPedida = null,
}: {
  producto: ProductoDetalle;
  ofertas: OfertaVista[];
  audiencia: Audiencia;
  /** `?oferta=` (desde un chat o un aviso): se abre esa; si ya no está, «Ya no está disponible». */
  ofertaPedida?: string | null;
}) {
  const router = useRouter();
  const conSesion = audiencia !== 'visitante';
  const [elegida, setElegida] = useState(
    () =>
      ofertas.find((oferta) => oferta.id === ofertaPedida)?.id ??
      (ofertas.find((oferta) => !oferta.propia) ?? ofertas[0])?.id ??
      null,
  );
  // EV_WebAgot: la publicación que se pidió se vendió o la quitaron (o ya no queda ninguna).
  const noDisponible =
    ofertas.length === 0 ||
    (ofertaPedida !== null && !ofertas.some((oferta) => oferta.id === ofertaPedida));
  const [foto, setFoto] = useState(0);
  const [contactando, setContactando] = useState<'CHAT' | 'WHATSAPP' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oferta = ofertas.find((candidata) => candidata.id === elegida) ?? null;
  const fotos = oferta && oferta.fotos.length > 0 ? oferta.fotos : producto.fotos;
  const fotoActual = fotos[Math.min(foto, fotos.length - 1)] ?? null;

  const caracteristicas = Object.entries(producto.caracteristicas);

  const mejor = masBarata(ofertas);
  function elegir(id: string) {
    setElegida(id);
    setFoto(0);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // La barra fija de abajo (celular): para quien puede escribir y para el visitante.
  const barraAbajo = oferta !== null && !oferta.propia && audiencia !== 'equipo';
  useReservarAbajo(84, barraAbajo);

  async function contactar(canal: 'CHAT' | 'WHATSAPP') {
    if (!oferta) return;
    setContactando(canal);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaContacto>(`/ofertas/${oferta.id}/contacto`, {
        metodo: 'POST',
        cuerpo: { canal },
      });
      if (respuesta.canal === 'CHAT') router.push(`/mensajes/${respuesta.conversacion_id}`);
      else window.open(respuesta.enlace, '_blank', 'noopener,noreferrer');
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos abrir el contacto.');
    } finally {
      setContactando(null);
    }
  }

  const otras = ofertas.filter((otra) => otra.id !== oferta?.id);
  const desdeOtras = masBarata(otras, oferta?.precio?.moneda);
  const esLaMasBarata =
    conSesion && ofertas.length > 1 && oferta !== null && oferta.id === mejor?.id;
  const conPublicarIgual = audiencia === 'vendedor' && !oferta?.propia;

  const precioGrande = oferta ? (
    oferta.precio ? (
      <span className="flex h-[52px] items-center rounded-full bg-tinta px-[18px] text-[28px] font-bold leading-none text-white">
        {formatearPrecio(oferta.precio)}
      </span>
    ) : conSesion ? (
      <span className="text-[24px] font-bold leading-8">Al interno</span>
    ) : (
      <PrecioConSesion className="text-[20px] font-bold leading-7" />
    )
  ) : null;

  const botonesContacto =
    oferta && audiencia === 'vendedor' && !oferta.propia ? (
      <div className="flex gap-2.5">
        <button
          type="button"
          disabled={contactando !== null}
          onClick={() => contactar('CHAT')}
          className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-pase-medio text-[16px] font-bold text-marca hover:bg-[#c3efd6] disabled:opacity-60"
        >
          <IconMessageCircle size={20} stroke={1.8} aria-hidden="true" />
          {contactando === 'CHAT' ? 'Abriendo…' : 'Chatear ahora'}
        </button>
        {oferta.tiendaVisible && (
          <button
            type="button"
            disabled={contactando !== null}
            onClick={() => contactar('WHATSAPP')}
            aria-label="Escribir por WhatsApp"
            className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full border border-borde bg-white px-5 text-cuerpo font-semibold text-tinta hover:border-borde-control max-md:w-[52px] max-md:px-0"
          >
            <IconBrandWhatsapp size={22} stroke={1.6} aria-hidden="true" className="text-ok" />
            <span className="max-md:hidden">
              {contactando === 'WHATSAPP' ? 'Abriendo…' : 'WhatsApp'}
            </span>
          </button>
        )}
      </div>
    ) : null;

  // «Más opciones» (REP_Web): reportar la publicación y, si se ve la tienda, bloquearla.
  const menuOpciones = (sobreMarca: boolean) =>
    oferta && audiencia === 'vendedor' && !oferta.propia ? (
      <MenuOpciones
        sobreMarca={sobreMarca}
        objeto="OFERTA"
        objetoId={oferta.id}
        sobre={`Publicación · ${producto.modelo ?? producto.titulo}`}
        tienda={oferta.tienda?.id ? { id: oferta.tienda.id, nombre: oferta.tienda.nombre } : null}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-12 max-md:gap-5">
      {/* En el celular, la cabecera propia de M_Ficha: volver, la categoría y compartir. */}
      <CabeceraMovil titulo={producto.categoria.nombre}>
        <BotonCompartir titulo={producto.titulo} soloIcono />
        {menuOpciones(true)}
      </CabeceraMovil>

      <div className="grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_480px]">
        {/* Fotos: las miniaturas a la izquierda y la foto grande (D_Ficha). */}
        <section aria-label="Fotos" className="flex min-w-0 gap-3">
          {fotos.length > 1 && (
            <div
              role="tablist"
              aria-label="Fotos"
              aria-orientation="vertical"
              className="flex flex-col gap-2 max-md:hidden"
            >
              {fotos.map((miniatura, indice) => (
                <button
                  key={miniatura.ruta}
                  type="button"
                  role="tab"
                  aria-selected={indice === foto}
                  aria-label={`Foto ${indice + 1} de ${fotos.length}`}
                  onClick={() => setFoto(indice)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-superficie p-0 ${
                    indice === foto ? 'border-2 border-tinta' : 'border border-linea'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlFoto(miniatura.ruta)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          <div className="relative min-w-0 flex-1">
            <Miniatura
              ruta={fotoActual?.ruta ?? null}
              categoria={producto.categoria.slug}
              className="aspect-[4/3] w-full rounded-[20px] max-md:aspect-[358/240]"
              glifo={240}
              grosor={0.8}
              prioridad
            />
            {fotos.length > 1 && (
              <>
                <span className="absolute bottom-4 left-4 text-nota text-secundario max-md:hidden">
                  Foto {Math.min(foto, fotos.length - 1) + 1} de {fotos.length}
                </span>
                <button
                  type="button"
                  aria-label={`Foto ${Math.min(foto, fotos.length - 1) + 1} de ${fotos.length}, ver la siguiente`}
                  onClick={() => setFoto((foto + 1) % fotos.length)}
                  className="absolute bottom-3 right-3 rounded-full bg-white px-2.5 text-nota font-semibold leading-6 text-tinta md:hidden"
                >
                  {Math.min(foto, fotos.length - 1) + 1} / {fotos.length}
                </button>
              </>
            )}
          </div>
        </section>

        <section aria-label="Producto" className="flex min-w-0 flex-col gap-4">
          {noDisponible && (
            <div role="status" className="flex flex-col gap-1 rounded-2xl bg-aviso-fondo px-4 py-3">
              <b className="text-cuerpo font-bold text-aviso">Ya no está disponible</b>
              <span className="text-apoyo text-secundario">
                {ofertas.length > 0
                  ? `Esa publicación se vendió o la quitaron. Lo bueno: ${
                      ofertas.length === 1
                        ? 'otra tienda la tiene'
                        : `otras ${ofertas.length} tiendas la tienen`
                    }.`
                  : 'Se vendió o la quitaron, y ahora ninguna otra tienda la tiene publicada.'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 max-md:hidden">
            <span className="text-nota text-secundario">
              {[producto.categoria.nombre, producto.marca].filter(Boolean).join(' · ')}
            </span>
            <span className="flex items-center gap-2">
              <BotonCompartir titulo={producto.titulo} />
              {menuOpciones(false)}
            </span>
          </div>
          {oferta && (
            <span className="text-apoyo text-secundario md:hidden">
              <b className="font-semibold text-tinta">{textoEstado(oferta.condicion)}</b> ·
              Actualizado {haceCuanto(oferta.actualizadaEn).toLowerCase()}
            </span>
          )}
          <h1 className="text-[30px] font-bold leading-[38px] tracking-[-0.01em] max-md:text-[24px] max-md:leading-8">
            {producto.titulo}
          </h1>
          {producto.etiquetas.length > 0 && (
            <ul
              aria-label="Etiquetas"
              className="flex list-none flex-wrap gap-1.5 p-0 max-md:order-last"
            >
              {producto.etiquetas.map((etiqueta) => (
                <li
                  key={etiqueta}
                  className="rounded-full bg-superficie px-2.5 text-nota leading-6 text-secundario"
                >
                  {etiqueta}
                </li>
              ))}
            </ul>
          )}

          {oferta ? (
            <div className="flex flex-col gap-4 rounded-[20px] border border-linea p-[22px] max-md:border-0 max-md:p-0">
              <span className="text-nota text-secundario max-md:hidden">
                <b className="font-semibold text-tinta">{textoEstado(oferta.condicion)}</b> ·
                Actualizado {haceCuanto(oferta.actualizadaEn).toLowerCase()}
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                {precioGrande}
                {esLaMasBarata && (
                  <span className="rounded-full bg-contador px-2 text-[12px] font-bold leading-[22px] text-tinta">
                    Más barato
                  </span>
                )}
                {oferta.precio && (
                  <span className="text-apoyo text-secundario">
                    {oferta.precioVisible ? 'Precio de pase' : 'Al interno: solo lo ves tú'}
                  </span>
                )}
              </div>
              {!conSesion && (
                <span className="-mt-1 text-nota text-secundario">
                  El precio y la tienda se ven al iniciar sesión.
                </span>
              )}
              <span
                className={`flex items-center gap-2 text-apoyo font-semibold ${oferta.stock > 0 ? 'text-tinta' : 'text-aviso'}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${oferta.stock > 0 ? 'bg-pase' : 'bg-aviso'}`}
                />
                {disponibles(oferta.stock)}
              </span>

              <div className="flex items-center gap-3 border-t border-linea pt-4">
                <Avatar oferta={oferta} />
                <span className="flex min-w-0 flex-col">
                  {oferta.tienda?.id && !oferta.propia ? (
                    <Link
                      href={`/tiendas/${oferta.tienda.id}`}
                      aria-label={`${nombreDe(oferta)}: ver el perfil y las opiniones de la tienda`}
                      className="font-bold text-tinta no-underline hover:underline"
                    >
                      {nombreDe(oferta)}
                      <span className="font-normal text-pase-texto md:hidden"> · ver perfil</span>
                    </Link>
                  ) : (
                    <b className={`font-bold ${esReservada(oferta) ? 'italic' : ''}`}>
                      {nombreDe(oferta)}
                    </b>
                  )}
                  <span className="text-nota text-secundario">
                    {oferta.tienda
                      ? lugarDe(oferta)
                      : `Galería ${oferta.galeria ?? 'independiente'} · el nombre y el stand se ven con sesión`}
                  </span>
                </span>
              </div>

              {/* M_Ficha: «3 tiendas más lo tienen · desde US$ 245». */}
              {otras.length > 0 && (
                <a
                  href="#tiendas"
                  className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-linea px-4 text-apoyo text-tinta no-underline md:hidden"
                >
                  <span>
                    <b className="font-bold">
                      {otras.length === 1
                        ? '1 tienda más lo tiene'
                        : `${otras.length} tiendas más lo tienen`}
                    </b>
                    {desdeOtras?.precio && ` · desde ${formatearPrecio(desdeOtras.precio)}`}
                  </span>
                  <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
                </a>
              )}

              <div className="max-md:hidden">{botonesContacto}</div>
              {error && (
                <p role="alert" className="text-apoyo text-error">
                  {error}
                </p>
              )}
              {oferta.propia && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-apoyo text-secundario">
                    Esta es tu oferta. Las demás tiendas ven los botones para escribirte
                    {oferta.tiendaVisible ? '.' : ', y a tu tienda como «Tienda reservada».'}
                  </span>
                  <Link
                    href="/mis-publicaciones"
                    className={`${botonSecundario} h-12 w-full no-underline`}
                  >
                    Editar en Mis publicaciones
                  </Link>
                </div>
              )}
              {audiencia === 'equipo' && (
                <span className="text-apoyo text-secundario">
                  Con la cuenta del equipo se mira, pero no se contacta: eso es de las tiendas.
                </span>
              )}
              {!conSesion && (
                <Link
                  href="/ingresar"
                  className={`${botonPrincipal} h-[52px] w-full no-underline max-md:hidden`}
                >
                  Inicia sesión para contactar
                </Link>
              )}
              {audiencia === 'vendedor' && !oferta.propia && !oferta.tiendaVisible && (
                <span className="text-nota text-secundario">
                  Esta tienda prefirió no mostrar su nombre: atiende solo por el chat de PaseLibre.
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-[20px] border border-linea p-[22px]">
              <span className="text-apoyo text-secundario">
                Ninguna tienda lo tiene publicado ahora. Pídelo en vivo: alguna puede tenerlo en su
                almacén.
              </span>
              {audiencia === 'vendedor' && (
                <Link
                  href={`/pedidos-en-vivo/publicar?que=${encodeURIComponent(producto.titulo)}&categoria=${producto.categoria.slug}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-contador font-bold text-tinta no-underline"
                >
                  <span aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta" />
                  Pedirlo en vivo
                </Link>
              )}
            </div>
          )}

          {oferta?.descripcion && (
            <div className="flex flex-col gap-1.5 md:hidden">
              <h2 className="text-tarjeta font-bold">Descripción del vendedor</h2>
              <p className="whitespace-pre-line text-apoyo text-secundario">{oferta.descripcion}</p>
            </div>
          )}

          {conPublicarIgual && (
            <Link
              href={`/publicar?igual=${producto.slug}`}
              className="flex items-center justify-between gap-3 rounded-2xl bg-pase-suave px-[18px] py-3.5 text-tinta no-underline hover:bg-pase-medio"
            >
              <span className="flex flex-col">
                <b className="text-cuerpo font-bold">¿Tienes este producto?</b>
                <span className="text-nota text-secundario">
                  Publica uno igual con estas fotos
                  <span className="max-md:hidden">: solo pones estado, stock y precio</span>.
                </span>
              </span>
              <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
            </Link>
          )}
        </section>
      </div>

      {ofertas.length > 0 && (
        <section
          id="tiendas"
          aria-labelledby="titulo-tiendas"
          className="flex scroll-mt-40 flex-col gap-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="titulo-tiendas" className="text-[22px] font-bold leading-8">
              Las tiendas que lo tienen{' '}
              <span className="font-normal text-secundario">({ofertas.length})</span>
            </h2>
            <span className="text-nota text-secundario">
              {conSesion
                ? 'Del más barato al más caro; las que están al interno, al final.'
                : 'De la más reciente a la más antigua.'}
            </span>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-apoyo">
              <thead>
                <tr className="text-nota font-semibold text-secundario">
                  <th className="h-11 pr-4 font-semibold">Tienda</th>
                  <th className="pr-4 font-semibold">Galería</th>
                  <th className="pr-4 font-semibold">Estado</th>
                  <th className="pr-4 font-semibold">Stock</th>
                  <th className="pr-4 font-semibold">Precio</th>
                  <th className="w-[140px]">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((fila) => {
                  const viendo = fila.id === elegida;
                  return (
                    <tr
                      key={fila.id}
                      className={`h-16 border-t border-linea ${viendo ? 'bg-pase-suave' : ''}`}
                    >
                      <td
                        className={`pr-4 ${viendo ? 'font-bold' : ''} ${esReservada(fila) ? 'italic' : ''}`}
                      >
                        {nombreDe(fila)}
                      </td>
                      <td className="pr-4 text-secundario">{fila.galeria ?? 'Independiente'}</td>
                      <td className="pr-4 text-secundario">{textoEstado(fila.condicion)}</td>
                      <td className="pr-4">
                        <span className="flex items-center gap-2 font-semibold">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${fila.stock > 0 ? 'bg-pase' : 'bg-aviso'}`}
                          />
                          {disponibles(fila.stock)}
                        </span>
                      </td>
                      <td className="pr-4">
                        {fila.precio ? (
                          <span className="inline-flex h-7 items-center rounded-full bg-tinta px-3 font-bold text-white">
                            {formatearPrecio(fila.precio)}
                          </span>
                        ) : (
                          <span className="font-semibold">
                            {conSesion ? 'Al interno' : 'Con sesión'}
                          </span>
                        )}
                      </td>
                      <td className="pr-2 text-right">
                        {viendo ? (
                          <span className="pr-5 font-semibold text-pase-texto">Viendo</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => elegir(fila.id)}
                            className="h-9 rounded-full border border-borde bg-white px-4 font-semibold text-tinta hover:border-borde-control"
                          >
                            Ver oferta
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section
        aria-label="Descripción y características"
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]"
      >
        <div id="descripcion" className="flex min-w-0 scroll-mt-40 flex-col gap-3 max-md:hidden">
          <h2 className="text-seccion">Descripción de la tienda</h2>
          <p className="max-w-[640px] whitespace-pre-line text-secundario">
            {oferta?.descripcion || 'La tienda no agregó una descripción.'}
          </p>
          {ofertas.length > 1 && (
            <span className="text-nota text-detalle">Cambia con la oferta que estás viendo.</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-seccion">Características</h2>
          <dl className="m-0 grid grid-cols-[minmax(110px,0.3fr)_minmax(0,1fr)]">
            {[
              ...(producto.marca ? [['Marca', producto.marca] as const] : []),
              ...(producto.modelo ? [['Modelo', producto.modelo] as const] : []),
              ...caracteristicas,
              ['Categoría', producto.categoria.nombre] as const,
            ].map(([nombre, valor]) => (
              <div key={nombre} className="contents">
                <dt className="border-b border-linea py-3 text-apoyo text-secundario">{nombre}</dt>
                <dd className="m-0 border-b border-linea py-3 text-apoyo">{valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* En el celular, contactar queda siempre a mano abajo (M_Ficha). */}
      {barraAbajo && oferta && (
        <>
          <div aria-hidden="true" className="h-20 md:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-white px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-3 md:hidden">
            {conSesion ? (
              botonesContacto
            ) : (
              <Link
                href="/ingresar"
                className="inline-flex h-[52px] w-full items-center justify-center rounded-full bg-pase text-[16px] font-bold text-white no-underline"
              >
                Inicia sesión para contactar
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
