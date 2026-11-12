'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

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
 * La barra negra del panel del equipo (ADM_Web): Inicio, Solicitudes, Reportes, Tiendas,
 * Galerías (docs/18 §3), Chats, Comunicados y Cuentas, con los numeritos de lo que espera.
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
  return (
    <nav
      aria-label="Panel del equipo"
      className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]"
    >
      {secciones.map(({ href, texto, cuenta }) => {
        const actual = href === '/equipo' ? ruta === '/equipo' : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={actual ? 'page' : undefined}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-apoyo no-underline 2xl:px-4 ${
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
