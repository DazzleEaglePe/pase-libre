'use client';

import {
  formatearPrecio,
  type ProductoEnLista,
  type ProductoEnListaConPrecio,
} from '@paselibre/contracts';
import { IconBell, IconCheck, IconChevronRight, IconSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Miniatura } from '@/shared/ui/miniatura';

const conPrecio = (
  producto: ProductoEnLista | ProductoEnListaConPrecio,
): producto is ProductoEnListaConPrecio => 'oferta_destacada' in producto;

/** «Desde US$ 1 150 · 2 tiendas»; sin sesión, «3 ofertas». */
function resumen(producto: ProductoEnLista | ProductoEnListaConPrecio): string {
  const { cantidad } = producto.ofertas;
  const tiendas = cantidad === 1 ? '1 tienda' : `${cantidad} tiendas`;
  if (!conPrecio(producto)) return cantidad === 1 ? '1 oferta' : `${cantidad} ofertas`;
  const desde = producto.ofertas.precios_desde[0];
  return desde ? `Desde ${formatearPrecio(desde)} · ${tiendas}` : tiendas;
}

/**
 * Nadie tiene lo que buscaste (EV_WebRes, BUS_WebVacio): pedirlo en vivo, «Avísame cuando
 * alguien la publique» y lo parecido que sí hay. Nunca un callejón sin salida.
 */
export function SinResultados({
  q,
  nombreCategoria,
  categoria,
  conSesion,
  conBusco,
  parecidas,
}: {
  q: string;
  nombreCategoria: string | null;
  categoria: string | null;
  conSesion: boolean;
  /** El equipo no publica busco. */
  conBusco: boolean;
  parecidas: Array<ProductoEnLista | ProductoEnListaConPrecio>;
}) {
  const [alerta, setAlerta] = useState<'nada' | 'guardando' | 'lista'>('nada');
  const [error, setError] = useState<string | null>(null);
  const consulta = new URLSearchParams({ que: q, ...(categoria ? { categoria } : {}) }).toString();

  async function avisame() {
    setAlerta('guardando');
    setError(null);
    try {
      await llamarApi('/cuenta/alertas', { metodo: 'POST', cuerpo: { texto: q } });
      setAlerta('lista');
    } catch (falla) {
      setAlerta('nada');
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar tu alerta.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 max-md:hidden">
        <span className="text-apoyo text-secundario">Resultados para</span>
        <h1 className="text-[28px] font-bold leading-9">
          «{q}» · 0 publicaciones{nombreCategoria ? ` en ${nombreCategoria}` : ''}
        </h1>
      </div>

      <section className="flex flex-col items-center gap-4 rounded-3xl border border-linea px-5 py-10 text-center sm:px-10">
        <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-superficie text-tinta">
          <IconSearch size={34} stroke={1.8} aria-hidden="true" />
        </span>
        <h2 className="text-[24px] font-bold leading-8">Nadie tiene «{q}» publicada ahora</h2>
        <p className="m-0 max-w-[460px] text-cuerpo text-secundario">
          Pero alguna tienda de la galería puede tenerla en su almacén. Pídela en vivo y te
          responden en minutos.
        </p>

        {conBusco && (
          <div className="flex w-full max-w-[420px] flex-col gap-2.5">
            <Link
              href={conSesion ? `/pedidos-en-vivo/publicar?${consulta}` : '/ingresar'}
              className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-contador text-[16px] font-bold text-tinta no-underline"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-tinta" />
              Pedirla en vivo
            </Link>
            <span className="text-nota text-secundario">
              Les avisamos al instante a las tiendas que venden {nombreCategoria ?? 'lo que buscas'}
              .
            </span>
            {conSesion &&
              (alerta === 'lista' ? (
                <span
                  role="status"
                  className="flex h-[50px] items-center justify-center gap-2 rounded-full bg-pase-suave font-bold text-marca"
                >
                  <IconCheck size={18} stroke={2.2} aria-hidden="true" />
                  Te avisamos en la campanita
                </span>
              ) : (
                <button
                  type="button"
                  disabled={alerta === 'guardando'}
                  onClick={() => void avisame()}
                  className="flex h-[50px] items-center justify-center gap-2 rounded-full border border-borde bg-white font-bold text-tinta disabled:opacity-60"
                >
                  <IconBell size={18} stroke={1.8} aria-hidden="true" />
                  Avísame cuando alguien la publique
                </button>
              ))}
            {error && (
              <p role="alert" className="m-0 text-apoyo text-error">
                {error}
              </p>
            )}
          </div>
        )}

        {parecidas.length > 0 && (
          <div className="flex w-full max-w-[600px] flex-col gap-2.5 pt-3 text-left">
            <b className="text-cuerpo font-bold">Parecidas que sí hay</b>
            <ul className="m-0 grid list-none gap-2.5 p-0 sm:grid-cols-2">
              {parecidas.map((producto) => (
                <li key={producto.slug}>
                  <Link
                    href={`/p/${producto.slug}`}
                    className="flex items-center gap-3 rounded-2xl border border-linea p-3 text-tinta no-underline hover:border-borde"
                  >
                    <Miniatura
                      ruta={producto.foto}
                      categoria={producto.categoria.slug}
                      className="h-11 w-14 shrink-0 rounded-lg"
                      glifo={36}
                      grosor={4}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="truncate text-apoyo font-bold">{producto.titulo}</b>
                      <span className="text-nota text-secundario">{resumen(producto)}</span>
                    </span>
                    <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Se corrigió lo escrito («rtx 5090» → «rtx 5060»): por si buscaba justo eso, pedirlo en vivo o
 * que le avisen cuando alguien lo publique.
 */
export function ExactoNoHay({ q, conSesion }: { q: string; conSesion: boolean }) {
  const [alerta, setAlerta] = useState(false);
  if (!conSesion) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-apoyo text-secundario">
      ¿Era justo «{q}»? Nadie la tiene publicada.
      <Link
        href={`/pedidos-en-vivo/publicar?que=${encodeURIComponent(q)}`}
        className="font-bold text-pase-texto"
      >
        Pedirla en vivo
      </Link>
      {alerta ? (
        <span role="status" className="font-bold text-marca">
          Te avisamos en la campanita
        </span>
      ) : (
        <button
          type="button"
          onClick={() =>
            void llamarApi('/cuenta/alertas', { metodo: 'POST', cuerpo: { texto: q } }).then(
              () => setAlerta(true),
              () => undefined,
            )
          }
          className="font-bold text-pase-texto underline"
        >
          Avísame cuando alguien la publique
        </button>
      )}
    </p>
  );
}
