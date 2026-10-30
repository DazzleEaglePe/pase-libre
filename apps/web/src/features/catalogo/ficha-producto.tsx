'use client';

import {
  formatearPrecio,
  urlFoto,
  type Audiencia,
  type Precio,
  type ProductoDetalle,
  type RespuestaContacto,
} from '@paselibre/contracts';
import { IconBrandWhatsapp, IconFlag } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';
import { botonLista, botonPrincipal, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

import type { OfertaVista } from './ofertas';
import { PrecioConSesion } from './precio-con-sesion';
import { textoEstado, textoStock } from './textos';

/** Viñetas de «Lo que tienes que saber»: las primeras líneas de lo que escribió el vendedor. */
const VINETAS = 4;

const lugarDe = (oferta: OfertaVista): string =>
  [oferta.galeria ?? 'Independiente', oferta.tienda?.stand && `Stand ${oferta.tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

const nombreDe = (oferta: OfertaVista): string =>
  oferta.tienda
    ? `${oferta.tienda.nombre}${oferta.propia ? ' (tú)' : ''}`
    : `Tienda de ${oferta.galeria ?? 'independiente'}`;

/** «A» para «Tienda A»; «?» para el visitante, que no ve la tienda. */
const inicialDe = (oferta: OfertaVista): string =>
  oferta.tienda ? (oferta.tienda.nombre.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase() : '?';

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
        chico ? 'h-9 w-9 text-apoyo' : 'h-11 w-11'
      }`}
    >
      {inicialDe(oferta)}
    </span>
  );
}

/**
 * La ficha de un producto, con la estructura de B_Producto en Hielo: fotos, el producto con
 * su precio y «Lo que tienes que saber», la caja para contactar con el vendedor, la tabla de
 * otras ofertas y los detalles. Elegir otra oferta cambia el precio, el vendedor, las fotos y
 * la descripción. Contactar abre el chat o WhatsApp (RF-21, RF-23).
 *
 * Lo de la fase 2 que muestra el lienzo (pedir pase, favoritos, seguir, reputación y
 * preguntas) no aparece hasta que exista.
 */
export function FichaProducto({
  producto,
  ofertas,
  audiencia,
}: {
  producto: ProductoDetalle;
  ofertas: OfertaVista[];
  audiencia: Audiencia;
}) {
  const router = useRouter();
  const conSesion = audiencia !== 'visitante';
  const [elegida, setElegida] = useState(
    () => (ofertas.find((oferta) => !oferta.propia) ?? ofertas[0])?.id ?? null,
  );
  const [foto, setFoto] = useState(0);
  const [contactando, setContactando] = useState<'CHAT' | 'WHATSAPP' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denunciando, setDenunciando] = useState(false);

  const oferta = ofertas.find((candidata) => candidata.id === elegida) ?? null;
  const fotos = oferta && oferta.fotos.length > 0 ? oferta.fotos : producto.fotos;
  const fotoActual = fotos[Math.min(foto, fotos.length - 1)] ?? null;

  const lineas = (oferta?.descripcion ?? '')
    .split('\n')
    .map((linea) => linea.replace(/^[-•*·]\s*/, '').trim())
    .filter(Boolean);
  const caracteristicas = Object.entries(producto.caracteristicas);
  const vinetas =
    lineas.length > 0
      ? lineas.slice(0, VINETAS)
      : caracteristicas.slice(0, VINETAS).map(([nombre, valor]) => `${nombre}: ${valor}`);

  const mejor = masBarata(ofertas);
  const otraMasBarata = oferta
    ? masBarata(
        ofertas.filter((otra) => otra.id !== oferta.id),
        oferta.precio?.moneda,
      )
    : null;
  const conviene =
    otraMasBarata?.precio &&
    (!oferta?.precio || otraMasBarata.precio.centimos < oferta.precio.centimos)
      ? otraMasBarata
      : null;
  const vendedores = conSesion
    ? new Set(ofertas.map((o) => o.tienda?.nombre)).size
    : ofertas.length;

  function elegir(id: string) {
    setElegida(id);
    setFoto(0);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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

  return (
    <div className="flex flex-col gap-14">
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(300px,0.85fr)] lg:gap-10">
        {/* Fotos: las miniaturas a la izquierda y la foto grande. */}
        <section aria-label="Fotos" className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row">
          {fotos.length > 1 && (
            <div
              role="tablist"
              aria-label="Fotos"
              aria-orientation="vertical"
              className="flex gap-2 sm:flex-col"
            >
              {fotos.map((miniatura, indice) => (
                <button
                  key={miniatura.ruta}
                  type="button"
                  role="tab"
                  aria-selected={indice === foto}
                  aria-label={`Foto ${indice + 1} de ${fotos.length}`}
                  onClick={() => setFoto(indice)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-superficie p-0 ${
                    indice === foto ? 'border-2 border-tinta' : 'border-linea'
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
              className="aspect-square w-full rounded-[20px]"
              glifo={240}
              grosor={0.8}
            />
            {fotos.length > 1 && (
              <span className="absolute bottom-3.5 left-4 rounded-full bg-white/90 px-2.5 text-nota text-secundario">
                Foto {Math.min(foto, fotos.length - 1) + 1} de {fotos.length}
              </span>
            )}
          </div>
        </section>

        {/* El producto: estado, título, precio y lo que hay que saber. */}
        <section aria-label="Producto" className="flex min-w-0 flex-col gap-4">
          <span className="text-apoyo text-secundario">
            {oferta
              ? `${textoEstado(oferta.condicion)} · Actualizado ${haceCuanto(oferta.actualizadaEn).toLowerCase()}`
              : [producto.categoria.nombre, producto.marca].filter(Boolean).join(' · ')}
          </span>
          <h1 className="text-[30px] font-semibold leading-[38px] tracking-[-0.01em]">
            {producto.titulo}
          </h1>
          {producto.etiquetas.length > 0 && (
            <ul aria-label="Etiquetas" className="flex list-none flex-wrap gap-1.5 p-0">
              {producto.etiquetas.map((etiqueta) => (
                <li
                  key={etiqueta}
                  className="rounded-full bg-superficie px-2.5 text-nota leading-5 text-secundario"
                >
                  {etiqueta}
                </li>
              ))}
            </ul>
          )}

          {oferta && (
            <div className="flex flex-col gap-1">
              {oferta.precio ? (
                <span className="text-[40px] font-semibold leading-[48px] tracking-[-0.02em]">
                  {formatearPrecio(oferta.precio)}
                </span>
              ) : conSesion ? (
                <span className="text-[28px] font-semibold leading-9">Al interno</span>
              ) : (
                <PrecioConSesion className="text-[22px] leading-8" />
              )}
              <span className="text-apoyo text-secundario">
                {oferta.precio
                  ? `Precio de pase de ${nombreDe(oferta)}${oferta.precioVisible ? '' : ' · está al interno: solo lo ves tú'}`
                  : conSesion
                    ? 'El vendedor da el precio por mensaje o WhatsApp'
                    : 'El precio y la tienda se ven al iniciar sesión'}
                {conviene?.precio && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      onClick={() => elegir(conviene.id)}
                      className="font-semibold text-tinta underline"
                    >
                      hay otra desde {formatearPrecio(conviene.precio)}
                    </button>
                  </>
                )}
              </span>
            </div>
          )}

          {vinetas.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">
              <h2 className="text-tarjeta">Lo que tienes que saber</h2>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-secundario marker:text-detalle">
                {vinetas.map((vineta) => (
                  <li key={vineta}>{vineta}</li>
                ))}
              </ul>
              {lineas.length > VINETAS && (
                <a href="#descripcion" className="text-apoyo font-semibold">
                  Ver la descripción completa
                </a>
              )}
            </div>
          )}
        </section>

        {/* La caja de contacto (a la derecha en la computadora). */}
        <aside
          aria-label="Contactar al vendedor"
          className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-linea p-5 md:col-span-2 lg:col-span-1"
        >
          {oferta ? (
            <>
              <b className={`text-tarjeta ${oferta.stock > 0 ? 'text-ok' : 'text-aviso'}`}>
                {disponibles(oferta.stock)}
              </b>

              {audiencia === 'vendedor' && !oferta.propia && (
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    disabled={contactando !== null}
                    onClick={() => contactar('CHAT')}
                    className={`${botonPrincipal} h-12 w-full`}
                  >
                    {contactando === 'CHAT' ? 'Abriendo…' : 'Enviar mensaje'}
                  </button>
                  <button
                    type="button"
                    disabled={contactando !== null}
                    onClick={() => contactar('WHATSAPP')}
                    className="inline-flex h-11 items-center justify-center gap-2 text-apoyo font-semibold text-ok underline disabled:text-detalle"
                  >
                    <IconBrandWhatsapp size={18} stroke={1.5} aria-hidden="true" />
                    {contactando === 'WHATSAPP' ? 'Abriendo WhatsApp…' : 'Escribir por WhatsApp'}
                  </button>
                  {error && (
                    <p role="alert" className="text-apoyo text-error">
                      {error}
                    </p>
                  )}
                </div>
              )}
              {oferta.propia && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-apoyo text-secundario">
                    Esta es tu oferta. Los demás vendedores ven los botones para escribirte.
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
                <div className="flex flex-col gap-2.5">
                  <Link href="/ingresar" className={`${botonPrincipal} h-12 w-full no-underline`}>
                    Inicia sesión para contactar
                  </Link>
                  <span className="text-nota text-detalle">
                    Con tu cuenta ves el precio, la tienda y el stand. Las cuentas las entrega el
                    equipo de PaseLibre.
                  </span>
                </div>
              )}

              <p className="text-nota text-detalle">
                PaseLibre no cobra ni intermedia: el pase se coordina entre ustedes.
              </p>

              <div className="flex items-center gap-3 border-t border-linea pt-4">
                <Avatar oferta={oferta} />
                <span className="flex min-w-0 flex-col">
                  <b className="font-semibold">{nombreDe(oferta)}</b>
                  <span className="text-nota text-detalle">
                    {oferta.tienda ? lugarDe(oferta) : 'El nombre y el stand se ven con sesión'}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-secundario">Por ahora ninguna tienda lo tiene publicado.</p>
          )}
        </aside>
      </div>

      {ofertas.length > 0 && (
        <section aria-labelledby="ofertas" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 id="ofertas" className="text-[24px] font-semibold leading-8">
              Otras ofertas de este producto
            </h2>
            <span className="text-apoyo text-secundario">
              {conSesion
                ? `Lo ${vendedores === 1 ? 'tiene 1 vendedor' : `tienen ${vendedores} vendedores`}${mejor?.precio ? ` · desde ${formatearPrecio(mejor.precio)}` : ''}`
                : `${ofertas.length === 1 ? '1 oferta' : `${ofertas.length} ofertas`} · los precios se ven con sesión`}
            </span>
          </div>
          <div className="overflow-x-auto rounded-[20px] border border-linea">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="bg-superficie text-nota font-semibold text-secundario">
                  <th className="h-12 px-5 font-semibold">Vendedor</th>
                  <th className="pr-4 font-semibold">Estado</th>
                  <th className="pr-4 font-semibold">Disponibles</th>
                  <th className="pr-4 font-semibold">Precio</th>
                  <th className="w-[160px] pr-5">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ofertas.map((fila) => {
                  const viendo = fila.id === elegida;
                  const esMejor = conSesion && fila.id === mejor?.id && ofertas.length > 1;
                  return (
                    <tr
                      key={fila.id}
                      className={`border-t border-linea ${viendo ? 'bg-pase-suave' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-3">
                          <Avatar oferta={fila} chico />
                          <span className="flex min-w-0 flex-col">
                            <b className="font-semibold">{nombreDe(fila)}</b>
                            <span className="text-nota text-detalle">{lugarDe(fila)}</span>
                          </span>
                        </span>
                      </td>
                      <td className="pr-4">{textoEstado(fila.condicion)}</td>
                      <td className="pr-4">{disponibles(fila.stock)}</td>
                      <td className="pr-4">
                        <span className="flex flex-col">
                          <b className="text-tarjeta">
                            {fila.precio
                              ? formatearPrecio(fila.precio)
                              : conSesion
                                ? 'Al interno'
                                : 'Con sesión'}
                          </b>
                          {viendo ? (
                            <span className="text-nota font-semibold text-pase">
                              Estás viendo esta
                            </span>
                          ) : (
                            esMejor && (
                              <span className="text-nota font-semibold text-ok">Mejor precio</span>
                            )
                          )}
                        </span>
                      </td>
                      <td className="pr-5 text-right">
                        {!viendo && (
                          <button
                            type="button"
                            onClick={() => elegir(fila.id)}
                            className={`${botonLista} w-[140px]`}
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
          <span className="text-nota text-detalle">
            {conSesion
              ? 'De menor a mayor precio. Las ofertas al interno van al final.'
              : 'De la más reciente a la más antigua.'}
          </span>
        </section>
      )}

      <section aria-label="Descripción y detalles" className="grid gap-10 lg:grid-cols-2">
        <div id="descripcion" className="flex min-w-0 scroll-mt-28 flex-col gap-3">
          <h2 className="text-[24px] font-semibold leading-8">Descripción del vendedor</h2>
          <p className="max-w-[640px] whitespace-pre-line text-secundario">
            {oferta?.descripcion || 'El vendedor no agregó una descripción.'}
          </p>
          {ofertas.length > 1 && (
            <span className="text-nota text-detalle">Cambia con la oferta que estás viendo.</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-[24px] font-semibold leading-8">Detalles</h2>
          <dl className="m-0 grid grid-cols-[minmax(120px,0.4fr)_minmax(0,1fr)] border-t border-linea">
            {[
              ...(producto.marca ? [['Marca', producto.marca] as const] : []),
              ...(producto.modelo ? [['Modelo', producto.modelo] as const] : []),
              ...caracteristicas,
              ['Categoría', producto.categoria.nombre] as const,
            ].map(([nombre, valor]) => (
              <div key={nombre} className="contents">
                <dt className="border-b border-linea py-3 text-secundario">{nombre}</dt>
                <dd className="m-0 border-b border-linea py-3">{valor}</dd>
              </div>
            ))}
          </dl>
          {oferta && (
            <span className="flex flex-wrap items-center gap-x-1.5 text-nota text-detalle">
              Publicación actualizada {haceCuanto(oferta.actualizadaEn).toLowerCase()}
              {audiencia === 'vendedor' && !oferta.propia && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setDenunciando(true)}
                    className="inline-flex items-center gap-1 underline"
                  >
                    <IconFlag size={14} stroke={1.5} aria-hidden="true" />
                    Denunciar
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      </section>

      {denunciando && oferta && (
        <VentanaDenuncia ofertaId={oferta.id} alCerrar={() => setDenunciando(false)} />
      )}
    </div>
  );
}

/** Denunciar la oferta que se está viendo (RF-29): el motivo va a la cola del equipo. */
function VentanaDenuncia({ ofertaId, alCerrar }: { ofertaId: string; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await llamarApi('/denuncias', {
        metodo: 'POST',
        cuerpo: { objeto: 'OFERTA', objeto_id: ofertaId, motivo },
      });
      setEnviada(true);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos enviar la denuncia.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Ventana titulo="Denunciar esta publicación" abierta alCerrar={alCerrar}>
      {enviada ? (
        <>
          <p className="text-secundario">Gracias. El equipo de PaseLibre la va a revisar.</p>
          <button type="button" onClick={alCerrar} className={botonSecundario}>
            Cerrar
          </button>
        </>
      ) : (
        <form onSubmit={(evento) => void enviar(evento)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-apoyo font-medium">
            ¿Qué pasa con esta publicación?
            <textarea
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Ya no la tienen, el precio no es real, es otro producto…"
              className="rounded-xl border border-borde px-3.5 py-2.5 text-cuerpo font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="text-apoyo text-error">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={alCerrar} className={botonSecundario}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando || motivo.trim().length < 5}
              className={botonPrincipal}
            >
              {enviando ? 'Enviando…' : 'Enviar denuncia'}
            </button>
          </div>
        </form>
      )}
    </Ventana>
  );
}
