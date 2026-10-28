'use client';

import {
  formatearPrecio,
  urlFoto,
  type Audiencia,
  type ProductoDetalle,
  type RespuestaContacto,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';
import { botonLista, botonPrincipal, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';

import type { OfertaVista } from './ofertas';
import { PrecioConSesion } from './precio-con-sesion';
import { textoEstado, textoStock } from './textos';

const lugarDe = (oferta: OfertaVista): string =>
  [oferta.galeria ?? 'Independiente', oferta.tienda?.stand && `Stand ${oferta.tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

/**
 * La ficha de un producto (F_Ficha): las fotos, la oferta que se está viendo con sus botones
 * y la tabla con todas las ofertas. Elegir otra oferta cambia el precio, el vendedor, las
 * fotos y la descripción. Contactar abre el chat o WhatsApp (RF-21, RF-23).
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

  const oferta = ofertas.find((candidata) => candidata.id === elegida) ?? null;
  const fotos = oferta && oferta.fotos.length > 0 ? oferta.fotos : producto.fotos;
  const fotoActual = fotos[Math.min(foto, fotos.length - 1)] ?? null;

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
    <div className="flex flex-col gap-12">
      <div className="flex flex-wrap items-start gap-10">
        <section
          aria-label="Fotos"
          className="flex min-w-0 flex-[1_1_520px] flex-col-reverse gap-3 sm:flex-row"
        >
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
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-[10px] border bg-superficie p-0 ${
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
              className="aspect-[4/3] w-full rounded-2xl"
              glifo={260}
              grosor={0.7}
            />
            {fotos.length > 1 && (
              <span className="absolute bottom-3.5 left-4 rounded-full bg-white/90 px-2.5 text-nota text-secundario">
                Foto {Math.min(foto, fotos.length - 1) + 1} de {fotos.length}
              </span>
            )}
          </div>
        </section>

        <section
          aria-label="Producto y oferta"
          className="flex min-w-0 flex-[1_1_380px] flex-col gap-5 lg:max-w-[460px]"
        >
          <div className="flex flex-col gap-2">
            <span className="text-nota text-detalle">
              {[producto.categoria.nombre, producto.marca].filter(Boolean).join(' · ')}
            </span>
            <h1 className="text-titulo">{producto.titulo}</h1>
            {producto.etiquetas.length > 0 && (
              <ul aria-label="Etiquetas" className="mt-1 flex list-none flex-wrap gap-1.5 p-0">
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
          </div>

          {oferta ? (
            <div className="flex flex-col gap-4 rounded-2xl border border-linea p-5">
              <span className="text-nota text-detalle">
                {textoEstado(oferta.condicion)} · {textoStock(oferta.stock)} · Actualizado{' '}
                {haceCuanto(oferta.actualizadaEn).toLowerCase()}
              </span>
              {oferta.precio ? (
                <div className="flex flex-col">
                  <span className="text-[32px] font-semibold leading-10 tracking-[-0.01em]">
                    {formatearPrecio(oferta.precio)}
                  </span>
                  <span className="text-nota text-detalle">
                    {oferta.precioVisible
                      ? 'Precio de pase'
                      : 'Precio de pase · está al interno: solo lo ves tú'}
                  </span>
                </div>
              ) : conSesion ? (
                <div className="flex flex-col">
                  <span className="text-[24px] font-semibold leading-8">Al interno</span>
                  <span className="text-nota text-detalle">
                    El vendedor da el precio por mensaje o WhatsApp
                  </span>
                </div>
              ) : (
                <PrecioConSesion className="text-[20px] leading-7" />
              )}

              <div className="flex items-center gap-3 border-t border-linea pt-4">
                {oferta.tienda && (
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tinta font-semibold text-white"
                  >
                    {(oferta.tienda.nombre.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase()}
                  </span>
                )}
                <span className="flex min-w-0 flex-col">
                  <b className="font-semibold">
                    {oferta.tienda
                      ? `${oferta.tienda.nombre}${oferta.propia ? ' (tú)' : ''}`
                      : `Tienda de ${oferta.galeria ?? 'independiente'}`}
                  </b>
                  <span className="text-nota text-detalle">
                    {oferta.tienda
                      ? lugarDe(oferta)
                      : `${oferta.galeria ? `Galería ${oferta.galeria}` : 'Independiente'} · el nombre y el stand se ven con sesión`}
                  </span>
                </span>
              </div>

              {audiencia === 'vendedor' && !oferta.propia && (
                <div className="flex flex-col gap-2.5">
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
                    className={`${botonSecundario} h-12 w-full gap-2`}
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
                    >
                      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
                      <path d="M9.2 8.8c0 3.4 2.6 6 6 6l1-1.6-2.1-1-1 .9c-.9-.4-1.7-1.2-2.1-2.1l.9-1-1-2.1z" />
                    </svg>
                    {contactando === 'WHATSAPP' ? 'Abriendo…' : 'WhatsApp'}
                  </button>
                  <span className="text-nota text-detalle">
                    WhatsApp se abre con un mensaje ya escrito sobre este producto.
                  </span>
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
            </div>
          ) : (
            <p className="rounded-2xl bg-superficie p-5 text-secundario">
              Por ahora ninguna tienda lo tiene publicado.
            </p>
          )}

          {audiencia === 'vendedor' && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col">
                <b className="font-semibold">¿Tienes este producto?</b>
                <span className="text-nota text-detalle">
                  Usa estas fotos y datos; solo pones estado, stock y precio.
                </span>
              </span>
              <Link
                href={`/publicar?igual=${producto.slug}`}
                className={`${botonLista} shrink-0 no-underline`}
              >
                Publicar uno igual
              </Link>
            </div>
          )}
        </section>
      </div>

      {ofertas.length > 0 && (
        <section aria-labelledby="ofertas" className="flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 pb-3">
            <h2 id="ofertas" className="text-seccion">
              Ofertas de este producto{' '}
              <span className="font-normal text-detalle">({ofertas.length})</span>
            </h2>
            <span className="text-nota text-detalle">
              {conSesion
                ? 'De menor a mayor precio. Las ofertas al interno van al final.'
                : 'De la más reciente a la más antigua.'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-linea text-nota font-semibold text-detalle">
                  <th className="h-10 pr-4 font-semibold">Vendedor</th>
                  <th className="pr-4 font-semibold">Galería</th>
                  <th className="pr-4 font-semibold">Estado</th>
                  <th className="pr-4 font-semibold">Stock</th>
                  <th className="pr-4 font-semibold">Precio</th>
                  <th className="w-[132px]">
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
                      className={`h-16 border-b border-linea ${viendo ? 'bg-superficie' : ''}`}
                    >
                      <td className={`pr-4 ${viendo ? 'font-semibold' : ''}`}>
                        {fila.tienda
                          ? `${fila.tienda.nombre}${fila.propia ? ' (tú)' : ''}`
                          : `Tienda de ${fila.galeria ?? 'independiente'}`}
                      </td>
                      <td className="pr-4 text-apoyo text-secundario">
                        {fila.galeria ?? 'Independiente'}
                      </td>
                      <td className="pr-4 text-apoyo text-secundario">
                        {textoEstado(fila.condicion)}
                      </td>
                      <td className="pr-4 text-apoyo text-secundario">{textoStock(fila.stock)}</td>
                      <td className="pr-4 font-semibold">
                        {fila.precio
                          ? formatearPrecio(fila.precio)
                          : conSesion
                            ? 'Al interno'
                            : 'Con sesión'}
                      </td>
                      <td>
                        {viendo ? (
                          <span className="flex w-[132px] justify-center text-apoyo font-medium text-secundario">
                            Viendo
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => elegir(fila.id)}
                            className={`${botonLista} w-[132px]`}
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

      <section aria-label="Detalle" className="flex flex-wrap gap-10 pt-2">
        <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-2.5">
          <h2 className="text-seccion">Descripción del vendedor</h2>
          <p className="max-w-[640px] whitespace-pre-line">
            {oferta?.descripcion || 'El vendedor no agregó una descripción.'}
          </p>
          {ofertas.length > 1 && (
            <span className="text-nota text-detalle">Cambia con la oferta que estás viendo.</span>
          )}
        </div>
        {Object.keys(producto.caracteristicas).length > 0 && (
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-2.5 lg:max-w-[460px]">
            <h2 className="text-seccion">Características</h2>
            <dl className="m-0 grid grid-cols-[140px_minmax(0,1fr)] text-apoyo">
              {Object.entries(producto.caracteristicas).map(([nombre, valor]) => (
                <div key={nombre} className="contents">
                  <dt className="border-b border-linea py-2.5 text-detalle">{nombre}</dt>
                  <dd className="m-0 border-b border-linea py-2.5">{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
  );
}
