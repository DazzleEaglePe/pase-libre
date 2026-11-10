'use client';

import type { CategoriaResumen } from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useEnVivoMontado } from '@/features/en-vivo/contexto';
import { Buscador } from '@/shared/ui/buscador';
import { agruparCategorias, resumenCategorias } from '@/shared/ui/menu-categorias';

/**
 * Todas las categorías en una pantalla (CAT_Cel1): la cabecera verde con «volver» y el
 * buscador, el aviso de los pedidos en vivo y las categorías de cada grupo en dos columnas,
 * con cuántos productos hay. En el celular reemplaza a la barra del sitio.
 */
export function TodasLasCategorias({ categorias }: { categorias: CategoriaResumen[] }) {
  const router = useRouter();
  const enVivo = useEnVivoMontado();
  const pedidos = enVivo?.activo && enVivo.datos ? enVivo.datos.en_vivo.length : null;
  const grupos = agruparCategorias(categorias);

  return (
    <div className="-mx-4 -mt-5 flex flex-col sm:mx-0 sm:mt-0">
      <div className="flex flex-col gap-4 bg-marca px-4 pb-3.5 pt-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Volver"
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-seccion text-white">Todas las categorías</h1>
            <span className="text-nota text-white/90">{resumenCategorias(categorias)}</span>
          </div>
        </div>
        <Buscador sobreMarca />
      </div>

      <h1 className="text-titulo max-md:hidden">Todas las categorías</h1>
      <p className="mt-1 text-apoyo text-secundario max-md:hidden">
        {resumenCategorias(categorias)}
      </p>

      <div className="flex flex-col gap-6 px-4 pb-6 pt-3.5 sm:px-0 md:pt-6">
        {pedidos !== null && pedidos > 0 && (
          <Link
            href="/pedidos-en-vivo"
            className="flex items-center gap-3 rounded-2xl bg-tinta px-4 py-3.5 text-white no-underline md:max-w-[480px]"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 animate-latido rounded-full bg-vivo"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-cuerpo font-bold">
                {pedidos} {pedidos === 1 ? 'pedido en vivo' : 'pedidos en vivo'} ahora
              </b>
              <span className="text-nota text-white/85">
                Tiendas buscando algo que quizá tienes
              </span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {grupos.map(({ grupo, categorias: lista }) => (
          <section key={grupo} aria-label={grupo} className="flex flex-col">
            <h2 className="pb-1.5 text-etiqueta uppercase text-detalle">{grupo}</h2>
            <div className="grid grid-cols-2 gap-x-6 md:grid-cols-4">
              {lista.map((categoria) => (
                <Link
                  key={categoria.slug}
                  href={`/buscar?categoria=${categoria.slug}`}
                  className="flex min-h-[43px] items-start justify-between gap-3 py-2.5 text-cuerpo font-semibold text-tinta no-underline hover:text-pase-texto"
                >
                  <span className="min-w-0">{categoria.nombre}</span>
                  <span className="pt-px text-nota font-normal text-detalle">
                    {categoria.productos}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
