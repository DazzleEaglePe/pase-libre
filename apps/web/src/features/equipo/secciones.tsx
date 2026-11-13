'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

/** «☀ Claro» / «☾ Oscuro» (COR17, COR18): se guarda en tu cuenta. */
export function BotonTema({ oscuro }: { oscuro: boolean }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  return (
    <button
      type="button"
      disabled={guardando}
      aria-pressed={oscuro}
      onClick={async () => {
        setGuardando(true);
        try {
          await llamarApi('/equipo/preferencias', {
            metodo: 'PUT',
            cuerpo: { tema_oscuro: !oscuro },
          });
          router.refresh();
        } finally {
          setGuardando(false);
        }
      }}
      className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/25 px-3.5 text-apoyo font-bold text-white hover:bg-white/10"
    >
      {oscuro ? (
        <IconSun size={17} stroke={1.8} aria-hidden="true" />
      ) : (
        <IconMoon size={17} stroke={1.8} aria-hidden="true" />
      )}
      {oscuro ? 'Claro' : 'Oscuro'}
    </button>
  );
}

/**
 * Las pestañas del panel del equipo (ADM_Web): Inicio, Solicitudes, Reportes, Tiendas,
 * Galerías (docs/18 §3), Chats, Comunicados, Cuentas y Catálogo, con los numeritos de lo que
 * espera. Van en el segundo piso de la barra, en una fila de todo el ancho (doc 20, punto 6).
 * En pantallas angostas la fila se desliza de costado y frena al borde de una pestaña: ninguna
 * queda cortada a la mitad sin poder llegar a ella. La pestaña abierta se muestra entera.
 */
export function SeccionesDelPanel({
  solicitudes,
  reportes,
  chats,
  catalogo,
  galerias,
}: {
  solicitudes: number;
  reportes: number;
  chats: number;
  catalogo: number;
  /** Avisos «Galería nueva: …» sin resolver. */
  galerias: number;
}) {
  const ruta = usePathname();
  const fila = useRef<HTMLElement>(null);
  const secciones = [
    { href: '/equipo', texto: 'Inicio', cuenta: 0 },
    { href: '/equipo/solicitudes', texto: 'Solicitudes', cuenta: solicitudes },
    { href: '/equipo/reportes', texto: 'Reportes', cuenta: reportes },
    { href: '/equipo/tiendas', texto: 'Tiendas', cuenta: 0 },
    { href: '/equipo/galerias', texto: 'Galerías', cuenta: galerias },
    { href: '/equipo/chats', texto: 'Chats', cuenta: chats },
    { href: '/equipo/comunicados', texto: 'Comunicados', cuenta: 0 },
    { href: '/equipo/cuentas', texto: 'Cuentas', cuenta: 0 },
    { href: '/equipo/catalogo', texto: 'Catálogo', cuenta: catalogo },
  ];

  // En el celular, la pestaña abierta (por ejemplo «Catálogo», la última) queda a la vista.
  useEffect(() => {
    const nav = fila.current;
    const actual = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !actual || nav.scrollWidth <= nav.clientWidth) return;
    const caja = nav.getBoundingClientRect();
    const pestana = actual.getBoundingClientRect();
    if (pestana.left < caja.left || pestana.right > caja.right) {
      nav.scrollLeft += pestana.left - caja.left - 16;
    }
  }, [ruta]);

  return (
    <nav
      ref={fila}
      aria-label="Panel del equipo"
      className="-mx-4 flex snap-x gap-1 overflow-x-auto scroll-px-4 px-4 py-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 [scrollbar-width:none]"
    >
      {secciones.map(({ href, texto, cuenta }) => {
        const actual = href === '/equipo' ? ruta === '/equipo' : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actual ? 'page' : undefined}
            className={`flex h-10 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-apoyo no-underline md:px-4 ${
              actual
                ? 'pildora-activa bg-white font-bold text-tinta'
                : 'font-medium text-white hover:bg-white/10'
            }`}
          >
            {texto}
            {cuenta > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
                {cuenta}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
