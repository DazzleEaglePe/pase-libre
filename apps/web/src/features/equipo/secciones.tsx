'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * La barra negra del panel del equipo (ADM_Web): Inicio, Solicitudes, Reportes, Tiendas, Chats,
 * Comunicados y Cuentas, con los numeritos de lo que espera.
 */
export function SeccionesDelPanel({
  solicitudes,
  reportes,
  chats,
}: {
  solicitudes: number;
  reportes: number;
  chats: number;
}) {
  const ruta = usePathname();
  const secciones = [
    { href: '/equipo', texto: 'Inicio', cuenta: 0 },
    { href: '/equipo/solicitudes', texto: 'Solicitudes', cuenta: solicitudes },
    { href: '/equipo/reportes', texto: 'Reportes', cuenta: reportes },
    { href: '/equipo/tiendas', texto: 'Tiendas', cuenta: 0 },
    { href: '/equipo/chats', texto: 'Chats', cuenta: chats },
    { href: '/equipo/comunicados', texto: 'Comunicados', cuenta: 0 },
    { href: '/equipo/cuentas', texto: 'Cuentas', cuenta: 0 },
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
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-apoyo no-underline ${
              actual ? 'bg-white font-bold text-tinta' : 'font-medium text-white hover:bg-white/10'
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
